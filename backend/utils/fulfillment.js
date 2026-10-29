import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import {Rider,DeliveryTask,RiderPayout,CampusAlert,StockWatch,PickupCounter} from '../models/campusModels.js';
import {shopOpen,campusClock} from '../../shared/fulfillment.js';
import {money,lateDeduction} from './marketplace.js';
export async function updateOrderTotals(id){
 // A pipeline recomputes from the current groups, so two simultaneous shop completions cannot overwrite one another.
 await Order.updateOne({_id:id},[{$set:{_live:{$filter:{input:'$shopOrders',as:'g',cond:{$ne:['$$g.status','cancelled']}}}}},{$set:{itemsPrice:{$sum:'$_live.itemsPrice'},shippingPrice:{$sum:'$_live.shippingPrice'},discount:{$sum:'$_live.discount'},isDelivered:{$and:[{$gt:[{$size:'$_live'},0]},{$allElementsTrue:[{$map:{input:'$_live',as:'g',in:{$eq:['$$g.isDelivered',true]}}}]}]},status:{$cond:[{$eq:[{$size:'$_live'},0]},'cancelled','placed']}}},{$set:{totalPrice:{$round:[{$subtract:[{$add:['$itemsPrice','$shippingPrice']},'$discount']},2]},isPaid:'$isDelivered',status:{$cond:['$isDelivered','completed','$status']},deliveredAt:{$cond:['$isDelivered',{$max:'$_live.deliveredAt'},null]},paidAt:{$cond:['$isDelivered',{$max:'$_live.deliveredAt'},null]}}},{$unset:'_live'}]);
}
export async function fulfillTask(task){
 if(task.status!=='delivered')return;
 const order=await Order.findById(task.order),g=order?.shopOrders.id(task.group);if(!g)return;
 await Order.updateOne({_id:order._id,shopOrders:{$elemMatch:{_id:g._id,isDelivered:false,status:{$ne:'cancelled'}}}},{$set:{'shopOrders.$.status':'delivered','shopOrders.$.isDelivered':true,'shopOrders.$.deliveredAt':task.deliveredAt,'shopOrders.$.rider':task.rider,'shopOrders.$.riderName':task.riderName,'shopOrders.$.deduction':lateDeduction(g,task.deliveredAt)}});
 await updateOrderTotals(order._id);await Rider.updateOne({_id:task.rider},{$pull:{slots:task.slotToken}});await DeliveryTask.updateOne({_id:task._id,status:'delivered'},{$set:{settledAt:new Date()}});
}
async function restoreCancelled(orderId,groupId){
 const order=await Order.findById(orderId),g=order?.shopOrders.id(groupId);if(!g||g.status!=='cancelled'||g.stockRestoredAt)return;
 for(const i of g.items){const marker=String(g._id);await Product.updateOne({_id:i.product,stockRestores:{$ne:marker}},{$inc:{countInStock:i.qty},$addToSet:{stockRestores:marker}});}
 await DeliveryTask.updateOne({_id:String(order._id)+':'+String(g._id),status:{$in:['available','accepted']}},{$set:{status:'cancelled'}});
 await updateOrderTotals(order._id);await Order.updateOne({_id:order._id,'shopOrders._id':g._id},{$set:{'shopOrders.$.stockRestoredAt':new Date()}});
}
async function releaseGroup(order,g){
 const shop=await User.findById(g.shopkeeper);
 if(g.status==='scheduled'){
  const missed=Date.now()>new Date(g.scheduledFor).getTime()+15*60000;
  if(!shop||shop.status!=='active'||missed||!shopOpen(shop.shopSettings,new Date())){
   await Order.updateOne({_id:order._id,'shopOrders':{$elemMatch:{_id:g._id,status:'scheduled'}}},{$set:{'shopOrders.$.status':'cancelled','shopOrders.$.cancelReason':missed?'The delivery slot was missed.':'The shop was closed when preparation was due.'}});await restoreCancelled(order._id,g._id);return;
  }
  await Order.updateOne({_id:order._id,shopOrders:{$elemMatch:{_id:g._id,status:'scheduled'}}},{$set:{'shopOrders.$.status':'preparing',status:'placed'}});
 }
 if(!g.pickupToken){
  const day=campusClock(g.releaseAt||new Date()).date;
  const count=await PickupCounter.findOneAndUpdate({_id:String(g.shopkeeper)+':'+day},{$inc:{value:1}},{upsert:true,new:true});
  const token=day.replaceAll('-','')+'-'+String(count.value).padStart(3,'0');
  await Order.updateOne({_id:order._id,shopOrders:{$elemMatch:{_id:g._id,pickupToken:{$exists:false},status:{$in:['preparing','ready']}}}},{$set:{'shopOrders.$.pickupToken':token}});
 }
 const fresh=await Order.findById(order._id),current=fresh.shopOrders.id(g._id);if(!['preparing','ready','picked_up','delivered'].includes(current.status))return;
 if(current.deliveryMode==='rider'){
  await DeliveryTask.updateOne({_id:String(order._id)+':'+String(g._id)},{$setOnInsert:{order:order._id,group:g._id,shopkeeper:g.shopkeeper,shopName:g.shopName,pickupToken:current.pickupToken}},{upsert:true});
 }
 await CampusAlert.updateOne({_id:'order:'+String(g._id)},{$setOnInsert:{user:g.shopkeeper,kind:'order',title:'New CampusCart order',body:'A new COD order is waiting in your deliveries.',url:'/admin/orders',orderId:String(order._id)}},{upsert:true});
 await Order.updateOne({_id:order._id,'shopOrders._id':g._id},{$set:{'shopOrders.$.releaseProcessedAt':new Date()}});
}
export async function processFulfillment(id){
 const filter={workflowVersion:2,...(id?{_id:id}:{}),shopOrders:{$elemMatch:{isDelivered:false,$or:[{status:'scheduled'},{status:'cancelled',stockRestoredAt:{$exists:false}},{status:{$in:['preparing','ready']},releaseProcessedAt:{$exists:false}}]}}};
 for await(const order of Order.find(filter).cursor()){
  for(const g of order.shopOrders){
   if(g.status==='cancelled'){await restoreCancelled(order._id,g._id);continue;}
   if(g.isDelivered||g.status==='picked_up'||g.releaseProcessedAt)continue;
   if(g.status==='scheduled'&&new Date(g.releaseAt)>new Date())continue;
   await releaseGroup(order,g);
  }
 }
 for await(const task of DeliveryTask.find({status:'delivered',settledAt:{$exists:false}}).cursor())await fulfillTask(task);
 // Reconcile slot reservations after interrupted claims; never free a slot for an active assignment.
 for await(const rider of Rider.find({'slots.0':{$exists:true}}).cursor())for(const key of rider.slots){
  const task=await DeliveryTask.findById(key.split('|')[0]);
  if(!task||['delivered','cancelled'].includes(task.status)||(task.slotToken&&task.slotToken!==key)||(task.rider&&String(task.rider)!==String(rider._id)))await Rider.updateOne({_id:rider._id},{$pull:{slots:key}});
  else if(task.status==='available'&&!task.rider&&Date.now()-rider.updatedAt.getTime()>120000)await Rider.updateOne({_id:rider._id,updatedAt:rider.updatedAt},{$pull:{slots:key}});
 }
 for await(const watch of StockWatch.find({fulfilled:false}).cursor()){
  const p=await Product.findOne({_id:watch.product,countInStock:{$gt:0},printOwner:{$exists:false}}).populate('shopkeeper');if(!p||p.shopkeeper?.status!=='active')continue;
  await CampusAlert.updateOne({_id:'stock:'+String(watch._id)},{$setOnInsert:{user:watch.user,kind:'stock',title:'Back in stock',body:(p.name||'Your saved item')+' is available again.',url:'/product/'+p._id}},{upsert:true});
  await StockWatch.updateOne({_id:watch._id},{$set:{fulfilled:true}});
 }
 for await(const payout of RiderPayout.find({status:'preparing'}).cursor())await preparePayout(payout);
}
export async function preparePayout(payout){
 await DeliveryTask.updateMany({rider:payout.rider,status:'delivered',deliveredAt:{$gte:payout.weekStart,$lt:payout.weekEnd},payout:{$exists:false}},{$set:{payout:payout._id}});
 const tasks=await DeliveryTask.find({payout:payout._id});
 await RiderPayout.updateOne({_id:payout._id,status:'preparing'},{$set:{amount:money(tasks.reduce((sum,t)=>sum+t.reward,0)),status:'prepared'}});
}
export function startFulfillment(){let running=false;const tick=async()=>{if(running)return;running=true;try{await processFulfillment();}catch(e){console.warn('Fulfillment will retry:',e.message);}finally{running=false;}};const timer=setInterval(tick,15000);timer.unref();tick();}

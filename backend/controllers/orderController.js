import {itemNote} from '../utils/itemNote.js';
import {normalizePhone} from '../../shared/phone.js';
import {applyCoupon,fulfillmentFor,reserveCoupon,newDeliveryCode} from '../utils/campusCheckout.js';
import {withRiders} from '../utils/riderView.js';
import {processFulfillment,updateOrderTotals} from '../utils/fulfillment.js';
import {workerIdentity} from '../utils/workerIdentity.js';
import {settleCheckout,recoverAbandonedCheckout} from '../utils/checkoutRecovery.js';
import mongoose from 'mongoose';
import {createHash} from 'node:crypto';
import CheckoutRequest from '../models/checkoutRequestModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {roleOf,fail,numeric,money,deliveryPrice,lateDeduction,visibleOrder} from '../utils/marketplace.js';
async function priceCart(body,user) {
 if(!Array.isArray(body.orderItems)||!body.orderItems.length||body.orderItems.length>100)fail('Add between 1 and 100 products.');
 const amounts=new Map(),notes=new Map();
 for(const i of body.orderItems){const qty=numeric(i.qty,'Quantity',1,100000);if(!Number.isInteger(qty))fail('Quantity must be a whole number.');const id=String(i._id);const note=itemNote(i.note);if(notes.has(id)&&notes.get(id)!==note)fail('Use one set of instructions per product.');notes.set(id,note);amounts.set(id,(amounts.get(id)||0)+qty);}
 const products=await Product.find({_id:{$in:[...amounts.keys()]}}).populate('shopkeeper');
 if(products.length!==amounts.size)fail('A product is no longer available.');
 const groups=new Map();
 for(const p of products){
  const shop=p.shopkeeper,qty=amounts.get(String(p._id));
  if(p.printOwner&&String(p.printOwner)!==String(user._id))fail('This print job belongs to another student.',403);
  if(!shop||roleOf(shop)!=='shopkeeper'||shop.status!=='active')fail('A shop is unavailable. Remove its items from the cart.');
  if(qty>p.countInStock)fail((p.name||'This item')+' does not have enough stock.');
  const id=String(shop._id);
  if(!groups.has(id))groups.set(id,{...fulfillmentFor(body,shop),shopkeeper:shop._id,shopName:shop.shopName||shop.username,items:[],minimumOrder:shop.deliveryPolicy.minimumOrder,deliveryCharge:shop.deliveryPolicy.deliveryCharge,deliveryMinutes:shop.deliveryPolicy.deliveryMinutes,latePenalty:shop.deliveryPolicy.latePenalty});
  groups.get(id).items.push({...(notes.get(String(p._id))?{note:notes.get(String(p._id))}:{}),product:p._id,name:p.name||'Shop item',image:p.image,qty,price:p.price});
 }
 const shopOrders=[...groups.values()].map(g=>{const itemsPrice=money(g.items.reduce((s,i)=>s+i.price*i.qty,0));return {...g,itemsPrice,shippingPrice:deliveryPrice(itemsPrice,g)};});
 const itemsPrice=money(shopOrders.reduce((s,g)=>s+g.itemsPrice,0)),shippingPrice=money(shopOrders.reduce((s,g)=>s+g.shippingPrice,0));
 return applyCoupon({shopOrders,orderItems:shopOrders.flatMap(g=>g.items),itemsPrice,shippingPrice,taxPrice:0,totalPrice:money(itemsPrice+shippingPrice)},body,user);
}
export const quoteOrder=asyncHandler(async(req,res)=>res.json(visibleOrder(await priceCart(req.body,req.user),req.user)));
export const createOrder=asyncHandler(async(req,res)=>{
 if(req.body.paymentMethod!=='COD')fail('Only Cash on Delivery is available.');
 const address={};for(const key of ['address','city','postalCode','country']){const v=req.body.shippingAddress?.[key];if(typeof v!=='string'||!v.trim()||v.length>300)fail('Enter a valid shipping '+key+'.');address[key]=v.trim();}
 if(req.body.shippingAddress?.phone!==undefined){address.phone=normalizePhone(req.body.shippingAddress.phone);if(!address.phone)fail('Enter a valid 10-digit Indian mobile number.');}
 let claim;
 const key=req.body.checkoutKey;
 if(key!==undefined){
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))fail('Invalid checkout ID.');
  if(!Array.isArray(req.body.orderItems))fail('Add products to your cart.');
  const items=req.body.orderItems.map(i=>{const note=itemNote(i.note);return [String(i._id),Number(i.qty),...(note?[note]:[])];}).sort((a,b)=>a[0].localeCompare(b[0]));
  const fingerprint=createHash('sha256').update(JSON.stringify({items,address,paymentMethod:'COD',...(req.body.couponCode?{couponCode:String(req.body.couponCode).trim().toUpperCase()}:{}),...(req.body.scheduledFor?{scheduledFor:req.body.scheduledFor}:{}),...(req.body.deliveryMode==='rider'?{deliveryMode:'rider'}:{})})).digest('hex');
  const claimId=String(req.user._id)+':'+key;
  try{claim=await CheckoutRequest.create({_id:claimId,owner:workerIdentity,fingerprint,orderId:new mongoose.Types.ObjectId()});}
  catch(e){
   if(e.code!==11000)throw e;
   const existing=await CheckoutRequest.findById(claimId);
   if(!existing||existing.fingerprint!==fingerprint)fail('This checkout ID belongs to a different request. Review your cart.',409);
   const completed=await Order.findById(existing.orderId);
   if(completed)return res.json(visibleOrder(completed,req.user));
   if(await recoverAbandonedCheckout(existing))fail('Interrupted checkout recovered. Please retry.',409);
   fail('This order is already being placed. Please retry shortly.',409);
  }
 }else{
  claim=await CheckoutRequest.create({_id:String(req.user._id)+':legacy:'+new mongoose.Types.ObjectId(),owner:workerIdentity,fingerprint:'legacy',orderId:new mongoose.Types.ObjectId()});
 }
 try{
  if(!address.phone)fail('A customer mobile number is required for delivery.');
  const priced=await priceCart(req.body,req.user);
  claim.couponId=priced.couponId;
  claim.reservations=priced.orderItems.map(i=>({product:i.product,qty:i.qty}));
  await claim.save();
  await reserveCoupon(claim,req.user);
  for(const i of priced.orderItems){
   const result=await Product.updateOne({_id:i.product,countInStock:{$gte:i.qty},'stockReservations.requestId':{$ne:claim._id}},{$inc:{countInStock:-i.qty},$push:{stockReservations:{requestId:claim._id,reservationId:String(claim.orderId),qty:i.qty}}});
   if(result.modifiedCount!==1)fail('Stock changed. Please review your cart.',409);

  }
  const now=new Date();
  const order=await Order.create({...priced,...(claim?{_id:claim.orderId}:{}),workflowVersion:2,user:req.user._id,shippingAddress:address,paymentMethod:'COD',status:req.body.scheduledFor?'scheduled':'placed',shopOrders:priced.shopOrders.map(g=>({...g,deliveryCode:g.deliveryMode==='rider'?newDeliveryCode():undefined,deadline:g.scheduledFor||new Date(now.getTime()+g.deliveryMinutes*60000)}))});
  await settleCheckout(claim);
  try{await processFulfillment(order._id);}catch{console.warn('Order fulfillment queued for retry.');}
  res.status(201).json(visibleOrder(order,req.user));
 }catch(e){
  // Durable reservation markers also handle hard crashes; failures here leave
  // the claim pending for startup recovery instead of risking a double restore.
  if(claim)await settleCheckout(claim);
  throw e;
 }
});
export const getAllOrders=asyncHandler(async(req,res)=>{
 const filter=roleOf(req.user)==='shopkeeper'?{shopOrders:{$elemMatch:{shopkeeper:req.user._id,status:{$ne:'scheduled'}}}}:{};
 const orders=await Order.find(filter).populate('user','username email').sort({createdAt:-1});res.json(await Promise.all(orders.map(async o=>visibleOrder(await withRiders(o),req.user))));
});
export const getUserOrders=asyncHandler(async(req,res)=>res.json(await Promise.all((await Order.find({user:req.user._id}).sort({createdAt:-1})).map(async o=>visibleOrder(await withRiders(o),req.user)))));
export const findOrderById=asyncHandler(async(req,res)=>{
 const o=await Order.findById(req.params.id).populate('user','username email');if(!o)fail('Order not found.',404);
 const role=roleOf(req.user);
 const allowed=role==='shopkeeper'?o.shopOrders.some(g=>String(g.shopkeeper)===String(req.user._id)&&g.status!=='scheduled'):['superadmin','administrator'].includes(role)||String(o.user?._id)===String(req.user._id);
 if(!allowed)fail('You cannot view this order.',403);
 res.json(visibleOrder(await withRiders(o),req.user));
});
export const markOrderAsDelivered=asyncHandler(async(req,res)=>{
 const o=await Order.findById(req.params.id);if(!o)fail('Order not found.',404);
 const g=o.shopOrders.id(req.params.shopOrderId);if(!g||String(g.shopkeeper)!==String(req.user._id))fail('You can only complete your own deliveries.',403);
 if(g.deliveryMode==='rider')fail('The assigned rider must complete delivery with the student code.',403);
 if(['scheduled','cancelled'].includes(g.status))fail('This delivery is not available.');
 if(o.paymentMethod!=='COD')fail('Legacy online orders cannot be completed here.');
 if(!g.isDelivered){
  const now=new Date();
  await Order.updateOne({_id:o._id,shopOrders:{$elemMatch:{_id:g._id,isDelivered:false}}},{$set:{'shopOrders.$.status':'delivered','shopOrders.$.isDelivered':true,'shopOrders.$.deliveredAt':now,'shopOrders.$.deduction':lateDeduction(g,now)}});
  await Order.updateOne({_id:o._id,shopOrders:{$not:{$elemMatch:{isDelivered:false}}},isDelivered:false},{$set:{isDelivered:true,deliveredAt:now,isPaid:true,paidAt:now}});
 }
 if(o.workflowVersion===2)await updateOrderTotals(o._id);
 res.json(visibleOrder(await Order.findById(o._id),req.user));
});
export const countTotalOrders=asyncHandler(async(req,res)=>res.json({totalOrders:await Order.countDocuments()}));
export const calculateTotalSales=asyncHandler(async(req,res)=>res.json({totalSales:money((await Order.find({isPaid:true})).reduce((s,o)=>s+o.totalPrice,0))}));
export const calcualteTotalSalesByDate=asyncHandler(async(req,res)=>res.json(await Order.aggregate([{$match:{isPaid:true}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$paidAt'}},totalSales:{$sum:'$totalPrice'}}}])));

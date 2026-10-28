import dotenv from 'dotenv';
dotenv.config({path:'.env.push'});
import webpush from 'web-push';
import PushSubscription from '../models/pushSubscriptionModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
export const pushConfigured=()=>!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);
export function validPushSubscription(value){
 try{const u=new URL(value.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&value.endpoint.length<2048&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.notify.windows.com'))&&/^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth)&&/^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh);}catch{return false;}
}
let sender=null;
export function setPushSenderForTests(fn){if(process.env.NODE_ENV!=='test')throw new Error('Test sender unavailable');sender=fn;}
export async function sendPush(sub,data){
 if(process.env.NODE_ENV==='test'){if(!sender)throw new Error('Test push sender missing');return sender(sub,data);}
 if(!pushConfigured())throw new Error('Push not configured');
 return webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},JSON.stringify(data),{TTL:300,timeout:10000,vapidDetails:{subject:'mailto:ankitbhukar815@gmail.com',publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY}});
}
export async function dispatchOrderNotifications(){
 const subs=await PushSubscription.find({$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lte:new Date()}}]}).select('_id');
 for(const entry of subs){
  const lease=new Date(Date.now()+60000);
  const sub=await PushSubscription.findOneAndUpdate({_id:entry._id,$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lte:new Date()}}]},{$set:{leaseUntil:lease}},{new:true});if(!sub)continue;
  try{
   if(!await User.exists({_id:sub.user,role:'shopkeeper',status:'active'})){await PushSubscription.deleteOne({_id:sub._id});continue;}
   const after=sub.cursorId?{$or:[{createdAt:{$gt:sub.cursorAt}},{createdAt:sub.cursorAt,_id:{$gt:sub.cursorId}}]}:{createdAt:{$gt:sub.cursorAt}};
   const orders=await Order.find({'shopOrders.shopkeeper':sub.user,...after}).sort({createdAt:1,_id:1}).limit(1);
   for(const order of orders){
    const group=order.shopOrders.find(g=>String(g.shopkeeper)===String(sub.user));
    // Delivered groups need no new-order alert, but still advance the durable cursor.
    if(!group.isDelivered&&!group.deliveredAt){await sendPush(sub,{title:'New CampusCart order',body:'A new COD order is waiting in your deliveries.',orderId:String(order._id),shopkeeper:String(sub.user)});}
    const updated=await PushSubscription.updateOne({_id:sub._id,user:sub.user,leaseUntil:lease},{$set:{cursorAt:order.createdAt,cursorId:String(order._id)}});
    if(!updated.modifiedCount)break;
    // Hold the same lease timestamp for compare-and-set ownership throughout this batch.
    break;
   }
  }catch(e){if([404,410].includes(e.statusCode))await PushSubscription.deleteOne({_id:sub._id});}
  finally{await PushSubscription.updateOne({_id:sub._id,leaseUntil:lease},{$unset:{leaseUntil:1}});}
 }
}
export function startOrderNotifications(){let running=false;const timer=setInterval(async()=>{if(running||!pushConfigured())return;running=true;try{await dispatchOrderNotifications();}catch{console.warn('Order notification worker will retry.');}finally{running=false;}},5000);timer.unref();}

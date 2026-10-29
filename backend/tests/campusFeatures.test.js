import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import {PDFDocument} from 'pdf-lib';
import {slotRule,shopOpen,couponValue,GROUP_STATES} from '../../shared/fulfillment.js';
const uri=process.env.MARKETPLACE_TEST_URI;
test('shared scheduling rules cover every five minutes across two campus days',()=>{
 const now=Date.parse('2026-10-28T00:00:00Z'),settings={prepMinutes:15,walkMinutes:10,hoursConfigured:true,hours:Array.from({length:7},(_,day)=>({day,open:480,close:1320}))};
 for(let at=now;at<=now+48*3600000;at+=300000){const actual=slotRule(at,settings,now);const release=at-25*60000,local=new Date(release+330*60000),minute=local.getUTCHours()*60+local.getUTCMinutes();const expected=at>=now+25*60000&&minute>=480&&minute<1320;assert.equal(actual.valid,expected,new Date(at).toISOString());}
 assert(GROUP_STATES.includes('scheduled'));assert.equal(shopOpen({hoursConfigured:true,hours:[]},now),false);assert.equal(couponValue({active:true,expiresAt:now+1,minimum:0,kind:'fixed',value:500},50,now),50);
});
test('campus feature permissions, races, durable stock and private print jobs',{skip:!uri,timeout:120000},async()=>{
 assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/);process.env.JWT_SECRET='isolated-campus-features-secret';process.env.NODE_ENV='test';
 await mongoose.connect(uri+'_features');await mongoose.connection.dropDatabase();
 const {default:User}=await import('../models/userModel.js'),{default:Product}=await import('../models/productModel.js'),{default:Order}=await import('../models/orderModel.js');
 const {Rider,DeliveryTask,Coupon,OrderRating,RiderPayout,StockWatch,CampusAlert,PrintJob}=await import('../models/campusModels.js');
 assert.deepEqual(Order.schema.path('shopOrders').schema.path('status').enumValues,GROUP_STATES);
 const {processFulfillment,preparePayout}=await import('../utils/fulfillment.js');
 const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/orders',(await import('../routes/orderRoutes.js')).default);app.use('/api/campus',(await import('../routes/campusRoutes.js')).default);app.use('/api/print',(await import('../routes/printRoutes.js')).default);app.use('/api/products',(await import('../routes/productRoutes.js')).default);app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
 const create=(name,role='customer')=>User.create({username:name,email:name+'@nith.ac.in',password:'test-only',role,emailVerifiedAt:new Date(),shopName:role==='shopkeeper'?name:undefined});
 const call=async(u,path,method='GET',body)=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:'jwt='+jwt.sign({userId:u._id},process.env.JWT_SECRET)},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 try{
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  const [student,other,r1,r2,admin,shop,shop2]=await Promise.all([create('student'),create('other'),create('rider1'),create('rider2'),create('admin','administrator'),create('booth4','shopkeeper'),create('4h','shopkeeper')]);
  const product=await Product.create({name:'Milk',image:'/uploads/test.jpg',price:40,countInStock:100,shopkeeper:shop._id});
  const payload=(extra={})=>({paymentMethod:'COD',orderItems:[{_id:product._id,qty:1}],shippingAddress:{phone:'9000000000',address:'Test hostel',city:'Hamirpur',postalCode:'177005',country:'India'},...extra});
  let seq=0;const place=async(extra={})=>{const result=await call(student,'/api/orders','POST',payload({checkoutKey:'campus-features-order-'+(++seq),...extra}));assert.equal(result.status,201,JSON.stringify(result));return result.data;};
  for(const rider of [r1,r2]){assert.equal((await call(rider,'/api/campus/rider/apply','POST',{upiId:rider.username+'@upi'})).status,201);assert.equal((await call(admin,'/api/campus/admin/riders/'+rider._id,'PUT',{status:'approved',reward:20})).status,200);assert.equal((await call(rider,'/api/campus/rider/online','PUT',{online:true})).status,200);}
  assert.equal((await call(student,'/api/campus/admin/riders')).status,403);
  const order=await place({deliveryMode:'rider'}),group=order.shopOrders[0],key=order._id+':'+group._id;
  const offers=await call(r1,'/api/campus/rider/offers');assert(offers.data.length);assert(!JSON.stringify(offers.data).includes('Test hostel'));assert(!JSON.stringify(offers.data).includes(student.email));assert(!JSON.stringify(offers.data).includes(group.deliveryCode));
  const claims=await Promise.all([r1,r2].map(r=>call(r,'/api/campus/rider/tasks/'+key+'/accept','POST',{})));assert.equal(claims.filter(x=>x.status===200).length,1);assert.equal(claims.filter(x=>x.status===409).length,1);
  const winner=claims[0].status===200?r1:r2,loser=winner===r1?r2:r1;
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/pickup','POST',{})).status,409);
  assert.equal((await call(shop2,'/api/campus/orders/'+order._id+'/shops/'+group._id+'/ready','POST',{})).status,409);
  assert.equal((await call(shop,'/api/campus/orders/'+order._id+'/shops/'+group._id+'/ready','POST',{})).status,200);
  const shopView=await call(shop,'/api/orders/'+order._id);assert.equal(shopView.data.shopOrders[0].deliveryCode,undefined);assert.equal(shopView.data.shopOrders[0].riderName,winner.username);
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/pickup','POST',{})).status,200);
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/return','POST',{})).status,409);
  assert.equal((await call(loser,'/api/campus/rider/tasks/'+key+'/deliver','POST',{code:group.deliveryCode,codCollected:true})).status,404);
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/deliver','POST',{code:'000000',codCollected:true})).status,400);
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/deliver','POST',{code:group.deliveryCode,codCollected:true})).status,200);
  assert.equal((await call(winner,'/api/campus/rider/tasks/'+key+'/deliver','POST',{code:group.deliveryCode,codCollected:true})).status,200);
  assert.equal((await Order.findById(order._id)).isDelivered,true);assert.equal((await Rider.findById(winner._id)).slots.length,0);
  const many=await Promise.all([place({deliveryMode:'rider'}),place({deliveryMode:'rider'}),place({deliveryMode:'rider'})]);
  const accepted=await Promise.all(many.map(o=>call(winner,'/api/campus/rider/tasks/'+o._id+':'+o.shopOrders[0]._id+'/accept','POST',{})));assert.equal(accepted.filter(v=>v.status===200).length,2);assert.equal((await Rider.findById(winner._id)).slots.length,2);
  const held=await DeliveryTask.findOne({rider:winner._id,status:'accepted'});assert.equal((await call(winner,'/api/campus/rider/tasks/'+held._id+'/return','POST',{})).status,200);assert.equal((await Rider.findById(winner._id)).slots.length,1);
  // Concurrent limited coupon usage is reserved atomically with checkout recovery.
  const coupon=await Coupon.create({code:'ONLYONE',kind:'fixed',value:100,minimum:0,maxUses:1,expiresAt:new Date(Date.now()+3600000)});
  const coupons=await Promise.all([1,2].map(i=>call(student,'/api/orders','POST',payload({couponCode:'ONLYONE',checkoutKey:'coupon-concurrent-key-'+i}))));assert.equal(coupons.filter(v=>v.status===201).length,1);const discounted=coupons.find(v=>v.status===201).data;assert.equal(discounted.discount,40);assert.equal(discounted.totalPrice,30);assert.equal((await Coupon.findById(coupon._id)).redemptions.length,1);
  for(const [code,extra] of [['EXPIRED',{expiresAt:new Date(0)}],['WRONGSHOP',{shopkeeper:shop2._id}],['MINIMUM',{minimum:1000}]]){await Coupon.create({code,kind:'fixed',value:10,maxUses:1,expiresAt:new Date(Date.now()+3600000),...extra});assert.equal((await call(student,'/api/orders/quote','POST',payload({couponCode:code}))).status,400);}
  const rollback=await Coupon.create({code:'ROLLBACK',kind:'fixed',value:10,maxUses:1,expiresAt:new Date(Date.now()+3600000)}),before=(await Product.findById(product._id)).countInStock,original=Order.create;
  Order.create=async()=>{throw new Error('Simulated order save failure');};try{assert.equal((await call(student,'/api/orders','POST',payload({couponCode:'ROLLBACK',checkoutKey:'coupon-save-failure-test'}))).status,500);}finally{Order.create=original;}
  assert.equal((await Coupon.findById(rollback._id)).redemptions.length,0);assert.equal((await Product.findById(product._id)).countInStock,before);assert.equal((await call(student,'/api/orders','POST',payload({couponCode:'ROLLBACK',checkoutKey:'coupon-save-failure-test'}))).status,201);
  // Scheduled orders are hidden until release and cancellation restores stock once.
  const scheduledFor=new Date(Math.ceil((Date.now()+3600000)/300000)*300000).toISOString();
  const scheduled=await place({scheduledFor}),sg=scheduled.shopOrders[0];assert.equal(sg.status,'scheduled');assert.equal((await call(shop,'/api/orders/'+scheduled._id)).status,403);
  await Order.updateOne({_id:scheduled._id,'shopOrders._id':sg._id},{$set:{'shopOrders.$.releaseAt':new Date(0)}});await processFulfillment(scheduled._id);const released=await Order.findById(scheduled._id);assert.equal(released.shopOrders[0].status,'preparing');assert(released.shopOrders[0].pickupToken);assert.equal((await call(shop,'/api/orders/'+scheduled._id)).status,200);
  const cancelled=await place({scheduledFor}),cg=cancelled.shopOrders[0],stock=(await Product.findById(product._id)).countInStock;
  await User.updateOne({_id:shop._id},{$set:{'shopSettings.closed':true}});await Order.updateOne({_id:cancelled._id,'shopOrders._id':cg._id},{$set:{'shopOrders.$.releaseAt':new Date(0)}});await processFulfillment(cancelled._id);await processFulfillment(cancelled._id);await processFulfillment(cancelled._id);assert.equal((await Product.findById(product._id)).countInStock,stock+1);assert.equal((await Order.findById(cancelled._id)).totalPrice,0);await User.updateOne({_id:shop._id},{$set:{'shopSettings.closed':false}});
  assert.equal((await call(other,'/api/campus/orders/'+order._id+'/rating','POST',{shopkeeper:String(shop._id),rating:5})).status,400);
  assert.equal((await call(student,'/api/campus/orders/'+order._id+'/rating','POST',{shopkeeper:String(shop._id),rating:5})).status,201);assert.equal((await call(student,'/api/campus/orders/'+order._id+'/rating','POST',{shopkeeper:String(shop._id),rating:5})).status,409);
  assert.equal((await call(student,'/api/campus/shops/'+shop._id+'/ratings')).data.average,null);
  await OrderRating.create([{order:new mongoose.Types.ObjectId(),shopkeeper:shop._id,user:student._id,rating:4},{order:new mongoose.Types.ObjectId(),shopkeeper:shop._id,user:other._id,rating:3}]);assert.equal((await call(student,'/api/campus/shops/'+shop._id+'/ratings')).data.average,4);
  await Order.updateOne({_id:order._id},{$set:{deliveredAt:new Date(Date.now()-8*86400000)}});assert.equal((await call(student,'/api/campus/orders/'+order._id+'/rating','POST',{shopkeeper:String(shop._id),rating:4})).status,400);
  await Product.updateOne({_id:product._id},{$set:{countInStock:0}});assert.equal((await call(student,'/api/campus/stock-watch/'+product._id,'POST',{})).status,200);await Product.updateOne({_id:product._id},{$set:{countInStock:10}});await processFulfillment();await processFulfillment();assert.equal(await CampusAlert.countDocuments({user:student._id,kind:'stock'}),1);
  assert.equal((await call(student,'/api/campus/favorites/'+product._id,'PUT',{saved:true})).status,200);assert.equal((await call(student,'/api/campus/favorites')).data.length,1);assert.equal((await call(other,'/api/campus/favorites')).data.length,0);
  assert((await call(student,'/api/campus/buy-again')).data.some(p=>p._id===String(product._id)));
  // Payout claims prevent a completed delivery being counted twice.
  const task=await DeliveryTask.findById(key);const oldMonday=new Date('2026-10-05T00:00:00+05:30');await DeliveryTask.updateOne({_id:key},{$set:{deliveredAt:new Date(oldMonday.getTime()+86400000)}});
  const payoutResults=await Promise.all([1,2].map(()=>call(admin,'/api/campus/admin/payouts','POST',{rider:String(winner._id),weekStart:'2026-10-05'})));assert(payoutResults.every(p=>p.status===201));assert.equal(new Set(payoutResults.map(p=>p.data._id)).size,1);assert.equal(payoutResults[0].data.amount,20);assert.equal(await RiderPayout.countDocuments({rider:winner._id}),1);const pay=payoutResults.find(p=>p.data.amount>0).data;assert.equal((await call(admin,'/api/campus/admin/payouts/'+pay._id+'/paid','POST',{reference:'UPI-TEST-12345'})).status,200);assert.equal((await call(admin,'/api/campus/admin/payouts/'+pay._id+'/paid','POST',{reference:'UPI-TEST-12345'})).status,409);
  // Private PDF pricing is derived from bytes, ignoring client page/price fields.
  await User.updateOne({_id:shop._id},{$set:{'shopSettings.printEnabled':true,'shopSettings.blackWhiteRate':2}});const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const form=new FormData();form.append('file',new Blob([await pdf.save()],{type:'application/pdf'}),'test.pdf');form.append('shopkeeper',String(shop._id));form.append('copies','3');form.append('pages','1');form.append('price','0.01');
  const response=await fetch(base+'/api/print/jobs',{method:'POST',headers:{Cookie:'jwt='+jwt.sign({userId:student._id},process.env.JWT_SECRET)},body:form}),job=await response.json();assert.equal(response.status,201,JSON.stringify(job));assert.equal(job.pages,2);assert.equal(job.price,12);
  const file='/api/print/jobs/'+job.jobId+'/file';assert.equal((await call(student,file)).status,403);assert.equal((await call(shop,file)).status,403);assert.equal((await call(shop2,file)).status,404);
  const printOrder=await place({orderItems:[{_id:job.product._id,qty:1}]});assert.equal(printOrder.itemsPrice,12);const download=await fetch(base+file,{headers:{Cookie:'jwt='+jwt.sign({userId:shop._id},process.env.JWT_SECRET)}});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.equal((await call(student,'/api/products/'+job.product._id)).status,404);
  console.log('PASS rider races/codes/privacy, coupons/rollback, scheduling/stock, ratings, stock watches, payouts and private PDF permissions');
 }finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

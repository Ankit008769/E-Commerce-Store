import test from 'node:test';import assert from 'node:assert/strict';import mongoose from 'mongoose';import express from 'express';import cookieParser from 'cookie-parser';import jwt from 'jsonwebtoken';import {createChallenge,solveChallenge} from 'altcha-lib';import {deriveKey} from 'altcha-lib/algorithms/pbkdf2';
const uri=process.env.MARKETPLACE_TEST_URI;
test('CAPTCHA replay/expiry and shop-scoped durable notifications',{skip:!uri,timeout:60000},async()=>{
 if(!/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/.test(uri))throw new Error('Use isolated test DB');
 process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-captcha-secret';process.env.VAPID_PUBLIC_KEY='test-public';process.env.VAPID_PRIVATE_KEY='test-private';
 await mongoose.connect(uri+'_security');await mongoose.connection.dropDatabase();
 const {default:User}=await import('../models/userModel.js'),{default:Order}=await import('../models/orderModel.js'),{default:Sub}=await import('../models/pushSubscriptionModel.js');
 const {dispatchOrderNotifications,setPushSenderForTests}=await import('../utils/orderPush.js');const {default:users}=await import('../routes/userRoutes.js'),{default:notifications}=await import('../routes/notificationRoutes.js');
 const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/users',users);app.use('/api/notifications',notifications);const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 async function call(path,body,user){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{cookie:'jwt='+jwt.sign({userId:user._id},process.env.JWT_SECRET)}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 async function proof(purpose='login',expired=false){const challenge=expired?await createChallenge({algorithm:'PBKDF2/SHA-256',cost:1000,counter:200,deriveKey,hmacSignatureSecret:process.env.JWT_SECRET,expiresAt:new Date(Date.now()-1000),data:{purpose}}):(await call('/api/users/captcha?purpose='+purpose)).data;const solution=await solveChallenge({challenge,deriveKey});return Buffer.from(JSON.stringify({challenge,solution})).toString('base64');}
 try{
  assert.equal((await call('/api/users/auth',{email:'nobody@nith.ac.in',password:'bad'})).status,400);
  assert.equal((await call('/api/users/auth',{altcha:Buffer.from('null').toString('base64')})).status,400);
  const altcha=await proof(),body={email:'nobody@nith.ac.in',password:'bad',altcha};const results=await Promise.all([call('/api/users/auth',body),call('/api/users/auth',body)]);assert.deepEqual(results.map(x=>x.status).sort(),[400,401]);
  const decoded=JSON.parse(Buffer.from(altcha,'base64').toString());const reordered={solution:decoded.solution,challenge:{signature:decoded.challenge.signature,parameters:decoded.challenge.parameters}};assert.equal((await call('/api/users/auth',{...body,altcha:Buffer.from(JSON.stringify(reordered)).toString('base64')})).status,400);
  assert.equal((await call('/api/users/auth',{...body,altcha:await proof('otp')})).status,400);assert.equal((await call('/api/users/auth',{...body,altcha:await proof('login',true)})).status,400);
  console.log('PASS CAPTCHA required, purpose bound, expiring, atomic single use, reordered-payload replay rejected');
  const mk=(name,role)=>User.create({username:name,email:name+'@test.local',password:'test-only',role,status:'active'});const a=await mk('shopa','shopkeeper'),b=await mk('shopb','shopkeeper'),buyer=await mk('buyer','customer');
  assert.equal((await call('/api/notifications/key')).status,401);assert.equal((await call('/api/notifications/key',null,buyer)).status,403);
  const keys={auth:'a'.repeat(22),p256dh:'b'.repeat(87)};
  assert.equal((await call('/api/notifications/subscribe',{endpoint:'https://127.0.0.1/private',keys},a)).status,400);
  const endpoint='https://fcm.googleapis.com/fcm/send/test-a',endpointB='https://fcm.googleapis.com/fcm/send/test-b';
  assert.equal((await call('/api/notifications/subscribe',{endpoint,keys},a)).status,200);assert.equal((await call('/api/notifications/subscribe',{endpoint:endpointB,keys},b)).status,200);
  await Sub.updateMany({},{$set:{cursorAt:new Date(Date.now()-60000)}});
  const order=await Order.create({user:buyer._id,shippingAddress:{address:'Test',city:'Test',postalCode:'1',country:'India'},paymentMethod:'COD',shopOrders:[{shopkeeper:a._id,shopName:'A'},{shopkeeper:b._id,shopName:'B'}]});
  let sent=[];setPushSenderForTests(async(sub,payload)=>sent.push({user:String(sub.user),payload}));
  await Promise.all([dispatchOrderNotifications(),dispatchOrderNotifications()]);assert.equal(sent.length,2);for(const item of sent){assert.equal(item.payload.shopkeeper,item.user);assert.equal(item.payload.orderId,String(order._id));assert.equal(item.payload.customer,undefined);}
  await dispatchOrderNotifications();assert.equal(sent.length,2);
  assert.equal((await call('/api/notifications/test',{endpoint},b)).status,400);await call('/api/notifications/unsubscribe',{endpoint},b);assert(await Sub.exists({endpoint}));
  await Sub.updateMany({},{$set:{cursorAt:new Date(Date.now()-60000),cursorId:''}});setPushSenderForTests(async()=>{throw new Error('temporary push failure');});await dispatchOrderNotifications();assert.equal((await Sub.findOne({endpoint})).cursorId,'');
  sent=[];setPushSenderForTests(async(sub,payload)=>sent.push(payload));await dispatchOrderNotifications();assert.equal(sent.length,2);
  await User.updateOne({_id:a._id},{$set:{status:'blacklisted'}});await dispatchOrderNotifications();assert.equal(await Sub.countDocuments({user:a._id}),0);
  await Sub.updateOne({endpoint:endpointB},{$set:{cursorAt:new Date(Date.now()-60000),cursorId:''}});setPushSenderForTests(async()=>{const e=new Error('gone');e.statusCode=410;throw e;});await dispatchOrderNotifications();assert.equal(await Sub.countDocuments(),0);
  console.log('PASS shop isolation, endpoint safety, concurrent deduplication, durable retry, revoked users and expired subscriptions');
 }finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

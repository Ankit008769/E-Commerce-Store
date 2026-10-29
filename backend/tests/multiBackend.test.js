import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import CheckoutRequest from '../models/checkoutRequestModel.js';
const base=process.env.MARKETPLACE_TEST_URI;
test('two live backend processes preserve reservations and deduplicate across workers',{skip:!base,timeout:60000},async()=>{
 assert.match(base,/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/);
 const uri=base+'_multi_backend';const children=new Set();
 function start(mode){
  const child=fork(fileURLToPath(new URL('./fixtures/crashServer.mjs',import.meta.url)),[],{env:{...process.env,CRASH_TEST_URI:uri,CRASH_POINT:mode,JWT_SECRET:'crash-test-secret',NODE_ENV:'test'},stdio:['ignore','pipe','pipe','ipc']});
  children.add(child);let logs='';child.stderr.on('data',b=>{logs+=b;});child.stdout.on('data',()=>{});
  const history=[],waiters=[];
  child.on('message',m=>{history.push(m);for(const w of [...waiters])if(w.stage===m.stage){waiters.splice(waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(m);}});
  const wait=stage=>{const found=history.find(m=>m.stage===stage);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const w={stage,resolve,timer:setTimeout(()=>reject(new Error('Timed out at '+stage+' '+logs)),15000)};waiters.push(w);});};
  return {child,wait};
 }
 async function kill(server){if(server.child.exitCode!==null)return;const done=once(server.child,'exit');server.child.kill('SIGKILL');await done;children.delete(server.child);}
 await mongoose.connect(uri);await mongoose.connection.dropDatabase();
 try{
  const buyer=await User.create({username:'Crash buyer',email:'crash@test.local',password:'not-used',role:'customer'});
  const a=await User.create({username:'Shop A',email:'crash-a@test.local',password:'not-used',role:'shopkeeper'}),b=await User.create({username:'Shop B',email:'crash-b@test.local',password:'not-used',role:'shopkeeper'});
  const cookie='jwt='+jwt.sign({userId:buyer._id},'crash-test-secret');
  const p=await Product.create({name:'Multi-worker A',price:10,image:'/uploads/test.jpg',shopkeeper:a._id,countInStock:5});
  const q=await Product.create({name:'Multi-worker B',price:20,image:'/uploads/test.jpg',shopkeeper:b._id,countInStock:7});
  const payload={checkoutKey:'multi-worker-checkout',orderItems:[{_id:p._id,qty:2},{_id:q._id,qty:3}],paymentMethod:'COD',shippingAddress:{phone:'9000000000',address:'Isolated multi-worker test',city:'Demo',postalCode:'123456',country:'India'}};
  const post=async(port,body=payload)=>{const r=await fetch('http://127.0.0.1:'+port+'/api/orders',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const first=start('before-save'),firstReady=await first.wait('ready');
  const inFlight=post(firstReady.port).catch(e=>({networkError:e.message}));
  await first.wait('before-save');
  assert.equal((await Product.findById(p._id)).countInStock,3);assert.equal((await Product.findById(q._id)).countInStock,4);
  const second=start('normal'),secondReady=await second.wait('ready');
  assert.equal((await Product.findById(p._id)).countInStock,3,'Second server must not restore live reservations');
  assert.equal((await Product.findById(q._id)).countInStock,4);
  const overlapping=await Promise.all(Array.from({length:4},()=>post(secondReady.port)));assert(overlapping.every(r=>r.status===409));
  first.child.send('resume');const original=await inFlight;assert.equal(original.status,201);
  const replay=await post(secondReady.port);assert.equal(replay.status,200);assert.equal(replay.data._id,original.data._id);
  assert.equal(await Order.countDocuments({'orderItems.product':p._id}),1);
  assert.equal((await Product.findById(p._id)).countInStock,3);assert.equal((await Product.findById(q._id)).countInStock,4);
  console.log('PASS server B startup leaves live server A reservations untouched; duplicate requests across workers return one order');
  // Both workers simultaneously recover the same dead owner, then receive retries.
  await kill(first);await kill(second);
  const doomed=start('before-save'),doomedReady=await doomed.wait('ready');
  const next={...payload,checkoutKey:'multi-worker-crash-retry',orderItems:[{_id:p._id,qty:1},{_id:q._id,qty:1}]};
  const lost=post(doomedReady.port,next).catch(()=>null);await doomed.wait('before-save');await kill(doomed);await lost;
  assert.equal((await Product.findById(p._id)).countInStock,2);assert.equal((await Product.findById(q._id)).countInStock,3);
  const recoveryA=start('normal'),recoveryB=start('normal');
  const [upA,upB]=await Promise.all([recoveryA.wait('ready'),recoveryB.wait('ready')]);
  assert.equal((await Product.findById(p._id)).countInStock,3);assert.equal((await Product.findById(q._id)).countInStock,4);
  const retried=await Promise.all(Array.from({length:8},(_,i)=>post(i%2?upA.port:upB.port,next)));
  assert.equal(retried.filter(r=>r.status===201).length,1);assert(retried.every(r=>[200,201,409].includes(r.status)));
  assert.equal(await Order.countDocuments({'orderItems.product':p._id}),2);
  assert.equal((await Product.findById(p._id)).countInStock,2);assert.equal((await Product.findById(q._id)).countInStock,3);
  console.log('PASS simultaneous dead-worker recovery restores once; eight retries across two backends create one new order');
 }finally{for(const child of children){if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}}await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

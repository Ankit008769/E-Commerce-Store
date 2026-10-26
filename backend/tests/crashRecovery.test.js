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
test('hard process termination restores reservations on restart and preserves committed orders',{skip:!base,timeout:60000},async()=>{
 assert.match(base,/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/);
 const uri=base+'_hard_crash';const children=new Set();
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
  for(const crashPoint of ['before-save','after-save']){
   const p=await Product.create({name:'Crash A',price:10,image:'/uploads/test.jpg',shopkeeper:a._id,countInStock:5});
   const q=await Product.create({name:'Crash B',price:20,image:'/uploads/test.jpg',shopkeeper:b._id,countInStock:7});
   const payload={checkoutKey:'hard-crash-'+crashPoint,orderItems:[{_id:p._id,qty:2},{_id:q._id,qty:3}],paymentMethod:'COD',shippingAddress:{address:'Isolated crash test',city:'Demo',postalCode:'123456',country:'India'}};
   const post=async port=>{const r=await fetch('http://127.0.0.1:'+port+'/api/orders',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()};};
   const crashing=start(crashPoint),ready=await crashing.wait('ready');
   const disconnected=post(ready.port).then(()=>false,()=>true);
   await crashing.wait(crashPoint);
   assert.equal((await Product.findById(p._id)).countInStock,3);assert.equal((await Product.findById(q._id)).countInStock,4);
   const committed=await Order.findOne({'orderItems.product':p._id});assert.equal(!!committed,crashPoint==='after-save');
   await kill(crashing);assert(await disconnected);
   if(crashPoint==='before-save'){
    const recovering=start('during-recovery');await recovering.wait('during-recovery');await kill(recovering);
    const partial=[(await Product.findById(p._id)).countInStock,(await Product.findById(q._id)).countInStock];
    assert(partial[0]===5&&partial[1]===4||partial[0]===3&&partial[1]===7);
   }
   const restarted=start('normal'),up=await restarted.wait('ready');
   assert.equal((await Product.findById(p._id)).countInStock,committed?3:5);assert.equal((await Product.findById(q._id)).countInStock,committed?4:7);
   assert.equal(await Order.countDocuments({'orderItems.product':p._id}),committed?1:0);
   const retries=await Promise.all(Array.from({length:6},()=>post(up.port)));
   assert(retries.every(r=>[200,201,409].includes(r.status)));assert.equal(retries.filter(r=>r.status===201).length,committed?0:1);
   const saved=await Order.findOne({'orderItems.product':p._id});assert(saved);if(committed)assert.equal(String(saved._id),String(committed._id));
   const replay=await post(up.port);assert.equal(replay.status,200);assert.equal(replay.data._id,String(saved._id));
   assert.equal(await Order.countDocuments({'orderItems.product':p._id}),1);
   assert.equal((await Product.findById(p._id)).countInStock,3);assert.equal((await Product.findById(q._id)).countInStock,4);
   for(const id of [p._id,q._id])assert.equal((await Product.findById(id).select('+stockReservations')).stockReservations.length,0);
   assert.equal((await CheckoutRequest.findById(String(buyer._id)+':'+payload.checkoutKey)).state,'completed');
   await kill(restarted);
   console.log('PASS real process kill '+crashPoint+': restart reconciles both shops, six retries produce one order and one stock deduction');
  }
 }finally{for(const child of children){if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}}await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

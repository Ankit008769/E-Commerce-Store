import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import Product from '../../models/productModel.js';
import Order from '../../models/orderModel.js';
import {recoverCheckouts} from '../../utils/checkoutRecovery.js';
import orderRoutes from '../../routes/orderRoutes.js';
await mongoose.connect(process.env.CRASH_TEST_URI);
const pause=async stage=>{process.send({stage});await new Promise(resolve=>{const resume=m=>{if(m==='resume'){process.off('message',resume);resolve();}};process.on('message',resume);});};
if(process.env.CRASH_POINT==='during-recovery'){
 const original=Product.updateOne;let armed=true;
 Product.updateOne=async function(filter,update,...args){
  const result=await original.call(this,filter,update,...args);
  if(armed&&update.$inc?.countInStock>0&&result.modifiedCount===1){armed=false;await pause('during-recovery');}
  return result;
 };
}
await recoverCheckouts();
const original=Order.create;
if(['before-save','after-save'].includes(process.env.CRASH_POINT)){
 Order.create=async function(...args){
  if(process.env.CRASH_POINT==='before-save')await pause('before-save');
  const result=await original.apply(this,args);
  if(process.env.CRASH_POINT==='after-save')await pause('after-save');return result;
 };
}
const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/orders',orderRoutes);
app.use((e,req,res,next)=>res.status(e.status||500).json({message:e.message}));
const server=app.listen(0,'127.0.0.1',()=>process.send({stage:'ready',port:server.address().port}));

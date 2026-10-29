import {checkPrintPdf} from '../utils/safePrintPdf.js';
import {inputGuard} from '../middlewares/security.js';
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import {PDFDocument} from 'pdf-lib';
import {randomUUID} from 'node:crypto';
import {authenticate,allowRoles} from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {rateLimit} from '../utils/emailVerification.js';
import {fail,numeric,money} from '../utils/marketplace.js';
import {PrintJob} from '../models/campusModels.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
const r=express.Router(),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:5}});
const bucket=()=>new mongoose.mongo.GridFSBucket(mongoose.connection.db,{bucketName:'privatePrintFiles'});
r.use(authenticate);
r.post('/jobs',allowRoles('customer'),asyncHandler(async(req,res,next)=>{await rateLimit('print-upload',String(req.user._id),10);next();}),upload.single('file'),inputGuard,asyncHandler(async(req,res)=>{
 if(!req.file||req.file.buffer.subarray(0,5).toString()!=='%PDF-')fail('Upload a valid PDF up to 10 MB.');
 const shop=await User.findOne({_id:req.body.shopkeeper,role:'shopkeeper',status:'active','shopSettings.printEnabled':true});if(!shop)fail('Choose an active print shop.');
 const copies=numeric(req.body.copies??1,'Copies',1,100);if(!Number.isInteger(copies))fail('Copies must be whole.');
 let pdf;try{pdf=await PDFDocument.load(req.file.buffer,{ignoreEncryption:false,updateMetadata:false});}catch{fail('PDF could not be read. Encrypted or malformed documents are not accepted.');}
 checkPrintPdf(pdf);
 const pages=pdf.getPageCount();if(pages<1||pages>500)fail('Use a PDF with between 1 and 500 pages.');
 const colour=req.body.colour==='true',unitRate=colour?shop.shopSettings.colourRate:shop.shopSettings.blackWhiteRate,price=money(pages*copies*unitRate);
 const stream=bucket().openUploadStream(randomUUID()+'.pdf',{metadata:{owner:req.user._id,shopkeeper:shop._id}});await new Promise((resolve,reject)=>{stream.on('finish',resolve);stream.on('error',reject);stream.end(req.file.buffer);});
 let product;
 try{product=await Product.create({name:`Print job · ${pages} pages × ${copies}`,image:'/product-placeholder.svg',shopkeeper:shop._id,printOwner:req.user._id,price,countInStock:1});const job=await PrintJob.create({user:req.user._id,shopkeeper:shop._id,fileId:stream.id,product:product._id,pages,copies,colour,unitRate,price});res.status(201).json({jobId:job._id,product:{_id:product._id,name:product.name,price:product.price,countInStock:1,image:product.image,shopkeeper:{_id:shop._id,shopName:shop.shopName}},pages,copies,unitRate,price});}
 catch(e){await bucket().delete(stream.id);if(product)await Product.deleteOne({_id:product._id});throw e;}
}));
r.get('/jobs/:id/file',allowRoles('shopkeeper'),asyncHandler(async(req,res)=>{
 const job=await PrintJob.findOne({_id:req.params.id,shopkeeper:req.user._id});if(!job)fail('Print file unavailable.',404);
 if(!await Order.exists({shopOrders:{$elemMatch:{shopkeeper:req.user._id,status:{$nin:['scheduled','cancelled']},'items.product':job.product}}}))fail('The print job has not been released to your shop.',403);
 res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="print-job.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});const stream=bucket().openDownloadStream(job.fileId);stream.on('error',()=>{if(!res.headersSent)res.status(404).end();else res.destroy();});stream.pipe(res);
}));
r.get('/jobs',allowRoles('shopkeeper'),asyncHandler(async(req,res)=>{const orders=await Order.find({shopOrders:{$elemMatch:{shopkeeper:req.user._id,status:{$nin:['scheduled','cancelled']}}}});const products=orders.flatMap(o=>o.shopOrders.filter(g=>String(g.shopkeeper)===String(req.user._id)&&!['scheduled','cancelled'].includes(g.status)).flatMap(g=>g.items.map(i=>i.product)));res.json(await PrintJob.find({shopkeeper:req.user._id,product:{$in:products}}).select('-fileId -user'));}));
export default r;

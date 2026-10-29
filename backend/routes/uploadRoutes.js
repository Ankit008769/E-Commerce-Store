import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import {authenticate,authorizeStaff} from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {rateLimit} from '../utils/emailVerification.js';
import {safePhoto} from '../utils/safePhoto.js';
import {fail} from '../utils/marketplace.js';
const r=express.Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1}}).single('image');
r.post('/',authenticate,authorizeStaff,asyncHandler(async(req,res,next)=>{await rateLimit('photo-upload',String(req.user._id),60);next();}),upload,asyncHandler(async(req,res)=>{
 if(!req.file)fail('Choose a photo.');
 const bytes=await safePhoto(req.file.buffer),filename=crypto.randomUUID()+'.webp';
 await fs.mkdir('uploads',{recursive:true});await fs.writeFile('uploads/'+filename,bytes,{flag:'wx'});
 res.json({image:'/uploads/'+filename,message:'Photo uploaded.'});
}));
export default r;

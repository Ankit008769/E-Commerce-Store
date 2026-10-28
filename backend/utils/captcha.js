import mongoose from 'mongoose';
import {createHash,randomInt} from 'node:crypto';
import {createChallenge,verifySolution} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/pbkdf2';
import asyncHandler from '../middlewares/asyncHandler.js';
import {rateLimit} from './emailVerification.js';
import {fail} from './marketplace.js';
const schema=new mongoose.Schema({_id:String,expiresAt:Date},{versionKey:false});schema.index({expiresAt:1},{expireAfterSeconds:0});
export const CaptchaUse=mongoose.model('CaptchaUse',schema);
export const challenge=asyncHandler(async(req,res)=>{
 const purpose=req.query.purpose;if(!['login','signup','otp'].includes(purpose))fail('Invalid CAPTCHA purpose.');
 await rateLimit('captcha',String(req.ip),120);
 const result=await createChallenge({algorithm:'PBKDF2/SHA-256',cost:1000,counter:randomInt(200,400),deriveKey,hmacSignatureSecret:process.env.JWT_SECRET,expiresAt:new Date(Date.now()+300000),data:{purpose}});
 res.set('Cache-Control','no-store').json(result);
});
export const requireCaptcha=purpose=>asyncHandler(async(req,res,next)=>{
 let payload;try{if(typeof req.body.altcha!=='string'||req.body.altcha.length>16000)throw new Error();payload=JSON.parse(Buffer.from(req.body.altcha,'base64').toString('utf8'));}catch{fail('Complete the security check before continuing.');}
 const c=payload?.challenge;
 if(!c||c.parameters?.algorithm!=='PBKDF2/SHA-256'||c.parameters.cost!==1000||c.parameters.data?.purpose!==purpose)fail('Invalid security check. Please try again.');
 let valid=false;try{valid=(await verifySolution({challenge:c,solution:payload.solution,deriveKey,hmacSignatureSecret:process.env.JWT_SECRET})).verified;}catch{}
 if(!valid)fail('Security check expired or invalid. Please try again.');
 const id=createHash('sha256').update(c.signature).digest('hex');
 try{await CaptchaUse.create({_id:id,expiresAt:new Date(Date.now()+600000)});}catch(e){if(e.code===11000)fail('Security check already used. Please verify again.');throw e;}
 next();
});

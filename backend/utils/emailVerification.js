import {createHmac,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import EmailOtp from '../models/emailOtpModel.js';
import AuthRate from '../models/authRateModel.js';
import User from '../models/userModel.js';
import {fail} from './marketplace.js';
import {smtpConfigured,sendVerificationCode} from './otpMailer.js';
export const normalEmail=value=>String(value||'').trim().toLowerCase();
export const isCampusEmail=email=>/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@nith\.ac\.in$/i.test(email)&&email.length<=254;
const digest=value=>createHmac('sha256',process.env.JWT_SECRET).update(value).digest('hex');
export async function rateLimit(scope,value,limit){
 const now=Date.now(),window=Math.floor(now/3600000),id=scope+':'+window+':'+digest(value),update={$inc:{hits:1},$setOnInsert:{expiresAt:new Date((window+1)*3600000)}};
 let bucket;try{bucket=await AuthRate.findOneAndUpdate({_id:id},update,{upsert:true,new:true});}catch(e){if(e.code!==11000)throw e;bucket=await AuthRate.findOneAndUpdate({_id:id},{$inc:{hits:1}},{new:true});}
 if(bucket.hits>limit)fail('Too many verification requests. Please try again later.',429);
}
export async function requestEmailCode(value,ip,accountId=null){
 const email=normalEmail(value);if(!isCampusEmail(email))fail('Use your official NIT Hamirpur email ending in @nith.ac.in.');
 if(!smtpConfigured())fail('Email verification is temporarily unavailable. Please try again later.',503);
 await rateLimit('send-ip',String(ip||'unknown'),20);
 const context=accountId?'account:'+String(accountId):'signup';
 if(accountId){if(!await User.exists({_id:accountId,email,role:'customer',status:'active'}))fail('This account cannot verify this email.',403);}
 else if(await User.exists({email}))fail('An account already exists for this email. Please sign in.',409);
 await rateLimit('send-email',email,5);
 const challengeId=randomBytes(24).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0'),now=new Date();
 const document={context,challengeId,digest:digest(email+':'+challengeId+':'+code),attempts:0,sentAt:now,expiresAt:new Date(now.getTime()+600000)};
 try{await EmailOtp.findOneAndUpdate({_id:email,sentAt:{$lte:new Date(now.getTime()-60000)}},{$set:document},{upsert:true});}catch(e){if(e.code===11000)fail('Please wait 60 seconds before requesting another code.',429);throw e;}
 try{await sendVerificationCode(email,code);}catch{await EmailOtp.deleteOne({_id:email,challengeId});fail('We could not send the verification email. Please try again later.',503);}
 return {message:'Verification code sent. Check your college inbox and spam folder.',challengeId,expiresIn:600,retryAfter:60};
}
export async function consumeEmailCode(value,challengeId,code,ip,accountId=null){
 const email=normalEmail(value);await rateLimit('verify-ip',String(ip||'unknown'),60);
 if(!isCampusEmail(email)||typeof challengeId!=='string'||!/^[a-f0-9]{48}$/.test(challengeId)||typeof code!=='string'||!/^\d{6}$/.test(code))fail('Enter the six-digit code sent to your college email.');
 const context=accountId?'account:'+String(accountId):'signup';
 const record=await EmailOtp.findOneAndUpdate({_id:email,context,challengeId,expiresAt:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{new:true});
 if(!record)fail('Code expired, already used, or attempt limit reached. Request a new code.');
 const expected=Buffer.from(record.digest,'hex'),actual=Buffer.from(digest(email+':'+challengeId+':'+code),'hex');
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))fail('Incorrect verification code.');
 const used=await EmailOtp.findOneAndDelete({_id:email,context,challengeId,digest:record.digest,expiresAt:{$gt:new Date()}});
 if(!used)fail('Code expired or already used. Request a new code.');
}

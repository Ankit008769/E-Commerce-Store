import helmet from 'helmet';
import {rateLimit as requestLimit} from 'express-rate-limit';
import {rateLimit} from '../utils/emailVerification.js';
import asyncHandler from './asyncHandler.js';
import {fail} from '../utils/marketplace.js';
export const securityHeaders=helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com','data:'],imgSrc:["'self'",'data:','blob:','https:'],connectSrc:["'self'"],workerSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'none'"],frameAncestors:["'none'"],formAction:["'self'"],upgradeInsecureRequests:process.env.NODE_ENV==='production'?[]:null}},strictTransportSecurity:process.env.NODE_ENV==='production'?{maxAge:31536000,includeSubDomains:false}:false,referrerPolicy:{policy:'strict-origin-when-cross-origin'}});
export const apiLimit=requestLimit({windowMs:60000,limit:1800,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many requests. Please try again shortly.'}});
export function originGuard(req,res,next){
 res.set('Cache-Control','private, no-store');
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const configured=process.env.PUBLIC_ORIGIN||'https://campuscart.34.93.237.251.sslip.io';
 const allowed=new Set([configured,...(process.env.NODE_ENV==='production'?[]:['http://localhost:5173','http://127.0.0.1:5173','http://localhost:5010','http://127.0.0.1:5010'])]);
 const origin=req.get('Origin');
 if(req.get('Sec-Fetch-Site')==='cross-site'||(origin&&!allowed.has(origin)))return res.status(403).json({message:'Cross-site request rejected.'});
 if(!origin&&req.get('Referer')){try{if(!allowed.has(new URL(req.get('Referer')).origin))throw new Error();}catch{return res.status(403).json({message:'Cross-site request rejected.'});}}
 if(req.get('Content-Type')&&!req.is(['application/json','multipart/form-data']))return res.status(415).json({message:'Use JSON or multipart form data.'});
 next();
}
export function validatePayload(value,depth=0){
 if(depth>15)fail('Request is too deeply nested.');
 if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
  if(key.includes('$')||key.includes('.')||['__proto__','prototype','constructor'].includes(key))fail('Invalid request field.');
  validatePayload(child,depth+1);
 }
}
export function inputGuard(req,res,next){try{validatePayload(req.body);validatePayload(req.query);next();}catch(e){next(e);}}
export const loginLimit=asyncHandler(async(req,res,next)=>{
 await rateLimit('login-ip',String(req.ip),100);
 if(typeof req.body.email==='string'&&req.body.email.length<=254)await rateLimit('login-email',req.body.email.trim().toLowerCase(),20);
 next();
});
export const profileLimit=asyncHandler(async(req,res,next)=>{await rateLimit('profile-update',String(req.user._id),30);next();});
export {safeError} from './safeError.js';

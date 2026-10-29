import {createHash} from 'node:crypto';
import jwt from 'jsonwebtoken';
import RevokedSession from '../models/revokedSessionModel.js';
import {requestEmailCode,consumeEmailCode} from '../utils/emailVerification.js';
import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import bcrypt from 'bcryptjs';
import createToken from '../utils/createToken.js';
import {roleOf,fail,numeric} from '../utils/marketplace.js';
const identity = u => ({_id:u._id, username:u.username, email:u.email, role:roleOf(u), isAdmin:['superadmin','administrator'].includes(roleOf(u)), shopName:u.shopName, status:u.status || 'active',emailVerified:!!u.emailVerifiedAt});
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
const campusEmail = value => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@nith\.ac\.in$/i.test(String(value || '').trim());
function credentials(b) { if (typeof b.username!=='string'||!b.username.trim()||b.username.length>80||typeof b.email!=='string'||b.email.length>254||!validEmail(b.email)||typeof b.password!=='string'||b.password.length<8||Buffer.byteLength(b.password)>72) fail('Enter a name, valid email, and password of 8 characters or more (maximum 72 UTF-8 bytes).'); }
export const requestRegistrationOtp = asyncHandler(async(req,res)=>res.json(await requestEmailCode(req.body.email,req.ip)));
export const createUser = asyncHandler(async (req,res) => {
 req.body.email=String(req.body.email || '').trim().toLowerCase();
 credentials(req.body);
 if(!campusEmail(req.body.email))fail('Use your official NIT Hamirpur email address ending in @nith.ac.in.');
 if(await User.exists({email:req.body.email}))fail('An account already exists for this email. Please sign in.',409);
 const password=await bcrypt.hash(req.body.password,10);
 await consumeEmailCode(req.body.email,req.body.challengeId,req.body.otp,req.ip);
 let u;try{u=await User.create({username:req.body.username,email:req.body.email,password,role:'customer',emailVerifiedAt:new Date()});}catch(e){if(e.code===11000)fail('An account already exists for this email. Please sign in.',409);throw e;}
 createToken(res,u._id,u.sessionVersion||0); res.status(201).json(identity(u));
});
export const loginUser = asyncHandler(async (req,res) => {
 const u = await User.findOne({email:String(req.body.email || '').trim().toLowerCase()});
 if (!u || typeof req.body.password !== 'string' || req.body.password.length>256 || !await bcrypt.compare(req.body.password,u.password)) fail('Incorrect email or password.',401);
 if (u.status && u.status !== 'active') fail('This account is unavailable. Contact the Super Administrator.',403);
 if (req.body.portal === 'customer' && roleOf(u) !== 'customer') fail('Use shop and administration sign in at /admin/login.',403);
 if (req.body.portal === 'management' && roleOf(u) === 'customer') fail('Use customer sign in.',403);
 createToken(res,u._id,u.sessionVersion||0); res.json(identity(u));
});
export const logoutCurrentUser = asyncHandler(async(req,res)=>{
 const token=req.cookies.jwt;
 if(typeof token==='string'){
  let decoded;try{decoded=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});}catch{}
  if(decoded?.exp)await RevokedSession.updateOne({_id:createHash('sha256').update(token).digest('hex')},{$setOnInsert:{expiresAt:new Date(decoded.exp*1000)}},{upsert:true});
 }
 res.clearCookie('jwt',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});res.json({message:'Signed out'});
});
export const getCurrentUserProfile = asyncHandler(async (req,res) => res.json(identity(req.user)));
export const updateCurrentUserProfile = asyncHandler(async(req,res)=>{
 const u=await User.findById(req.user._id),changes={};
 if(req.body.username!==undefined){if(typeof req.body.username!=='string'||!req.body.username.trim()||req.body.username.length>80)fail('Enter a name up to 80 characters.');changes.username=req.body.username.trim();}
 if(req.body.email!==undefined){if(typeof req.body.email!=='string'||req.body.email.length>254||!validEmail(req.body.email))fail('Enter a valid email.');const email=req.body.email.trim().toLowerCase();if(roleOf(u)==='customer'&&email!==u.email)fail('Customer email cannot be changed here. Contact the Super Administrator for help.');changes.email=email;}
 const passwordChange=req.body.password!==undefined&&req.body.password!=='';
 if(passwordChange&&(typeof req.body.password!=='string'||req.body.password.length<8||Buffer.byteLength(req.body.password)>72))fail('Use 8 or more characters, up to 72 UTF-8 bytes.');
 const sensitive=passwordChange||(changes.email&&changes.email!==u.email);
 if(sensitive){if(typeof req.body.currentPassword!=='string'||req.body.currentPassword.length>256||!await bcrypt.compare(req.body.currentPassword,u.password))fail('Enter your current password to change password or email.',403);if(passwordChange)changes.password=await bcrypt.hash(req.body.password,10);}
 const updated=await User.findOneAndUpdate({_id:u._id,password:u.password},{$set:changes,...(sensitive?{$inc:{sessionVersion:1}}:{})},{new:true,runValidators:true});
 if(!updated)fail('Account changed. Please sign in again.',409);
 if(sensitive)createToken(res,updated._id,updated.sessionVersion||0);
 res.json(identity(updated));
});
export const getAllUsers = asyncHandler(async (req,res) => res.json((await User.find().select('-password').sort({createdAt:-1})).map(u => ({...identity(u),deliveryPolicy:u.deliveryPolicy}))));
export const createStaff = asyncHandler(async (req,res) => {
 credentials(req.body);
 if (!['shopkeeper','administrator'].includes(req.body.role)) fail('Choose shopkeeper or administrator.');
 if (req.body.role === 'shopkeeper' && (typeof req.body.shopName!=='string'||!req.body.shopName.trim()||req.body.shopName.length>150)) fail('Shop name is required.');
 const u = await User.create({username:req.body.username,email:req.body.email,password:await bcrypt.hash(req.body.password,10),role:req.body.role,shopName:req.body.shopName});
 res.status(201).json(identity(u));
});
export const updateUserById = asyncHandler(async (req,res) => {
 const u = await User.findById(req.params.id); if (!u) fail('Account not found.',404);
 if (roleOf(u) === 'superadmin') fail('Super Administrator accounts cannot be changed here.',403);
 if (req.body.status !== undefined) { if (!['active','blacklisted','removed'].includes(req.body.status)) fail('Invalid status.'); u.status=req.body.status; }
 if(req.body.shopName!==undefined){if(typeof req.body.shopName!=='string'||!req.body.shopName.trim()||req.body.shopName.length>150)fail('Enter a shop name up to 150 characters.');u.shopName=req.body.shopName.trim();}
 if (req.body.deliveryPolicy) {
  if (roleOf(u) !== 'shopkeeper') fail('Delivery policies apply to shopkeepers.');
  for (const k of ['minimumOrder','deliveryCharge','deliveryMinutes','latePenalty']) if (req.body.deliveryPolicy[k] !== undefined) u.deliveryPolicy[k]=numeric(req.body.deliveryPolicy[k],k,k === 'deliveryMinutes' ? 1 : 0,k === 'deliveryMinutes' ? 10080 : 10000000);
 }
 await u.save(); res.json({...identity(u),deliveryPolicy:u.deliveryPolicy});
});
export const deleteUserById = asyncHandler(async (req,res) => {
 const u=await User.findById(req.params.id); if (!u) fail('Account not found.',404);
 if (roleOf(u)==='superadmin') fail('Cannot remove a Super Administrator.',403);
 u.status='removed'; await u.save(); res.json({message:'Account removed; history retained.'});
});

export const requestProfileOtp=asyncHandler(async(req,res)=>{
 if(roleOf(req.user)!=='customer')fail('Email verification is for customer accounts.',403);
 if(req.user.emailVerifiedAt)return res.json({alreadyVerified:true,user:identity(req.user)});
 res.json(await requestEmailCode(req.user.email,req.ip,req.user._id));
});
export const verifyProfileEmail=asyncHandler(async(req,res)=>{
 if(roleOf(req.user)!=='customer')fail('Email verification is for customer accounts.',403);
 if(req.user.emailVerifiedAt)return res.json(identity(req.user));
 await consumeEmailCode(req.user.email,req.body.challengeId,req.body.otp,req.ip,req.user._id);
 const user=await User.findOneAndUpdate({_id:req.user._id,email:req.user.email,status:'active'},{$set:{emailVerifiedAt:new Date()}},{new:true});
 if(!user)fail('Account changed. Please sign in again.',409);
 res.json(identity(user));
});

import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import bcrypt from 'bcryptjs';
import createToken from '../utils/createToken.js';
import {roleOf,fail,numeric} from '../utils/marketplace.js';
const identity = u => ({_id:u._id, username:u.username, email:u.email, role:roleOf(u), isAdmin:['superadmin','administrator'].includes(roleOf(u)), shopName:u.shopName, status:u.status || 'active'});
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
function credentials(b) { if (!b.username?.trim() || !validEmail(b.email) || typeof b.password !== 'string' || b.password.length < 8) fail('Enter a name, valid email, and password of at least 8 characters.'); }
export const createUser = asyncHandler(async (req,res) => {
 credentials(req.body);
 const u = await User.create({username:req.body.username,email:req.body.email,password:await bcrypt.hash(req.body.password,10),role:'customer'});
 createToken(res,u._id); res.status(201).json(identity(u));
});
export const loginUser = asyncHandler(async (req,res) => {
 const u = await User.findOne({email:String(req.body.email || '').trim().toLowerCase()});
 if (!u || typeof req.body.password !== 'string' || !await bcrypt.compare(req.body.password,u.password)) fail('Incorrect email or password.',401);
 if (u.status && u.status !== 'active') fail('This account is unavailable. Contact the Super Administrator.',403);
 if (req.body.portal === 'customer' && roleOf(u) !== 'customer') fail('Use shop and administration sign in at /admin/login.',403);
 if (req.body.portal === 'management' && roleOf(u) === 'customer') fail('Use customer sign in.',403);
 createToken(res,u._id); res.json(identity(u));
});
export const logoutCurrentUser = asyncHandler(async (req,res) => { res.clearCookie('jwt',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV === 'production'}); res.json({message:'Signed out'}); });
export const getCurrentUserProfile = asyncHandler(async (req,res) => res.json(identity(req.user)));
export const updateCurrentUserProfile = asyncHandler(async (req,res) => {
 const u = await User.findById(req.user._id);
 if (req.body.username?.trim()) u.username = req.body.username.trim();
 if (req.body.email) { if (!validEmail(req.body.email)) fail('Enter a valid email.'); u.email=req.body.email; }
 if (req.body.password) { if (req.body.password.length < 8) fail('Use at least 8 characters.'); u.password=await bcrypt.hash(req.body.password,10); }
 await u.save(); res.json(identity(u));
});
export const getAllUsers = asyncHandler(async (req,res) => res.json((await User.find().select('-password').sort({createdAt:-1})).map(u => ({...identity(u),deliveryPolicy:u.deliveryPolicy}))));
export const createStaff = asyncHandler(async (req,res) => {
 credentials(req.body);
 if (!['shopkeeper','administrator'].includes(req.body.role)) fail('Choose shopkeeper or administrator.');
 if (req.body.role === 'shopkeeper' && !req.body.shopName?.trim()) fail('Shop name is required.');
 const u = await User.create({username:req.body.username,email:req.body.email,password:await bcrypt.hash(req.body.password,10),role:req.body.role,shopName:req.body.shopName});
 res.status(201).json(identity(u));
});
export const updateUserById = asyncHandler(async (req,res) => {
 const u = await User.findById(req.params.id); if (!u) fail('Account not found.',404);
 if (roleOf(u) === 'superadmin') fail('Super Administrator accounts cannot be changed here.',403);
 if (req.body.status !== undefined) { if (!['active','blacklisted','removed'].includes(req.body.status)) fail('Invalid status.'); u.status=req.body.status; }
 if (req.body.shopName?.trim()) u.shopName=req.body.shopName.trim();
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

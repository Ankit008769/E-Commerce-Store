import {createHash} from 'node:crypto';
import RevokedSession from '../models/revokedSessionModel.js';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import asyncHandler from './asyncHandler.js';
import {roleOf,fail} from '../utils/marketplace.js';
export const authenticate = asyncHandler(async (req,res,next) => {
 let d; try { d = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET,{algorithms:['HS256']}); } catch { fail('Please sign in again.',401); }
 if(typeof d.userId!=='string'||!/^[a-f0-9]{24}$/i.test(d.userId))fail('Please sign in again.',401);
 if(await RevokedSession.exists({_id:createHash('sha256').update(req.cookies.jwt).digest('hex')}))fail('Please sign in again.',401);
 req.user = await User.findById(d.userId).select('-password');
 if(req.user&&Number(d.v||0)!==Number(req.user.sessionVersion||0))fail('Please sign in again.',401);
 if (!req.user || (req.user.status && req.user.status !== 'active')) fail('This account is unavailable.',403);
 next();
});
export const allowRoles = (...roles) => (req,res,next) => roles.includes(roleOf(req.user)) ? next() : res.status(403).json({message:'You do not have access to this action.'});
export const authorizeAdmin = allowRoles('superadmin','administrator');
export const authorizeStaff = allowRoles('superadmin','administrator','shopkeeper');
export const authorizeSuperAdmin = allowRoles('superadmin');

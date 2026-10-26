// Run from the project root: node backend/utils/promoteSuperAdmin.js your-email@example.com
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
const email=process.argv[2]?.trim().toLowerCase();
if(!email)throw new Error('Provide the email of an existing account to promote.');
try{
 await mongoose.connect(process.env.MONGO_URI);
 const user=await User.findOne({email});
 if(!user)throw new Error('Register this account first. No account was changed.');
 user.role='superadmin';user.isAdmin=true;user.status='active';await user.save();
 console.log('Super Administrator enabled for '+email+'. Sign in again.');
}finally{await mongoose.disconnect();}

import mongoose from 'mongoose';
const schema=new mongoose.Schema({_id:String,challengeId:{type:String,required:true},digest:{type:String,required:true},attempts:{type:Number,default:0},sentAt:{type:Date,required:true},expiresAt:{type:Date,required:true}},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export default mongoose.model('EmailOtp',schema);

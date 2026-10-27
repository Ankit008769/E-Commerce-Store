import mongoose from 'mongoose';
const schema=new mongoose.Schema({_id:String,hits:{type:Number,default:0},expiresAt:Date},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export default mongoose.model('AuthRate',schema);

import mongoose from 'mongoose';
const schema=new mongoose.Schema({endpoint:{type:String,required:true,unique:true},user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},keys:{auth:String,p256dh:String},cursorAt:{type:Date,required:true},cursorId:{type:String,default:''},alertCursorAt:Date,alertCursorId:String,leaseUntil:Date},{timestamps:true});
export default mongoose.model('PushSubscription',schema);

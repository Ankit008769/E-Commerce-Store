import mongoose from 'mongoose';
// _id gives each customer/check-out pair a database-enforced unique claim.
const schema=new mongoose.Schema({
 couponId:{type:mongoose.Schema.Types.ObjectId,ref:'Coupon'},
 owner:{host:String,pid:Number,token:String},
 state:{type:String,enum:['pending','completed'],default:'pending',index:true},
 reservations:[{_id:false,product:{type:mongoose.Schema.Types.ObjectId,ref:'Product'},qty:Number}],
 _id:String,fingerprint:{type:String,required:true},orderId:{type:mongoose.Schema.Types.ObjectId,required:true}
},{timestamps:true});
export default mongoose.model('CheckoutRequest',schema);

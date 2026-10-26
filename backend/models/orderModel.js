import mongoose from 'mongoose';
const item = new mongoose.Schema({name:String,image:String,qty:Number,price:Number,product:{type:mongoose.Schema.Types.ObjectId,ref:'Product'}});
const group = new mongoose.Schema({
 shopkeeper:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},shopName:String,items:[item],
 itemsPrice:Number,shippingPrice:Number,minimumOrder:Number,deliveryCharge:Number,deliveryMinutes:Number,
 deadline:Date,latePenalty:{type:Number,default:0},deduction:{type:Number,default:0},
 isDelivered:{type:Boolean,default:false},deliveredAt:Date
});
const schema=new mongoose.Schema({
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 orderItems:[item],shopOrders:[group],
 shippingAddress:{address:{type:String,required:true},city:{type:String,required:true},postalCode:{type:String,required:true},country:{type:String,required:true}},
 paymentMethod:{type:String,required:true},itemsPrice:Number,shippingPrice:Number,taxPrice:{type:Number,default:0},totalPrice:Number,
 isPaid:{type:Boolean,default:false},paidAt:Date,isDelivered:{type:Boolean,default:false},deliveredAt:Date
},{timestamps:true});
export default mongoose.model('Order',schema);

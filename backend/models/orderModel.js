import mongoose from 'mongoose';
import {GROUP_STATES} from '../../shared/fulfillment.js';
const item = new mongoose.Schema({note:{type:String,maxlength:300},name:String,image:String,qty:Number,price:Number,product:{type:mongoose.Schema.Types.ObjectId,ref:'Product'}});
const group = new mongoose.Schema({
 shopkeeper:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},shopName:String,items:[item],
 status:{type:String,enum:GROUP_STATES,default:'preparing'},deliveryMode:{type:String,enum:['shop','rider'],default:'shop'},scheduledFor:Date,releaseAt:Date,pickupToken:String,releaseProcessedAt:Date,stockRestoredAt:Date,cancelReason:String,deliveryCode:String,riderName:String,rider:{type:mongoose.Schema.Types.ObjectId,ref:'User'},discount:{type:Number,default:0},
 itemsPrice:Number,shippingPrice:Number,minimumOrder:Number,deliveryCharge:Number,deliveryMinutes:Number,
 deadline:Date,latePenalty:{type:Number,default:0},deduction:{type:Number,default:0},
 isDelivered:{type:Boolean,default:false},deliveredAt:Date
});
const schema=new mongoose.Schema({
 workflowVersion:Number,couponCode:String,couponId:{type:mongoose.Schema.Types.ObjectId,ref:'Coupon'},discount:{type:Number,default:0},status:{type:String,enum:['scheduled','placed','completed','cancelled'],default:'placed'},
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 orderItems:[item],shopOrders:[group],
 shippingAddress:{phone:{type:String},address:{type:String,required:true},city:{type:String,required:true},postalCode:{type:String,required:true},country:{type:String,required:true}},
 paymentMethod:{type:String,required:true},itemsPrice:Number,shippingPrice:Number,taxPrice:{type:Number,default:0},totalPrice:Number,
 isPaid:{type:Boolean,default:false},paidAt:Date,isDelivered:{type:Boolean,default:false},deliveredAt:Date
},{timestamps:true});
export default mongoose.model('Order',schema);

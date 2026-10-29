import mongoose from 'mongoose';
const review = new mongoose.Schema({name:String,rating:{type:Number,min:1,max:5},comment:String,user:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
const schema = new mongoose.Schema({
 printOwner:{type:mongoose.Schema.Types.ObjectId,ref:'User'},stockRestores:{type:[String],default:[],select:false},
 name:{type:String,trim:true,default:''},image:{type:String,required:true},shopkeeper:{type:mongoose.Schema.Types.ObjectId,ref:'User',index:true},
 brand:{type:String,default:''},quantity:{type:Number,default:1},category:{type:mongoose.Schema.Types.ObjectId,ref:'Category'},
 description:{type:String,default:''},reviews:[review],rating:{type:Number,default:0},numReviews:{type:Number,default:0},
 stockReservations:{type:[{_id:false,requestId:String,reservationId:String,qty:Number}],default:[],select:false},
 price:{type:Number,required:true,min:0.01},countInStock:{type:Number,default:1,min:0}
},{timestamps:true});
export default mongoose.model('Product',schema);

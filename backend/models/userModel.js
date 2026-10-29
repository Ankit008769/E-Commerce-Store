import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 username: {type:String, required:true, trim:true}, email:{type:String, required:true, unique:true, lowercase:true, trim:true},
 password:{type:String, required:true},sessionVersion:{type:Number,default:0}, emailVerifiedAt:{type:Date}, isAdmin:{type:Boolean, default:false},
 role:{type:String, enum:['customer','shopkeeper','administrator','superadmin']},
 status:{type:String, enum:['active','blacklisted','removed'], default:'active'}, shopName:{type:String, trim:true},
 favorites:[{type:mongoose.Schema.Types.ObjectId,ref:'Product'}],
 shopSettings:{hoursConfigured:{type:Boolean,default:false},closed:{type:Boolean,default:false},prepMinutes:{type:Number,default:15},walkMinutes:{type:Number,default:10},hours:[{_id:false,day:Number,open:Number,close:Number}],printEnabled:{type:Boolean,default:false},blackWhiteRate:{type:Number,default:2},colourRate:{type:Number,default:10}},
 deliveryPolicy:{
  minimumOrder:{type:Number,min:0,default:500}, deliveryCharge:{type:Number,min:0,default:30},
  deliveryMinutes:{type:Number,min:1,default:60}, latePenalty:{type:Number,min:0,default:0}
 }
}, {timestamps:true});
export default mongoose.model('User', schema);

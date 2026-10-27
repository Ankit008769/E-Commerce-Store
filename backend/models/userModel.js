import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 username: {type:String, required:true, trim:true}, email:{type:String, required:true, unique:true, lowercase:true, trim:true},
 password:{type:String, required:true}, emailVerifiedAt:{type:Date}, isAdmin:{type:Boolean, default:false},
 role:{type:String, enum:['customer','shopkeeper','administrator','superadmin']},
 status:{type:String, enum:['active','blacklisted','removed'], default:'active'}, shopName:{type:String, trim:true},
 deliveryPolicy:{
  minimumOrder:{type:Number,min:0,default:500}, deliveryCharge:{type:Number,min:0,default:30},
  deliveryMinutes:{type:Number,min:1,default:60}, latePenalty:{type:Number,min:0,default:0}
 }
}, {timestamps:true});
export default mongoose.model('User', schema);

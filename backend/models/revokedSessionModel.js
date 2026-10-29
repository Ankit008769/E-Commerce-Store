import mongoose from 'mongoose';
const schema=new mongoose.Schema({_id:String,expiresAt:Date},{versionKey:false});schema.index({expiresAt:1},{expireAfterSeconds:0});
export default mongoose.model('RevokedSession',schema);

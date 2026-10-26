import 'dotenv/config';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';
try{
 await mongoose.connect(process.env.MONGO_URI);
 const shop=await User.findOne({email:'4h@campuscart.local',role:'shopkeeper'});if(!shop)throw Error('4H shop not found');
 const mapping=JSON.parse(await fs.readFile(new URL('../data/menus/4h-categories.json',import.meta.url),'utf8'));
 const products=await Product.find({shopkeeper:shop._id});if(products.some(p=>!mapping[p.name]))throw Error('Unmapped product');
 let count=0;for(const p of products){const name=mapping[p.name];const category=await Category.findOneAndUpdate({name},{$setOnInsert:{name}},{upsert:true,new:true});await Product.updateOne({_id:p._id},{$set:{category:category._id}});count++;}
 console.log(JSON.stringify({updated:count,categories:[...new Set(Object.values(mapping))]}));
}finally{await mongoose.disconnect();}

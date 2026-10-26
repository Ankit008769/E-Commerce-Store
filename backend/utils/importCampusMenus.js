// Run from the project root: node backend/utils/importCampusMenus.js <private-credentials-output.json>
// Additive and repeatable: existing products, inventory, passwords and delivery policies are preserved.
import 'dotenv/config';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';
function csv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(field||row.length){row.push(field);rows.push(row);}const headers=rows.shift();return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(headers.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]])));
}
const shops=[
 {file:'jai_santoshi_maa.csv',name:'Jai Santoshi Maa - Booth 4',email:'booth4@campuscart.local',photo:'/uploads/booth4-menu.jpeg',count:108},
 {file:'nit_hamirpur_canteen.csv',name:'4H Canteen',email:'4h@campuscart.local',photo:'/uploads/4h-menu.jpeg',count:58}
];
const credentials=[];
let productPhotos={};
try{productPhotos=JSON.parse(await fs.readFile(new URL('../data/menus/product-photos.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
try{
 if(!process.argv[2])throw Error('Provide a private credentials output path.');
 const inputs=await Promise.all(shops.map(async s=>csv(await fs.readFile(new URL('../data/menus/'+s.file,import.meta.url),'utf8'))));
 for(const [i,rows] of inputs.entries())if(rows.length!==shops[i].count||rows.some(r=>!r.item_name||!(Number(r.price_inr)>0)))throw Error('Invalid menu input');
 await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:5000});
 for(const [i,s] of shops.entries()){
  let shop=await User.findOne({email:s.email});
  if(shop&&shop.role!=='shopkeeper')throw Error('Email already belongs to another role: '+s.email);
  if(!shop){const password='Campus!'+crypto.randomBytes(8).toString('hex');
   // Save credentials before creating the account so an interruption cannot lose its password.
   credentials.push({shop:s.name,email:s.email,password});
   await fs.writeFile(process.argv[2],JSON.stringify(credentials,null,2),{mode:0o600});
   shop=await User.create({username:s.name,shopName:s.name,email:s.email,password:await bcrypt.hash(password,10),role:'shopkeeper',status:'active',isAdmin:false});
  }
  let added=0;
  for(const row of inputs[i]){
   const name=row.item_name+(row.variant?' ('+row.variant+')':'');
   if(await Product.exists({shopkeeper:shop._id,name}))continue;
   const category=await Category.findOneAndUpdate({name:row.category},{$setOnInsert:{name:row.category}},{upsert:true,new:true});
   const photo=productPhotos[s.email+':'+name];
   await Product.create({name,shopkeeper:shop._id,brand:s.name,price:Number(row.price_inr),image:photo?.image||s.photo,category:category._id,countInStock:100,quantity:1,description:[row.description,row.availability?'Availability: '+row.availability:'',row.notes,'Initial stock is 100 test servings, not confirmed shop inventory.',photo?.photoNote||'Menu photo shown; individual dish photo not yet supplied.'].filter(Boolean).join('\n')});added++;
  }
  console.log(JSON.stringify({shop:s.name,email:s.email,added,total:await Product.countDocuments({shopkeeper:shop._id}),deliveryPolicy:shop.deliveryPolicy}));
 }
}finally{await mongoose.disconnect();}

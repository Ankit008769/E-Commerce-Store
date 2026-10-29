import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import {rankRecommendations} from '../utils/recommendations.js';
import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {roleOf,fail,numeric} from '../utils/marketplace.js';
const shopFields={path:'shopkeeper',select:'shopName username shopSettings deliveryPolicy.minimumOrder deliveryPolicy.deliveryCharge deliveryPolicy.deliveryMinutes'};
const activeShops=async () => (await User.find({role:'shopkeeper',status:'active'}).select('_id')).map(s=>s._id);
async function owned(req) {
 const p=await Product.findById(req.params.id); if (!p) fail('Product not found.',404); if(p.printOwner)fail('Print jobs are priced only by the print service.',403);
 if (roleOf(req.user)==='shopkeeper' && String(p.shopkeeper)!==String(req.user._id)) fail('You can only manage your own products.',403);
 return p;
}
async function fields(req,old) {
 const b=req.fields || req.body;
 const shopkeeper=roleOf(req.user)==='shopkeeper' ? req.user._id : b.shopkeeper || old?.shopkeeper;
 const shop=await User.findOne({_id:shopkeeper,role:'shopkeeper',status:'active'});
 if (!shop) fail('Assign this product to an active shopkeeper.');
 if (!b.image || !/^(\/uploads\/|https?:\/\/)/.test(b.image)) fail('Upload a product photo.');
 const stock=numeric(b.countInStock ?? 1,'Stock',0,100000); if (!Number.isInteger(stock)) fail('Stock must be a whole number.');
 return {name:String(b.name || '').trim(),image:b.image,description:String(b.description || ''),brand:String(b.brand || ''),category:b.category === undefined ? old?.category : b.category || undefined,price:numeric(b.price,'Price',0.01),countInStock:stock,shopkeeper};
}
export const addProduct=asyncHandler(async (req,res)=>res.status(201).json(await Product.create(await fields(req))));
export const updateProductDetails=asyncHandler(async (req,res)=>{const p=await owned(req);Object.assign(p,await fields(req,p));res.json(await p.save());});
export const removeProduct=asyncHandler(async(req,res)=>{const p=await owned(req);await p.deleteOne();res.json({message:'Product removed.'});});
export const fetchAllProducts=asyncHandler(async(req,res)=>res.json(await Product.find({printOwner:{$exists:false},shopkeeper:{$in:await activeShops()}}).populate(shopFields).sort({createdAt:-1})));
export const manageProducts=asyncHandler(async(req,res)=>res.json(await Product.find({printOwner:{$exists:false},...(roleOf(req.user)==='shopkeeper'?{shopkeeper:req.user._id}:{})}).populate(shopFields).sort({createdAt:-1})));
export const fetchProducts=asyncHandler(async(req,res)=>res.json({products:await Product.find({printOwner:{$exists:false},shopkeeper:{$in:await activeShops()}}).populate(shopFields).sort({createdAt:-1}),page:1,pages:1}));
export const fetchProductById=asyncHandler(async(req,res)=>{const p=await Product.findOne({_id:req.params.id,printOwner:{$exists:false},shopkeeper:{$in:await activeShops()}}).populate(shopFields);if(!p)fail('This product is unavailable.',404);res.json(p);});
export const fetchTopProducts=asyncHandler(async(req,res)=>res.json(await Product.find({printOwner:{$exists:false},shopkeeper:{$in:await activeShops()}}).populate(shopFields).sort({rating:-1}).limit(4)));
export const fetchNewProducts=fetchAllProducts;
export const filterProducts=fetchAllProducts;
export const addProductReview=asyncHandler(async(req,res)=>{
 const p=await Product.findOne({_id:req.params.id,printOwner:{$exists:false},shopkeeper:{$in:await activeShops()}});if(!p)fail('Product unavailable.',404);
 if(!await Order.exists({user:req.user._id,isDelivered:true,deliveredAt:{$gte:new Date(Date.now()-7*86400000)},'orderItems.product':p._id}))fail('Review a purchased product within 7 days of delivery.');
 if(p.reviews.some(r=>String(r.user)===String(req.user._id)))fail('You have already reviewed this product.');
 const rating=numeric(req.body.rating,'Rating',1,5);if(!Number.isInteger(rating)||!req.body.comment?.trim())fail('Enter a rating and review.');
 p.reviews.push({name:req.user.username,user:req.user._id,rating,comment:req.body.comment.trim()});
 p.numReviews=p.reviews.length;p.rating=p.reviews.reduce((s,r)=>s+r.rating,0)/p.numReviews;await p.save();res.status(201).json({message:'Review added.'});
});


export const fetchRecommendations = asyncHandler(async (req,res) => {
  const shopIds = await activeShops();
  const source = await Product.findOne({_id:req.params.id,printOwner:{$exists:false},shopkeeper:{$in:shopIds}}).lean();
  if (!source) fail('This product is unavailable.',404);
  const candidates = await Product.find({_id:{$ne:source._id},printOwner:{$exists:false},shopkeeper:{$in:shopIds},countInStock:{$gt:0}})
    .populate(shopFields).lean();
  res.json(rankRecommendations(source,candidates));
});

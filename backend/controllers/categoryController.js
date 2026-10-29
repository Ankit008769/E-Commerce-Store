import Category from '../models/categoryModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {fail} from '../utils/marketplace.js';
const nameOf=req=>{const name=req.body.name;if(typeof name!=='string'||!name.trim()||name.length>100)fail('Enter a category name up to 100 characters.');return name.trim();};
export const createCategory=asyncHandler(async(req,res)=>{const name=nameOf(req);if(await Category.exists({name}))fail('Category already exists.',409);res.status(201).json(await Category.create({name}));});
export const updateCategory=asyncHandler(async(req,res)=>{const name=nameOf(req),category=await Category.findById(req.params.categoryId);if(!category)fail('Category not found.',404);category.name=name;res.json(await category.save());});
export const removeCategory=asyncHandler(async(req,res)=>{const category=await Category.findByIdAndDelete(req.params.categoryId);if(!category)fail('Category not found.',404);res.json(category);});
export const listCategory=asyncHandler(async(req,res)=>res.json(await Category.find({})));
export const readCategory=asyncHandler(async(req,res)=>{const category=await Category.findById(req.params.id);if(!category)fail('Category not found.',404);res.json(category);});

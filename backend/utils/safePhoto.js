import sharp from 'sharp';
import {fail} from './marketplace.js';
export async function safePhoto(bytes){
 try{
  const image=sharp(bytes,{limitInputPixels:16000000,failOn:'warning'}),info=await image.metadata();
  if(!['jpeg','png','webp'].includes(info.format)||!info.width||!info.height||(info.pages||1)>1)fail('Choose a valid, non-animated JPG, PNG or WebP photo.');
  return await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 }catch{fail('Photo cannot be processed. Use a JPG, PNG or WebP up to 5 MB and 16 megapixels.');}
}

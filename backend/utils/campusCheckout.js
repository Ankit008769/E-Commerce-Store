import {randomInt} from 'node:crypto';
import {Coupon} from '../models/campusModels.js';
import {fail,money} from './marketplace.js';
import {slotRule,shopOpen,couponValue} from '../../shared/fulfillment.js';
export function fulfillmentFor(body,shop){
 const deliveryMode=body.deliveryMode||'shop';if(!['shop','rider'].includes(deliveryMode))fail('Choose shop delivery or a student rider.');
 const result={deliveryMode,status:'preparing',releaseAt:new Date()};
 if(body.scheduledFor){const slot=slotRule(body.scheduledFor,shop.shopSettings);if(!slot.valid)fail(slot.reason);Object.assign(result,{status:'scheduled',scheduledFor:slot.scheduledFor,releaseAt:slot.releaseAt});}
 else if(!shopOpen(shop.shopSettings,new Date()))fail('This shop is closed. Choose an available scheduled slot.');
 return result;
}
export async function applyCoupon(priced,body,user){
 const code=String(body.couponCode||'').trim().toUpperCase();if(!code)return priced;
 const c=await Coupon.findOne({code});if(!c)fail('Coupon not found.');
 const eligible=priced.shopOrders.filter(g=>!c.shopkeeper||String(g.shopkeeper)===String(c.shopkeeper));if(!eligible.length)fail('This coupon is for a different shop.');
 if(c.redemptions.length>=c.maxUses)fail('This coupon has been used up.');
 if(c.oncePerCustomer&&c.redemptions.some(x=>String(x.user)===String(user._id)))fail('You have already used this coupon.');
 const subtotal=money(eligible.reduce((s,g)=>s+g.itemsPrice,0));let discount;try{discount=couponValue(c,subtotal);}catch(e){fail(e.message);}
 let remaining=discount;eligible.forEach((g,i)=>{g.discount=i===eligible.length-1?remaining:Math.min(remaining,money(discount*g.itemsPrice/subtotal));remaining=money(remaining-g.discount);});
 return {...priced,couponId:c._id,couponCode:code,discount,totalPrice:money(priced.totalPrice-discount)};
}
export async function reserveCoupon(claim,user){
 if(!claim.couponId)return;const c=await Coupon.findById(claim.couponId);if(!c)fail('Coupon no longer available.',409);
 const now=new Date(),filter={_id:c._id,active:true,expiresAt:{$gt:now},$or:[{startsAt:{$exists:false}},{startsAt:null},{startsAt:{$lte:now}}],$expr:{$lt:[{$size:'$redemptions'},'$maxUses']},'redemptions.order':{$ne:claim.orderId}};
 if(c.oncePerCustomer)filter['redemptions.user']={$ne:user._id};
 const result=await Coupon.updateOne(filter,{$push:{redemptions:{order:claim.orderId,user:user._id}}});if(!result.modifiedCount)fail('Coupon is expired, used up, or already used by you.',409);
}
export const newDeliveryCode=()=>String(randomInt(100000,1000000));

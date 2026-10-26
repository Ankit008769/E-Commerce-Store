import CheckoutRequest from '../models/checkoutRequestModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import {workerIdentity,ownerIsStopped} from './workerIdentity.js';

export async function settleCheckout(claim){
 if(claim.owner?.token!==workerIdentity.token)throw new Error('Checkout belongs to another worker.');
 const committed=await Order.exists({_id:claim.orderId});
 for(const item of claim.reservations||[]){
  const marker={requestId:claim._id,reservationId:String(claim.orderId)};
  await Product.updateOne({_id:item.product,stockReservations:{$elemMatch:{...marker,qty:item.qty}}},{
   ...(committed?{}:{$inc:{countInStock:item.qty}}),$pull:{stockReservations:marker}
  });
 }
 const owned={_id:claim._id,orderId:claim.orderId,'owner.token':workerIdentity.token};
 if(committed)await CheckoutRequest.updateOne(owned,{$set:{state:'completed'}});
 else await CheckoutRequest.deleteOne(owned);
 return !!committed;
}

export async function recoverAbandonedCheckout(claim){
 if(claim.state==='completed'||!ownerIsStopped(claim.owner))return false;
 // Atomically take ownership; a second recovering worker cannot win this claim.
 // orderId fences an old snapshot from a later retry reusing the checkout key.
 const acquired=await CheckoutRequest.findOneAndUpdate({_id:claim._id,orderId:claim.orderId,state:{$ne:'completed'},'owner.token':claim.owner.token},{$set:{owner:workerIdentity}},{new:true});
 if(!acquired)return false;
 await settleCheckout(acquired);return true;
}

export async function recoverCheckouts(){
 let recovered=0;
 for await(const claim of CheckoutRequest.find({state:{$ne:'completed'}}).cursor()){
  if(await recoverAbandonedCheckout(claim))recovered++;
 }
 return recovered;
}

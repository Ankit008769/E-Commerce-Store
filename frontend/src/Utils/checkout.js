export const checkoutPayload=cart=>({orderItems:cart.cartItems.map(i=>({_id:i._id,qty:i.qty})).sort((a,b)=>a._id.localeCompare(b._id)),shippingAddress:cart.shippingAddress,paymentMethod:'COD'});
export function readCheckout(storage,owner,payload){
 try{const p=JSON.parse(storage.getItem('pendingCheckout'));return p?.owner===owner&&p.fingerprint===JSON.stringify(payload)&&typeof p.key==='string'?p:null;}catch{return null;}
}
export function prepareCheckout(storage,owner,payload,newKey){
 const existing=readCheckout(storage,owner,payload);if(existing)return existing;
 const pending={owner,fingerprint:JSON.stringify(payload),key:newKey()};storage.setItem('pendingCheckout',JSON.stringify(pending));return pending;
}

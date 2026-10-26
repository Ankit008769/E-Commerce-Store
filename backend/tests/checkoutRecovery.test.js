import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutPayload,prepareCheckout,readCheckout} from '../../frontend/src/Utils/checkout.js';
test('refresh restores checkout ID and does not mix customers or changed baskets',()=>{
 let persisted=null;const storage={getItem:()=>persisted,setItem:(_,v)=>{persisted=v;}};
 const cart={cartItems:[{_id:'b',qty:1},{_id:'a',qty:2}],shippingAddress:{address:'Test',city:'Demo',postalCode:'123456',country:'India'}};
 const payload=checkoutPayload(cart),pending=prepareCheckout(storage,'customer-a',payload,()=> 'persistent-checkout-key');
 const refreshed=JSON.parse(JSON.stringify(cart));refreshed.cartItems.reverse();
 assert.equal(readCheckout(storage,'customer-a',checkoutPayload(refreshed)).key,pending.key);
 assert.equal(prepareCheckout(storage,'customer-a',checkoutPayload(refreshed),()=>{throw new Error('Must not issue a new key');}).key,pending.key);
 assert.equal(readCheckout(storage,'customer-b',payload),null);
 refreshed.cartItems[0].qty=3;assert.equal(readCheckout(storage,'customer-a',checkoutPayload(refreshed)),null);
 persisted='broken JSON';assert.equal(readCheckout(storage,'customer-a',payload),null);
});

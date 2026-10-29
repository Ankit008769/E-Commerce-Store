import test from 'node:test';
import assert from 'node:assert/strict';
import {itemNote} from '../utils/itemNote.js';
import {checkoutPayload,prepareCheckout,readCheckout} from '../../frontend/src/Utils/checkout.js';
test('item instructions validate plain text, normalize line endings and reject unsafe types',()=>{
 assert.equal(itemNote(undefined),'');assert.equal(itemNote('  Less spicy\r\nExtra cheese  '),'Less spicy\nExtra cheese');assert.equal(itemNote('कम मिर्च & cheese'),'कम मिर्च & cheese');
 for(const value of [null,{},['note'],42,'x'.repeat(301),'<script>alert(1)</script>','a\u0000b'])assert.throws(()=>itemNote(value),e=>e.status===400);
});
test('checkout includes per-item notes and detects changed instructions on retry',()=>{
 const cart={cartItems:[{_id:'a',qty:1,note:' Extra cheese '}],shippingAddress:{}};
 const payload=checkoutPayload(cart);assert.equal(payload.orderItems[0].note,'Extra cheese');let saved;const storage={getItem:()=>saved,setItem:(_,v)=>saved=v};prepareCheckout(storage,'buyer',payload,()=> 'key');assert(readCheckout(storage,'buyer',checkoutPayload(cart)));
 cart.cartItems[0].note='No cheese';assert.equal(readCheckout(storage,'buyer',checkoutPayload(cart)),null);cart.cartItems[0].note='';assert(!('note' in checkoutPayload(cart).orderItems[0]));
});

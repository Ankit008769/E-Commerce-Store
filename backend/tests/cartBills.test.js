import test from 'node:test';
import assert from 'node:assert/strict';
import {cartBills,billTotal} from '../../frontend/src/Utils/cartBills.js';
const item=(id,price,qty,minimumOrder=500,deliveryCharge=30)=>({price,qty,shopkeeper:{_id:id,shopName:id,deliveryPolicy:{minimumOrder,deliveryCharge}}});
test('cart bills separate shops and include each delivery fee once',()=>{
 const groups=cartBills([item('Booth 4',40,1),item('4H',15,1),item('Booth 4',10,2)]);
 assert.equal(groups.length,2);assert.equal(groups[0].items.length,2);assert.equal(groups[0].subtotal,60);assert.equal(groups[0].delivery,30);assert.equal(groups[1].total,45);assert.equal(billTotal(groups),135);
});
test('each shop earns free delivery independently at its own threshold',()=>{
 const groups=cartBills([item('A',100,5),item('B',20,1,100,15)]);
 assert.equal(groups[0].delivery,0);assert.equal(groups[1].delivery,15);assert.equal(billTotal(groups),535);
});
test('missing policy stays unquoted rather than promising free delivery',()=>{
 const groups=cartBills([{price:25,qty:2,shopkeeper:{_id:'A',shopName:'A'}}]);
 assert.equal(groups[0].subtotal,50);assert.equal(groups[0].delivery,null);assert.equal(billTotal(groups),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryPrice,lateDeduction,visibleOrder,roleOf,numeric} from '../utils/marketplace.js';
test('delivery fee applies below threshold, including zero thresholds',()=>{const p={minimumOrder:500,deliveryCharge:30};assert.equal(deliveryPrice(499.99,p),30);assert.equal(deliveryPrice(500,p),0);assert.equal(deliveryPrice(501,p),0);assert.equal(deliveryPrice(1,{minimumOrder:0,deliveryCharge:30}),0);});
test('late penalty is fixed and starts strictly after deadline',()=>{const g={deadline:'2026-01-01T12:00:00Z',latePenalty:25};assert.equal(lateDeduction(g,new Date(g.deadline)),0);assert.equal(lateDeduction(g,new Date('2026-01-01T12:00:01Z')),25);assert.equal(lateDeduction(g,new Date('2026-01-03T12:00:01Z')),25);});
test('shopkeepers cannot receive another shop items or deductions',()=>{
 const o={shopOrders:[{shopkeeper:'a',items:[{name:'A'}],itemsPrice:100,shippingPrice:30,deduction:25,latePenalty:25},{shopkeeper:'b',items:[{name:'B'}],itemsPrice:500,shippingPrice:0,deduction:50,latePenalty:50}]};
 const view=visibleOrder(o,{_id:'a',role:'shopkeeper'});assert.equal(view.shopOrders.length,1);assert.equal(view.totalPrice,130);assert.equal(view.orderItems[0].name,'A');assert.equal(view.shopOrders[0].deduction,undefined);
 assert.equal(visibleOrder(o,{role:'administrator'}).shopOrders[0].latePenalty,undefined);
 assert.equal(visibleOrder(o,{role:'customer'}).shopOrders[1].deduction,undefined);
 assert.equal(visibleOrder(o,{role:'superadmin'}).shopOrders[0].deduction,25);
});
test('legacy admins do not silently gain super administrator privileges',()=>{assert.equal(roleOf({isAdmin:true}),'administrator');assert.equal(roleOf({}),'customer');});
test('invalid price inputs are rejected',()=>{for(const v of ['',null,undefined,-1,'abc',Infinity])assert.throws(()=>numeric(v,'Price',0.01));assert.equal(numeric('12.5','Price',0.01),12.5);});


test('checkout quotes preserve ObjectId shop and product identifiers',async()=>{
 const {default:mongoose}=await import('mongoose');
 const shopId=new mongoose.Types.ObjectId(),productId=new mongoose.Types.ObjectId();
 const quote={shopOrders:[{shopkeeper:shopId,items:[{product:productId,qty:1,price:28}],itemsPrice:28,shippingPrice:30,latePenalty:20}]};
 const view=visibleOrder(quote,{role:'customer'});
 assert.equal(view.shopOrders[0].shopkeeper,String(shopId));
 assert.equal(view.shopOrders[0].items[0].product,String(productId));
 assert.equal(view.shopOrders[0].latePenalty,undefined);
 assert.equal(quote.shopOrders[0].latePenalty,20);
 const own=visibleOrder(quote,{role:'shopkeeper',_id:shopId});
 assert.equal(own.shopOrders.length,1);assert.equal(own.totalPrice,58);
});

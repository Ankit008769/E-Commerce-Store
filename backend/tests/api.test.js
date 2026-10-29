import {solveChallenge} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/pbkdf2';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require=createRequire(base+'/package.json');
const express=require('express'),mongoose=require('mongoose'),cookieParser=require('cookie-parser'),jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs');
const load=async p=>(await import(pathToFileURL(base+'/'+p))).default;
const uri=process.env.MARKETPLACE_TEST_URI;
test('API permissions, per-shop COD pricing, blacklisting and idempotent delivery', {skip:!uri,timeout:90000}, async()=>{
 if(!/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/.test(uri))throw new Error('Use only an isolated localhost campuscart_test database.');
 process.env.JWT_SECRET='isolated-test-secret-not-for-production';process.env.NODE_ENV='test';
 let server;
 await mongoose.connect(uri);
 await mongoose.connection.dropDatabase();
 try {
 const User=await load('backend/models/userModel.js'),Product=await load('backend/models/productModel.js'),Order=await load('backend/models/orderModel.js');
 const {setOtpMailSenderForTests}=await import(pathToFileURL(base+'/backend/utils/otpMailer.js'));
 const codes=new Map();setOtpMailSenderForTests(async(email,code)=>codes.set(email,code));
 const register=async(body)=>{const sent=await call(null,'/api/users/registration-otp','POST',{email:body.email});assert.equal(sent.status,200);return call(null,'/api/users','POST',{...body,challengeId:sent.data.challengeId,otp:codes.get(body.email.trim().toLowerCase())});};
 const password=await bcrypt.hash('TestOnly123!',10);
 const sa=await User.create({username:'Super Admin',email:'sa@test.local',password,role:'superadmin'});
 const admin=await User.create({username:'Administrator',email:'admin@test.local',password,role:'administrator'});
 const buyer=await User.create({username:'Test Customer',email:'buyer@test.local',password,role:'customer'});
 const other=await User.create({username:'Another Customer',email:'other@test.local',password,role:'customer'});
 const shop=await User.create({username:'Asha',shopName:'The Corner Pantry',email:'shop@test.local',password,role:'shopkeeper',deliveryPolicy:{minimumOrder:500,deliveryCharge:30,deliveryMinutes:60,latePenalty:25}});
 const shop2=await User.create({username:'Ravi',shopName:'Everyday Essentials',email:'shop2@test.local',password,role:'shopkeeper',deliveryPolicy:{minimumOrder:300,deliveryCharge:20,deliveryMinutes:45,latePenalty:15}});
 const p=await Product.create({name:'Fresh apples',price:100,image:'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600',shopkeeper:shop._id,countInStock:10});
 const p2=await Product.create({name:'Everyday headphones',price:300,image:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',shopkeeper:shop2._id,countInStock:10});
 const app=express();app.use(express.json());app.use(cookieParser());
 let dropCheckoutResponse=true;
 app.use((req,res,next)=>{
  if(req.method==='POST'&&req.path==='/api/orders'&&req.body.checkoutKey==='network-loss-regression'&&dropCheckoutResponse){
   const send=res.json.bind(res);res.json=data=>{if(res.statusCode===201){dropCheckoutResponse=false;res.destroy();return res;}return send(data);};
  }
  next();
 });

 app.use('/api/users',await load('backend/routes/userRoutes.js'));app.use('/api/products',await load('backend/routes/productRoutes.js'));app.use('/api/orders',await load('backend/routes/orderRoutes.js'));
 app.use(express.static(base+'/frontend/dist'));app.get('*',(req,res)=>res.sendFile(base+'/frontend/dist/index.html'));
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const call=async(user,url,method='GET',body)=>{if(method==='POST'&&['/api/users/auth','/api/users','/api/users/registration-otp','/api/users/profile/verification-code'].includes(url)){const purpose=url==='/api/users/auth'?'login':url==='/api/users'?'signup':'otp';const challenge=await (await fetch('http://127.0.0.1:'+server.address().port+'/api/users/captcha?purpose='+purpose)).json();const solution=await solveChallenge({challenge,deriveKey});body={...body,altcha:Buffer.from(JSON.stringify({challenge,solution})).toString('base64')};}const response=await fetch('http://127.0.0.1:'+server.address().port+url,{method,headers:{'Content-Type':'application/json',...(user?{Cookie:'jwt='+jwt.sign({userId:user._id},process.env.JWT_SECRET)}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 const check=(label,fn)=>{fn();console.log('PASS '+label);};
 const productRequest=async(data)=>{const form=new FormData();for(const [key,value] of Object.entries(data))form.append(key,value);const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/products',{method:'POST',headers:{Cookie:'jwt='+jwt.sign({userId:shop._id},process.env.JWT_SECRET)},body:form});return {status:response.status,data:await response.json()};};
 const missing=await productRequest({image:'/uploads/test.jpg',countInStock:1});assert.equal(missing.status,400);
 const unnamed=await productRequest({image:'/uploads/test.jpg',price:10,countInStock:1,shopkeeper:String(shop2._id)});assert.equal(unnamed.status,201);assert.equal(unnamed.data.name,'');assert.equal(String(unnamed.data.shopkeeper),String(shop._id));await Product.deleteOne({_id:unnamed.data._id});console.log('PASS photo and price required, name optional, seller ownership enforced');
 let r=await register({username:'New Customer',email:'new@nith.ac.in',password:'TestOnly123!',role:'superadmin',isAdmin:true});check('public registration cannot grant staff access',()=>assert.equal(r.data.role,'customer'));
 r=await call(null,'/api/users/auth','POST',{email:'buyer@test.local',password:'wrong'});check('invalid login terminates with 401',()=>assert.equal(r.status,401));
 for(const [email,portal,status] of [['buyer@test.local','management',403],['shop@test.local','customer',403],['admin@test.local','customer',403],['buyer@test.local','customer',200],['shop@test.local','management',200]]){const auth=await call(null,'/api/users/auth','POST',{email,password:'TestOnly123!',portal});assert.equal(auth.status,status,'Portal separation: '+email+' '+portal);}console.log('PASS separate customer and management sign-in');
 for(const email of ['outsider@gmail.com','name@nith.ac.in.evil.com','name@sub.nith.ac.in','name@@nith.ac.in']){assert.equal((await call(null,'/api/users','POST',{username:'Invalid Domain',email,password:'TestOnly123!'})).status,400);assert.equal(await User.countDocuments({email}),0);}
 const campus=await register({username:'Campus Student',email:'  Student@NITH.AC.IN  ',password:'TestOnly123!'});assert.equal(campus.status,201);assert.equal(campus.data.email,'student@nith.ac.in');assert.equal(campus.data.role,'customer');
 assert.equal((await call(buyer,'/api/users/profile','PUT',{email:'new-address@gmail.com'})).status,400);
 assert.equal((await call(buyer,'/api/users/profile','PUT',{email:'unverified-change@nith.ac.in',emailVerified:true})).status,400);
 assert.equal((await call(buyer,'/api/users/profile','PUT',{username:'Test Customer',email:buyer.email})).status,200);
 console.log('PASS official campus domain, normalization, spoof rejection and profile bypass protection');
 r=await call(admin,'/api/users');check('Administrator cannot read private policies/accounts',()=>assert.equal(r.status,403));
 for(const actor of [admin,shop,buyer]){assert.equal((await call(actor,'/api/users/'+sa._id,'DELETE')).status,403);assert.equal((await call(actor,'/api/users/'+sa._id,'PUT',{status:'blacklisted'})).status,403);}
 assert.equal((await call(sa,'/api/users/'+sa._id,'DELETE')).status,403);
 const tempAdmin=await User.create({username:'Removable Administrator',email:'removable@test.local',password,role:'administrator'});
 assert.equal((await call(sa,'/api/users/'+tempAdmin._id,'DELETE')).status,200);assert.equal((await User.findById(tempAdmin._id)).status,'removed');
 assert.equal((await call(tempAdmin,'/api/users/profile')).status,403);
 console.log('PASS Super Admin protected; only Super Admin removes administrators, revoked sessions denied');
 r=await call(shop,'/api/users/'+shop._id,'PUT',{deliveryPolicy:{deliveryCharge:0}});check('shopkeeper cannot change delivery policy',()=>assert.equal(r.status,403));
 r=await call(sa,'/api/users/'+shop._id,'PUT',{deliveryPolicy:{latePenalty:-1}});check('negative penalties rejected',()=>assert.equal(r.status,400));
 r=await call(shop,'/api/products/'+p2._id,'DELETE');check('cross-shop product deletion rejected',()=>assert.equal(r.status,403));
 r=await call(sa,'/api/users/'+shop2._id,'PUT',{status:'blacklisted'});assert.equal(r.status,200);
 r=await call(null,'/api/products/allproducts');check('blacklisted products hidden',()=>assert.equal(r.data.length,1));
 r=await call(null,'/api/products/'+p._id+'/recommendations');check('recommendations exclude blacklisted shops and the current product',()=>assert.equal(r.data.length,0));
 r=await call(shop2,'/api/products/manage');check('existing blacklisted session blocked',()=>assert.equal(r.status,403));
 r=await call(buyer,'/api/orders/quote','POST',{orderItems:[{_id:p2._id,qty:1}]});check('blacklisted shop cannot be ordered from',()=>assert.equal(r.status,400));
 await call(sa,'/api/users/'+shop2._id,'PUT',{status:'active'});
 const payload={orderItems:[{_id:p._id,qty:2,price:1},{_id:p2._id,qty:1,price:1}],shippingAddress:{phone:'9000000000',address:'Hostel A, Room 12',city:'Pune',postalCode:'411001',country:'India'},paymentMethod:'COD'};
 for(const phone of [undefined,'','123','1234567890','9000000000<script>',9000000000]){
  const invalid=await call(buyer,'/api/orders','POST',{...payload,shippingAddress:{...payload.shippingAddress,phone}});assert.equal(invalid.status,400);
 }
 assert.equal((await Product.findById(p._id)).countInStock,10);console.log('PASS missing/invalid phone rejected without stock changes');
 r=await call(buyer,'/api/orders/quote','POST',payload);check('server prices and independent threshold fees',()=>{assert.equal(r.data.totalPrice,530);assert.equal(r.data.shopOrders.length,2);assert.equal(r.data.shopOrders[0].latePenalty,undefined);});
 r=await call(buyer,'/api/orders','POST',{...payload,paymentMethod:'PayPal'});check('online payment rejected',()=>assert.equal(r.status,400));
 r=await call(buyer,'/api/orders','POST',payload);assert.equal(r.status,201);const id=r.data._id;
 check('COD order stores shop groups without leaking penalties',()=>{assert.equal(r.data.shippingAddress.phone,'+919000000000');assert.equal(r.data.totalPrice,530);assert.equal(r.data.shopOrders[0].latePenalty,undefined);});
 const ownHistory=await call(buyer,'/api/orders/mine'),otherHistory=await call(other,'/api/orders/mine');assert(ownHistory.data.some(o=>o._id===id));assert.equal(otherHistory.data.length,0);console.log('PASS customer order history remains scoped to the purchasing account');
 assert.equal((await Product.findById(p._id)).countInStock,8);console.log('PASS stock reserved');
 r=await call(other,'/api/orders/'+id);check('other customer cannot read order',()=>assert.equal(r.status,403));
 r=await call(shop,'/api/orders/'+id);check('shop only receives its items and total',()=>{assert.equal(r.data.shopOrders.length,1);assert.equal(r.data.shippingAddress.phone,'+919000000000');assert.equal(r.data.totalPrice,230);assert.equal(r.data.orderItems.length,1);assert.equal(r.data.shopOrders[0].deduction,undefined);});
 const order=await Order.findById(id),g=order.shopOrders.find(g=>String(g.shopkeeper)===String(shop._id));
 r=await call(shop2,'/api/orders/'+id+'/shops/'+g._id+'/deliver','PUT');check('cross-shop delivery rejected',()=>assert.equal(r.status,403));
 g.deadline=new Date(Date.now()-60000);await order.save();
 await call(sa,'/api/users/'+shop._id,'PUT',{deliveryPolicy:{latePenalty:999,deliveryMinutes:120}});
 r=await call(admin,'/api/orders/'+id);check('Administrator cannot read deductions',()=>assert.equal(r.data.shopOrders[0].latePenalty,undefined));
 r=await call(sa,'/api/orders/'+id);assert.equal(r.data.user.username,buyer.username);assert.equal(r.data.user.email,buyer.email);assert.equal(r.data.orderItems.length,2);check('SA sees snapshotted pending deduction',()=>assert.equal(r.data.shopOrders.find(g=>String(g.shopkeeper)===String(shop._id)).pendingDeduction,25));
 const delivery='/api/orders/'+id+'/shops/'+g._id+'/deliver';await call(shop,delivery,'PUT');await call(shop,delivery,'PUT');
 r=await call(sa,'/api/orders/'+id);check('late delivery recorded once at original penalty',()=>assert.equal(r.data.shopOrders.find(g=>String(g.shopkeeper)===String(shop._id)).deduction,25));
 const group2=order.shopOrders.find(g=>String(g.shopkeeper)===String(shop2._id));await call(shop2,'/api/orders/'+id+'/shops/'+group2._id+'/deliver','PUT');
 r=await call(buyer,'/api/orders/'+id);check('all delivered groups complete COD order',()=>{assert.equal(r.data.isPaid,true);assert.equal(r.data.isDelivered,true);});

 const limited=await Product.create({name:'Checkout retry test',price:10,image:'/uploads/test.jpg',shopkeeper:shop._id,countInStock:3});
 const request={...payload,orderItems:[{_id:limited._id,qty:1}],checkoutKey:'checkout-regression-001'};
 const parallel=await Promise.all(Array.from({length:8},()=>call(buyer,'/api/orders','POST',request)));
 assert.equal(parallel.filter(r=>r.status===201).length,1);assert(parallel.every(r=>[200,201,409].includes(r.status)));
 const created=parallel.find(r=>r.status===201).data;
 assert.equal(await Order.countDocuments({'orderItems.product':limited._id}),1);assert.equal((await Product.findById(limited._id)).countInStock,2);
 const replay=await call(buyer,'/api/orders','POST',request);assert.equal(replay.status,200);assert.equal(replay.data._id,created._id);
 const samePhone=await call(buyer,'/api/orders','POST',{...request,shippingAddress:{...request.shippingAddress,phone:'+91 90000 00000'}});assert.equal(samePhone.status,200);assert.equal(samePhone.data._id,created._id);
 const changedPhone=await call(buyer,'/api/orders','POST',{...request,shippingAddress:{...request.shippingAddress,phone:'9000000001'}});assert.equal(changedPhone.status,409);
 const altered=await call(buyer,'/api/orders','POST',{...request,orderItems:[{_id:limited._id,qty:2}]});assert.equal(altered.status,409);
 const separateUser=await call(other,'/api/orders','POST',request);assert.equal(separateUser.status,201);assert.notEqual(separateUser.data._id,created._id);
 const newCheckout=await call(buyer,'/api/orders','POST',{...request,checkoutKey:'checkout-regression-002'});assert.equal(newCheckout.status,201);assert.equal((await Product.findById(limited._id)).countInStock,0);
 const soldOutReplay=await call(buyer,'/api/orders','POST',request);assert.equal(soldOutReplay.status,200);assert.equal(soldOutReplay.data._id,created._id);
 const retryFailure={...request,checkoutKey:'checkout-regression-retry'};assert.equal((await call(buyer,'/api/orders','POST',retryFailure)).status,400);
 await Product.updateOne({_id:limited._id},{$set:{countInStock:1}});
 assert.equal((await call(buyer,'/api/orders','POST',retryFailure)).status,201);assert.equal((await Product.findById(limited._id)).countInStock,0);
 console.log('PASS duplicate checkout, retry, changed payload, independent users and failed-checkout recovery');

 const networkProduct=await Product.create({name:'Lost response last unit',price:10,image:'/uploads/test.jpg',shopkeeper:shop._id,countInStock:1});
 const networkRequest={...payload,orderItems:[{_id:networkProduct._id,qty:1}],checkoutKey:'network-loss-regression'};
 await assert.rejects(call(buyer,'/api/orders','POST',networkRequest));
 const persisted=await Order.findOne({'orderItems.product':networkProduct._id});assert(persisted);
 assert.equal((await Product.findById(networkProduct._id)).countInStock,0);
 await new Promise(resolve=>server.close(resolve));
 server=await new Promise(resolve=>{const restarted=app.listen(0,'127.0.0.1',()=>resolve(restarted));});
 const networkRetry=await call(buyer,'/api/orders','POST',networkRequest);assert.equal(networkRetry.status,200);assert.equal(networkRetry.data._id,String(persisted._id));
 const repeated=await call(buyer,'/api/orders','POST',networkRequest);assert.equal(repeated.data._id,String(persisted._id));
 assert.equal(await Order.countDocuments({'orderItems.product':networkProduct._id}),1);assert.equal((await Product.findById(networkProduct._id)).countInStock,0);
 console.log('PASS lost HTTP response after commit, HTTP server restart, repeated recovery with sold-out stock');

 // Force the competing purchase between validation and reservation, rather than relying on timing.
 const CheckoutRequest=await load('backend/models/checkoutRequestModel.js');
 for(const [round,owners] of [[1,[shop,shop2]],[2,[shop2,shop]]]){
  const stocked=await Product.create({name:'Rollback stocked '+round,price:10,image:'/uploads/test.jpg',shopkeeper:owners[0]._id,countInStock:5});
  const scarce=await Product.create({name:'Rollback last unit '+round,price:20,image:'/uploads/test.jpg',shopkeeper:owners[1]._id,countInStock:1});
  const mixed={...payload,checkoutKey:'cross-shop-rollback-'+round,orderItems:[{_id:stocked._id,qty:2},{_id:scarce._id,qty:1}]};
  const quoted=await call(buyer,'/api/orders/quote','POST',mixed);assert.equal(quoted.status,200);
  assert.equal(String(quoted.data.orderItems[0].product),String(stocked._id));
  const originalUpdate=Product.updateOne;let competitor,observedReservation=false,intercept=true;
  Product.updateOne=async function(filter,update,...args){
   if(intercept&&String(filter._id)===String(scarce._id)&&update.$inc?.countInStock===-1){
    intercept=false;
    assert.equal((await Product.findById(stocked._id)).countInStock,3);observedReservation=true;
    competitor=await call(other,'/api/orders','POST',{...payload,checkoutKey:'competing-last-unit-'+round,orderItems:[{_id:scarce._id,qty:1}]});
    assert.equal(competitor.status,201);assert.equal((await Product.findById(scarce._id)).countInStock,0);
   }
   return originalUpdate.call(this,filter,update,...args);
  };
  let failed;
  try{failed=await call(buyer,'/api/orders','POST',mixed);}finally{Product.updateOne=originalUpdate;}
  assert(observedReservation);assert.equal(failed.status,409);
  assert.equal((await Product.findById(stocked._id)).countInStock,5);
  assert.equal((await Product.findById(scarce._id)).countInStock,0);
  assert.equal(await Order.countDocuments({user:buyer._id,'orderItems.product':{$in:[stocked._id,scarce._id]}}),0);
  assert.equal(await Order.countDocuments({'orderItems.product':stocked._id}),0);
  assert.equal(await Order.countDocuments({'orderItems.product':scarce._id}),1);
  assert.equal(await CheckoutRequest.countDocuments({_id:String(buyer._id)+':'+mixed.checkoutKey}),0);
  const competitorOrder=await Order.findById(competitor.data._id);assert.equal(competitorOrder.orderItems.length,1);
  console.log('PASS cross-shop rollback '+round+': first stock 5 -> 3 -> 5, last unit sold to competitor, mixed order 409, no partial order');
  // Once restocked, the same failed checkout can be retried without a stuck claim.
  await Product.updateOne({_id:scarce._id},{$set:{countInStock:1}});
  const retryMixed=await call(buyer,'/api/orders','POST',mixed);assert.equal(retryMixed.status,201);assert.equal(retryMixed.data.shopOrders.length,2);
  assert.equal((await Product.findById(stocked._id)).countInStock,3);assert.equal((await Product.findById(scarce._id)).countInStock,0);
  const replayMixed=await call(buyer,'/api/orders','POST',mixed);assert.equal(replayMixed.status,200);assert.equal(replayMixed.data._id,retryMixed.data._id);
  assert.equal((await Product.findById(stocked._id)).countInStock,3);
  console.log('PASS cross-shop retry after restock '+round+': one complete order, stock deducted once');
 }

 // Fail persistence only after real stock updates have completed for both shops.
 const saveA=await Product.create({name:'Save failure shop A',price:10,image:'/uploads/test.jpg',shopkeeper:shop._id,countInStock:5});
 const saveB=await Product.create({name:'Save failure shop B',price:20,image:'/uploads/test.jpg',shopkeeper:shop2._id,countInStock:7});
 const saveRequest={...payload,checkoutKey:'save-failure-regression',orderItems:[{_id:saveA._id,qty:2},{_id:saveB._id,qty:3}]};
 const productIds=[saveA._id,saveB._id],originalCreate=Order.create;
 let observedSaveFailure=false;
 try{
  Order.create=async function(document,...args){
   if(document.orderItems.some(i=>String(i.product)===String(saveA._id))){
    assert.equal((await Product.findById(saveA._id)).countInStock,3);
    assert.equal((await Product.findById(saveB._id)).countInStock,4);
    observedSaveFailure=true;throw new Error('Injected order-save failure before persistence');
   }
   return originalCreate.call(this,document,...args);
  };
  // A repeated failure must neither leak reservations nor over-restore stock.
  for(let attempt=0;attempt<2;attempt++){
   const failedSave=await call(buyer,'/api/orders','POST',saveRequest);assert.equal(failedSave.status,500);assert(observedSaveFailure);
   assert.equal((await Product.findById(saveA._id)).countInStock,5);assert.equal((await Product.findById(saveB._id)).countInStock,7);
   assert.equal(await Order.countDocuments({'orderItems.product':{$in:productIds}}),0);
   assert.equal(await CheckoutRequest.countDocuments({_id:String(buyer._id)+':'+saveRequest.checkoutKey}),0);
  }
 }finally{Order.create=originalCreate;}
 console.log('PASS order-save failure twice: both stocks restored (5 -> 3 -> 5 and 7 -> 4 -> 7), no saved order or stale checkout claim');
 const saveRetries=await Promise.all(Array.from({length:6},()=>call(buyer,'/api/orders','POST',saveRequest)));
 assert.equal(saveRetries.filter(r=>r.status===201).length,1);assert(saveRetries.every(r=>[200,201,409].includes(r.status)));
 const savedRetry=saveRetries.find(r=>r.status===201).data;assert.equal(savedRetry.shopOrders.length,2);
 assert.equal(await Order.countDocuments({'orderItems.product':{$in:productIds}}),1);
 assert.equal((await Product.findById(saveA._id)).countInStock,3);assert.equal((await Product.findById(saveB._id)).countInStock,4);
 const finalReplay=await call(buyer,'/api/orders','POST',saveRequest);assert.equal(finalReplay.status,200);assert.equal(finalReplay.data._id,savedRetry._id);
 assert.equal((await Product.findById(saveA._id)).countInStock,3);assert.equal((await Product.findById(saveB._id)).countInStock,4);
 console.log('PASS six concurrent retries after save failure: one order, one deduction per shop, replay returns same order');

 // If the write actually committed but its acknowledgement was lost, do not restore sold stock.
 const acknowledgedRequest={...saveRequest,checkoutKey:'save-acknowledgement-loss'};
 let committedId;
 try{
  Order.create=async function(document,...args){
   const committed=await originalCreate.call(this,document,...args);
   committedId=String(committed._id);throw new Error('Injected lost database acknowledgement after persistence');
  };
  assert.equal((await call(buyer,'/api/orders','POST',acknowledgedRequest)).status,500);
 }finally{Order.create=originalCreate;}
 assert(committedId);assert.equal((await Product.findById(saveA._id)).countInStock,1);assert.equal((await Product.findById(saveB._id)).countInStock,1);
 const recoveredAcknowledgement=await call(buyer,'/api/orders','POST',acknowledgedRequest);assert.equal(recoveredAcknowledgement.status,200);assert.equal(recoveredAcknowledgement.data._id,committedId);
 assert.equal(await Order.countDocuments({'orderItems.product':{$in:productIds}}),2);
 assert.equal((await Product.findById(saveA._id)).countInStock,1);assert.equal((await Product.findById(saveB._id)).countInStock,1);
 console.log('PASS committed write with lost acknowledgement: no incorrect restock and no duplicate on retry');

 // Existing-account verification must preserve identity, credentials and all orders.
 await User.updateOne({_id:buyer._id},{$set:{email:'legacy@nith.ac.in'}});
 const beforeAccount=await User.findById(buyer._id).lean(),beforeOrders=await Order.find({user:buyer._id}).sort({_id:1}).lean(),beforeCount=await User.countDocuments();
 assert.equal((await call(null,'/api/users/profile/verification-code','POST',{})).status,401);
 assert.equal((await call(shop,'/api/users/profile/verification-code','POST',{})).status,403);
 const verification=await call(buyer,'/api/users/profile/verification-code','POST',{email:'someone-else@nith.ac.in'});assert.equal(verification.status,200);assert(codes.has('legacy@nith.ac.in'));assert.equal(codes.has('someone-else@nith.ac.in'),false);
 const proof={challengeId:verification.data.challengeId,otp:codes.get('legacy@nith.ac.in')};
 assert.equal((await call(other,'/api/users/profile/verify-email','POST',proof)).status,400);
 const {consumeEmailCode}=await import(pathToFileURL(base+'/backend/utils/emailVerification.js'));
 await assert.rejects(consumeEmailCode('legacy@nith.ac.in',proof.challengeId,proof.otp,'isolated-purpose-test'));
 assert.equal((await call(buyer,'/api/users/profile/verify-email','POST',{...proof,otp:proof.otp==='000000'?'111111':'000000'})).status,400);
 const verified=await call(buyer,'/api/users/profile/verify-email','POST',proof);assert.equal(verified.status,200);assert.equal(verified.data._id,String(buyer._id));assert.equal(verified.data.emailVerified,true);
 const afterAccount=await User.findById(buyer._id).lean();for(const field of ['email','username','password','role','status'])assert.equal(afterAccount[field],beforeAccount[field]);assert.equal(await User.countDocuments(),beforeCount);
 assert.deepEqual(await Order.find({user:buyer._id}).sort({_id:1}).lean(),beforeOrders);
 assert.equal((await call(buyer,'/api/users/profile/verification-code','POST',{})).data.alreadyVerified,true);
 assert.equal((await call(buyer,'/api/users/profile')).data.emailVerified,true);
 console.log('PASS existing email verification: authenticated account binding, wrong-code rejection, purpose binding, same account/password/orders, persisted verified status');

 } finally {if(server)await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

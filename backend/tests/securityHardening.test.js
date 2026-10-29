import {PDFDocument} from 'pdf-lib';
import {checkPrintPdf} from '../utils/safePrintPdf.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {unlink} from 'node:fs/promises';
import {safeCustomerRedirect} from '../../frontend/src/Utils/safeRedirect.js';
import {safePhoto} from '../utils/safePhoto.js';
const uri=process.env.MARKETPLACE_TEST_URI;
test('login redirects stay on known customer routes',()=>{
 for(const path of ['https://evil.example','//evil.example','/\\evil.example','/%5cevil.example','/admin/accounts','/login?redirect=//evil.example'])assert.equal(safeCustomerRedirect(path),'/shop');
 assert.equal(safeCustomerRedirect('/shipping'),'/shipping');assert.equal(safeCustomerRedirect('/shop?category=abc'),'/shop?category=abc');
});
test('photo decoder rejects forged and active files and rewrites real images',async()=>{
 for(const bytes of [Buffer.from('<script>alert(1)</script>'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')])await assert.rejects(()=>safePhoto(bytes),e=>e.status===400);
 const png=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();
 const output=await safePhoto(Buffer.concat([png,Buffer.from('<script>untrusted</script>')]));assert.equal((await sharp(output).metadata()).format,'webp');assert(!output.includes(Buffer.from('untrusted')));
});
test('security boundary: CSRF, injection, error privacy, limits, sessions and real upload',{skip:!uri,timeout:60000},async()=>{
 assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/);process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-hardening-secret-only';
 await mongoose.connect(uri+'_hardening');await mongoose.connection.dropDatabase();
 const {default:User}=await import('../models/userModel.js');const {default:Revoked}=await import('../models/revokedSessionModel.js');const {default:AuthRate}=await import('../models/authRateModel.js');await Promise.all([User.init(),Revoked.init(),AuthRate.init()]);
 const {securityHeaders,originGuard,inputGuard,safeError,loginLimit}=await import('../middlewares/security.js');
 const {loginUser}=await import('../controllers/userController.js');const {default:createToken}=await import('../utils/createToken.js');
 const app=express();app.use(securityHeaders);app.use('/api',originGuard);app.use(express.json({limit:'64kb'}));app.use(inputGuard);app.use(cookieParser());
 app.use('/api/users',(await import('../routes/userRoutes.js')).default);app.use('/api/upload',(await import('../routes/uploadRoutes.js')).default);
 app.post('/api/echo',(req,res)=>res.json({ok:true}));app.get('/api/fail',(req,res,next)=>next(new Error('private-db-password')));app.post('/api/rate',loginLimit,(req,res)=>res.json({ok:true}));app.post('/api/test-login',loginUser);app.use(safeError);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,cookie,extra={})=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 let uploaded;
 try{
  assert.equal((await call('/api/echo','POST',{},undefined,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('/api/echo','POST',{},undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  const good=await call('/api/echo','POST',{},undefined,{Origin:'http://localhost:5173'});assert.equal(good.status,200);assert.equal(good.headers.get('x-content-type-options'),'nosniff');assert.match(good.headers.get('content-security-policy'),/script-src 'self'/);assert.match(good.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(good.headers.get('x-powered-by'),null);assert.match(good.headers.get('cache-control'),/no-store/);
  for(const body of [{email:{$ne:null}},JSON.parse('{"__proto__":{"admin":true}}'),{name:'x'.repeat(70000)}])assert([400,413].includes((await call('/api/echo','POST',body)).status));
  let deep={};for(let i=0;i<20;i++)deep={child:deep};assert.equal((await call('/api/echo','POST',deep)).status,400);
  const plain=await fetch(base+'/api/echo',{method:'POST',headers:{'Content-Type':'text/plain'},body:'x'});assert.equal(plain.status,415);
  const hidden=await call('/api/fail');assert.equal(hidden.status,500);assert(!JSON.stringify(hidden.data).includes('private-db-password'));
  for(let i=0;i<20;i++)assert.equal((await call('/api/rate','POST',{email:'rate@nith.ac.in'})).status,200);assert.equal((await call('/api/rate','POST',{email:'rate@nith.ac.in'})).status,429);
  const user=await User.create({username:'Security test',email:'safe@nith.ac.in',password:await bcrypt.hash('OldPassword123!',10),role:'shopkeeper'});
  const old='jwt='+jwt.sign({userId:String(user._id)},process.env.JWT_SECRET);
  assert.equal((await call('/api/users/profile','GET',undefined,old)).status,200);
  assert.equal((await call('/api/users/profile','PUT',{password:'NewPassword123!'},old)).status,403);
  assert.equal((await call('/api/users/profile','PUT',{password:'NewPassword123!',currentPassword:'wrong'},old)).status,403);
  const changed=await call('/api/users/profile','PUT',{password:'NewPassword123!',currentPassword:'OldPassword123!'},old);assert.equal(changed.status,200);assert.match(changed.headers.get('set-cookie'),/HttpOnly/);assert.match(changed.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await call('/api/users/profile','GET',undefined,old)).status,401);assert.equal((await call('/api/users/profile','GET',undefined,changed.cookie)).status,200);
  const form=new FormData();form.append('image',new Blob([await sharp({create:{width:10,height:10,channels:3,background:'blue'}}).png().toBuffer()],{type:'image/png'}),'photo.png');const photo=await fetch(base+'/api/upload',{method:'POST',headers:{cookie:changed.cookie},body:form});assert.equal(photo.status,200);uploaded=(await photo.json()).image;assert.match(uploaded,/^\/uploads\/[a-f0-9-]+\.webp$/);
  const fake=new FormData();fake.append('image',new Blob(['<script>bad</script>'],{type:'image/png'}),'photo.png');assert.equal((await fetch(base+'/api/upload',{method:'POST',headers:{cookie:changed.cookie},body:fake})).status,400);
  assert.equal((await call('/api/users/logout','POST',{},changed.cookie)).status,200);assert.equal((await call('/api/users/profile','GET',undefined,changed.cookie)).status,401);
  const fresh=await call('/api/test-login','POST',{email:user.email,password:'NewPassword123!',portal:'management'});assert.equal(fresh.status,200);assert.notEqual(fresh.cookie,changed.cookie);assert.equal((await call('/api/users/profile','GET',undefined,fresh.cookie)).status,200);
  const wrongAlgorithm='jwt='+jwt.sign({userId:String(user._id),v:1},process.env.JWT_SECRET,{algorithm:'HS384'});assert.equal((await call('/api/users/profile','GET',undefined,wrongAlgorithm)).status,401);
  console.log('PASS headers, CSRF, NoSQL/prototype injection, body limits, generic errors, shared auth limits, password proof, old-token revocation, logout revocation, JWT algorithms and image rewriting');
 }finally{if(uploaded)await unlink('.'+uploaded);await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

test('print PDFs reject embedded JavaScript while ordinary PDFs pass',async()=>{const pdf=await PDFDocument.create();pdf.addPage();checkPrintPdf(pdf);pdf.addJavaScript('test','app.alert(1)');const uploaded=await PDFDocument.load(await pdf.save());assert.throws(()=>checkPrintPdf(uploaded),e=>e.status===400);});

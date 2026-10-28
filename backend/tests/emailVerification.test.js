import {solveChallenge} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/pbkdf2';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
const uri=process.env.MARKETPLACE_TEST_URI;
test('College signup requires an expiring, single-use email OTP across servers',{skip:!uri,timeout:90000},async t=>{
 if(!/^mongodb:\/\/127\.0\.0\.1:\d+\/campuscart_test[a-z0-9_]*$/.test(uri))throw new Error('Use an isolated localhost test database.');
 process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-otp-test-secret';
 await mongoose.connect(uri+'_otp');
 const {default:User}=await import('../models/userModel.js');
 const {default:EmailOtp}=await import('../models/emailOtpModel.js');
 const {default:AuthRate}=await import('../models/authRateModel.js');
 const {setOtpMailSenderForTests}=await import('../utils/otpMailer.js');
 const {default:routes}=await import('../routes/userRoutes.js');
 const codes=new Map();let sendCount=0;
 const sender=async(email,code)=>{codes.set(email,code);sendCount++;};
 const servers=[];
 for(let i=0;i<2;i++){const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/users',routes);servers.push(await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));}));}
 async function call(path,body,index=0){const purpose=path===''?'signup':'otp';const challenge=await(await fetch('http://127.0.0.1:'+servers[index].address().port+'/api/users/captcha?purpose='+purpose)).json();const solution=await solveChallenge({challenge,deriveKey});body={...body,altcha:Buffer.from(JSON.stringify({challenge,solution})).toString('base64')};const response=await fetch('http://127.0.0.1:'+servers[index].address().port+'/api/users'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 async function reset(){await Promise.all([User.deleteMany({}),EmailOtp.deleteMany({}),AuthRate.deleteMany({})]);codes.clear();sendCount=0;setOtpMailSenderForTests(sender);}
 const email='student@nith.ac.in',details={username:'Student',email,password:'TestOnly123!',role:'superadmin',emailVerified:true};
 async function send(value=email,index=0){return call('/registration-otp',{email:value},index);}
 try{
  await User.init();await EmailOtp.init();await AuthRate.init();
  await t.test('no signup bypass; normalized email is verified before account creation',async()=>{
   await reset();assert.equal((await call('',details)).status,400);assert.equal(await User.countDocuments(),0);
   const sent=await send('  Student@NITH.AC.IN  ');assert.equal(sent.status,200);assert.equal(sent.data.otp,undefined);assert.equal(await User.countDocuments(),0);
   const stored=await EmailOtp.findById(email);assert.notEqual(stored.digest,codes.get(email));assert.equal(stored.digest.length,64);
   const result=await call('',{...details,email:'  Student@NITH.AC.IN  ',otp:codes.get(email),challengeId:sent.data.challengeId},1);
   assert.equal(result.status,201);assert.equal(result.data.email,email);assert.equal(result.data.emailVerified,true);assert.equal(result.data.role,'customer');assert.equal(result.data.password,undefined);assert((await User.findOne({email})).emailVerifiedAt);
   assert.equal((await call('',{...details,otp:codes.get(email),challengeId:sent.data.challengeId})).status,409);assert.equal(await User.countDocuments(),1);
  });
  await t.test('only the exact college domain may request codes',async()=>{
   await reset();for(const bad of ['outside@gmail.com','a@nith.ac.in.evil.com','a@sub.nith.ac.in','a@@nith.ac.in']){assert.equal((await send(bad)).status,400);assert.equal((await call('',{...details,email:bad})).status,400);}assert.equal(sendCount,0);
  });
  await t.test('five wrong attempts lock code; code cannot verify another email',async()=>{
   await reset();const sent=await send();const code=codes.get(email),wrong=code==='000000'?'111111':'000000';
   assert.equal((await call('',{...details,email:'other@nith.ac.in',challengeId:sent.data.challengeId,otp:code})).status,400);
   for(let i=0;i<5;i++)assert.equal((await call('',{...details,challengeId:sent.data.challengeId,otp:wrong})).status,400);
   assert.equal((await call('',{...details,challengeId:sent.data.challengeId,otp:code})).status,400);assert.equal(await User.countDocuments(),0);
  });
  await t.test('expiry and resend invalidate old challenges',async()=>{
   await reset();const first=await send(),oldCode=codes.get(email);assert.equal((await send()).status,429);assert.equal(sendCount,1);
   await EmailOtp.updateOne({_id:email},{$set:{sentAt:new Date(Date.now()-61000)}});
   const second=await send();assert.equal(second.status,200);assert.notEqual(first.data.challengeId,second.data.challengeId);
   assert.equal((await call('',{...details,challengeId:first.data.challengeId,otp:oldCode})).status,400);
   await EmailOtp.updateOne({_id:email},{$set:{expiresAt:new Date(Date.now()-1000)}});
   assert.equal((await call('',{...details,challengeId:second.data.challengeId,otp:codes.get(email)})).status,400);assert.equal(await User.countDocuments(),0);
  });
  await t.test('concurrent requests across two servers send once and create one account',async()=>{
   await reset();const requests=await Promise.all([send(email,0),send(email,1)]);assert.equal(requests.filter(r=>r.status===200).length,1);assert.equal(sendCount,1);
   const challengeId=requests.find(r=>r.status===200).data.challengeId,body={...details,challengeId,otp:codes.get(email)};
   const results=await Promise.all([call('',body,0),call('',body,1)]);assert.equal(results.filter(r=>r.status===201).length,1);assert(results.every(r=>[201,400,409].includes(r.status)));assert.equal(await User.countDocuments(),1);
  });
  await t.test('hourly sending limits apply per email and IP',async()=>{
   await reset();for(let i=0;i<5;i++){assert.equal((await send()).status,200);await EmailOtp.updateOne({_id:email},{$set:{sentAt:new Date(Date.now()-61000)}});}assert.equal((await send()).status,429);assert.equal(sendCount,5);
   await reset();for(let i=0;i<20;i++)assert.equal((await send('student'+i+'@nith.ac.in')).status,200);assert.equal((await send('student21@nith.ac.in')).status,429);assert.equal(sendCount,20);
  });
  await t.test('SMTP failures and missing configuration fail closed without secret leakage',async()=>{
   await reset();setOtpMailSenderForTests(async()=>{throw new Error('smtp-secret-must-not-leak');});let result=await send();assert.equal(result.status,503);assert(!JSON.stringify(result.data).includes('smtp-secret'));assert.equal(await EmailOtp.countDocuments(),0);assert.equal(await User.countDocuments(),0);
   setOtpMailSenderForTests(undefined);result=await send();assert.equal(result.status,503);assert.equal(await User.countDocuments(),0);
  });
 }finally{await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

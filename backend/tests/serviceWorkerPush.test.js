import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../frontend/public/sw.js',import.meta.url),'utf8');
const shopkeeper='6adef3e23168596fc72af455',orderId='6ae1e2f0de412e42f0b54b15';
async function run({status=200,user={_id:shopkeeper,role:'shopkeeper'},retry=false}={}){
 const listeners={},shown=[],records=new Map();
 const self={addEventListener:(type,handler)=>listeners[type]=handler,clients:{matchAll:async()=>[]},registration:{showNotification:async(title,options)=>shown.push({title,...options})}};
 vm.runInNewContext(source,{self,Response,AbortSignal,Date,URL,fetch:async()=>({ok:status===200,status,json:async()=>user}),caches:{open:async()=>({put:async(key,value)=>records.set(key,await value.json())})}});
 let completed;listeners.push({data:{json:()=>({shopkeeper,orderId,title:'New CampusCart order',retry})},waitUntil:p=>completed=p});await completed;
 return {shown,result:records.get('/__push-status__/'+shopkeeper)};
}
test('closed-tab push displays the existing order and explicit retry re-alerts the same tag',async()=>{const {shown,result}=await run({retry:true});assert.equal(shown.length,1);assert.equal(shown[0].tag,'campuscart-order-'+orderId);assert.equal(shown[0].renotify,true);assert.equal(result.openTabs,0);assert.equal(result.stage,'display-request-accepted');});
test('push for a different signed-in account never displays',async()=>{const {shown,result}=await run({user:{_id:'000000000000000000000000',role:'shopkeeper'}});assert.equal(shown.length,0);assert.equal(result.stage,'different-account');});
test('expired sign-in records a reason without exposing an order notification',async()=>{const {shown,result}=await run({status:401});assert.equal(shown.length,0);assert.equal(result.profileStatus,401);assert.equal(result.stage,'sign-in-required');});

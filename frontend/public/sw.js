const STATUS_CACHE = 'campuscart-push-status-v1';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => event.waitUntil((async () => {
 let data; try { data = event.data.json(); } catch { return; }
 if (!/^[a-f0-9]{24}$/.test(data.shopkeeper || '')) return;
 const status = {version:2,orderId:data.orderId || 'test',receivedAt:new Date().toISOString(),stage:'received'};
 async function save() { try { const cache = await caches.open(STATUS_CACHE); await cache.put('/__push-status__/' + data.shopkeeper, new Response(JSON.stringify(status))); } catch {} }
 await save();
 try {
  status.openTabs = (await self.clients.matchAll({type:'window',includeUncontrolled:true})).length;
  const response = await fetch('/api/users/profile',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
  status.profileStatus = response.status;
  if (!response.ok) { status.stage='sign-in-required'; await save(); return; }
  const user = await response.json();
  if (user.role !== 'shopkeeper' || user._id !== data.shopkeeper) { status.stage='different-account'; await save(); return; }
  await self.registration.showNotification(data.title || 'CampusCart', {body:data.body,tag:data.test?'campuscart-test':'campuscart-order-'+data.orderId,data:{url:'/admin/orders',shopkeeper:data.shopkeeper},renotify:!!data.retry});
  status.stage='display-request-accepted'; status.shownAt=new Date().toISOString();
 } catch (error) { status.stage='error'; status.error=error.name; }
 await save();
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate('/admin/orders');return client.focus();}}return clients.openWindow('/admin/orders');})());});

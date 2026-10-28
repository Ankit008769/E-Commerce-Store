self.addEventListener('push',event=>{event.waitUntil((async()=>{
 let data;try{data=event.data.json();}catch{return;}
 const response=await fetch('/api/users/profile',{credentials:'same-origin',cache:'no-store'}).catch(()=>null);if(!response?.ok)return;
 const user=await response.json();if(user.role!=='shopkeeper'||user._id!==data.shopkeeper)return;
 await self.registration.showNotification(data.title||'CampusCart',{body:data.body,tag:data.test?'campuscart-test':'campuscart-order-'+data.orderId,data:{url:'/admin/orders',shopkeeper:data.shopkeeper},renotify:false});
})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate('/admin/orders');return client.focus();}}return clients.openWindow('/admin/orders');})());});

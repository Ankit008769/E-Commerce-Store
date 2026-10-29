import {api} from './marketplace';
import {toast} from 'react-toastify';
export async function watchStock(productId){
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Use a browser that supports push notifications.');
 if(await Notification.requestPermission()!=='granted')throw new Error('Allow notifications to receive a back-in-stock alert.');
 const key=await api('/api/notifications/key');if(!key.enabled)throw new Error('Push notifications are unavailable.');
 const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;const sub=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key.publicKey});
 await api('/api/notifications/subscribe',{method:'POST',body:sub.toJSON()});await api('/api/campus/stock-watch/'+productId,{method:'POST',body:{}});toast.success('We will notify you when this item is back in stock.');
}

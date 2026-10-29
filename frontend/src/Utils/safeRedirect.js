export function safeCustomerRedirect(value){
 if(typeof value!=='string'||value.length>2000||/[\\\u0000-\u0020]/.test(value)||/%(?:5c|00|0a|0d)/i.test(value))return '/shop';
 try{const u=new URL(value,'https://campuscart.invalid');if(u.origin!=='https://campuscart.invalid'||!value.startsWith('/')||value.startsWith('//'))return '/shop';
 if(!['/shop','/cart','/shipping','/placeorder','/profile','/favorite','/rider','/user-orders'].includes(u.pathname)&&!/^\/(?:order|product)\/[a-f0-9]{24}$/i.test(u.pathname))return '/shop';
 return u.pathname+u.search+u.hash;
 }catch{return '/shop';}
}

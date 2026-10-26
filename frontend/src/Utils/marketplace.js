import {useCallback,useEffect,useState} from 'react';
export const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
export const roleOf = u => u?.role || (u?.isAdmin ? 'administrator' : 'customer');
export const roleLabel = r => ({superadmin:'Super Administrator',administrator:'Administrator',shopkeeper:'Shopkeeper',customer:'Customer'}[r] || r);
export async function api(url, options={}) {
 const form=options.body instanceof FormData;
 const response=await fetch(url,{credentials:'same-origin',...options,headers:form?options.headers:{'Content-Type':'application/json',...options.headers},body:options.body && !form?JSON.stringify(options.body):options.body});
 const data=await response.json().catch(()=>({message:'The server returned an unexpected response.'}));
 if(!response.ok)throw new Error(data.message || data.error || 'Request failed.');
 return data;
}
export function useRemote(url) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
 const reload=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{let alive=true;setLoading(true);setError('');if(!url){setLoading(false);return;}api(url).then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[url,version]);
 return {data,error,loading,reload};
}

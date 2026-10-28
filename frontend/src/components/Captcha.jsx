import {useEffect,useRef} from 'react';
import 'altcha';
export default function Captcha({purpose,onChange,resetKey=0}){
 const ref=useRef(null),callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>{const el=ref.current;const update=e=>callback.current(e.detail.state==='verified'?e.detail.payload||el.querySelector('input[name="altcha"]')?.value||'':'');el.addEventListener('statechange',update);return()=>el.removeEventListener('statechange',update);},[resetKey,purpose]);
 return <div style={{margin:'16px 0'}}><altcha-widget key={purpose+resetKey} ref={ref} challenge={'/api/users/captcha?purpose='+purpose} type="checkbox"/></div>;
}

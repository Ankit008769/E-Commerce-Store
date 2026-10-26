import {Fragment,useEffect,useState} from 'react';
import {useSelector,useDispatch} from 'react-redux';
import store from '../redux/store';
import {setCredentials,logout} from '../redux/features/auth/authSlice';
// Cookies are shared across browser tabs: always reconcile the visible account with the server.
export default function SessionBoundary({children}){
 const user=useSelector(s=>s.auth.userInfo),dispatch=useDispatch();
 const [ready,setReady]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,controller;
  const verify=async()=>{controller?.abort();const request=new AbortController();controller=request;setChecking(true);setError('');
   try{const response=await fetch('/api/users/profile',{credentials:'same-origin',signal:request.signal});
    if(!alive||request.signal.aborted)return;
    if(response.status===401||response.status===403){if(store.getState().auth.userInfo)dispatch(logout());}
    else{if(!response.ok)throw new Error('Could not check your session. Please retry.');const identity=await response.json();if(!alive||request.signal.aborted)return;if(JSON.stringify(store.getState().auth.userInfo)!==JSON.stringify(identity))dispatch(setCredentials(identity));}
    setReady(true);
   }catch(e){if(alive&&!request.signal.aborted)setError('Could not check your session. Please retry.');}
   finally{if(alive&&!request.signal.aborted)setChecking(false);}
  };
  const storage=e=>{if(e.key==='userInfo'||e.key===null)verify();};
  const visible=()=>{if(document.visibilityState==='visible')verify();};
  verify();window.addEventListener('storage',storage);window.addEventListener('focus',verify);document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;controller?.abort();window.removeEventListener('storage',storage);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',visible);};
 },[dispatch,retry]);
 return <>{checking&&<p role="status" className="empty-state">Checking your account…</p>}{error&&<div role="alert" className="empty-state">{error}<button onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}<div hidden={checking||!!error}>{ready&&<Fragment key={(user?._id||'guest')+':'+(user?.role||'customer')}>{children}</Fragment>}</div></>;
}

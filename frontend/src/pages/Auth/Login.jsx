import {safeCustomerRedirect} from '../../Utils/safeRedirect';
import Captcha from '../../components/Captcha';
import {useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {setCredentials} from '../../redux/features/auth/authSlice';
import {api,roleOf} from '../../Utils/marketplace';
export default function Login({management=false}){
 const [altcha,setAltcha]=useState(''),[captchaKey,setCaptchaKey]=useState(0);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const dispatch=useDispatch(),navigate=useNavigate(),[params]=useSearchParams();
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const u=await api('/api/users/auth',{method:'POST',body:{altcha,email,password,portal:management?'management':'customer'}});dispatch(setCredentials(u));const redirect=params.get('redirect');navigate(management?'/admin/dashboard':roleOf(u)==='customer'?safeCustomerRedirect(redirect):'/admin/dashboard');}catch(e){setError(e.message);}finally{setBusy(false);setAltcha('');setCaptchaKey(k=>k+1);}};
 return <section className="auth-layout"><div className="auth-story"><span className="eyebrow">{management?'THE PEOPLE BEHIND EVERY DELIVERY':'YOUR NEIGHBOURHOOD, CLOSER'}</span><h1>{management?'A better day for every shop.':'Your daily favourites. Just around the corner.'}</h1><p>{management?'One workspace for your catalogue and orders. Access is tailored to your role.':'Discover local shops, fill your bag, and pay when your order arrives.'}</p><div className="story-orbit">C<span>shop · deliver · repeat</span></div></div><form className="panel auth-form" onSubmit={submit}><span className="eyebrow">{management?'MANAGEMENT PORTAL':'WELCOME BACK'}</span><h2>{management?'Sign in to your workspace':'Good to see you again'}</h2><p className="muted">{management?'Super Administrator, Administrator & Shopkeeper':'Sign in to place and track your orders.'}</p><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><Captcha purpose="login" onChange={setAltcha} resetKey={captchaKey}/>{error&&<p role="alert" className="error">{error}</p>}<button disabled={busy||!altcha}>{busy?'Signing in…':'Sign in →'}</button>{!management&&<p>New here? <Link to="/register">Create an account</Link></p>}{management&&<Link className="muted" to="/login">Customer sign in</Link>}</form></section>;
}

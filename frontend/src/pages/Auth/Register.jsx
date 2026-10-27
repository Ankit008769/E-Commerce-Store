import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {setCredentials} from '../../redux/features/auth/authSlice';
import {api} from '../../Utils/marketplace';
export default function Register(){
 const [form,setForm]=useState({username:'',email:'',password:''});
 const [challenge,setChallenge]=useState(null),[otp,setOtp]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 const dispatch=useDispatch(),navigate=useNavigate();
 useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[retryAt]);
 const remaining=Math.max(0,Math.ceil((retryAt-now)/1000));
 async function sendCode(){
  setError('');setNotice('');setBusy(true);
  try{const result=await api('/api/users/registration-otp',{method:'POST',body:{email:form.email.trim().toLowerCase()}});setChallenge(result.challengeId);setOtp('');setNotice(result.message);setRetryAt(Date.now()+result.retryAfter*1000);setNow(Date.now());}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function submit(e){
  e.preventDefault();if(busy)return;if(!challenge)return sendCode();
  setError('');setBusy(true);
  try{const user=await api('/api/users',{method:'POST',body:{...form,email:form.email.trim().toLowerCase(),challengeId:challenge,otp}});dispatch(setCredentials(user));navigate('/shop');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <form className="panel auth-form standalone" onSubmit={submit}>
  <span className="eyebrow">JOIN YOUR CAMPUS MARKETPLACE</span><h1>{challenge?'Verify your college email':'Create your account'}</h1>
  <p className="muted">Use your official @nith.ac.in email. We will verify it before creating your account.</p>
  {!challenge?[['username','Your name','text'],['email','Official NITH email','email'],['password','Password (8+ characters)','password']].map(([key,label,type])=><label key={key}>{label}<input required type={type} autoComplete={key==='password'?'new-password':key==='email'?'email':'name'} placeholder={key==='email'?'yourname@nith.ac.in':undefined} pattern={key==='email'?'[^@\\s]+@[nN][iI][tT][hH]\\.[aA][cC]\\.[iI][nN]':undefined} minLength={key==='password'?8:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>):<>
   <p>Enter the code sent to <strong>{form.email.trim().toLowerCase()}</strong>. Check your spam folder too.</p>
   <label>Verification code<input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" value={otp} onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,''))}/></label>
   <p className="muted">Valid for 10 minutes. A new code replaces the previous one.</p>
  </>}
  {notice&&<p role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
  <button disabled={busy}>{busy?'Please wait…':challenge?'Verify email & create account':'Send verification code'}</button>
  {challenge&&<><button type="button" className="secondary" disabled={busy||remaining>0} onClick={sendCode}>{remaining>0?`Resend code in ${remaining}s`:'Resend code'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setChallenge(null);setOtp('');setError('');setNotice('');}}>Change email or details</button></>}
  <p>Already registered? <Link to="/login">Sign in</Link></p>
 </form>;
}

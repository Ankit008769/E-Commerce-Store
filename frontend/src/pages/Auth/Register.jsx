import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {setCredentials} from '../../redux/features/auth/authSlice';
import {api} from '../../Utils/marketplace';
export default function Register(){
 const [form,setForm]=useState({username:'',email:'',password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),dispatch=useDispatch(),navigate=useNavigate();
 const submit=async e=>{e.preventDefault();setBusy(true);try{const u=await api('/api/users',{method:'POST',body:form});dispatch(setCredentials(u));navigate('/shop');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <form className="panel auth-form standalone" onSubmit={submit}><span className="eyebrow">JOIN YOUR LOCAL MARKETPLACE</span><h1>Create your account</h1><p className="muted">Use your official NIT Hamirpur email (@nith.ac.in) to join the campus marketplace.</p>{[['username','Your name','text'],['email','Official NITH email','email'],['password','Password (8+ characters)','password']].map(([key,label,type])=><label key={key}>{label}<input required type={type} placeholder={key==='email'?'yourname@nith.ac.in':undefined} pattern={key==='email'?'[^@\\s]+@[nN][iI][tT][hH]\\.[aA][cC]\\.[iI][nN]':undefined} minLength={key==='password'?8:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}{error&&<p className="error" role="alert">{error}</p>}<button disabled={busy}>{busy?'Creating…':'Create account'}</button><p>Already registered? <Link to="/login">Sign in</Link></p></form>;
}

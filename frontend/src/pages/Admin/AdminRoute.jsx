import {useEffect,useState} from 'react';
import {Navigate,Outlet} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {setCredentials} from '../../redux/features/auth/authSlice';
import {api,roleOf} from '../../Utils/marketplace';
export default function AdminRoute(){
 const [status,setStatus]=useState('loading');const dispatch=useDispatch();
 useEffect(()=>{let alive=true;api('/api/users/profile').then(u=>{if(alive){dispatch(setCredentials(u));setStatus(['superadmin','administrator','shopkeeper'].includes(roleOf(u))?'ok':'denied');}}).catch(()=>{if(alive)setStatus('denied');});return()=>{alive=false;};},[dispatch]);
 if(status==='loading')return <p className="empty-state">Checking your access…</p>;
 return status==='ok'?<Outlet/>:<Navigate to="/admin/login" replace/>;
}

import {useSelector} from 'react-redux';
import {Navigate} from 'react-router-dom';
import {useRemote,roleOf} from '../../Utils/marketplace';
import {OrderCard} from '../Orders/Order';
export default function UserOrder(){const user=useSelector(s=>s.auth.userInfo),staff=roleOf(user)!=='customer';const {data,error,loading,reload}=useRemote(staff?null:'/api/orders/mine');if(staff)return <Navigate to="/admin/orders" replace/>;return <section><span className="eyebrow">FROM THE SHOP TO YOUR DOOR</span><div className="section-heading"><h1>My orders</h1><button className="secondary small" onClick={reload}>Refresh</button></div><p className="muted">Order history for {user?.email}. Orders placed with another account appear under that account.</p>{loading?<p>Loading orders…</p>:error?<p className="error">{error}</p>:data?.length?data.map(o=><OrderCard key={o._id} order={o} reload={reload}/>):<div className="empty-state">Your first local delivery is waiting to happen.</div>}</section>;}

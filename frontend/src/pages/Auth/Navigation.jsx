import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useDispatch,useSelector} from 'react-redux';
import {logout} from '../../redux/features/auth/authSlice';
import {saveShippingAddress} from '../../redux/features/cart/cartSlice';
import {api,roleOf,roleLabel,money} from '../../Utils/marketplace';
import {toast} from 'react-toastify';
import CartDrawer from '../../components/CartDrawer';
function LocationDialog({onClose,address}) {
  const dialog=useRef(null),dispatch=useDispatch(),[form,setForm]=useState({address:'',city:'',postalCode:'',country:'India',...address});
  useEffect(()=>{const d=dialog.current;d.showModal();return()=>d.close();},[]);
  return <dialog ref={dialog} className="location-dialog" onCancel={onClose}><form onSubmit={e=>{e.preventDefault();dispatch(saveShippingAddress(form));onClose();}}><div className="section-heading"><h2>Where should we deliver?</h2><button type="button" className="text-button" onClick={onClose} aria-label="Close location">×</button></div><p className="muted">Enter your address or campus hostel. You can review it at checkout.</p>{[['address','Address / hostel & room'],['city','City'],['postalCode','PIN code'],['country','Country']].map(([key,label])=><label key={key}>{label}<input autoFocus={key==='address'} required maxLength="300" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<button>Save delivery location</button></form></dialog>;
}
export default function Navigation() {
  const {userInfo}=useSelector(s=>s.auth),cart=useSelector(s=>s.cart),dispatch=useDispatch(),navigate=useNavigate(),location=useLocation();
  const management=location.pathname.startsWith('/admin'),role=roleOf(userInfo),staff=role!=='customer';
  const [search,setSearch]=useState(''),[showCart,setShowCart]=useState(false),[showLocation,setShowLocation]=useState(false);
  useEffect(()=>setSearch(new URLSearchParams(location.search).get('q')||''),[location.search]);
  const signout=async()=>{try{await api('/api/users/logout',{method:'POST'});dispatch(logout());navigate(management?'/admin/login':'/login');}catch(e){toast.error(e.message);}};
  const count=cart.cartItems.reduce((s,i)=>s+Number(i.qty),0),total=cart.cartItems.reduce((s,i)=>s+i.price*Number(i.qty),0);
  return <><header className={management?'site-header':'quick-header'}>
    <Link className={management?'brand':'quick-brand'} to={management?'/admin/dashboard':'/'}>campus<span>cart</span>{management&&<small>MANAGEMENT</small>}</Link>
    {!management&&<><button className="location-button" onClick={()=>setShowLocation(true)}><strong>Local delivery, made easy</strong><span>{cart.shippingAddress?.address?[cart.shippingAddress.address,cart.shippingAddress.city].filter(Boolean).join(', '):'Select your delivery location'} ▾</span></button><form className="header-search" role="search" onSubmit={e=>{e.preventDefault();const next=new URLSearchParams();const selected=new URLSearchParams(location.search).get('shop');if(selected)next.set('shop',selected);if(search.trim())next.set('q',search.trim());navigate('/shop?'+next);}}><button aria-label="Search products" type="submit">⌕</button><input aria-label="Search products or shops" placeholder='Search for products, brands or shops' value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Clear search" onClick={()=>{setSearch('');const selected=new URLSearchParams(location.search).get('shop');navigate(selected?'/shop?shop='+selected:'/shop');}}>×</button>}</form></>}
    <nav aria-label="Account navigation">{management&&<><Link to="/">View storefront ↗</Link>{userInfo&&staff&&<span className="role-badge">{roleLabel(role)}</span>}</>}
      {userInfo?<details className="account-menu"><summary>{userInfo.username.split(' ')[0]} ▾</summary><div><Link to="/profile">My profile</Link><Link to="/user-orders">My orders</Link><Link to="/favorite">Saved items</Link>{staff&&<Link to="/admin/dashboard">Management</Link>}<button className="text-button" onClick={signout}>Sign out</button></div></details>:<Link className="login-link" to={management?'/admin/login':'/login'}>Login</Link>}
      {!management&&<button className="quick-cart-button" onClick={()=>setShowCart(true)} aria-label={'Open cart, '+count+' items'}><span aria-hidden="true">🛒</span>{count?<span>{count} items<small>{money(total)}</small></span>:<span>My cart</span>}</button>}
    </nav>
  </header>{!management&&<nav className="quick-subnav" aria-label="Store navigation"><Link to="/shop#choose-shop">Choose shop</Link><Link to="/favorite">My favourites</Link><Link to={userInfo?'/user-orders':'/login'}>Track my orders</Link><span>Cash on delivery available</span></nav>}
  {showCart&&<CartDrawer onClose={()=>setShowCart(false)}/>}
  {showLocation&&<LocationDialog address={cart.shippingAddress} onClose={()=>setShowLocation(false)}/>}
  </>;
}

import {watchStock} from '../../Utils/stockWatch';
import {toast} from 'react-toastify';
import {api} from '../../Utils/marketplace';
import {Link} from 'react-router-dom';
import {useDispatch,useSelector} from 'react-redux';
import {addToCart,removeFromCart} from '../../redux/features/cart/cartSlice';
import {addToFavorites,removeFromFavorites} from '../../redux/features/favorites/favoriteSlice';
import {addFavoriteToLocalStorage,removeFavoriteFromLocalStorage} from '../../Utils/localStorage';
import {money} from '../../Utils/marketplace';
export default function ProductCard({p}) {
  const user=useSelector(s=>s.auth.userInfo),dispatch=useDispatch(), favorites=useSelector(s=>s.favorites), cart=useSelector(s=>s.cart.cartItems);
  const saved=favorites.some(i=>i._id===p._id), qty=Number(cart.find(i=>i._id===p._id)?.qty||0);
  const label=p.name||'Shop item', policy=p.shopkeeper?.deliveryPolicy;
  const save=async()=>{if(user?.role==='customer'){try{await api('/api/campus/favorites/'+p._id,{method:'PUT',body:{saved:!saved}});}catch(e){toast.error(e.message);return;}}if(saved){dispatch(removeFromFavorites(p));removeFavoriteFromLocalStorage(p._id);}else{dispatch(addToFavorites(p));addFavoriteToLocalStorage(p);}};
  const change=n=>n<=0?dispatch(removeFromCart(p._id)):dispatch(addToCart({...p,qty:n}));
  return <article className="product-card">
    <div className="product-image"><Link to={'/product/'+p._id}><img src={p.image} alt={label} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src="/product-placeholder.svg";}}/></Link><button className={'save-button '+(saved?'saved':'')} onClick={save} aria-label={(saved?'Unsave ':'Save ')+label}>{saved?'♥':'♡'}</button>{!p.countInStock&&<span className="stock-badge">Sold out</span>}</div>
    <div className="product-info"><span className="delivery-chip">◷ {policy?.deliveryMinutes?policy.deliveryMinutes+' MINS':'LOCAL DELIVERY'}</span><Link to={'/product/'+p._id}><h3>{label}</h3></Link><span className="shop-label">{p.shopkeeper?.shopName||p.shopkeeper?.username||'Local shop'}</span>
      <div className="product-bottom"><strong>{money(p.price)}</strong>{qty?<div className="quantity-control" aria-label={'Quantity for '+label}><button onClick={()=>change(qty-1)} aria-label={'Remove one '+label}>−</button><span aria-live="polite">{qty}</span><button disabled={qty>=p.countInStock} onClick={()=>change(qty+1)} aria-label={'Add one '+label}>+</button></div>:<button className="add-button" disabled={!p.countInStock} onClick={()=>change(1)} aria-label={'Add '+label}>ADD</button>}</div>
      {!p.countInStock&&<button className="secondary small" onClick={()=>user?watchStock(p._id).catch(e=>toast.error(e.message)):toast.info('Sign in to receive alerts.')}>Notify me</button>}<p className="delivery-note">{policy?.deliveryCharge?money(policy.deliveryCharge)+' delivery · free from '+money(policy.minimumOrder):'Free delivery'}</p>
    </div>
  </article>;
}

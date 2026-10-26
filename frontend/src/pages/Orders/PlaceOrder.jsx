import {useEffect,useRef,useState} from 'react';
import {Link,Navigate,useNavigate} from 'react-router-dom';
import {useDispatch,useSelector} from 'react-redux';
import {clearCartItems} from '../../redux/features/cart/cartSlice';
import {api,money} from '../../Utils/marketplace';
import {checkoutPayload,readCheckout,prepareCheckout} from '../../Utils/checkout';
export default function PlaceOrder(){
 const cart=useSelector(s=>s.cart),[quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),navigate=useNavigate(),dispatch=useDispatch();
 const submitting=useRef(false),owner=useSelector(s=>s.auth.userInfo?._id);
 const [recoverable,setRecoverable]=useState(false);
 useEffect(()=>{
  let alive=true;setQuote(null);setError('');
  if(!cart.cartItems.length)return()=>{alive=false;};
  const payload=checkoutPayload(cart),pending=readCheckout(sessionStorage,owner,payload);
  setRecoverable(!!pending);
  if(pending){
   submitting.current=true;setBusy(true);
   api('/api/orders',{method:'POST',body:{...payload,checkoutKey:pending.key}}).then(o=>{
    if(!alive)return;
    sessionStorage.removeItem('pendingCheckout');dispatch(clearCartItems());navigate('/order/'+o._id);
   }).catch(e=>{if(alive){setError(e.message);setBusy(false);submitting.current=false;}});
  }else{
   api('/api/orders/quote',{method:'POST',body:{orderItems:cart.cartItems}}).then(q=>{if(alive)setQuote(q);}).catch(e=>{if(alive)setError(e.message);});
  }
  return()=>{alive=false;};
 },[cart.cartItems,cart.shippingAddress,owner,dispatch,navigate]);
 if(!cart.cartItems.length&&!busy)return <Navigate to="/cart"/>;if(!cart.shippingAddress.address)return <Navigate to="/shipping"/>;
 const place=async()=>{
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  try{
   const payload=checkoutPayload(cart);
   const pending=prepareCheckout(sessionStorage,owner,payload,()=>crypto.randomUUID());
   setRecoverable(true);
   const o=await api('/api/orders',{method:'POST',body:{...payload,checkoutKey:pending.key}});
   sessionStorage.removeItem('pendingCheckout');dispatch(clearCartItems());navigate('/order/'+o._id);
  }catch(e){setError(e.message);setBusy(false);submitting.current=false;}
 };

 return <section><span className="eyebrow">ONE LAST LOOK</span><h1>Ready when you are.</h1><div className="checkout-layout"><div>{quote?.shopOrders.map(g=><div className="panel order-panel" key={g.shopkeeper}><h2>{g.shopName}</h2>{g.items.map(i=><div className="total-row" key={i.product}><span>{i.name} × {i.qty}</span><strong>{money(i.price*i.qty)}</strong></div>)}<div className="total-row"><span>Delivery</span><strong>{g.shippingPrice?money(g.shippingPrice):'Free'}</strong></div><p className="muted">Free delivery from {money(g.minimumOrder)} · Delivery within {g.deliveryMinutes} minutes of placing your order.</p></div>)}</div><aside className="panel summary"><h2>Order summary</h2><p>{Object.values(cart.shippingAddress).join(', ')}</p><Link to="/shipping">Edit address</Link>{error&&<p role="alert" className="error">{error} <Link to="/cart">Review bag</Link></p>}{quote?<><div className="total-row"><span>Items</span><strong>{money(quote.itemsPrice)}</strong></div><div className="total-row"><span>Delivery</span><strong>{money(quote.shippingPrice)}</strong></div><div className="total-row grand-total"><span>Pay on delivery</span><strong>{money(quote.totalPrice)}</strong></div><button disabled={busy} onClick={place}>{busy?'Placing order…':'Place COD order →'}</button></>:recoverable?<button disabled={busy} onClick={place}>{busy?'Recovering your order…':'Retry checkout →'}</button>:!error&&<p>Confirming prices and delivery…</p>}<p className="muted">Each shop delivers its own items. No online payment is required.</p></aside></div></section>;
}

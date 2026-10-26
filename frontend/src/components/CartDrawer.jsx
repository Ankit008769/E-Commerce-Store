import {useEffect,useRef} from 'react';
import {useSelector} from 'react-redux';
import {useNavigate} from 'react-router-dom';
import {money} from '../Utils/marketplace';
import {cartBills,billTotal} from '../Utils/cartBills';
import ShopBills from './ShopBills';
export default function CartDrawer({onClose}){
 const dialog=useRef(null),items=useSelector(s=>s.cart.cartItems),navigate=useNavigate(),groups=cartBills(items),total=billTotal(groups);
 useEffect(()=>{const d=dialog.current;d.showModal();return()=>d.close();},[]);
 return <dialog className="quick-cart" ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}><div className="drawer-surface"><header><h2>My cart <small>({items.reduce((s,i)=>s+Number(i.qty),0)} items)</small></h2><button className="text-button" onClick={onClose} aria-label="Close cart">×</button></header><div className="drawer-body">{items.length?<><p className="cart-delivery-note">One combined order. Each shop delivers separately and collects its own payment.</p><ShopBills groups={groups} compact/><div className="drawer-bill"><h3>Combined bill</h3>{groups.map(g=><div key={g.id}><span>{g.name}</span><strong>{g.total===null?'At checkout':money(g.total)}</strong></div>)}<div><strong>Grand total</strong><strong>{total===null?'At checkout':money(total)}</strong></div><p>Estimated totals including delivery. Confirmed at checkout.</p></div></>:<div className="empty-state"><h2>Your cart is waiting</h2><button onClick={()=>{onClose();navigate('/shop');}}>Browse products</button></div>}</div>{!!items.length&&<footer><button onClick={()=>{onClose();navigate('/cart');}}><span>{total===null?'At checkout':money(total)}<small>ESTIMATED GRAND TOTAL</small></span><strong>Review order →</strong></button></footer>}</div></dialog>;
}

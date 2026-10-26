import {Link,useNavigate} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {money} from '../Utils/marketplace';
import {cartBills,billTotal} from '../Utils/cartBills';
import ShopBills from '../components/ShopBills';
export default function Cart(){
 const items=useSelector(s=>s.cart.cartItems),user=useSelector(s=>s.auth.userInfo),navigate=useNavigate(),groups=cartBills(items),total=billTotal(groups);
 return <section><span className="eyebrow">YOUR SHOPS, ONE BAG</span><h1>Your shopping bag</h1>{!items.length?<div className="empty-state"><h2>Your bag is waiting</h2><Link className="button" to="/shop">Browse all shops</Link></div>:<div className="checkout-layout"><ShopBills groups={groups}/><aside className="panel summary"><h2>Combined bill</h2>{groups.map(g=><div className="total-row" key={g.id}><span>{g.name}<small className="block muted">Includes this shop’s delivery</small></span><strong>{g.total===null?'At checkout':money(g.total)}</strong></div>)}<div className="total-row grand-total"><span>Grand total</span><strong>{total===null?'At checkout':money(total)}</strong></div><p className="muted">Estimated bill. Final prices, stock and delivery charges are confirmed at checkout.</p><p>Each shop sends its own delivery person. Pay each shop its amount when its delivery arrives.</p><button onClick={()=>navigate(user?'/shipping':'/login?redirect=/shipping')}>Continue to delivery →</button><Link to="/shop">Add more items</Link><span className="delivery-note">Cash on Delivery only</span></aside></div>}</section>;
}

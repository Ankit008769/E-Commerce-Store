import {Link,useParams} from 'react-router-dom';
import {useRemote,money,api} from '../../Utils/marketplace';
import {useDispatch,useSelector} from 'react-redux';
import {addToCart} from '../../redux/features/cart/cartSlice';
import {useState} from 'react';
import {toast} from 'react-toastify';
import ProductCard from './ProductCard';
function Recommendations({id}) {
 const {data,error,loading,reload}=useRemote('/api/products/'+id+'/recommendations');
 return <section className="spaced"><div className="section-heading"><div><span className="eyebrow">MORE GOOD FINDS</span><h2>You may also like</h2><p className="muted">Similar finds from local shops, picked for you.</p></div><Link to="/shop">Explore all →</Link></div>{loading?<p>Finding similar products…</p>:error?<div className="notice">Recommendations are temporarily unavailable. <button className="text-button" onClick={reload}>Try again</button></div>:data?.length?<div className="product-grid">{data.map(product=><ProductCard key={product._id} p={product}/>)}</div>:<div className="notice">More recommendations will appear as shops add products.</div>}</section>;
}
function ProductDescription({product}){
 const text=product.description||'';
 const marker=text.search(/Initial stock is|Representative food photo|Photo:|Source:|License:/i);
 const description=(marker<0?text:text.slice(0,marker)).trim();
 const credits=marker<0?'':text.slice(marker);
 const readable=content=>content.split(/(https?:\/\/[^\s]+)/g).map((part,index)=>/^https?:\/\//.test(part)?<a key={index} href={part} target="_blank" rel="noopener noreferrer">{part.includes('creativecommons.org')?'Image licence':'Photo source'}</a>:part);
 return <><p className="muted product-description">{readable(description||`${product.name||'Shop item'} from ${product.shopkeeper?.shopName||'your campus shop'}.`)}</p>{credits&&<details className="product-photo-credits"><summary>Product information &amp; photo credits</summary><p>{readable(credits)}</p></details>}</>;
}
export default function ProductDetails(){
 const {id}=useParams(),{data:p,error,loading,reload}=useRemote('/api/products/'+id),[qty,setQty]=useState(1),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[reviewBusy,setReviewBusy]=useState(false),user=useSelector(s=>s.auth.userInfo),dispatch=useDispatch(),cart=useSelector(s=>s.cart.cartItems);
 if(loading)return <p className="empty-state">Loading product…</p>;if(error)return <p className="empty-state error">{error}</p>;
 const existing=Number(cart.find(i=>i._id===id)?.qty||0);
 return <><Link className="back-link" to="/shop">← Back to marketplace</Link><section className="detail-layout"><img className="detail-image" src={p.image} alt={p.name||'Shop item'}/><div className="panel"><span className="eyebrow">{p.shopkeeper?.shopName}</span><h1>{p.name||'Shop item'}</h1><ProductDescription product={p}/><h2>{money(p.price)}</h2><p>{p.countInStock} available</p><label>Quantity<input type="number" min="1" max={p.countInStock} value={qty} onChange={e=>setQty(Number(e.target.value))}/></label><button disabled={!Number.isInteger(qty)||qty<1||qty+existing>p.countInStock} onClick={()=>{dispatch(addToCart({...p,qty:existing+qty}));toast.success('Added to your bag');}}>Add to bag</button><div className="notice">Cash on delivery · Delivered by {p.shopkeeper?.shopName}<br/>{money(p.shopkeeper?.deliveryPolicy?.deliveryCharge)} delivery below {money(p.shopkeeper?.deliveryPolicy?.minimumOrder)}</div></div></section><section className="panel spaced"><div className="section-heading"><h2>Customer reviews</h2><span className="count-pill">{Number(p.rating||0).toFixed(1)} / 5 · {p.numReviews||0} reviews</span></div>{p.reviews?.map(r=><article key={r._id} className="shop-order"><strong>{r.name} · {r.rating}/5</strong><p>{r.comment}</p></article>)}{!p.reviews?.length&&<p className="muted">Be the first to share your experience.</p>}{user?<form onSubmit={async e=>{e.preventDefault();setReviewBusy(true);try{await api('/api/products/'+id+'/reviews',{method:'POST',body:{rating,comment}});setComment('');reload();toast.success('Review added.');}catch(e){toast.error(e.message);}finally{setReviewBusy(false);}}}><label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label>Your review<textarea required value={comment} onChange={e=>setComment(e.target.value)}/></label><button disabled={reviewBusy}>{reviewBusy?'Saving…':'Share review'}</button></form>:<Link to="/login">Sign in to leave a review</Link>}</section><Recommendations key={id} id={id}/></>;
}

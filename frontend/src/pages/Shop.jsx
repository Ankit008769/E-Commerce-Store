import {useMemo} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useRemote,money} from '../Utils/marketplace';
import ProductCard from './Products/ProductCard';
export default function Shop({embedded=false}) {
  const {data,error,loading,reload}=useRemote('/api/products/allproducts');
  const categories=useRemote('/api/category/categories');
  const [params,setParams]=useSearchParams();
  const search=embedded?'':params.get('q')||'',shop=embedded?'':params.get('shop')||'',category=embedded?'':params.get('category')||'',sort=embedded?'new':params.get('sort')||'new';
  const update=(key,value)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);setParams(next);};
  const shops=useMemo(()=>[...new Map((data||[]).filter(p=>p.shopkeeper).map(p=>[p.shopkeeper._id,p.shopkeeper])).values()],[data]);
  const tiles=useMemo(()=>(categories.data||[]).map(c=>({...c,products:(data||[]).filter(p=>(!shop||p.shopkeeper?._id===shop)&&String(p.category?._id||p.category)===c._id)})).filter(c=>c.products.length),[categories.data,data,shop]);
  const products=useMemo(()=>{const list=(data||[]).filter(p=>(!shop||p.shopkeeper?._id===shop)&&(!category||String(p.category?._id||p.category)===category)&&((p.name||'Shop item')+' '+(p.brand||'')+' '+(p.shopkeeper?.shopName||'')).toLowerCase().includes(search.toLowerCase()));if(sort==='low')list.sort((a,b)=>a.price-b.price);if(sort==='high')list.sort((a,b)=>b.price-a.price);return list;},[data,search,shop,category,sort]);
  const groups=embedded&&tiles.length?tiles.map(c=>({id:c._id,name:c.name,items:c.products})): [{id:'all',name:search?'Results for “'+search+'”':category?tiles.find(c=>c._id===category)?.name||'Products':embedded?'Everyday favourites':'All products',items:products}];
  const uncategorised=(data||[]).filter(p=>!tiles.some(t=>t.products.some(item=>item._id===p._id)));
  if(embedded&&tiles.length&&uncategorised.length)groups.push({id:'other',name:'More to discover',items:uncategorised});
  return <section className="quick-market">
    <section className="shop-picker-section" id="choose-shop"><div className="section-heading"><div><span className="eyebrow">YOUR CAMPUS SHOPS</span><h2>Your campus shops</h2><p className="muted">Pick your favourite shop or browse all. Separate deliveries, one easy checkout.</p></div><Link to="/shop">Browse all products →</Link></div><div className="shop-picker-list"><Link className={'shop-picker-option '+(!shop?'selected':'')} to="/shop">All shops</Link>{shops.map(s=><Link key={s._id} className={'shop-picker-option '+(shop===s._id?'selected':'')} to={'/shop?shop='+s._id}><strong>{s.shopName||s.username}</strong><small>{s.deliveryPolicy?.deliveryMinutes} min · {money(s.deliveryPolicy?.deliveryCharge)} delivery below {money(s.deliveryPolicy?.minimumOrder)}</small></Link>)}</div></section>
    {tiles.length>0&&<nav className="menu-category-bar" aria-label="Product categories"><Link className={!category?'selected':''} to={shop?'/shop?shop='+shop:'/shop'}>All items</Link>{tiles.map(c=><Link key={c._id} className={category===c._id?'selected':''} to={'/shop?'+new URLSearchParams({category:c._id,...(shop?{shop}:{})})}>{c.name}<span>{c.products.length}</span></Link>)}</nav>}

    {!embedded&&<div className="quick-filter"><p>{products.length} products {search&&<>matching <strong>{search}</strong></>}</p><select aria-label="Sort products" value={sort} onChange={e=>update('sort',e.target.value)}><option value="new">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>{(category||search||shop)&&<Link to="/shop">Clear filters</Link>}</div>}
    {loading?<div className="empty-state">Stocking up your screen…</div>:error?<div className="empty-state error" role="alert">{error}<button onClick={reload}>Try again</button></div>:!products.length?<div className="empty-state"><h2>{data?.length?'No matching products':'Your local shops are getting ready'}</h2><p>{data?.length?'Try another category or search.':'Products from active shopkeepers will appear here.'}</p></div>:groups.map(g=><section key={g.id} className="product-shelf"><div className="shelf-heading"><h2>{g.name}</h2>{embedded&&<Link to={g.id==='all'||g.id==='other'?'/shop':'/shop?category='+g.id}>see all →</Link>}</div><div className={embedded?'product-grid quick-shelf':'product-grid'}>{g.items.slice(0,embedded?6:undefined).map(p=><ProductCard key={p._id} p={p}/>)}</div></section>)}
  </section>;
}

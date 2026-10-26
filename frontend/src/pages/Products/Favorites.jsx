import {useSelector} from 'react-redux';
import {useRemote} from '../../Utils/marketplace';
import ProductCard from './ProductCard';
export default function Favorites(){const saved=useSelector(s=>s.favorites),{data,error,loading}=useRemote('/api/products/allproducts');const products=(data||[]).filter(p=>saved.some(s=>s._id===p._id));return <section><span className="eyebrow">YOUR LITTLE COLLECTION</span><h1>Saved favourites</h1>{loading?<p>Loading…</p>:error?<p className="error">{error}</p>:products.length?<div className="product-grid">{products.map(p=><ProductCard key={p._id} p={p}/>)}</div>:<div className="empty-state">Save available products with the heart button to find them here.</div>}</section>;}

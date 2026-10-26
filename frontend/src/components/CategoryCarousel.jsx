import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
export default function CategoryCarousel({tiles,category,shop}){
 const track=useRef(null),[edges,setEdges]=useState({previous:false,next:false});
 useEffect(()=>{const el=track.current;if(!el)return;const update=()=>setEdges({previous:el.scrollLeft>2,next:el.scrollLeft+el.clientWidth<el.scrollWidth-2});
  const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener('scroll',update,{passive:true});
  const active=el.querySelector('[aria-current="page"]');if(active){const a=active.getBoundingClientRect(),b=el.getBoundingClientRect();if(a.left<b.left)el.scrollLeft-=b.left-a.left;else if(a.right>b.right)el.scrollLeft+=a.right-b.right;}
  update();return()=>{observer.disconnect();el.removeEventListener('scroll',update);};
 },[category,shop,tiles.length]);
 const move=direction=>track.current.scrollBy({left:direction*Math.max(120,track.current.clientWidth*.8),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 return <nav className="category-carousel" aria-label="Product categories"><button type="button" className="category-arrow" aria-label="Previous categories" disabled={!edges.previous} onClick={()=>move(-1)}>‹</button><div className="menu-category-bar" ref={track}><Link className={!category?'selected':''} aria-current={!category?'page':undefined} to={shop?'/shop?shop='+shop:'/shop'}>All items</Link>{tiles.map(c=><Link key={c._id} className={category===c._id?'selected':''} aria-current={category===c._id?'page':undefined} to={'/shop?'+new URLSearchParams({category:c._id,...(shop?{shop}:{})})}>{c.name}<span>{c.products.length}</span></Link>)}</div><button type="button" className="category-arrow" aria-label="Next categories" disabled={!edges.next} onClick={()=>move(1)}>›</button></nav>;
}

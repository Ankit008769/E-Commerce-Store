import {Link} from 'react-router-dom';
import {BuyAgain} from '../components/CampusFeatures';
import Shop from './Shop';
export default function Home() {
  return <>
    <section className="quick-hero">
      <div><span className="quick-kicker">YOUR CAMPUS. YOUR LOCAL SHOPS.</span><h1>Everyday needs,<br/>just a few taps away.</h1><p>From your favourite shop to your doorstep.</p><Link className="hero-shop" to="/shop">Shop now →</Link></div>
      <div className="quick-hero-art" aria-hidden="true"><span className="hero-spark">✦</span><div className="quick-bag"><span>campus<span>cart</span></span><small>good things inside.</small></div><span className="hero-goods goods-one">🥛</span><span className="hero-goods goods-two">🥬</span><span className="hero-goods goods-three">🍊</span><span className="hero-goods goods-four">🍞</span></div>
    </section>
    <div className="quick-promos">
      <Link to="/shop" className="quick-promo mint"><div><h2>Your daily<br/>essentials, sorted</h2><p>Find it. Add it. Get it delivered.</p><span>Explore essentials →</span></div><b aria-hidden="true">🛍️</b></Link>
      <Link to="/shop?sort=low" className="quick-promo lemon"><div><h2>Little prices.<br/>Big everyday wins.</h2><p>Browse from lowest price first.</p><span>Find your favourites →</span></div><b aria-hidden="true">🧺</b></Link>
      <Link to="/shop" className="quick-promo lilac"><div><h2>Local shops.<br/>Cash at your door.</h2><p>Shopkeepers deliver your order.</p><span>Shop with COD →</span></div><b aria-hidden="true">🛵</b></Link>
    </div>
    <BuyAgain/><Shop embedded/>
  </>;
}

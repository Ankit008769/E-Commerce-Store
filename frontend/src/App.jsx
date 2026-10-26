import {Outlet,useLocation} from 'react-router-dom';
import Navigation from './pages/Auth/Navigation';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export default function App(){const management=useLocation().pathname.startsWith('/admin');return <div className={management?'management-app':'customer-app'}><Navigation/><main className="app-main"><Outlet/></main><footer className="site-footer"><strong>CampusCart</strong><span>Local shops. Delivered by the people who know them.</span><span>Cash on delivery</span></footer><ToastContainer position="bottom-right"/></div>;}

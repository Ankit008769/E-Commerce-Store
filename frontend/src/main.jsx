import ReactDOM from 'react-dom/client';
import './index.css';
import './quick-commerce.css';
import App from './App.jsx';
import {Provider} from 'react-redux';
import store from './redux/store';
import {createBrowserRouter,RouterProvider,Navigate,useParams} from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './pages/Admin/AdminRoute';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Cart from './pages/Cart';
import ProductDetails from './pages/Products/ProductDetails';
import Favorites from './pages/Products/Favorites';
import Profile from './pages/User/Profile';
import UserOrder from './pages/User/UserOrder';
import Shipping from './pages/Orders/Shipping';
import PlaceOrder from './pages/Orders/PlaceOrder';
import Order from './pages/Orders/Order';
import AdminDashboard from './pages/Admin/AdminDashboard';
function ProductPage(){const {id}=useParams();return <ProductDetails key={id}/>;}
const router=createBrowserRouter([{element:<App/>,children:[
 {path:'/',element:<Home/>},{path:'/shop',element:<Shop/>},{path:'/product/:id',element:<ProductPage/>},
 {path:'/favorite',element:<Favorites/>},{path:'/cart',element:<Cart/>},{path:'/login',element:<Login/>},{path:'/register',element:<Register/>},
 {path:'/admin/login',element:<Login management/>},
 {element:<PrivateRoute/>,children:[{path:'/profile',element:<Profile/>},{path:'/user-orders',element:<UserOrder/>},{path:'/shipping',element:<Shipping/>},{path:'/placeorder',element:<PlaceOrder/>},{path:'/order/:id',element:<Order/>}]},
 {path:'/admin',element:<AdminRoute/>,children:[{index:true,element:<Navigate to="dashboard" replace/>},{path:':section',element:<AdminDashboard/>},{path:'product/update/:id',element:<Navigate to="/admin/products" replace/>}]},
 {path:'*',element:<div className="empty-state"><h1>Page not found</h1><a href="/">Back to the shop</a></div>}
]}]);
ReactDOM.createRoot(document.getElementById('root')).render(<Provider store={store}><RouterProvider router={router}/></Provider>);

import CampusAddressFields from '../../components/CampusAddressFields';
import {useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {Navigate,useNavigate} from 'react-router-dom';
import {saveShippingAddress,savePaymentMethod} from '../../redux/features/cart/cartSlice';
export default function Shipping(){const cart=useSelector(s=>s.cart),[form,setForm]=useState({address:'',city:'Hamirpur',postalCode:'177005',country:'India',...cart.shippingAddress}),dispatch=useDispatch(),navigate=useNavigate();if(!cart.cartItems.length)return <Navigate to="/cart"/>;return <form className="panel auth-form standalone" onSubmit={e=>{e.preventDefault();dispatch(saveShippingAddress(form));dispatch(savePaymentMethod('COD'));navigate('/placeorder');}}><span className="eyebrow">BAG → DELIVERY → CONFIRM</span><h1>Where should we deliver?</h1><CampusAddressFields form={form} setForm={setForm}/><div className="notice"><strong>Cash on Delivery</strong><p>Pay your shopkeeper when your order arrives.</p></div><button>Review your order →</button></form>;}

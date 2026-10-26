export const addDecimals = num => (Math.round(num * 100) / 100).toFixed(2);
export const updateCart = state => {
 state.itemsPrice = addDecimals(state.cartItems.reduce((sum, item) => sum + item.price * Number(item.qty), 0));
 // The server quotes the per-shop delivery fee during checkout.
 state.shippingPrice = null; state.taxPrice = '0.00'; state.totalPrice = state.itemsPrice; state.paymentMethod = 'COD';
 localStorage.setItem('cart', JSON.stringify(state)); return state;
};

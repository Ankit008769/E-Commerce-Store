export const roleOf = u => u?.role || (u?.isAdmin ? 'administrator' : 'customer');
export const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
export function numeric(value, label, min = 0, max = 10000000) {
 if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) fail(label + ' must be between ' + min + ' and ' + max);
 return Number(value);
}
export const deliveryPrice = (subtotal, p) => subtotal < p.minimumOrder ? money(p.deliveryCharge) : 0;
export const lateDeduction = (g, now = new Date()) => g.deadline && new Date(now) > new Date(g.deadline) ? money(g.latePenalty || 0) : 0;
export function visibleOrder(order, user) {
 const o = order.toObject ? order.toObject() : JSON.parse(JSON.stringify(order));
 if (roleOf(user) === 'shopkeeper') {
  o.shopOrders = (o.shopOrders || []).filter(g => String(g.shopkeeper) === String(user._id) && g.status !== 'scheduled');
  o.orderItems = o.shopOrders.flatMap(g => g.items);
  o.itemsPrice = money(o.shopOrders.reduce((s,g) => s + g.itemsPrice, 0));
  o.shippingPrice = money(o.shopOrders.reduce((s,g) => s + g.shippingPrice, 0));
  o.discount=money(o.shopOrders.reduce((s,g)=>s+(g.discount||0),0)); o.taxPrice = 0; o.totalPrice = money(o.itemsPrice + o.shippingPrice-o.discount);
  o.isDelivered = o.shopOrders.every(g => g.isDelivered); o.isPaid = o.isDelivered;
 }
 for (const g of o.shopOrders || []) {
  const owner=String(o.user?._id||o.user)===String(user._id);
  if(roleOf(user)!=='customer'||!owner)delete g.deliveryCode;
  if (roleOf(user) !== 'superadmin') { delete g.latePenalty; delete g.deduction; }
  else g.pendingDeduction = g.isDelivered ? 0 : lateDeduction(g);
 }
 return o;
}

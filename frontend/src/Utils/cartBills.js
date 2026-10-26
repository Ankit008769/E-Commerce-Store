export const roundMoney=n=>Math.round((n+Number.EPSILON)*100)/100;
export function cartBills(items){
 const groups=new Map();
 for(const item of items){const shop=item.shopkeeper,id=String(shop?._id||shop||'unassigned');
  if(!groups.has(id))groups.set(id,{id,name:shop?.shopName||'Shop',items:[],policy:shop?.deliveryPolicy});
  groups.get(id).items.push(item);
 }
 return [...groups.values()].map(g=>{const subtotal=roundMoney(g.items.reduce((s,i)=>s+Number(i.price)*Number(i.qty),0));
  const known=g.policy&&Number.isFinite(Number(g.policy.minimumOrder))&&Number.isFinite(Number(g.policy.deliveryCharge));
  const delivery=known?(subtotal<Number(g.policy.minimumOrder)?Number(g.policy.deliveryCharge):0):null;
  return {...g,subtotal,delivery,total:delivery===null?null:roundMoney(subtotal+delivery)};
 });
}
export function billTotal(groups){return groups.every(g=>g.total!==null)?roundMoney(groups.reduce((s,g)=>s+g.total,0)):null;}

export const GROUP_STATES=['scheduled','preparing','ready','picked_up','delivered','cancelled'];
export const roundMoney=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
export function campusClock(at){const d=new Date(new Date(at).getTime()+330*60000);return {day:d.getUTCDay(),minute:d.getUTCHours()*60+d.getUTCMinutes(),date:d.toISOString().slice(0,10)};}
export function shopOpen(policy,at){if(policy?.closed)return false;if(!policy?.hours?.length)return !policy?.hoursConfigured;const {day,minute}=campusClock(at);return policy.hours.some(h=>h.day===day&&minute>=h.open&&minute<h.close);}
export function slotRule(value,policy={},now=Date.now()){
 const at=new Date(value).getTime(),lead=(Number(policy.prepMinutes??15)+Number(policy.walkMinutes??10))*60000;
 if(!Number.isFinite(at)||at%300000!==0)return {valid:false,reason:'Choose a delivery time on a 5 minute boundary.'};
 if(at<Number(now)+lead||at>Number(now)+48*3600000)return {valid:false,reason:'Choose a slot after preparation and travel time, within 48 hours.'};
 const releaseAt=new Date(at-lead);if(!shopOpen({...policy,closed:false},releaseAt))return {valid:false,reason:'The shop is closed at the preparation time for that slot.'};
 return {valid:true,scheduledFor:new Date(at),releaseAt};
}
export function couponValue(coupon,subtotal,now=Date.now()){
 if(!coupon.active)throw new Error('This coupon is inactive.');
 if(coupon.startsAt&&new Date(coupon.startsAt)>now)throw new Error('This coupon has not started yet.');
 if(new Date(coupon.expiresAt)<=now)throw new Error('This coupon has expired.');
 if(subtotal<coupon.minimum)throw new Error('Cart is too small for this coupon.');
 return Math.min(roundMoney(subtotal),roundMoney(coupon.kind==='percent'?subtotal*coupon.value/100:coupon.value));
}

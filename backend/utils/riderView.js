import {DeliveryTask} from '../models/campusModels.js';
export async function withRiders(order){const o=order.toObject?order.toObject():order;const tasks=await DeliveryTask.find({order:o._id});for(const g of o.shopOrders||[]){const t=tasks.find(t=>String(t.group)===String(g._id));if(t){g.rider=t.rider;g.riderName=t.riderName;g.riderStatus=t.status;}}return o;}

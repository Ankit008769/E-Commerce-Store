import {campusLocations} from '../data/campusLocations.js';
export function makeCampusAddress({locationId,details='',customAddress=''}){
 if(locationId==='other')return customAddress.trim();
 const location=campusLocations.find(l=>l.id===locationId);
 return location?[details.trim(),location.name,'NIT Hamirpur'].filter(Boolean).join(', '):'';
}
export function readCampusAddress(address=''){
 const location=campusLocations.find(l=>address.endsWith(', '+l.name+', NIT Hamirpur')||address===l.name+', NIT Hamirpur');
 if(location)return {locationId:location.id,details:address===location.name+', NIT Hamirpur'?'':address.slice(0,-(', '+location.name+', NIT Hamirpur').length),customAddress:''};
 return {locationId:address?'other':'',details:'',customAddress:address};
}

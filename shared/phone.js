export function normalizePhone(value){
 if(typeof value!=='string'||value.length>30||!/^[+0-9() -]+$/.test(value))return '';
 const compact=value.replace(/[() -]/g,'');
 const match=compact.match(/^(?:\+91|91)?([6-9]\d{9})$/);
 return match?'+91'+match[1]:'';
}

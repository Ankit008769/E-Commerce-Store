import {fail} from './marketplace.js';
export function itemNote(value){
 if(value===undefined)return '';
 if(typeof value!=='string'||value.length>300||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value))fail('Special instructions must be plain text, up to 300 characters, without HTML or control characters.');
 return value.replace(/\r\n?/g,'\n').trim();
}

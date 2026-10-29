import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone} from '../../shared/phone.js';
test('delivery phone accepts Indian mobile formats and rejects invalid input',()=>{
 for(const phone of ['9876543210','+919876543210','91 98765 43210','(+91) 98765-43210'])assert.equal(normalizePhone(phone),'+919876543210');
 for(const phone of [undefined,null,9876543210,'','1234567890','987654321','98765432100','+449876543210','+91abc9876543210'])assert.equal(normalizePhone(phone),'');
});

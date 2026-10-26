import test from 'node:test';
import assert from 'node:assert/strict';
import {campusLocations} from '../../frontend/src/data/campusLocations.js';
import {readCampusAddress,makeCampusAddress} from '../../frontend/src/Utils/campusAddress.js';
test('saved campus location and room survive reopening without duplicated address',()=>{
 const hostel=campusLocations.find(l=>l.name==='Kailash Boys Hostel');
 const fields={locationId:hostel.id,details:'Block A, Room 203',customAddress:''};
 const address=makeCampusAddress(fields);assert.equal(address,'Block A, Room 203, Kailash Boys Hostel, NIT Hamirpur');assert.deepEqual(readCampusAddress(address),fields);
});
test('custom and legacy addresses remain editable without losing text',()=>{
 const address='New campus building, room 2';const decoded=readCampusAddress(address);assert.equal(decoded.locationId,'other');assert.equal(makeCampusAddress(decoded),address);assert.equal(makeCampusAddress({locationId:'unknown'}),'');
});

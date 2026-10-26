import test from 'node:test';
import assert from 'node:assert/strict';
import {rankRecommendations} from '../utils/recommendations.js';
test('same category ranks before brand and keyword matches',()=>{
 const source={_id:'a',name:'Running shoe',category:'shoes',brand:'Acme',price:100};
 const candidates=[{_id:'b',name:'Running top',category:'clothes',price:100,countInStock:1},{_id:'c',name:'Trainers',category:'shoes',price:150,countInStock:1},{_id:'d',name:'Cap',brand:'Acme',price:100,countInStock:1}];
 assert.deepEqual(rankRecommendations(source,candidates).map(p=>p._id),['c','d','b']);
});
test('current product and sold-out stock excluded; unnamed products use price fallback',()=>{
 const source={_id:'a',name:'',price:100};
 const candidates=[{_id:'a',price:100,countInStock:5},{_id:'b',price:100,countInStock:0},{_id:'c',price:80,countInStock:1},{_id:'d',price:105,countInStock:1}];
 assert.deepEqual(rankRecommendations(source,candidates).map(p=>p._id),['d','c']);
 assert.equal(rankRecommendations(source,[]).length,0);
 assert.equal(rankRecommendations(source,candidates,1).length,1);
});

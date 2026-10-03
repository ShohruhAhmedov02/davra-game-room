import test from 'node:test';
import assert from 'node:assert/strict';
import {uno} from '../server/games/uno.js';
const c=(id,color,value)=>({id,color,value});
function state(){const s=uno.create([{id:'a'},{id:'b'},{id:'c'}]);s.turn='a';s.color='red';s.discard=[c('top','red','3')];s.hands.a=[c('r','red','7'),c('b','blue','7'),c('g','green','7'),c('x','yellow','9')];return s;}
test('Three same-number cards of different colors count as one UNO turn',()=>{
 const s=state();uno.act(s,'a',{type:'play',cardIds:['r','g','b'],uno:true});
 assert.equal(s.turn,'b');assert.equal(s.color,'blue');assert.deepEqual(s.hands.a.map(c=>c.id),['x']);
 assert.deepEqual(s.discard.slice(-3).map(c=>c.id),['r','g','b']);assert.equal(s.unoPending,null);
});
test('Multi-card move still requires UNO and can finish the game',()=>{
 const s=state();uno.act(s,'a',{type:'play',cardIds:['r','b','g']});assert.equal(s.unoPending,'a');
 uno.act(s,'b',{type:'catch'});assert.equal(s.hands.a.length,3);
 const win=state();win.hands.a.pop();uno.act(win,'a',{type:'play',cardIds:['r','b','g']});assert.equal(win.winner,null);assert.deepEqual(win.finished,['a']);assert.equal(win.turn,'b');
});
test('Invalid multi-card moves are rejected atomically',()=>{
 for(const ids of [['b','r'],['r','x'],['r','r'],['r','missing'],[],null,'r']){
  const s=state(),before=JSON.stringify(s);assert.throws(()=>uno.act(s,'a',{type:'play',cardIds:ids}));assert.equal(JSON.stringify(s),before);
 }
 const s=state();s.hands.a=[c('one','red','+2'),c('two','blue','+2')];assert.throws(()=>uno.act(s,'a',{type:'play',cardIds:['one','two']}));
});
test('After drawing, the drawn number can be combined with matching cards',()=>{
 const s=state();s.drawn='r';uno.act(s,'a',{type:'play',cardIds:['r','b','g'],uno:true});
 assert.equal(s.hands.a.length,1);assert.equal(s.color,'green');assert.equal(s.turn,'b');assert.equal(s.drawn,null);
 const wrong=state();wrong.drawn='r';const before=JSON.stringify(wrong);
 assert.throws(()=>uno.act(wrong,'a',{type:'play',cardIds:['b','r']}));assert.equal(JSON.stringify(wrong),before);
 const single=state();single.drawn='r';uno.act(single,'a',{type:'play',cardIds:['r']});assert.equal(single.hands.a.length,3);
});
test('The exact screenshot scenario: draw a green six and combine the red six',()=>{
 const s=state();s.color='green';s.discard=[c('top','green','9')];
 s.hands.a=[c('red-six','red','6'),c('blue-skip','blue','skip'),c('yellow-nine','yellow','9')];
 s.deck.push(c('green-six','green','6'));
 uno.act(s,'a',{type:'draw'});assert.equal(s.drawn,'green-six');
 assert.deepEqual(uno.view(s,'a').legalCards,['green-six']);
 uno.act(s,'a',{type:'play',cardIds:['green-six','red-six']});
 assert.equal(s.color,'red');assert.equal(s.hands.a.length,2);assert.equal(s.turn,'b');
});
test('Bots also combine same-number cards after drawing',()=>{
 const s=state();s.drawn='r';const move=uno.bot(s,'a','hard');
 assert.deepEqual(move.cardIds,['r','b','g']);uno.act(s,'a',move);assert.equal(s.hands.a.length,1);
});
test('All bot levels use matching number groups',()=>{
 for(const level of ['easy','medium','hard']){const s=state();const move=uno.bot(s,'a',level);assert.equal(move.cardIds.length,3);uno.act(s,'a',move);assert.equal(s.hands.a.length,1);assert.equal(s.unoPending,null);}
});


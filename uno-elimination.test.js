import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {uno} from '../server/games/uno.js';
import {createGameServer} from '../server/app.js';
const card=(id,color,value)=>({id,color,value});
const players=n=>Array.from({length:n},(_,i)=>({id:`p${i}`,bot:false}));
function state(ps=players(4)){
 const s=uno.create(ps);s.color='red';s.discard=[card('top','red','9')];
 s.hands.p0=[card('last','red','5')];return s;
}

test('UNO continues after first finisher, skips finished players, and identifies the last loser',()=>{
 const s=state();uno.act(s,'p0',{type:'play',cardId:'last'});
 assert.equal(s.winner,null);assert.equal(s.over,false);assert.equal(s.turn,'p1');
 assert.deepEqual(s.finished,['p0']);assert.deepEqual(uno.view(s,'p0').legalCards,[]);
 assert.throws(()=>uno.act(s,'p0',{type:'draw'}));assert.throws(()=>uno.act(s,'p0',{type:'catch'}));
 s.turn='p3';s.hands.p3=[card('three','red','5')];uno.act(s,'p3',{type:'play',cardId:'three'});
 assert.equal(s.turn,'p1');assert.deepEqual(s.finished,['p0','p3']);assert.equal(s.over,false);
 s.hands.p1=[card('one','red','5')];uno.act(s,'p1',{type:'play',cardId:'one'});
 assert.equal(s.loser,'p2');assert.equal(s.winner,'p0');assert.equal(s.over,true);assert.equal(s.turn,null);
 assert.deepEqual(s.finished,['p0','p3','p1']);assert.throws(()=>uno.act(s,'p2',{type:'draw'}));
});

test('Reverse, skip and penalties use only players still in the game',()=>{
 for(const value of ['reverse','skip','+2']){
  const s=state();s.finished=['p1'];s.hands.p1=[];
  s.hands.p0=[card('action','red',value),card('keep','green','0')];
  const before=s.hands.p2.length;uno.act(s,'p0',{type:'play',cardId:'action'});
  assert.equal(s.turn,'p3');assert.equal(s.hands.p1.length,0);
  if(value==='+2')assert.equal(s.hands.p2.length,before+2);
 }
 const s=state();s.finished=['p1','p3'];s.hands.p1=[];s.hands.p3=[];
 s.hands.p0=[card('reverse','red','reverse'),card('keep','green','0')];
 uno.act(s,'p0',{type:'play',cardId:'reverse'});assert.equal(s.turn,'p0');
});

test('Exactly two remaining AI are randomly resolved, without discarding their cards',()=>{
 const losers=new Set();
 for(let i=0;i<100;i++){
  const ps=players(3);ps[1].bot=ps[2].bot=true;const s=state(ps);
  const held=s.hands.p1.length+s.hands.p2.length;
  uno.act(s,'p0',{type:'play',cardId:'last'});
  assert.equal(s.over,true);assert.equal(s.randomFinal,true);assert.equal(s.winner,'p0');
  assert.ok(['p1','p2'].includes(s.loser));assert.equal(s.finished.length,2);
  assert.equal(s.hands.p1.length+s.hands.p2.length,held);
  losers.add(s.loser);
 }
 assert.equal(losers.size,2,'Both bots must be eligible for the random loss');
});

test('A human and AI final continues; conversion of that human to AI resolves the match',()=>{
 const ps=players(3);ps[2].bot=true;const s=state(ps);
 uno.act(s,'p0',{type:'play',cardId:'last'});assert.equal(s.over,false);assert.equal(s.randomFinal,false);
 ps[1].bot=true;assert.equal(uno.syncPlayers(s,ps),true);assert.equal(s.over,true);assert.equal(s.randomFinal,true);
 const result=JSON.stringify(s);assert.equal(uno.syncPlayers(s,ps),false);assert.equal(JSON.stringify(s),result);
});

test('Two humans finish normally and a two-AI room resolves immediately',()=>{
 const s=state(players(2));uno.act(s,'p0',{type:'play',cardId:'last'});
 assert.equal(s.loser,'p1');assert.equal(s.winner,'p0');assert.equal(s.randomFinal,false);
 const ai=uno.create(players(2).map(p=>({...p,bot:true})));
 assert.equal(ai.over,true);assert.equal(ai.randomFinal,true);assert.notEqual(ai.winner,ai.loser);
});

test('Socket room remains playing after a finisher and announces random AI final',async t=>{
 const server=createGameServer();await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));
 const c=io(`http://127.0.0.1:${server.http.address().port}`,{transports:['websocket'],reconnection:false});
 t.after(async()=>{c.disconnect();await server.close();});
 c.on('session',s=>c.identity=s);c.on('room',r=>c.room=r);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw new Error('State timeout');}
 const emit=(event,data={})=>new Promise(resolve=>c.emit(event,data,resolve));
 await until(()=>c.identity);
 await emit('room:create',{name:'Host',game:'uno'});await until(()=>c.room);
 for(let i=0;i<3;i++)await emit('room:bot',{level:'easy'});
 await emit('room:start');await until(()=>c.room.status==='playing');
 const r=server.rooms.get(c.room.code),s=r.state,host=c.identity.id;
 s.color='red';s.discard=[card('top','red','9')];s.hands[host]=[card('last','red','5')];
 assert.equal((await emit('game:action',{type:'play',cardId:'last'})).ok,true);
 await until(()=>c.room.state.finished.length===1);assert.equal(c.room.status,'playing');
 const bot=r.players[1];s.hands[bot.id]=[card('bot-last','red','5')];
 r.lastBotAt=0;
 await until(()=>c.room.status==='finished');
 assert.equal(c.room.state.randomFinal,true);assert.equal(c.room.state.winner,host);
 assert.ok(c.room.state.loser);assert.equal(c.room.state.finished.length,3);
});

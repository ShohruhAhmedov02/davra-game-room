import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {uno} from '../server/games/uno.js';
import {createGameServer} from '../server/app.js';
const players=n=>Array.from({length:n},(_,i)=>({id:`p${i}`}));
const all=s=>[...s.deck,...s.discard,...Object.values(s.hands).flat()];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const emit=(s,event,data={})=>new Promise(resolve=>s.emit(event,data,resolve));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw new Error('State timeout');}

test('Every starting count from 7 to 20 deals complete hands even with 100 players',()=>{
 for(const n of [2,8,24,100])for(let startingCards=7;startingCards<=20;startingCards++){
  const s=uno.create(players(n),{startingCards});
  assert.ok(Object.values(s.hands).every(h=>h.length===startingCards));
  assert.equal(all(s).length,s.nextDeckSet*108);
  assert.equal(new Set(all(s).map(c=>c.id)).size,all(s).length);
  assert.ok(s.deck.length>0);
  assert.equal(uno.view(s,'p0').startingCards,startingCards);
  assert.equal(uno.view(s,'p0').infiniteDeck,true);
 }
 for(const startingCards of [6,21,7.5,'20',null])assert.throws(()=>uno.create(players(2),{startingCards}));
});

test('When all cards are held, repeated draws issue unique decks and preserve the top',()=>{
 const s=uno.create(players(2),{startingCards:20}),top=s.discard[0];
 s.hands.p1.push(...s.deck);s.deck=[];
 for(let i=0;i<220;i++){
  s.turn='p0';s.drawn=null;uno.act(s,'p0',{type:'draw'});
  assert.equal(s.discard[0],top);
  assert.equal(all(s).length,s.nextDeckSet*108);
  assert.equal(new Set(all(s).map(c=>c.id)).size,all(s).length);
 }
 assert.equal(s.hands.p0.length,240);
 assert.equal(s.nextDeckSet,4);
});

test('Exhausted draw pile recycles played cards before issuing another deck',()=>{
 const s=uno.create(players(2)),top=s.discard[0],recycled=s.deck.pop();
 s.hands.p1.push(...s.deck);s.deck=[];s.discard=[recycled,top];
 uno.act(s,'p0',{type:'draw'});
 assert.equal(s.hands.p0.at(-1).id,recycled.id);
 assert.deepEqual(s.discard,[top]);assert.equal(s.nextDeckSet,1);
});

test('Wild +4 and UNO penalties still deal every card when the pile is exhausted',()=>{
 const s=uno.create(players(3));
 const wild=all(s).find(c=>c.value==='+4');
 for(const h of Object.values(s.hands)){const i=h.indexOf(wild);if(i!==-1)h.splice(i,1);}
 s.deck=s.deck.filter(c=>c!==wild);
 s.hands.p0.push(...s.deck);s.deck=[];
 const sameColor=s.hands.p0.filter(c=>c.color===s.color);
 s.hands.p0=s.hands.p0.filter(c=>c.color!==s.color);s.hands.p2.push(...sameColor);
 s.hands.p0.push(wild);
  const before=s.hands.p1.length;
  uno.act(s,'p0',{type:'play',cardId:wild.id,color:'blue'});
  assert.equal(s.hands.p1.length,before);
  assert.equal(s.pendingPenalty.amount,4);
  uno.act(s,'p1',{type:'draw'});
  assert.equal(s.hands.p1.length,before+4);
 assert.equal(all(s).length,s.nextDeckSet*108);
 s.hands.p2.push(...s.deck);s.deck=[];
 s.unoPending='p1';uno.act(s,'p0',{type:'catch'});
 assert.equal(s.hands.p1.length,before+6);
 assert.equal(new Set(all(s).map(c=>c.id)).size,all(s).length);
});

test('Room host chooses starting count, partial updates preserve settings, invalid updates are atomic',async t=>{
 const server=createGameServer();await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.http.address().port}`,clients=[];
 t.after(async()=>{clients.forEach(c=>c.disconnect());await server.close();});
 for(let i=0;i<2;i++){
  const c=io(url,{transports:['websocket'],reconnection:false});clients.push(c);
  c.on('session',s=>c.identity=s);c.on('room',r=>c.room=r);await until(()=>c.identity);
 }
 const [host,guest]=clients;
 assert.equal((await emit(host,'room:create',{name:'Host',game:'uno'})).ok,true);await until(()=>host.room);
 assert.equal(host.room.startingCards,20);
 assert.equal((await emit(guest,'room:join',{name:'Guest',code:host.room.code})).ok,true);
 assert.equal((await emit(guest,'room:settings',{startingCards:7})).ok,false);
 for(const startingCards of [6,21,7.5,'20'])assert.equal((await emit(host,'room:settings',{startingCards,botThinkMs:15000})).ok,false);
 assert.equal(server.rooms.get(host.room.code).botThinkMs,3000);
 assert.equal((await emit(host,'room:settings',{startingCards:7})).ok,true);
 assert.equal((await emit(host,'room:settings',{botThinkMs:5000})).ok,true);
 await until(()=>guest.room.startingCards===7&&guest.room.botThinkMs===5000);
 assert.equal((await emit(host,'room:start')).ok,true);await until(()=>guest.room.status==='playing');
 assert.equal(guest.room.state.hand.length,7);assert.equal(guest.room.state.infiniteDeck,true);
 assert.equal((await emit(host,'room:settings',{startingCards:20})).ok,false);
});


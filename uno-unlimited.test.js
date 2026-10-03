import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {uno} from '../server/games/uno.js';
import {createGameServer} from '../server/app.js';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw new Error('State timeout'); }
const emit=(s,event,data={})=>new Promise(resolve=>s.emit(event,data,resolve));
test('UNO supports 9, 24 and 100 players with enough unique cards',()=>{
  assert.equal(uno.max, Infinity);
  for(const count of [9,24,100]){
    const s=uno.create(Array.from({length:count},(_,i)=>({id:`p${i}`})));
    const cards=[...s.deck,...s.discard,...Object.values(s.hands).flat()];
    assert.equal(cards.length,Math.ceil(count/8)*108);
    assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
    assert.ok(Object.values(s.hands).every(h=>h.length===7));
    assert.ok(s.deck.length>0);
    for(let i=0;i<200&&!s.winner;i++)uno.act(s,s.turn,uno.bot(s,s.turn,'medium'));
    assert.equal([...s.deck,...s.discard,...Object.values(s.hands).flat()].length,s.nextDeckSet*108);
  }
});
test('UNO rooms accept more than eight humans and bots; host controls thinking time',async t=>{
  const server=createGameServer();
  await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());await server.close();});
  const url=`http://127.0.0.1:${server.http.address().port}`;
  for(let i=0;i<12;i++){
    const c=io(url,{transports:['websocket'],reconnection:false});clients.push(c);
    c.on('session',s=>c.identity=s);c.on('room',r=>c.room=r);
    await until(()=>c.identity);
  }
  const host=clients[0];
  assert.equal((await emit(host,'room:create',{name:'Host',game:'uno'})).ok,true);
  await until(()=>host.room);
  for(let i=1;i<clients.length;i++)assert.equal((await emit(clients[i],'room:join',{name:`Player ${i}`,code:host.room.code})).ok,true);
  assert.equal((await emit(host,'room:bot',{level:'hard'})).ok,true);
  assert.equal((await emit(host,'room:bot',{level:'medium'})).ok,true);
  assert.equal((await emit(clients[1],'room:settings',{botThinkMs:5000})).ok,false);
  assert.equal((await emit(host,'room:settings',{botThinkMs:0})).ok,false);
  assert.equal((await emit(host,'room:settings',{botThinkMs:5000})).ok,true);
  await until(()=>host.room.botThinkMs===5000);
  assert.equal(host.room.max,null);
  assert.equal(host.room.players.length,14);
  assert.ok(host.room.players.filter(p=>p.bot).every(p=>p.name&&!p.name.includes('undefined')));
  assert.equal((await emit(host,'room:start')).ok,true);
  const r=server.rooms.get(host.room.code);
  r.lastBotAt=Date.now()-60000;
  await wait(300);
  assert.equal(r.state.turn,host.identity.id,'Human turn must not expire');
  const bot=r.players.find(p=>p.bot);
  r.state.turn=bot.id;r.lastBotAt=Date.now();
  const before=JSON.stringify(r.state);
  await wait(300);
  assert.equal(JSON.stringify(r.state),before,'Bot must wait for its thinking delay');
  r.lastBotAt=Date.now()-5100;
  await until(()=>JSON.stringify(r.state)!==before);
  assert.equal((await emit(host,'room:settings',{botThinkMs:1000})).ok,false,'Settings are locked while playing');
});

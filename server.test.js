import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { createGameServer } from "../server/app.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await wait(20);
  }
  throw new Error("Timed out waiting for state");
}
async function connect(url, token) {
  const s = io(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  s.on("session", (x) => s.identity = x);
  s.on("room", (r) => s.room = r);
  await until(() => s.connected && s.identity);
  return s;
}
const emit = (s, event, data = {}) => new Promise((resolve) => s.emit(event, data, resolve));
test('A returning player becomes host when every player had disconnected', async (t) => {
  const server = createGameServer();
  await new Promise(resolve => server.http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.http.address().port}`;
  const a = await connect(url), b = await connect(url);
  let resumed;
  t.after(async () => { a.disconnect(); b.disconnect(); resumed?.disconnect(); await server.close(); });
  await emit(a, 'room:create', {name: 'First', game: 'uno'});
  await until(() => a.room);
  await emit(b, 'room:join', {name: 'Second', code: a.room.code});
  const token = b.identity.token, id = b.identity.id;
  a.disconnect(); b.disconnect();
  await until(() => ![...server.rooms.values()][0].players.some(p => p.connected));
  resumed = await connect(url, token);
  await until(() => resumed.room);
  assert.equal(resumed.room.host, id);
  assert.equal((await emit(resumed, 'room:bot', {level:'easy'})).ok, true);
});
test("Socket.IO rooms: membership, host authorization, private state, bots, reconnection", async (t) => {
  const server = createGameServer({ botDelay: 25, disconnectGrace: 20 });
  await new Promise((r) => server.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.http.address().port}`, clients = [];
  t.after(async () => {
    clients.forEach((c) => c.disconnect());
    await server.close();
  });
  const a = await connect(url), b = await connect(url), outsider = await connect(url);
  clients.push(a, b, outsider);
  assert.equal((await emit(a, "room:create", { name: "Ali", game: "uno" })).ok, true);
  await until(() => a.room);
  assert.match(a.room.code, /^\d{6}$/);
  assert.equal((await emit(a, "room:create", { name: "Ali", game: "uno" })).ok, false);
  assert.equal((await emit(b, "room:join", { name: "Vali", code: a.room.code })).ok, true);
  await until(() => b.room?.players.length === 2);
  assert.equal((await emit(b, "room:bot", { level: "easy" })).ok, false);
  assert.equal((await emit(outsider, "game:action", { type: "draw" })).ok, false);
  assert.equal((await emit(a, "room:bot", { level: "hard" })).ok, true);
  assert.equal((await emit(a, "room:start")).ok, true);
  await until(() => b.room?.status === "playing");
  assert.equal(b.room.state.hands, void 0);
  assert.equal(b.room.state.deck, void 0);
  assert.equal(b.room.state.hand.length, 20);
  assert.notDeepEqual(a.room.state.hand, b.room.state.hand);
  assert.equal((await emit(b, "game:action", { type: "draw" })).ok, false);
  assert.equal((await emit(outsider, "room:join", { name: "Other", code: a.room.code })).ok, false);
  const id = b.identity.id, token = b.identity.token, hand = b.room.state.hand.map((c) => c.id);
  b.disconnect();
  const again = await connect(url, token);
  clients.push(again);
  await until(() => again.room?.status === "playing");
  assert.equal(again.identity.id, id);
  assert.deepEqual(again.room.state.hand.map((c) => c.id), hand);
  assert.equal((await emit(a, "room:leave")).ok, true);
  await until(() => again.room.host === id);
  assert.ok(again.room.players.some((p) => p.bot && p.name === "Ali · AI"));
});
test("Room validation and limits reject malformed requests without stopping server", async (t) => {
  const server = createGameServer();
  await new Promise((r) => server.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.http.address().port}`, a = await connect(url);
  t.after(async () => {
    a.disconnect();
    await server.close();
  });
  for (const data of [{ name: "A", game: "uno" }, { name: "Ali", game: "__proto__" }, { name: 123, game: "uno" }, null]) assert.equal((await emit(a, "room:create", data)).ok, false);
  assert.equal((await emit(a, "room:join", { name: "Ali", code: "abc" })).ok, false);
  assert.equal((await emit(a, "room:create", { name: "Ali", game: "durak" })).ok, true);
  assert.equal((await emit(a, "room:start")).ok, false);
  for (let i = 0; i < 5; i++) assert.equal((await emit(a, "room:bot", { level: "easy" })).ok, true);
  assert.equal((await emit(a, "room:bot", { level: "hard" })).ok, false);
  assert.equal((await emit(a, "room:start")).ok, true);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});

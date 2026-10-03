import test from "node:test";
import assert from "node:assert/strict";
import { mafia } from "../server/games/mafia.js";
import { durak } from "../server/games/durak.js";
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
test("Mafia abstentions can prevent a lone vote from eliminating a player", () => {
  const s = mafia.create(players(5));
  s.phase = "vote";
  s.votes = {};
  for (const id of s.order) mafia.act(s, id, { type: "vote", target: id === "p0" ? "p1" : "skip" });
  assert.ok(Object.values(s.alive).every(Boolean));
  assert.equal(s.day, 2);
});
test("Durak last player with cards is the loser after deck exhaustion", () => {
  const s = durak.create(players(2));
  Object.assign(s, { deck: [], attacker: "p0", defender: "p1", turn: "p0", attackTurn: "p0", limit: 1, hands: { p0: [{ id: "a", suit: "♥", rank: 6 }], p1: [{ id: "b", suit: "♣", rank: 7 }] } });
  durak.act(s, "p0", { type: "play", cardId: "a" });
  durak.act(s, "p1", { type: "take" });
  assert.equal(s.over, true);
  assert.equal(s.loser, "p1");
  assert.deepEqual(s.finished, ["p0"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { uno, colors } from "../server/games/uno.js";
import { durak, beats } from "../server/games/durak.js";
import { mafia } from "../server/games/mafia.js";
import { roundWinners } from "../server/games/common.js";
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
const card = (id, color, value) => ({ id, color, value });
test("overall wins follow each game's round result", () => {
  assert.deepEqual(roundWinners("uno", { winner: "p1" }), ["p1"]);
  assert.deepEqual(roundWinners("durak", { order: ["p1", "p2", "p3"], loser: "p2" }), ["p1", "p3"]);
  assert.deepEqual(roundWinners("durak", { order: ["p1", "p2"], loser: null }), []);
  assert.deepEqual(roundWinners("mafia", { winner: "mafia", order: ["p1", "p2", "p3"], alive: { p1: true, p2: false, p3: true }, roles: { p1: "mafia", p2: "mafia", p3: "civilian" } }), ["p1"]);
  assert.deepEqual(roundWinners("mafia", { winner: "civilian", order: ["p1", "p2"], alive: { p1: true, p2: false }, roles: { p1: "civilian", p2: "mafia" } }), ["p1"]);
});
function unoState() {
  const s = uno.create(players(3));
  s.turn = "p0";
  s.color = "red";
  s.discard = [card("top", "red", "5")];
  s.hands.p0 = [card("r", "red", "9"), card("w", "wild", "+4"), card("b", "blue", "2")];
  return s;
}
test("UNO deck has 108 unique cards and private hand views", () => {
  const s = uno.create(players(8));
  const all = [...s.deck, ...s.discard, ...Object.values(s.hands).flat()];
  assert.equal(all.length, 108);
  assert.equal(new Set(all.map((c) => c.id)).size, 108);
  assert.equal(s.hands.p0.length, 7);
  const view = uno.view(s, "p0");
  assert.equal(view.hands, void 0);
  assert.equal(view.deck, void 0);
  assert.equal(view.hand, s.hands.p0);
});
test("UNO validates turn, ownership, color and +4 restrictions", () => {
  const s = unoState();
  assert.throws(() => uno.act(s, "p1", { type: "play", cardId: "r" }));
  assert.throws(() => uno.act(s, "p0", { type: "play", cardId: "b" }));
  assert.throws(() => uno.act(s, "p0", { type: "play", cardId: "w", color: "blue" }));
  assert.equal(s.hands.p0.length, 3);
  s.hands.p0 = s.hands.p0.filter((c) => c.id !== "r");
  assert.throws(() => uno.act(s, "p0", { type: "play", cardId: "w", color: "invalid" }));
  const count = s.hands.p1.length;
  uno.act(s, "p0", { type: "play", cardId: "w", color: "blue", uno: true });
  assert.equal(s.color, "blue");
  assert.equal(s.hands.p1.length, count);
  assert.equal(s.pendingPenalty.amount, 4);
  assert.equal(s.turn, "p1");
  uno.act(s, "p1", { type: "draw" });
  assert.equal(s.hands.p1.length, count + 4);
  assert.equal(s.turn, "p2");
});
test("UNO skip, reverse and draw-two skip the correct player", () => {
  for (const value of ["skip", "reverse", "+2"]) {
    const s = unoState();
    s.hands.p0[0].value = value;
    const before = s.hands.p1.length;
    uno.act(s, "p0", { type: "play", cardId: "r" });
    assert.equal(s.turn, value === "+2" ? "p1" : "p2");
    if (value === "reverse") assert.equal(s.direction, -1);
    if (value === "+2") {
      assert.equal(s.pendingPenalty.amount, 2);
      uno.act(s, "p1", { type: "draw" });
      assert.equal(s.hands.p1.length, before + 2);
      assert.equal(s.turn, "p2");
    }
  }
});
test("UNO two-player reverse returns the turn", () => {
  const s = uno.create(players(2));
  s.color = "red";
  s.hands.p0 = [card("r", "red", "reverse"), card("x", "blue", "3")];
  uno.act(s, "p0", { type: "play", cardId: "r", uno: true });
  assert.equal(s.turn, "p0");
});
test("UNO drawn card can be played or passed, not replaced by another card", () => {
  const s = unoState();
  s.deck.push(card("new", "red", "2"));
  uno.act(s, "p0", { type: "draw" });
  assert.equal(s.drawn, "new");
  assert.throws(() => uno.act(s, "p0", { type: "draw" }));
  assert.throws(() => uno.act(s, "p0", { type: "play", cardId: "r" }));
  uno.act(s, "p0", { type: "pass" });
  assert.equal(s.turn, "p1");
});
test("UNO missed call gives two-card penalty only until next move", () => {
  const s = unoState();
  s.hands.p0 = s.hands.p0.slice(0, 2);
  uno.act(s, "p0", { type: "play", cardId: "r" });
  assert.equal(s.unoPending, "p0");
  uno.act(s, "p1", { type: "catch" });
  assert.equal(s.hands.p0.length, 3);
  assert.equal(s.unoPending, null);
  assert.throws(() => uno.act(s, "p1", { type: "catch" }));
});
test("UNO explicit call and last-card winner", () => {
  const s = unoState();
  s.hands.p0 = [card("r", "red", "9"), card("r2", "red", "3")];
  uno.act(s, "p0", { type: "play", cardId: "r" });
  uno.act(s, "p0", { type: "uno" });
  assert.equal(s.unoPending, null);
  s.turn = "p0";
  uno.act(s, "p0", { type: "play", cardId: "r2" });
  assert.equal(s.winner, null);
  assert.deepEqual(s.finished, ["p0"]);
});
test("UNO reshuffles discard without duplicating top card", () => {
  const s = unoState();
  s.deck = [];
  s.discard.unshift(card("old", "blue", "3"));
  uno.act(s, "p0", { type: "draw" });
  assert.equal(s.discard.length, 1);
  assert.equal(s.discard[0].id, "top");
  assert.ok(s.hands.p0.some((c) => c.id === "old"));
});
test("Durak deck, trump, six-card deal and private views", () => {
  const s = durak.create(players(6));
  const all = [...s.deck, ...Object.values(s.hands).flat()];
  assert.equal(all.length, 36);
  assert.equal(new Set(all.map((c) => c.id)).size, 36);
  assert.ok(Object.values(s.hands).every((h) => h.length === 6));
  assert.equal(s.limit, 6);
  assert.equal(durak.view(s, "p0").hands, void 0);
});
test("Durak higher suit or trump can defend", () => {
  assert.ok(beats({ suit: "♥", rank: 8 }, { suit: "♥", rank: 6 }, "♠"));
  assert.ok(beats({ suit: "♠", rank: 6 }, { suit: "♥", rank: 14 }, "♠"));
  assert.ok(!beats({ suit: "♥", rank: 14 }, { suit: "♠", rank: 6 }, "♠"));
  assert.ok(!beats({ suit: "♥", rank: 6 }, { suit: "♥", rank: 6 }, "♠"));
});
function durakState() {
  const s = durak.create(players(3));
  s.attacker = "p0";
  s.defender = "p1";
  s.turn = "p0";
  s.attackTurn = "p0";
  s.trump = "♠";
  s.hands.p0 = [{ id: "a", suit: "♥", rank: 6 }, { id: "x", suit: "♣", rank: 9 }];
  s.hands.p1 = [{ id: "b", suit: "♥", rank: 7 }, { id: "z", suit: "♣", rank: 8 }];
  s.hands.p2 = [{ id: "c", suit: "♦", rank: 6 }];
  s.limit = 2;
  return s;
}
test("Durak defense, podkidka, take and round refill order", () => {
  const s = durakState();
  durak.act(s, "p0", { type: "play", cardId: "a" });
  assert.equal(s.turn, "p1");
  assert.throws(() => durak.act(s, "p1", { type: "play", cardId: "z" }));
  durak.act(s, "p1", { type: "play", cardId: "b" });
  assert.equal(s.turn, "p0");
  assert.throws(() => durak.act(s, "p0", { type: "play", cardId: "x" }));
  durak.act(s, "p0", { type: "pass" });
  assert.equal(s.turn, "p2");
  durak.act(s, "p2", { type: "play", cardId: "c" });
  durak.act(s, "p1", { type: "take" });
  assert.equal(s.attacker, "p2");
  assert.ok(Object.values(s.hands).every((h) => h.length >= 6));
  assert.equal(s.table.length, 0);
});
test("Durak can add cards after defender announces take", () => {
  const s = durakState();
  s.hands.p0.push({ id: "extra", suit: "♣", rank: 6 });
  durak.act(s, "p0", { type: "play", cardId: "a" });
  durak.act(s, "p1", { type: "take" });
  assert.equal(s.turn, "p0");
  assert.equal(s.taking, true);
  durak.act(s, "p0", { type: "play", cardId: "extra" });
  assert.equal(s.attacker, "p2");
  assert.ok(s.hands.p1.some((c) => c.id === "extra"));
});
test("Durak final successful defense can result in a draw", () => {
  const s = durak.create(players(2));
  s.deck = [];
  s.attacker = "p0";
  s.defender = "p1";
  s.turn = "p0";
  s.attackTurn = "p0";
  s.limit = 1;
  s.hands = { p0: [{ id: "a", suit: "♥", rank: 6 }], p1: [{ id: "b", suit: "♥", rank: 7 }] };
  durak.act(s, "p0", { type: "play", cardId: "a" });
  durak.act(s, "p1", { type: "play", cardId: "b" });
  assert.equal(s.over, true);
  assert.equal(s.loser, null);
});
test("Mafia roles and knowledge are private", () => {
  const s = mafia.create(players(8));
  assert.equal(Object.values(s.roles).filter((r) => r === "mafia").length, 2);
  for (const id of s.order) {
    const v = mafia.view(s, id);
    assert.equal(v.roles, void 0);
    assert.equal(v.actions, void 0);
    assert.equal(v.role, s.roles[id]);
    if (v.role !== "mafia") assert.deepEqual(v.allies, []);
  }
});
test("Mafia doctor saves target and commissioner gets private intel", () => {
  const s = mafia.create(players(5));
  s.roles = { p0: "mafia", p1: "doctor", p2: "commissioner", p3: "civilian", p4: "civilian" };
  assert.throws(() => mafia.act(s, "p3", { type: "target", target: "p0" }));
  mafia.act(s, "p0", { type: "target", target: "p3" });
  mafia.act(s, "p1", { type: "target", target: "p3" });
  mafia.act(s, "p2", { type: "target", target: "p0" });
  assert.equal(s.phase, "discussion");
  assert.equal(s.alive.p3, true);
  assert.equal(mafia.view(s, "p2").intel.p0, "mafia");
  assert.deepEqual(mafia.view(s, "p1").intel, {});
});
test("Mafia daytime chat accepts stickers and compressed images but validates their payload", () => {
  const s = mafia.create(players(5));
  s.phase = "discussion";
  mafia.act(s, "p0", { type: "chat", sticker: "❤️" });
  mafia.act(s, "p1", { type: "chat", image: "data:image/jpeg;base64,QUJD", text: "Salom" });
  assert.equal(s.chat[0].sticker, "❤️");
  assert.equal(s.chat[1].image, "data:image/jpeg;base64,QUJD");
  assert.equal(s.chat[1].text, "Salom");
  assert.throws(() => mafia.act(s, "p2", { type: "chat", image: "https://example.com/a.jpg" }));
  assert.throws(() => mafia.act(s, "p3", { type: "chat", sticker: "<script>" }));
});
test("Mafia voting eliminates mafia and ends game", () => {
  const s = mafia.create(players(5));
  s.roles = { p0: "mafia", p1: "doctor", p2: "commissioner", p3: "civilian", p4: "civilian" };
  s.phase = "discussion";
  for (const p of s.order) mafia.act(s, p, { type: "ready" });
  assert.equal(s.phase, "vote");
  for (const p of s.order) mafia.act(s, p, { type: "vote", target: p === "p0" ? "p1" : "p0" });
  assert.equal(s.winner, "civilian");
  assert.equal(s.alive.p0, false);
});
test("Mafia timeout advances phases, dead players cannot act", () => {
  const s = mafia.create(players(5));
  s.roles = {p0:'civilian',p1:'mafia',p2:'doctor',p3:'commissioner',p4:'civilian'};
  s.alive.p0 = false;
  assert.throws(() => mafia.act(s, "p0", { type: "ready" }));
  s.deadline = 0;
  assert.equal(mafia.tick(s), true);
  assert.equal(s.phase, "discussion");
  s.deadline = 0;
  mafia.tick(s);
  assert.equal(s.phase, "vote");
});
for (const [name, game, n] of [["UNO", uno, 8], ["Durak", durak, 6], ["Mafia", mafia, 12]]) test(`${name}: complete AI matches conserve cards and terminate`, () => {
  for (let match = 0; match < 12; match++) {
    const ps = players(n), s = game.create(ps);
    let moves = 0;
    while (!s.winner && !s.over && moves < 15e3) {
      let acted = false;
      for (const p of ps) {
        const a = game.bot(s, p.id, ["easy", "medium", "hard"][moves % 3]);
        if (a) {
          game.act(s, p.id, a);
          acted = true;
          moves++;
          break;
        }
      }
      assert.ok(acted, `${name} stalled after ${moves}`);
      if (name !== "Mafia") {
        const table = name === "Durak" ? s.table.flatMap((p) => [p.attack, ...p.defense ? [p.defense] : []]) : [];
        const all = [...s.deck, ...s.discard, ...Object.values(s.hands).flat(), ...table];
        assert.equal(new Set(all.map((c) => c.id)).size, name === "UNO" ? s.nextDeckSet * 108 : 36);
        assert.equal(all.length, name === "UNO" ? s.nextDeckSet * 108 : 36);
      }
    }
    assert.ok(s.winner || s.over, `${name} exceeded move limit`);
  }
});


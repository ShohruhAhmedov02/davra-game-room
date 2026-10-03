import { assert, shuffle, next, pick } from "./common.js";
const suits = ["♠", "♥", "♦", "♣"];
const strength = (c, trump) => c.rank + (c.suit === trump ? 20 : 0);
export const beats = (c, a, trump) => c.suit === a.suit && c.rank > a.rank || c.suit === trump && a.suit !== trump;
function attacks(s, id) {
  return s.hands[id].filter((c) => !s.table.length || s.table.some((p) => p.attack.rank === c.rank || p.defense?.rank === c.rank));
}
function round(s, attacker) {
  s.attacker = attacker;
  s.defender = next(s, attacker);
  s.turn = attacker;
  s.table = [];
  s.passed = [];
  s.taking = false;
  s.limit = Math.min(6, s.hands[s.defender].length);
  s.attackTurn = attacker;
}
function endRound(s) {
  const oldAttacker = s.attacker, oldDefender = s.defender, taking = s.taking;
  if (taking) s.hands[oldDefender].push(...s.table.flatMap((p2) => [p2.attack, ...p2.defense ? [p2.defense] : []]));
  else s.discard.push(...s.table.flatMap((p2) => [p2.attack, p2.defense]));
  const refill = [];
  for (let i = 0; i < s.order.length; i++) {
    const p2 = next(s, oldAttacker, i);
    if (p2 !== oldDefender) refill.push(p2);
  }
  refill.push(oldDefender);
  for (const p2 of refill) while (s.hands[p2].length < 6 && s.deck.length) s.hands[p2].push(s.deck.pop());
  const previous = [...s.order];
  if (!s.deck.length) {
    const out = s.order.filter((p2) => !s.hands[p2].length);
    s.finished.push(...out);
    s.order = s.order.filter((p2) => s.hands[p2].length);
  }
  if (s.order.length <= 1) {
    s.over = true;
    s.loser = s.order[0] || null;
    s.table = [];
    s.message = s.loser ? "Oxirgi karta egasi — Durak." : "Durang!";
    return;
  }
  let start = previous.indexOf(oldDefender) + (taking ? 1 : 0);
  let p = previous[start % previous.length];
  while (!s.order.includes(p)) {
    start++;
    p = previous[start % previous.length];
  }
  round(s, p);
  s.message = taking ? "Kartalar olindi. Keyingi hujum." : "Bito! Yangi hujum.";
}
function attackNext(s, id) {
  if (s.table.length >= s.limit) {
    endRound(s);
    return;
  }
  for (let i = 1; i <= s.order.length; i++) {
    const p = next(s, id, i);
    if (p !== s.defender && !s.passed.includes(p)) {
      s.turn = p;
      s.attackTurn = p;
      return;
    }
  }
  endRound(s);
}
export const durak = {
  min: 2,
  max: 6,
  create(players) {
    const d = shuffle(suits.flatMap((suit) => Array.from({ length: 9 }, (_, i) => ({ id: `${suit}${i + 6}`, suit, rank: i + 6 }))));
    const trumpCard = d[0], order = players.map((p) => p.id), hands = Object.fromEntries(order.map((id) => [id, d.splice(-6)]));
    let lowest = null;
    for (const id of order) for (const c of hands[id]) if (c.suit === trumpCard.suit && (!lowest || c.rank < lowest.rank)) lowest = { id, rank: c.rank };
    const s = { order, hands, deck: d, trump: trumpCard.suit, trumpCard, discard: [], finished: [], over: false, loser: null, message: "Eng kichik kozir egasi hujum qiladi." };
    round(s, lowest?.id || order[0]);
    return s;
  },
  act(s, id, a) {
    assert(!s.over && s.turn === id, "Hozir sizning navbatingiz emas.");
    const defense = id === s.defender && !s.taking;
    if (a.type === "take") {
      assert(defense && s.table.some((p) => !p.defense));
      s.taking = true;
      s.message = "Himoyachi oladi. Yana mos karta tashlash mumkin.";
      s.turn = s.attackTurn;
      if (s.table.length >= s.limit) endRound(s);
      return;
    }
    if (a.type === "pass") {
      assert(!defense && s.table.length > 0, "Avval hujum kartasini tashlang.");
      s.passed.push(id);
      attackNext(s, id);
      return;
    }
    assert(a.type === "play");
    const index = s.hands[id].findIndex((c2) => c2.id === a.cardId), c = s.hands[id][index];
    assert(index >= 0);
    if (defense) {
      const pair = s.table.find((p) => !p.defense);
      assert(pair && beats(c, pair.attack, s.trump), "Bu karta hujumni yopa olmaydi.");
      pair.defense = c;
      s.hands[id].splice(index, 1);
      s.turn = s.attackTurn;
      if (s.table.length >= s.limit) endRound(s);
    } else {
      assert(s.table.length < s.limit && attacks(s, id).some((x) => x.id === c.id), "Stoldagi raqamga mos karta kerak.");
      s.hands[id].splice(index, 1);
      s.table.push({ attack: c, defense: null });
      s.attackTurn = id;
      s.passed = [];
      s.turn = s.taking ? id : s.defender;
      if (s.taking && s.table.length >= s.limit) endRound(s);
    }
  },
  view(s, id) {
    const defending = s.turn === id && id === s.defender && !s.taking;
    const pair = s.table.find((p) => !p.defense);
    const legalCards = s.over || s.turn !== id ? [] : defending ? s.hands[id].filter((c) => pair && beats(c, pair.attack, s.trump)) : attacks(s, id);
    return { hand: s.hands[id], table: s.table, trump: s.trump, trumpCard: s.trumpCard, deckCount: s.deck.length, turn: s.turn, attacker: s.attacker, defender: s.defender, taking: s.taking, limit: s.limit, counts: Object.fromEntries(Object.entries(s.hands).map(([p, h]) => [p, h.length])), finished: s.finished, over: s.over, loser: s.loser, message: s.message, legalCards: legalCards.map((c) => c.id) };
  },
  bot(s, id, level = "medium") {
    if (s.over || s.turn !== id) return null;
    const defending = id === s.defender && !s.taking, pair = s.table.find((p) => !p.defense);
    let cards = defending ? s.hands[id].filter((c) => beats(c, pair.attack, s.trump)) : attacks(s, id);
    if (!cards.length) return { type: defending ? "take" : "pass" };
    cards.sort((a, b) => strength(a, s.trump) - strength(b, s.trump));
    if (level === "hard" && defending && s.deck.length > 6 && cards[0].suit === s.trump && cards[0].rank >= 12 && pair.attack.suit !== s.trump && s.table.length < 2) return { type: "take" };
    return { type: "play", cardId: (level === "easy" ? pick(cards) : cards[0]).id };
  }
};

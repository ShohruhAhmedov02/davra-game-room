import { assert, shuffle, pick } from "./common.js";
export const colors = ["red", "yellow", "green", "blue"];
function deck(set = 0) {
  let n = 0;
  const cards = [];
  for (const color of colors) {
    cards.push({ id: `u${set}-${n++}`, color, value: "0" });
    for (const value of [...Array.from({ length: 9 }, (_, i) => String(i + 1)), "skip", "reverse", "+2"]) for (let k = 0; k < 2; k++) cards.push({ id: `u${set}-${n++}`, color, value });
  }
  for (const value of ["wild", "+4"]) for (let k = 0; k < 4; k++) cards.push({ id: `u${set}-${n++}`, color: "wild", value });
  return shuffle(cards);
}
function draw(s, id, count = 1) {
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length > 1) {
      const top = s.discard.pop();
      s.deck = shuffle(s.discard);
      s.discard = [top];
    }
    // If every existing card is held, issue a new uniquely identified set.
    // Reuse the discard pile first so the draw pile never blocks a turn.
    if (!s.deck.length) s.deck = deck(s.nextDeckSet++);
    s.hands[id].push(s.deck.pop());
  }
}
export function legal(s, id, card) {
  if (!card) return false;
  if (card.value === "+4") return !s.hands[id].some((c) => c.color === s.color);
  return card.color === "wild" || card.color === s.color || card.value === s.discard.at(-1).value;
}
function nextActive(s, id, steps = 1) {
  let index = s.order.indexOf(id);
  for (let step = 0; step < steps; step++) {
    do { index = (index + s.direction + s.order.length) % s.order.length; }
    while (s.finished.includes(s.order[index]));
  }
  return s.order[index];
}
function settle(s) {
  if (s.over) return false;
  const active = s.order.filter(id => !s.finished.includes(id));
  if (active.length === 2 && active.every(id => s.bots[id])) {
    s.loser = pick(active);
    s.finished.push(active.find(id => id !== s.loser));
    s.randomFinal = true;
    s.message = 'Oxirida 2 ta AI qoldi: yutqazgan tasodifiy tanlandi.';
  } else if (active.length === 1) {
    s.loser = active[0];
    s.message = 'Oxirgi kartali o‘yinchi yutqazdi. Davra yakunlandi.';
  } else return false;
  s.winner = s.finished[0];
  s.over = true;
  s.turn = null;
  s.drawn = null;
  s.unoPending = null;
  return true;
}
function move(s, steps = 1) {
  s.turn = nextActive(s, s.turn, steps);
  s.drawn = null;
}
export const uno = {
  min: 2,
  max: Infinity,
  create(players, {startingCards = 7} = {}) {
    assert(Number.isInteger(startingCards) && startingCards >= 7 && startingCards <= 20, 'Boshlang‘ich kartalar soni 7–20 oralig‘ida bo‘lsin.');
    // One complete deck per eight players keeps all card frequencies intact.
    // Every copy gets a unique ID so duplicated card faces remain distinct.
    const sets = Math.max(Math.ceil(players.length / 8), Math.ceil((players.length * startingCards + 1) / 108));
    const d = shuffle(Array.from({length: sets}, (_, i) => deck(i)).flat());
    let i = d.findIndex((c) => /^\d$/.test(c.value));
    const first = d.splice(i, 1)[0];
    const order = players.map((p) => p.id), hands = Object.fromEntries(order.map((id) => [id, d.splice(0, startingCards)]));
    const s = { order, hands, deck: d, discard: [first], startingCards, nextDeckSet: sets, bots: Object.fromEntries(players.map(p => [p.id, !!p.bot])), finished: [], over: false, loser: null, randomFinal: false, color: first.color, turn: order[0], direction: 1, drawn: null, unoPending: null, winner: null, message: "O‘yin boshlandi. Rang yoki raqamni moslang." };
    settle(s);
    return s;
  },
  syncPlayers(s, players) {
    s.bots = Object.fromEntries(players.map(p => [p.id, !!p.bot]));
    return settle(s);
  },
  act(s, id, a) {
    assert(!s.winner);
    assert(s.order.includes(id) && !s.finished.includes(id), 'Siz kartalaringizni tugatdingiz. Endi o‘yinni kuzating.');
    if (a.type === "uno") {
      assert(s.unoPending === id, "UNO faqat bitta kartangiz qolganda aytiladi.");
      s.unoPending = null;
      s.message = "UNO!";
      return;
    }
    if (a.type === "catch") {
      assert(s.unoPending && s.unoPending !== id, "UNO jazosi mavjud emas.");
      draw(s, s.unoPending, 2);
      s.unoPending = null;
      s.message = "UNO aytilmadi: 2 ta jarima karta.";
      return;
    }
    assert(s.turn === id, "Hozir sizning navbatingiz emas.");
    if (a.type === "draw") {
      assert(!s.drawn, "Allaqachon karta oldingiz.");
      s.unoPending = null;
      const before = s.hands[id].length;
      draw(s, id);
      const c2 = s.hands[id].at(-1);
      if (s.hands[id].length > before && legal(s, id, c2)) {
        s.drawn = c2.id;
        s.message = "Olingan kartani tashlang yoki navbatni o‘tkazing.";
      } else move(s);
      return;
    }
    if (a.type === "pass") {
      assert(s.drawn);
      s.unoPending = null;
      move(s);
      return;
    }
    assert(a.type === "play");
    const hand = s.hands[id];
    const ids = a.cardIds === undefined ? [a.cardId] : a.cardIds;
    assert(Array.isArray(ids) && ids.length > 0 && ids.length <= hand.length, 'Kamida bitta karta tanlang.');
    assert(ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length, 'Bitta kartani ikki marta tashlab bo‘lmaydi.');
    const chosen = ids.map(cardId => hand.find(card => card.id === cardId));
    assert(chosen.every(Boolean), 'Tanlangan karta sizning qo‘lingizda yo‘q.');
    assert(legal(s, id, chosen[0]), 'Birinchi karta stol rangiga yoki raqamiga mos bo‘lishi kerak.');
    assert(chosen.length === 1 || /^\d$/.test(chosen[0].value) && chosen.every(card => card.value === chosen[0].value), 'Birga tashlanadigan kartalar bir xil raqamda bo‘lsin.');
    const c = chosen.at(-1);
    assert(!s.drawn || s.drawn === chosen[0].id, "Avval hozir olgan kartani tanlang; unga shu raqamli kartalarni qo‘shish mumkin.");
    assert(c.color !== "wild" || colors.includes(a.color), "Yangi rangni tanlang.");
    s.unoPending = null;
    for(let i = hand.length - 1; i >= 0; i--) if(ids.includes(hand[i].id)) hand.splice(i, 1);
    s.discard.push(...chosen);
    s.color = c.color === "wild" ? a.color : c.color;
    let steps = 1;
    if (c.value === "reverse") {
      s.direction *= -1;
      if (s.order.length - s.finished.length === 2) steps = 2;
    }
    if (c.value === "skip") steps = 2;
    if (c.value === "+2" || c.value === "+4") {
      draw(s, nextActive(s, id), c.value === "+2" ? 2 : 4);
      steps = 2;
    }
    s.message = chosen.length > 1 ? `${chosen.length} ta ${c.value} birga tashlandi.` : "Karta tashlandi.";
    if (hand.length === 1 && !a.uno) s.unoPending = id;
    if (hand.length === 0) {
      s.finished.push(id);
      s.message = `${s.finished.length}-o‘rin aniqlandi. Qolganlar davom etadi.`;
      if (settle(s)) return;
    }
    move(s, steps);
  },
  view(s, id) {
    return { hand: s.hands[id], top: s.discard.at(-1), color: s.color, turn: s.turn, direction: s.direction, drawn: s.turn === id ? s.drawn : null, deckCount: s.deck.length, infiniteDeck: true, startingCards: s.startingCards, counts: Object.fromEntries(s.order.map((p) => [p, s.hands[p].length])), finished: s.finished, loser: s.loser, randomFinal: s.randomFinal, unoPending: s.unoPending, winner: s.winner, message: s.message, legalCards: s.turn === id ? s.hands[id].filter((c) => legal(s, id, c) && (!s.drawn || s.drawn === c.id)).map((c) => c.id) : [] };
  },
  bot(s, id, level = "medium") {
    if (s.over || s.turn !== id || s.finished.includes(id)) return null;
    const h = s.hands[id];
    let cards = h.filter((c2) => legal(s, id, c2) && (!s.drawn || s.drawn === c2.id));
    if (!cards.length) return { type: s.drawn ? "pass" : "draw" };
    if (level !== "easy") {
      const count = (color2) => h.filter((c2) => c2.color === color2).length;
      const threat = s.hands[nextActive(s, id)].length <= 2;
      cards.sort((a, b) => {
        const score = (c2) => count(c2.color) * 2 + (c2.color === "wild" ? -5 : 0) + (threat && ["+2", "+4", "skip", "reverse"].includes(c2.value) ? 20 : 0) + (level === "hard" && !/^\d$/.test(c2.value) ? 3 : 0);
        return score(b) - score(a);
      });
    }
    const c = level === "easy" ? pick(cards) : cards[0];
    if (/^\d$/.test(c.value)) {
      const matching = h.filter(card => card.value === c.value && card.id !== c.id);
      if (matching.length) return {type:'play',cardIds:[c.id,...matching.map(card=>card.id)],uno:true};
    }
    const color = level === "easy" ? pick(colors) : [...colors].sort((a, b) => h.filter((c2) => c2.color === b).length - h.filter((c2) => c2.color === a).length)[0];
    return { type: "play", cardId: c.id, color, uno: true };
  }
};


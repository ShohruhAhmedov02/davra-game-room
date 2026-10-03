import { assert, shuffle, majority, pick } from "./common.js";
const alive = (s) => s.order.filter((id) => s.alive[id]);
function check(s) {
  const m = alive(s).filter((id) => s.roles[id] === "mafia").length, c = alive(s).length - m;
  if (m === 0) s.winner = "civilian";
  else if (m >= c) s.winner = "mafia";
  return !!s.winner;
}
function night(s) {
  s.phase = "night";
  s.actions = {};
  s.votes = {};
  s.ready = [];
  s.deadline = Date.now() + 6e4;
  s.message = `${s.day}-tun. Shahar uyquda.`;
}
function resolveNight(s) {
  const mafia2 = alive(s).filter((id) => s.roles[id] === "mafia");
  const victim = majority(mafia2.map((id) => s.actions[id]).filter(Boolean));
  const doctor = alive(s).find((id) => s.roles[id] === "doctor");
  const saved = doctor ? s.actions[doctor] : null;
  if (victim && victim !== saved) {
    s.alive[victim] = false;
    s.lastEliminated = victim;
    s.message = "Tong otdi. Tunda bir o‘yinchi chiqarildi.";
  } else {
    s.lastEliminated = null;
    s.message = "Tong otdi. Hamma omon qoldi.";
  }
  check(s);
  s.phase = "discussion";
  s.ready = [];
  s.deadline = Date.now() + 6e4;
  s.chat.push({ id: `system-${s.day}`, name: "Boshlovchi", text: s.message, system: true });
}
function vote(s) {
  s.phase = "vote";
  s.votes = {};
  s.deadline = Date.now() + 45e3;
  s.message = "Shubhali o‘yinchini tanlab ovoz bering.";
}
function resolveVote(s) {
  const target = majority(Object.values(s.votes));
  if (target && target !== "skip") {
    s.alive[target] = false;
    s.lastEliminated = target;
    s.message = "Ovoz berish yakunlandi: bir o‘yinchi chiqarildi.";
  } else {
    s.lastEliminated = null;
    s.message = "Ovozlar teng yoki yetarli emas. Hech kim chiqarilmadi.";
  }
  s.chat.push({ id: `vote-${s.day}`, name: "Boshlovchi", text: s.message, system: true });
  if (!check(s)) {
    s.day++;
    night(s);
  }
}
export const mafia = {
  min: 4,
  max: 20,
  create(players) {
    const order = players.map((p) => p.id);
    const n = players.length >= 17 ? 5 : players.length >= 13 ? 4 : players.length >= 9 ? 3 : players.length >= 7 ? 2 : 1;
    const deck = shuffle([...Array(n).fill("mafia"), "doctor", "commissioner", ...Array(order.length - n - 2).fill("civilian")]);
    const s = { order, roles: Object.fromEntries(order.map((id, i) => [id, deck[i]])), alive: Object.fromEntries(order.map((id) => [id, true])), intel: {}, day: 1, winner: null, chat: [], lastEliminated: null };
    night(s);
    return s;
  },
  act(s, id, a) {
    assert(!s.winner && s.alive[id], "Siz bu bosqichda qatnasha olmaysiz.");
    if (a.type === "chat") {
      assert(s.phase === "discussion", "Suhbat faqat kunduz ochiq.");
      assert(typeof a.text === "string" && a.text.trim().length > 0 && a.text.length <= 280);
      s.chat.push({ id: `${Date.now()}-${id}-${s.chat.length}`, playerId: id, text: a.text.trim() });
      s.chat = s.chat.slice(-60);
      return;
    }
    if (s.phase === "night") {
      assert(a.type === "target" && s.roles[id] !== "civilian" && !s.actions[id]);
      assert(typeof a.target === "string" && s.order.includes(a.target) && s.alive[a.target]);
      assert(s.roles[id] !== "mafia" || s.roles[a.target] !== "mafia", "Mafia sherigini tanlay olmaydi.");
      assert(s.roles[id] !== "commissioner" || id !== a.target);
      s.actions[id] = a.target;
      if (s.roles[id] === "commissioner") {
        s.intel[id] ||= {};
        s.intel[id][a.target] = s.roles[a.target] === "mafia" ? "mafia" : "innocent";
      }
      if (alive(s).filter((p) => s.roles[p] !== "civilian").every((p) => s.actions[p])) resolveNight(s);
      return;
    }
    if (s.phase === "discussion") {
      assert(a.type === "ready" && !s.ready.includes(id));
      s.ready.push(id);
      if (alive(s).every((p) => s.ready.includes(p))) vote(s);
      return;
    }
    assert(s.phase === "vote" && a.type === "vote" && !s.votes[id]);
    assert(a.target === "skip" || typeof a.target === "string" && s.order.includes(a.target) && s.alive[a.target] && a.target !== id);
    s.votes[id] = a.target;
    if (alive(s).every((p) => s.votes[p])) resolveVote(s);
  },
  tick(s) {
    if (s.winner || Date.now() < s.deadline) return false;
    if (s.phase === "night") resolveNight(s);
    else if (s.phase === "discussion") vote(s);
    else resolveVote(s);
    return true;
  },
  view(s, id) {
    return { role: s.roles[id], allies: s.roles[id] === "mafia" ? s.order.filter((p) => s.roles[p] === "mafia") : [], intel: s.intel[id] || {}, alive: s.alive, phase: s.phase, day: s.day, deadline: s.deadline, winner: s.winner, roles: s.winner ? s.roles : void 0, message: s.message, lastEliminated: s.lastEliminated, chat: s.chat, acted: s.phase === "night" ? !!s.actions[id] : s.phase === "vote" ? !!s.votes[id] : s.ready.includes(id), votes: s.phase === "vote" ? Object.keys(s.votes) : [] };
  },
  bot(s, id) {
    if (!s.alive[id] || s.winner) return null;
    const role = s.roles[id], others = alive(s).filter((p) => p !== id);
    if (s.phase === "night") {
      if (role === "civilian" || s.actions[id]) return null;
      let targets = role === "mafia" ? others.filter((p) => s.roles[p] !== "mafia") : role === "doctor" ? alive(s) : others.filter((p) => !s.intel[id]?.[p]);
      if (!targets.length) targets = others;
      return { type: "target", target: pick(targets) };
    }
    if (s.phase === "discussion") {
      if (s.ready.includes(id)) return null;
      const said = s.chat.some((m) => m.playerId === id && m.day === s.day);
      if (!said) {
        const known2 = Object.entries(s.intel[id] || {}).find(([p, r]) => r === "mafia" && s.alive[p]);
        s.chat.push({ id: `bot-${id}-${s.day}`, playerId: id, day: s.day, text: role === "commissioner" && known2 ? "Tekshiruvimda Mafia topildi. Ovoz berishda aniq tanlovim bor." : pick(["Shoshilmaylik, hammaning fikrini eshitaylik.", "Bugungi ovozlarni kuzataman.", "Dalilsiz ayblash bizga foyda bermaydi."]) });
      }
      return { type: "ready" };
    }
    if (s.votes[id]) return null;
    const known = Object.entries(s.intel[id] || {}).find(([p, r]) => r === "mafia" && s.alive[p]);
    return { type: "vote", target: known?.[0] || pick(role === "mafia" ? others.filter((p) => s.roles[p] !== "mafia") : others) };
  }
};


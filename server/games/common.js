import { randomInt } from "node:crypto";
export const pick = (a) => a[randomInt(a.length)];
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function assert(ok, message = "Bu amal hozir mumkin emas.") {
  if (!ok) throw new Error(message);
}
const CHAT_STICKERS = new Set(["❤️", "🫶", "😂", "🔥", "🎉", "👏", "🥰", "👀", "🤝", "✨", "😎", "💯"]);
export function normalizeChatPayload(payload) {
  assert(payload && typeof payload === "object", "Xabar noto‘g‘ri.");
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const sticker = typeof payload.sticker === "string" && CHAT_STICKERS.has(payload.sticker) ? payload.sticker : "";
  const image = typeof payload.image === "string" ? payload.image : "";
  assert(text.length <= 280, "Xabar 280 belgidan oshmasin.");
  assert(!payload.sticker || sticker, "Bu stiker mavjud emas.");
  assert(!payload.image || (image.length <= 400_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)), "Rasm hajmi yoki formati mos emas.");
  assert(text || sticker || image, "Xabarga matn, rasm yoki stiker qo‘shing.");
  assert(!(sticker && (text || image)), "Stikerni alohida yuboring.");
  return { ...(text ? { text } : {}), ...(image ? { image } : {}), ...(sticker ? { sticker } : {}) };
}
export function roundWinners(game, state) {
  if (game === "uno") return state.winner ? [state.winner] : [];
  if (game === "durak") return state.loser ? state.order.filter((id) => id !== state.loser) : [];
  if (game === "mafia") return state.winner ? state.order.filter((id) => state.alive[id] && (state.roles[id] === "mafia" ? "mafia" : "civilian") === state.winner) : [];
  return [];
}
export const next = (s, id, step = 1) => s.order[(s.order.indexOf(id) + step + s.order.length * 10) % s.order.length];
export function majority(values) {
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length && (!sorted[1] || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
}


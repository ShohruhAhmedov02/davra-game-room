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
export const next = (s, id, step = 1) => s.order[(s.order.indexOf(id) + step + s.order.length * 10) % s.order.length];
export function majority(values) {
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length && (!sorted[1] || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
}


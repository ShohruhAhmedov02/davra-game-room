import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import { games } from "./games/index.js";
import { assert } from "./games/common.js";
export function createGameServer({ botDelay = 900, disconnectGrace = 3e4, allowedOrigins = [] } = {}) {
  const app = express(), http = createServer(app);
  const rooms = /* @__PURE__ */ new Map(), sessions = /* @__PURE__ */ new Map();
  const io = new Server(http, { maxHttpBufferSize: 16384, allowRequest: (req, done) => {
    const origin = req.headers.origin;
    let same = false;
    try {
      same = !origin || new URL(origin).host === req.headers.host;
    } catch {
    }
    done(null, same || allowedOrigins.includes(origin));
  } });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.get("/api/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));
  const publicDir = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(publicDir));
  app.get("/", (_, res) => res.sendFile(`${publicDir}/index.html`));
  function snapshot(room, id) {
    return { code: room.code, game: room.game, host: room.host, status: room.status, you: id, max: Number.isFinite(games[room.game].max) ? games[room.game].max : null, botThinkMs: room.botThinkMs, startingCards: room.startingCards, min: games[room.game].min, players: room.players.map(({ id: id2, name, bot, level, connected }) => ({ id: id2, name, bot, level, connected })), chat: room.chat || [], state: room.state ? games[room.game].view(room.state, id) : null };
  }
  function broadcast(room) {
    if (room.state) games[room.game].syncPlayers?.(room.state, room.players);
    if (room.state && (room.state.winner || room.state.over)) room.status = "finished";
    for (const p of room.players) {
      const socket = io.sockets.sockets.get(p.socketId);
      if (socket) socket.emit("room", snapshot(room, p.id));
    }
  }
  function detach(session, explicit = false) {
    const room = rooms.get(session.room);
    if (!room) {
      session.room = null;
      return;
    }
    const p = room.players.find((p2) => p2.id === session.id);
    if (p) {
      p.connected = false;
      p.socketId = null;
      p.disconnectedAt = Date.now();
      if (explicit) {
        if (room.status === "waiting" || room.status === "finished") room.players = room.players.filter((p2) => p2.id !== session.id);
        else {
          p.bot = true;
          p.name = `${p.name} · AI`;
        }
      }
    }
    if (room.host === session.id) room.host = room.players.find((p2) => p2.connected && !p2.bot)?.id || room.players.find((p2) => !p2.bot)?.id || null;
    if (explicit) session.room = null;
    if (!room.players.some((p2) => !p2.bot)) {
      rooms.delete(room.code);
      return;
    }
    broadcast(room);
  }
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === "string" && sessions.has(token)) {
      socket.data.token = token;
      return next();
    }
    if (sessions.size >= 5e3) return next(new Error("Server band. Keyinroq urinib ko‘ring."));
    socket.data.token = randomBytes(32).toString("hex");
    sessions.set(socket.data.token, { id: randomUUID(), room: null, lastSeen: Date.now() });
    next();
  });
  io.on("connection", (socket) => {
    const session = sessions.get(socket.data.token);
    if (session.socketId) {
      const old = io.sockets.sockets.get(session.socketId);
      if (old) {
        old.emit("replaced");
        old.disconnect(true);
      }
    }
    session.socketId = socket.id;
    session.lastSeen = Date.now();
    socket.emit("session", { token: socket.data.token, id: session.id });
    const current = rooms.get(session.room);
    if (current) {
      const p = current.players.find((p2) => p2.id === session.id);
      if (p && !p.bot) {
        p.connected = true;
        p.socketId = socket.id;
        if (!current.players.some((player2) => player2.id === current.host && player2.connected && !player2.bot)) current.host = p.id;
        broadcast(current);
      } else session.room = null;
    } else session.room = null;
    if (!session.room) socket.emit("room", null);
    let windowStart = Date.now(), requests = 0;
    function handle(event, fn) {
      socket.on(event, (data, ack) => {
        if (typeof ack !== "function") ack = () => {
        };
        try {
          if (Date.now() - windowStart > 1e3) {
            windowStart = Date.now();
            requests = 0;
          }
          assert(++requests <= 15, "Juda tez amal yuborildi. Biroz kuting.");
          assert(session.socketId === socket.id);
          assert(data && typeof data === "object" && !Array.isArray(data), "So‘rov noto‘g‘ri.");
          session.lastSeen = Date.now();
          fn(data);
          ack({ ok: true });
        } catch (e) {
          ack({ ok: false, error: e.message || "Xatolik yuz berdi." });
        }
      });
    }
    const member = () => {
      const room = rooms.get(session.room);
      assert(room && room.players.some((p) => p.id === session.id && !p.bot), "Avval xonaga kiring.");
      return room;
    };
    const host = () => {
      const r = member();
      assert(r.host === session.id, "Bu amal faqat xona egasi uchun.");
      return r;
    };
    const name = (d) => {
      assert(typeof d.name === "string" && d.name.trim().length >= 2 && d.name.trim().length <= 20, "Nickname 2–20 belgi bo‘lsin.");
      return d.name.trim();
    };
    const player = (n) => ({ id: session.id, name: n, bot: false, level: "medium", connected: true, socketId: socket.id });
    handle("room:create", (d) => {
      assert(!rooms.has(session.room), "Avval joriy xonadan chiqing.");
      assert(Object.hasOwn(games, d.game), "O‘yin topilmadi.");
      assert(rooms.size < 500, "Hozir barcha xonalar band.");
      const n = name(d);
      let code;
      do {
        code = String(randomInt(1e5, 1e6));
      } while (rooms.has(code));
      const r = { code, game: d.game, host: session.id, status: "waiting", players: [player(n)], state: null, chat: [], lastBotAt: 0, botThinkMs: d.game === 'uno' ? 3000 : botDelay, startingCards: d.game === 'uno' ? 20 : null };
      session.room = code;
      rooms.set(code, r);
      broadcast(r);
    });
    handle("room:join", (d) => {
      assert(!rooms.has(session.room), "Avval joriy xonadan chiqing.");
      assert(typeof d.code === "string" && /^\d{6}$/.test(d.code), "6 xonali kod kiriting.");
      const r = rooms.get(d.code);
      assert(r, "Xona topilmadi.");
      assert(r.status === "waiting", "O‘yin boshlangan. Keyingi davrani kuting.");
      assert(r.players.length < games[r.game].max, "Xona to‘lgan.");
      r.players.push(player(name(d)));
      session.room = r.code;
      broadcast(r);
    });
    handle("room:bot", (d) => {
      const r = host();
      assert(r.status === "waiting");
      assert(r.players.length < games[r.game].max, "Xona to‘lgan.");
      assert(["easy", "medium", "hard"].includes(d.level));
      const names = ["Aziza", "Temur", "Lola", "Jasur", "Malika", "Sardor", "Nodira", "Bobur", "Diyor", "Zebo", "Ali"];
      const botIndex = r.players.length - 1;
      r.players.push({ id: randomUUID(), name: `${names[botIndex % names.length]} AI ${botIndex + 1}`, bot: true, level: d.level, connected: true });
      broadcast(r);
    });
    handle('room:settings', d => {
      const r = host();
      assert(r.game === 'uno' && r.status === 'waiting', 'Bu sozlama UNO lobbysida o‘zgartiriladi.');
      const hasTime = Object.hasOwn(d, 'botThinkMs'), hasCards = Object.hasOwn(d, 'startingCards');
      assert(hasTime || hasCards, 'O‘zgartiriladigan sozlamani yuboring.');
      if (hasTime) assert([1000, 3000, 5000, 10000, 15000].includes(d.botThinkMs), 'Bot vaqti noto‘g‘ri.');
      if (hasCards) assert(Number.isInteger(d.startingCards) && d.startingCards >= 7 && d.startingCards <= 20, 'Boshlang‘ich kartalar soni 7–20 oralig‘ida bo‘lsin.');
      if (hasTime) r.botThinkMs = d.botThinkMs;
      if (hasCards) r.startingCards = d.startingCards;
      broadcast(r);
    });
    handle("room:removeBot", (d) => {
      const r = host();
      assert(r.status === "waiting");
      assert(r.players.some((p) => p.id === d.id && p.bot));
      r.players = r.players.filter((p) => p.id !== d.id);
      broadcast(r);
    });
    handle("room:start", () => {
      const r = host();
      assert(r.status === "waiting");
      assert(r.players.length >= games[r.game].min, `Kamida ${games[r.game].min} o‘yinchi kerak.`);
      assert(r.players.every((p) => p.bot || p.connected), "Barcha o‘yinchilar ulanishini kuting.");
      r.state = games[r.game].create(r.players, {startingCards: r.startingCards});
      r.status = "playing";
      r.lastBotAt = Date.now();
      broadcast(r);
    });
    handle("room:reset", () => {
      const r = host();
      assert(r.status === "finished", "O‘yin hali tugamadi.");
      r.status = "waiting";
      r.state = null;
      broadcast(r);
    });
    handle("room:leave", () => {
      detach(session, true);
      socket.emit("room", null);
    });
    handle("room:chat", (d) => {
      const r = member();
      assert(r.game !== "mafia", "Mafiyada suhbat faqat kunduzgi muhokama vaqtida ochiq.");
      assert(r.status === "waiting" || r.status === "playing", "Xona yakunlangan.");
      assert(typeof d.text === "string", "Xabar matni noto‘g‘ri.");
      const text = d.text.trim();
      assert(text.length > 0 && text.length <= 280, "Xabar 1–280 belgi bo‘lsin.");
      const sender = r.players.find((p) => p.id === session.id);
      r.chat.push({ id: randomUUID(), playerId: session.id, name: sender.name, text });
      r.chat = r.chat.slice(-80);
      broadcast(r);
    });
    handle("game:action", (d) => {
      const r = member();
      assert(r.status === "playing");
      games[r.game].act(r.state, session.id, d);
      r.lastBotAt = Date.now();
      broadcast(r);
    });
    socket.on("disconnect", () => {
      if (session.socketId !== socket.id) return;
      session.socketId = null;
      session.lastSeen = Date.now();
      detach(session);
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      if (!r.players.some((p) => !p.bot && p.connected) && r.players.filter((p) => !p.bot).every((p) => now - (p.disconnectedAt || now) > 18e5)) {
        rooms.delete(r.code);
        continue;
      }
      if (r.status !== "playing") continue;
      const game = games[r.game];
      if (game.tick?.(r.state)) {
        broadcast(r);
        if (r.status !== "playing") continue;
      }
      if (now - r.lastBotAt < r.botThinkMs) continue;
      for (const p of r.players) {
        if (!p.bot && (p.connected || now - (p.disconnectedAt || now) < disconnectGrace)) continue;
        try {
          const action = game.bot(r.state, p.id, p.level);
          if (action) {
            game.act(r.state, p.id, action);
            r.lastBotAt = now;
            broadcast(r);
            break;
          }
        } catch (e) {
          console.error("Bot action failed", r.game, e.message);
          r.lastBotAt = now;
          break;
        }
      }
    }
    for (const [token, s] of sessions) if (!s.socketId && now - s.lastSeen > 36e5) sessions.delete(token);
  }, Math.min(250, botDelay));
  timer.unref();
  return { app, http, io, rooms, close: () => new Promise((resolve) => {
    clearInterval(timer);
    io.close(() => resolve());
  }) };
}


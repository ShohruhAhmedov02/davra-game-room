import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";
const socket = io({ autoConnect: false, auth: { token: localStorage.getItem("davra-token") } });
const catalog = { uno: { name: "UNO", eyebrow: "RANGLAR JANGI", tag: "2+ · chegara yo‘q", description: "Rangni moslang. Navbatni o‘zgartiring. Oxirgi kartaga yeting.", icon: "◈" }, durak: { name: "6 karta", eyebrow: "PODKIDNOY DURAK", tag: "2–6 o‘yinchi", description: "Hujum, himoya va ozgina ayyorlik. Kartasiz qolgan yutadi.", icon: "♠" }, mafia: { name: "Mafia", eyebrow: "KIMGA ISHONASIZ?", tag: "5–12 o‘yinchi", description: "Tun sirlarni yashiradi. Kunduz esa hamma shubha ostida.", icon: "◐" } };
const roles = { mafia: "Mafia", doctor: "Doktor", commissioner: "Komissar", civilian: "Tinch aholi" };
const roleInfo = { mafia: "Tunda sheriklaringiz bilan nishon tanlang. Kunduz shubhalarni chetga buring.", doctor: "Har tunda bir o‘yinchini qutqaring. O‘zingizni ham tanlashingiz mumkin.", commissioner: "Har tunda bir o‘yinchini tekshiring. Natija faqat sizga ko‘rinadi.", civilian: "Kunduz suhbatni kuzating va ovoz berib Mafiani toping." };
const colorNames = { red: "Qizil", yellow: "Sariq", green: "Yashil", blue: "Ko‘k" };
const valueText = (v) => ({ skip: "⊘", reverse: "⇄", wild: "✦", "+4": "+4" })[v] || v;
const rankText = (r) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[r] || r;
function Card({ card, back = false, disabled = false, onClick, selected = false }) {
  const color = back ? "back" : card.color || (["♥", "♦"].includes(card.suit) ? "suit-red" : "suit-black");
  const value = back ? "D" : card.value ? valueText(card.value) : rankText(card.rank);
  const label = back ? "Yopiq karta" : card.value ? `${colorNames[card.color] || "Wild"} ${card.value}` : `${rankText(card.rank)} ${card.suit}`;
  return <button type="button" className={`card ${color} ${selected ? "selected" : ""}`} aria-label={label} disabled={disabled || !onClick} onClick={onClick}><span>{value}{card?.suit}</span><b>{card?.suit || value}</b><span>{value}{card?.suit}</span></button>;
}
function GameArt({ game }) {
  return <div className={`game-art ${game}`} aria-hidden="true">{game === "uno" ? <><div className="art-card a red">7</div><div className="art-card b yellow">⇄</div><div className="art-card c blue">+4</div><i>✦</i></> : game === "durak" ? <><div className="art-card a paper">A<small>♠</small></div><div className="art-card b paper red-ink">K<small>♥</small></div><div className="art-card c paper">Q<small>♣</small></div></> : <><div className="moon" /><svg viewBox="0 0 260 190"><path d="M75 74l16-48h69l22 48 27 11H51z" fill="#c1afe8" /><path d="M93 91h70l-13 50-24 16-24-16z" fill="#71648c" /><path d="M93 96l27 8-6 10-18-5m67-13l-28 8 6 10 18-5" fill="#1c1927" /><path d="M65 155l36-20 25 31 27-31 38 20 27 35H40z" fill="#9a88bd" /><path d="M118 160h17l-3 12 10 18h-30l10-18z" fill="#292334" /></svg><div className="stars">✦ · ✧</div></>}</div>;
}
function App() {
  const [selectedCards, setSelectedCards] = useState([]);
  const [room, setRoom] = useState(null), [connected, setConnected] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false), [name, setName] = useState(localStorage.getItem("davra-name") || ""), [code, setCode] = useState(""), [level, setLevel] = useState("medium"), [wild, setWild] = useState(null), [uno, setUno] = useState(false), [roleOpen, setRoleOpen] = useState(false), [chat, setChat] = useState(""), [clock, setClock] = useState(Date.now()), [rules, setRules] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setError("Server bilan aloqa yo‘q. Qayta ulanish kutilmoqda."));
    socket.on("session", (s2) => {
      localStorage.setItem("davra-token", s2.token);
      socket.auth = { token: s2.token };
    });
    socket.on("room", setRoom);
    socket.on("replaced", () => setError("Bu profil boshqa oynada ochildi. O‘yinni o‘sha oynada davom ettiring."));
    socket.connect();
    const t = setInterval(() => setClock(Date.now()), 1e3);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 6500);
      return () => clearTimeout(t);
    }
  }, [error]);
  useEffect(() => {
    setWild(null);
    setUno(false);
    setSelectedCards([]);
  }, [room?.state?.turn, room?.status]);
  useEffect(() => {
    setRoleOpen(false);
    setChat("");
  }, [room?.code, room?.status]);
  useEffect(() => {
    if (!wild && !rules) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusables = () => Array.from(dialog?.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]') || []);
    focusables()[0]?.focus();
    const handle = (e) => {
      if (e.key === "Escape") {
        setWild(null);
        setRules(false);
      }
      if (e.key === "Tab") {
        const f = focusables(), first = f[0], last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [wild, rules]);
  function send(event, data = {}) {
    return new Promise((resolve, reject) => {
      if (!socket.connected) return reject(new Error("Server bilan aloqa uzilgan."));
      socket.timeout(6e3).emit(event, data, (err, res) => {
        if (err) return reject(new Error("Javob kelmadi. Xona holatini tekshirib, qayta urinib ko‘ring."));
        if (!res?.ok) return reject(new Error(res?.error || "Amal bajarilmadi."));
        resolve(res);
      });
    });
  }
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create(game, ai) {
    localStorage.setItem("davra-name", name.trim());
    await send("room:create", { name, game });
    if (ai) {
      for (let i = 0; i < (game === "mafia" ? 5 : 2); i++) await send("room:bot", { level });
      await send("room:start");
    }
  }
  const action = (a) => run(() => send("game:action", a));
  const playerName = (id) => room?.players.find((p) => p.id === id)?.name || "O‘yinchi";
  const s = room?.state, me = room?.you, myTurn = s?.turn === me, isHost = room?.host === me;
  function play(c) {
    if (room.game === 'uno' && /^\d$/.test(c.value)) {
      if (selectedCards.includes(c.id)) setSelectedCards(selectedCards[0] === c.id ? [] : selectedCards.filter(id => id !== c.id));
      else setSelectedCards([...selectedCards, c.id]);
      return;
    }
    setSelectedCards([]);
    if (c.color === "wild") {
      setWild(c);
      return;
    }
    action({ type: "play", cardId: c.id, uno });
    setUno(false);
  }
  const canAct = connected && !busy;
  const selectedValue = s?.hand?.find(c => c.id === selectedCards[0])?.value;
  function selectable(c) {
    if(room?.game !== 'uno' || !selectedCards.length) return s.legalCards.includes(c.id);
    return /^\d$/.test(c.value) ? c.value === selectedValue : false;
  }
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/" aria-label="DavRA bosh sahifa"><span className="brandmark">D</span>dav<span>ra</span><i>®</i></a><div className="nav-label">O‘YIN MAYDONI</div><button className={`nav-item ${!room ? "active" : ""}`} onClick={() => room ? setError("Bosh sahifaga qaytish uchun avval xonadan chiqing.") : null}><span>▦</span> O‘yinlar <small>03</small></button>{Object.entries(catalog).map(([key, g]) => <div key={key} className={`nav-item sub ${room?.game === key ? "active" : ""}`}><span>{g.icon}</span>{g.name}</div>)}<div className="side-bottom"><div className="mini-card"><span className="little-orbit">✳</span><b>Birga qiziqroq.</b><p>Xona oching, kodni do‘stlaringizga yuboring.</p></div><button className="nav-item" onClick={() => setRules(true)}><span>ⓘ</span> O‘yin qoidalari</button><span className="version">DAVRA / BIRINCHI MAVSUM</span></div></aside>
 <div className="main-shell"><header><div className="breadcrumb">O‘yin maydoni <span>/</span> <b>{room ? catalog[room.game].name : "Barcha o‘yinlar"}</b></div><div className="header-right"><span className={`connection ${connected ? "online" : ""}`}><i />{connected ? "Ulangan" : "Ulanmoqda..."}</span><div className="avatar small">{(name || "?")[0].toUpperCase()}</div></div></header>
 <main>{!room ? <><div className="page-heading"><div><div className="eyebrow">DO‘STLAR UCHUN BIR JOY</div><h1>Bugun nima o‘ynaymiz<span>?</span></h1><p>Do‘stlarni yig‘ing. Yoki AI’ga qarshi o‘zingizni sinang.</p></div><span className="season">✳ <span>YAXSHI DAVRA.<br />YAXSHI O‘YIN.</span></span></div>
 <section className="entry-panel"><div className="identity-field"><label htmlFor="nickname">Sizni qanday chaqiramiz?</label><div className="input-icon"><span>☺</span><input id="nickname" value={name} maxLength={20} placeholder="Nickname kiriting" onChange={(e) => setName(e.target.value)} /></div></div><div className="join-field"><label htmlFor="room-code">Do‘stingizning xonasi bormi?</label><form onSubmit={(e) => {
    e.preventDefault();
    run(async () => {
      localStorage.setItem("davra-name", name.trim());
      await send("room:join", { name, code });
    });
  }}><input id="room-code" inputMode="numeric" maxLength={6} value={code} placeholder="6 xonali kod" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><button className="btn secondary" disabled={!canAct || code.length !== 6}>Qo‘shilish <span>↗</span></button></form></div></section>
 <div className="section-title"><h2>O‘yinni tanlang <span>03</span></h2><label className="difficulty">AI darajasi <select value={level} onChange={(e) => setLevel(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div>
 <div className="games-grid">{Object.entries(catalog).map(([key, g], i) => <article className={`game-tile ${key}`} key={key}><div className="art-wrap"><span className="game-number">0{i + 1}</span><span className="players-tag">♧ {g.tag}</span><GameArt game={key} /></div><div className="tile-content"><div className="eyebrow">{g.eyebrow}</div><h2>{g.name}<span>{g.icon}</span></h2><p>{g.description}</p><button className="btn primary" disabled={!canAct || name.trim().length < 2} onClick={() => run(() => create(key, false))}>Xona yaratish <span>↗</span></button><button className="btn ai-button" disabled={!canAct || name.trim().length < 2} onClick={() => run(() => create(key, true))}><span>✧</span> AI bilan o‘ynash <span>→</span></button></div></article>)}</div><div className="home-bottom"><span><i className="dot" /> 3 o‘yin. Bir davra. Cheksiz raqobat.</span><span>Telefon yoki kompyuter — tanlov sizniki.</span></div></> : <>
 <div className="room-heading"><div><div className="eyebrow">{room.status === "waiting" ? "DO‘STLARNI KUTYAPMIZ" : room.status === "finished" ? "DAVRA YAKUNLANDI" : "O‘YIN DAVOM ETMOQDA"}</div><h1>{catalog[room.game].name} <small>/ xona</small></h1></div><div className="room-controls"><button className="code-pill" onClick={() => run(async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  })}><span>{copied ? "Nusxalandi" : "XONA KODI"}</span><b>{room.code}</b> ⧉</button><button className="btn ghost" disabled={!canAct} onClick={() => run(() => send("room:leave"))}>Chiqish ↗</button></div></div>
 {room.status === "waiting" ? <div className="lobby-layout"><section className="panel lobby"><div className="section-title"><h2>Davrangiz <span>{room.players.length}/{room.max ?? "∞"}</span></h2><span className="tag">{catalog[room.game].tag}</span></div><div className="lobby-players">{room.players.map((p, i) => <div className="lobby-player" key={p.id}><div className={`avatar tone-${i % 4}`}>{p.bot ? "✧" : p.name[0].toUpperCase()}</div><div><b>{p.name}{p.id === me ? " (siz)" : ""}</b><small>{p.bot ? `AI · ${p.level}` : p.id === room.host ? "Xona egasi" : p.connected ? "Tayyor" : "Aloqa uzilgan"}</small></div>{p.bot && isHost ? <button aria-label={`${p.name} botini olib tashlash`} className="icon-btn" disabled={!canAct} onClick={() => run(() => send("room:removeBot", { id: p.id }))}>×</button> : <i className={`status-dot ${p.connected ? "ready" : ""}`} />}</div>)}</div>{isHost ? <div className="lobby-actions">{room.game === "uno" && <><label className="difficulty">Boshlang‘ich kartalar <select aria-label="Boshlang‘ich kartalar" value={room.startingCards} disabled={!canAct} onChange={e => run(() => send("room:settings", {startingCards:Number(e.target.value)}))}>{Array.from({length:14}, (_,i) => i+7).map(n => <option key={n} value={n}>{n} ta</option>)}</select></label><label className="difficulty">AI o‘ylash vaqti <select aria-label="AI o‘ylash vaqti" value={room.botThinkMs} disabled={!canAct} onChange={e => run(() => send("room:settings", {botThinkMs:Number(e.target.value)}))}>{[1,3,5,10,15].map(n => <option key={n} value={n*1000}>{n} soniya</option>)}</select></label></>}<div className="bot-add"><select aria-label="Bot darajasi" value={level} onChange={(e) => setLevel(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><button className="btn secondary" disabled={!canAct || (room.max !== null && room.players.length >= room.max)} onClick={() => run(() => send("room:bot", { level }))}>＋ AI qo‘shish</button></div><button className="btn primary" disabled={!canAct || room.players.length < room.min || room.players.some((p) => !p.bot && !p.connected)} onClick={() => run(() => send("room:start"))}>O‘yinni boshlash →</button></div> : <p className="muted">Xona egasi o‘yinni boshlashini kuting.</p>}<p className="helper">Boshlash uchun kamida {room.min} o‘yinchi kerak. Odamlar va botlar birga o‘ynashi mumkin.{room.game === "uno" && " Har kimga " + room.startingCards + " ta karta beriladi. Koloda tugamaydi. Odamlar yurishi uchun vaqt chegarasi yo‘q. Botlar " + room.botThinkMs / 1000 + " soniya o‘ylaydi."}</p></section><section className={`panel lobby-guide ${room.game}`}><GameArt game={room.game} /><h2>Davraga taklif qiling.</h2><p><b>{room.code}</b> kodini do‘stlaringizga yuboring. Ular nickname va shu kod bilan kirishadi.</p><button className="text-button" onClick={() => setRules(true)}>Qoidalarni ko‘rish ↗</button></section></div> : <>
 <div className="opponents">{room.players.map((p, i) => <div key={p.id} className={`opponent ${s.turn === p.id ? "turn" : ""} ${s.alive?.[p.id] === false || s.finished?.includes(p.id) ? "eliminated" : ""}`}><div className={`avatar tone-${i % 4}`}>{p.bot ? "✧" : p.name[0]}</div><div><b>{p.name} {p.id === me ? "· siz" : ""}</b><small>{room.game === "mafia" ? s.alive[p.id] ? "O‘yinda" : "Kuzatuvchi" : s.finished?.includes(p.id) ? `${s.finished.indexOf(p.id)+1}-o‘rin · Tugatdi` : s.loser === p.id ? "Yutqazdi" : `${s.counts[p.id]} ta karta`}{!p.bot && !p.connected ? " · uzilgan" : ""}</small></div>{s.turn === p.id && <span className="turn-dot" />}</div>)}</div>
 {room.status === "finished" && <div className="result-banner"><span>✦</span><div><h2>{room.game === "mafia" ? `${s.winner === "mafia" ? "Mafia" : "Tinch aholi"} g‘alaba qozondi!` : room.game === "durak" ? s.loser ? `${playerName(s.loser)} — Durak!` : "Durang!" : `${playerName(s.loser)} yutqazdi!`}</h2><p>{room.game === "uno" ? `${playerName(s.winner)} — 1-o‘rin.${s.randomFinal ? " Oxirgi 2 ta AI orasidan yutqazgan tasodifiy tanlandi." : ""}` : "Yana bir davra?"}</p></div>{isHost && <button className="btn primary" disabled={!canAct} onClick={() => run(() => send("room:reset"))}>Qayta o‘ynash ↗</button>}</div>}
 {room.game === "uno" && s.finished?.includes(me) && room.status === "playing" && <p className="notice">Siz {s.finished.indexOf(me)+1}-o‘rinni oldingiz. Qolganlar oxirgi yutqazgan aniqlanguncha davom etadi.</p>}{room.game === "mafia" ? <div className="mafia-layout"><section className="panel mafia-board"><div className="section-title"><h2>{s.day}-{s.phase === "night" ? "tun" : "kun"} · {{ night: "Tun", discussion: "Muhokama", vote: "Ovoz berish" }[s.phase]}</h2><span className="tag">{s.winner ? "Yakunlandi" : `${Math.max(0, Math.ceil((s.deadline - clock) / 1e3))} s`}</span></div><div className="role-box"><span>SHAXSIY ROLINGIZ</span><button className="text-button" onClick={() => setRoleOpen(!roleOpen)}>{roleOpen ? "Yashirish ◉" : "Ko‘rsatish ◉"}</button><h2>{roleOpen || s.winner ? roles[s.role] : "••••••••"}</h2>{roleOpen && <p>{roleInfo[s.role]}</p>}{roleOpen && s.allies.length > 0 && <p>Sheriklar: {s.allies.filter((p) => p !== me).map(playerName).join(", ") || "Siz yagona Mafiasiz."}</p>}{roleOpen && Object.entries(s.intel).map(([id, r]) => <p key={id}>{playerName(id)}: {r === "mafia" ? "Mafia" : "Mafia emas"}</p>)}</div><p>{s.message} {s.lastEliminated && <b>{playerName(s.lastEliminated)} chiqarildi.</b>}</p>{!s.alive[me] && !s.winner && <p className="notice">Siz kuzatuvchisiz. O‘yinni oxirigacha kuzating.</p>}{s.acted && !s.winner && <p className="notice">Tanlov qabul qilindi. Qolganlarni kutyapmiz.</p>}<div className="target-grid">{room.players.map((p) => <button key={p.id} className={`target ${!s.alive[p.id] ? "dead" : ""}`} disabled={!canAct || !!s.winner || !s.alive[me] || !s.alive[p.id] || s.acted || s.phase === "discussion" || s.phase === "night" && (s.role === "civilian" || s.role === "mafia" && s.allies.includes(p.id) || s.role === "commissioner" && p.id === me) || s.phase === "vote" && p.id === me} onClick={() => action({ type: s.phase === "vote" ? "vote" : "target", target: p.id })}><span>{p.bot ? "✧" : "☺"}</span><b>{p.name}</b><small>{s.winner ? roles[s.roles[p.id]] : !s.alive[p.id] ? "Chiqarilgan" : s.votes.includes(p.id) ? "Ovoz berdi" : "O‘yinda"}</small></button>)}</div>{s.phase === "discussion" && <button className="btn primary" disabled={!canAct || !s.alive[me] || s.acted || !!s.winner} onClick={() => action({ type: "ready" })}>Muhokamani tugatish →</button>}{s.phase === "vote" && <button className="btn secondary" disabled={!canAct || !s.alive[me] || s.acted || !!s.winner} onClick={() => action({ type: "vote", target: "skip" })}>Ovoz bermaslik</button>}</section><section className="panel chat-panel"><h2>Davradagi suhbat</h2><div className="chat-messages" aria-live="polite">{!s.chat.length && <p className="muted">Tong otganda suhbat ochiladi.</p>}{s.chat.map((m) => <div className={`chat-message ${m.system ? "system" : ""}`} key={m.id}><b>{m.name || playerName(m.playerId)}</b><p>{m.text}</p></div>)}</div><form onSubmit={(e) => {
    e.preventDefault();
    run(async () => {
      await send("game:action", { type: "chat", text: chat });
      setChat("");
    });
  }}><input aria-label="Xabar" placeholder={s.phase === "discussion" ? "Fikringizni yozing..." : "Suhbat faqat kunduz ochiq"} value={chat} maxLength={280} onChange={(e) => setChat(e.target.value)} disabled={!s.alive[me] || s.phase !== "discussion" || !!s.winner} /><button className="btn primary" disabled={!canAct || !chat.trim() || !s.alive[me] || s.phase !== "discussion" || !!s.winner}>↗</button></form></section></div> : <><section className={`table-area ${room.game}`}><div className="table-topline"><span className="tag">{room.game === "uno" ? `Navbat ${s.direction === 1 ? "↻" : "↺"}` : `Kozir: ${s.trump} · Limit: ${s.limit}`}</span><span className={`turn-label ${myTurn ? "your-turn" : ""}`}>{room.status === "finished" ? "O‘yin tugadi" : myTurn ? "Sizning navbatingiz" : `${playerName(s.turn)} o‘ylamoqda...`}</span></div><div className="table-center"><div className="deck-stack"><Card back /><span>{s.infiniteDeck ? "∞ · Tugamaydigan koloda" : `${s.deckCount} ta karta`}</span>{room.game === "durak" && <span className="trump-indicator">{rankText(s.trumpCard.rank)}{s.trump}</span>}</div>{room.game === "uno" ? <div className="discard"><Card card={s.top} /><span className={`color-badge ${s.color}`}>{colorNames[s.color]}</span></div> : <div className="battlefield">{s.table.length ? s.table.map((pair, i) => <div className="card-pair" key={i}><Card card={pair.attack} />{pair.defense && <div className="defense-card"><Card card={pair.defense} /></div>}</div>) : <div className="empty-table"><span>♠</span><p>{room.status === "finished" ? "Davraga rahmat!" : "Birinchi hujumni kutyapmiz"}</p></div>}</div>}</div><p className="table-message" aria-live="polite">{room.game === "durak" && s.taking ? "Himoyachi oladi. Mos kartalarni qo‘shing yoki o‘tkazing." : s.message}</p></section><section className="hand-panel"><div className="section-title"><div><h2>Sizning kartalaringiz <span>{s.hand.length}</span></h2><p className="helper">{myTurn ? (room.game === "uno" ? "Bir xil raqamlarni tanlang, so‘ng tashlash tugmasini bosing." : "Yorqin kartalardan birini tanlang.") : "Navbatingizni kuting."}</p></div><div className="game-actions">{room.game === "uno" ? <>{selectedCards.length > 0 && <><button className="btn ghost" disabled={!canAct} onClick={() => setSelectedCards([])}>Bekor qilish</button><button className="btn primary" disabled={!canAct || !myTurn || room.status !== "playing"} onClick={() => run(async () => {await send('game:action', {type:'play',cardIds:selectedCards,uno});setSelectedCards([]);setUno(false);})}>{selectedCards.length} ta kartani tashlash →</button></>}<button className={`btn uno-button ${uno ? "armed" : ""}`} disabled={!canAct || room.status !== "playing" || !((s.hand.length - Math.max(1, selectedCards.length) === 1) && myTurn || s.unoPending === me)} onClick={() => s.unoPending === me ? action({ type: "uno" }) : setUno(!uno)}>UNO! {uno ? "✓" : ""}</button>{s.unoPending && s.unoPending !== me && !s.finished?.includes(me) && <button className="btn secondary" disabled={!canAct || room.status !== "playing"} onClick={() => action({ type: "catch" })}>UNO jazosi +2</button>}<button className="btn primary" disabled={!canAct || !myTurn || room.status !== "playing"} onClick={() => {setSelectedCards([]);action({ type: s.drawn ? "pass" : "draw" });}}>{s.drawn ? "O‘tkazish →" : "Karta olish ＋"}</button></> : <button className="btn primary" disabled={!canAct || !myTurn || room.status !== "playing" || !s.table.length} onClick={() => action({ type: me === s.defender && !s.taking ? "take" : "pass" })}>{me === s.defender && !s.taking ? "Kartalarni olish" : "Bito / o‘tkazish →"}</button>}</div></div><div className="hand">{s.hand.map((c) => <Card key={c.id} card={c} disabled={!canAct || room.status !== "playing" || !myTurn || !selectable(c)} selected={selectedCards.includes(c.id)} onClick={() => play(c)} />)}</div></section></>}
 </>}
 </>}</main><footer><span>DAVRA © 2026</span><span>O‘yin bahona. Davra g‘animat.</span><button onClick={() => setRules(true)}>Qoidalar ↗</button></footer></div>
 {error && <div className="toast" role="alert">{error}<button aria-label="Yopish" onClick={() => setError("")}>×</button></div>}
 {wild && <div className="modal-overlay" onClick={() => setWild(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="color-title" onClick={(e) => e.stopPropagation()}><h2 id="color-title">Yangi rangni tanlang</h2><div className="color-options">{Object.entries(colorNames).map(([key, title]) => <button key={key} className={key} disabled={!canAct} onClick={() => {
    action({ type: "play", cardId: wild.id, color: key, uno });
    setWild(null);
    setUno(false);
  }}>{title}</button>)}</div><button className="btn ghost" onClick={() => setWild(null)}>Bekor qilish</button></section></div>}
 {rules && <div className="modal-overlay" onClick={() => setRules(false)}><section className="modal rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}><button className="close-modal" aria-label="Yopish" onClick={() => setRules(false)}>×</button><h2 id="rules-title">Davra qoidalari</h2><h3>UNO</h3><p>Kamida 2 o‘yinchi, yuqori son chegarasi yo‘q. Boshlang‘ich kartalar 7–20 oralig‘ida tanlanadi; standart 20 ta. Koloda avtomatik to‘ldiriladi va tugamaydi. Yurish vaqti cheklanmagan. Botlar standart 3 soniya kutadi; xona egasi 1–15 soniya tanlashi mumkin.</p><p>Rang yoki qiymatni moslang. Bir xil raqamli kartalarni birga tashlash mumkin: avval stolga mos kartani, keyin shu raqamli boshqa ranglarni tanlang. Oxirgi tanlangan karta yangi rangni belgilaydi. Maxsus kartalar bittadan tashlanadi. Skip navbatni o‘tkazadi, Reverse yo‘nalishni o‘zgartiradi. +2 va +4 keyingi o‘yinchiga karta beradi va navbatini o‘tkazadi. Jarimalar ustma-ust qo‘shilmaydi. +4 faqat joriy rangdagi kartangiz bo‘lmasa tashlanadi.</p><p>Karta olganda avval yangi kartani tanlang; unga shu raqamli boshqa kartalarni ham qo‘shib tashlash mumkin. 2 kartadan bittasini tashlashdan oldin UNO tugmasini yoqing yoki bittasi qolgach tezda UNO deng. Boshqa o‘yinchi keyingi yurishgacha ushlasa, +2 jarima.</p><p>Qo‘li bo‘shagan o‘yinchi o‘z o‘rnini olib, kuzatadi. O‘yin oxirgi kartali o‘yinchi yutqazguncha davom etadi. Oxirida faqat 2 ta AI qolsa, yutqazgan tasodifiy tanlanadi.</p><h3>6 karta — Podkidnoy Durak</h3><p>36 karta, 6 tadan tarqatiladi. Bir xil turdagi yuqoriroq karta yoki kozir bilan yoping. Stoldagi qiymatga mos kartani qo‘shish mumkin. Har hujumda limit: 6 yoki himoyachining boshlang‘ich kartalari soni. Hujumchilar ketma-ket qatnashadi. Himoyachi olsa ham limitgacha qo‘shish mumkin. Hamma o‘tkazgach kartalar to‘ldiriladi; himoyachi oxirgi oladi.</p><h3>Mafia</h3><p>5–6 o‘yinchida 1, 7–8 da 2, 9–12 da 3 Mafia bo‘ladi. Doktor himoya qiladi, Komissar tekshiradi. Tun 60 soniya, muhokama 60 soniya, ovoz berish 45 soniya. Hamma tanlasa bosqich tezroq tugaydi. Ovozlar teng bo‘lsa hech kim chiqmaydi. Mafia soni tinch aholi soniga tenglashsa Mafia yutadi.</p><p>Botlar qoidaviy strategiya bilan o‘ynaydi. Easy tasodifiyroq, Medium tejamkor, Hard vaziyatni hisobga oladi. Mafia botlari uchun daraja qo‘llanmaydi.</p></section></div>}
 </div>;
}
createRoot(document.getElementById("root")).render(<App />);

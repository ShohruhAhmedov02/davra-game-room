# DavRA — multiplayer o‘yin xonasi

React + Node.js + Socket.IO asosida UNO, 6 karta (Podkidnoy Durak) va Mafia. Interfeys o‘zbekcha, telefon va desktopga moslashadi. API kaliti yoki pullik AI xizmatlari kerak emas.

## Tez ishga tushirish

Node.js **22.12+** yoki **24 LTS** kerak. Terminalni shu papkada oching:

```sh
npm install
npm run build
npm start
```

Brauzer: **http://localhost:3001**. Frontend va Socket.IO bitta serverdan ishlaydi.

Loyihaga aniq versiyalarni qayta o‘rnatish uchun `pnpm-lock.yaml` kiritilgan. pnpm mavjud bo‘lsa:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Ishlab chiqish:

```sh
npm run dev
```

Frontend: **http://localhost:5173**, backend: **http://localhost:3001**. Vite `/socket.io` va `/api` so‘rovlarini backendga yuboradi. `Ctrl+C` ikkala jarayonni yopadi. Standart portlar band bo‘lsa, ularni bo‘shating yoki server va Vite proxy sozlamalarini birga o‘zgartiring.

## O‘ynash

1. Nickname kiriting (2–20 belgi).
2. **Xona yaratish** tugmasini bosing va 6 xonali kodni do‘stlarga yuboring.
3. Do‘stlaringiz saytni ochib, nickname va kod orqali kiradi.
4. Xona egasi istasa AI botlar qo‘shadi, so‘ng o‘yinni boshlaydi.
5. **AI bilan o‘ynash** UNO/Durakda 2 bot, Mafiada 5 bot bilan darhol partiya boshlaydi.

Bir xil Wi-Fi tarmog‘idagi telefonlar kompyuterning mahalliy IP manziliga, masalan `http://192.168.1.10:3001` orqali kirishi mumkin. Windows Firewall Node.js uchun xususiy tarmoqdan kirishga ruxsat berishi kerak. `localhost` boshqa telefon yoki kompyuterdan sizning serveringizga olib bormaydi.

Bir brauzer profilida bitta o‘yinchi sessiyasi saqlanadi. Ikki odamni bitta kompyuterda sinash uchun boshqa brauzer yoki inkognito oyna ishlating. Ikkinchi oddiy tab shu profil sessiyasini ko‘chiradi va oldingi tabni uzadi. Sahifa yangilansa yoki tarmoq qaytsa, mavjud token orqali o‘yinchining joyi va kartalari tiklanadi.

## Tayyor funksiyalar

- Umumiy lobby: nickname, tasodifiy 6 xonali xona kodi, qo‘shilish, host, bot qo‘shish/olib tashlash, boshlash, yakunda qayta o‘ynash.
- Odamlar, AI botlar yoki ularning aralashmasi bir xil qoidalar orqali o‘ynaydi.
- Server navbat, karta egaligi, ruxsat etilgan yurishlar va host huquqlarini tekshiradi.
- Kartalar va rollar har bir mijozga alohida filtrlanadi. To‘liq koloda yoki boshqa odamning qo‘li tarmoqqa yuborilmaydi.
- 30 soniya uzilgan o‘yinchini bot vaqtincha boshqaradi. Qayta ulansa boshqaruv o‘ziga qaytadi. O‘yindan ataylab chiqsa, o‘rnida doimiy bot qoladi.
- Host chiqib ketsa, boshqa ulangan odam host bo‘ladi. Faqat bot qolgan xona o‘chiriladi. Barcha odamlar 30 daqiqa uzilgan xona tozalanadi.
- Xatolik xabarlari, aloqa ko‘rsatkichi, responsive kartalar, klaviatura fokuslari va sahifa ichidagi qoidalar.

## O‘yin qoidalari va MVP variantlari

### UNO

Kamida 2 o‘yinchi, UNO uchun yuqori o‘yinchi soni chegarasi yo‘q. Xona egasi boshlang‘ich kartalarni 7–20 oralig‘ida tanlaydi. Yangi xona va tez AI o‘yinida standart **20 tadan** tarqatiladi. Boshlang‘ich koloda o‘yinchi va tarqatiladigan karta soniga yetadigan 108 kartalik to‘plamlardan tuziladi. Barcha nusxalar noyob ID oladi. **Koloda tugamaydi:** avval stolning yuqori kartasidan boshqa tashlangan kartalar qayta aralashtiriladi; ular ham yetmasa yangi 108 kartalik to‘plam yaratiladi. Oddiy karta olish ham, +2/+4 va UNO jarimalari ham kartasiz qolmaydi. Interfeys kolodani ∞ bilan ko‘rsatadi. Amaliy sig‘im server resurslari va umumiy sessiya limitiga bog‘liq.

Odamlar navbati vaqt bilan cheklanmaydi. UNO botlari standart 3 soniya o‘ylaydi; xona egasi lobbyda 1, 3, 5, 10 yoki 15 soniya tanlaydi. Bu tezlik sozlamasi strategiya darajasidan mustaqil. Rang yoki qiymat mos bo‘lishi kerak. **Bir xil raqamlarni birga tashlash** qo‘shimcha qoidasi yoqilgan: avval stol rangiga yoki qiymatiga mos raqamli kartani tanlang, keyin 0–9 orasidagi aynan shu raqamli boshqa kartalarni tanlab, **N ta kartani tashlash** tugmasini bosing. Ranglari turlicha bo‘lishi mumkin; oxirgi tanlangan karta keyingi rangni belgilaydi. Maxsus kartalar bu kombinatsiyaga kirmaydi. Butun guruh bitta yurish sanaladi; bitta karta qolsa UNO aytish kerak. Botlar ham mos raqamlarni birga tashlaydi. Skip, Reverse, +2, Wild, Wild +4 ishlaydi. Ikki o‘yinchida Reverse Skip kabi ishlaydi. +2/+4 kartalar keyingi o‘yinchiga jarima beradi va uning navbatini o‘tkazadi; jarimalar ustma-ust qo‘shilmaydi. +4 faqat joriy rangdagi karta bo‘lmaganda ruxsat etiladi; alohida challenge oqimi yo‘q, server qoidani darhol tekshiradi.

Boshlang‘ich stol kartasi raqamli. Karta olgach, mos bo‘lsa avval o‘sha yangi kartani tanlang. Agar u raqamli bo‘lsa, qo‘lingizdagi shu raqamli boshqa ranglarni ham qo‘shib birga tashlash mumkin. Yoki navbatni o‘tkazing. Mos bo‘lmasa navbat avtomatik o‘tadi. Tugagan koloda yuqoridagi kartadan boshqa tashlangan kartalarni qayta aralashtiradi.

Ikki karta qolganida **UNO!** tugmasini oldindan yoqing yoki bittasi qolgach bosing. Keyingi o‘yin yurishigacha boshqa odam **UNO jazosi +2** orqali ushlashi mumkin. Botlar UNO’ni o‘z yurishi bilan aytadi. Qo‘li bo‘shagan o‘yinchi tugatish ketma-ketligi bo‘yicha o‘rin oladi va kuzatuvchi bo‘ladi. Navbat, Reverse, Skip va jarimalar tugatganlarni chetlab o‘tadi. **O‘yin oxirgi kartali o‘yinchi yutqazguncha davom etadi.** Agar qolgan ikki o‘yinchining ikkalasi ham AI bo‘lsa, server tasodifiy birini yutqazgan deb belgilaydi, ikkinchisiga oldingi o‘rinni beradi va davrani yakunlaydi. Birinchi tugatgan 1-o‘rin bo‘lib qoladi; odam qatnashayotgan finalda tasodifiy yakun qo‘llanmaydi. Ochko va ko‘p raundli turnir tizimi kiritilmagan.

### 6 karta — Podkidnoy Durak

2–6 o‘yinchi, 36 karta (6–A), 6 tadan karta. Kolodaning pastki kartasi kozirni ko‘rsatadi va oxirgi olinadi. Eng kichik kozir egasi birinchi hujum qiladi; tarqatilgan qo‘llarda kozir bo‘lmasa birinchi o‘yinchi boshlaydi.

Hujum bir xil suitdagi yuqoriroq karta yoki kozir bilan yopiladi. Hujumchilar navbat bilan stolning hujum yoki himoya kartalaridagi qiymatga mos karta qo‘sha oladi. Har bir hujum kartasiga darhol himoya javobi olinadi. Bir davrada limit `min(6, himoyachining davra boshidagi kartalari)`.

Himoyachi **Kartalarni olish** desa, boshqalar limitgacha qo‘shishi mumkin. Hujumchilar **Bito / o‘tkazish** bilan navbatni beradi; hamma o‘tkazsa davra tugaydi. To‘ldirish hujumchidan boshlanadi, himoyachi oxirgi oladi. Himoyachi olsa navbati o‘tkaziladi; yopa olsa keyingi hujum unga o‘tadi. Koloda tugagach qo‘li bo‘shaganlar chiqadi. Oxirgi kartali odam Durak; ikkala oxirgi qo‘l bir davrada bo‘shasa durang. Perevodnoy rejim yo‘q.

### Mafia

5–12 o‘yinchi. 5–6 o‘yinchida 1 Mafia, 7–8 da 2, 9–12 da 3. Har safar 1 Doktor va 1 Komissar, qolganlar Tinch aholi.

- Tun: Mafia nishon tanlaydi, Doktor bir kishini (o‘zini ham) qutqaradi, Komissar Mafia ekanligini maxfiy tekshiradi. Doktor bir odamni ketma-ket qutqarishi mumkin.
- Mafia sheriklarini biladi. Mafia nishonlari teng bo‘lsa o‘sha tunda qurbon bo‘lmaydi.
- Kunduz: tirik o‘yinchilar umumiy chatda yozadi. Hamma tayyor bo‘lsa yoki vaqt tugasa ovoz berishga o‘tiladi.
- Ovoz: eng ko‘p ovoz olgan yagona nomzod chiqariladi. Tenglik yoki **Ovoz bermaslik** ko‘pchilik bo‘lsa hech kim chiqarilmaydi. O‘ziga ovoz berilmaydi. Chiqqanlar faqat kuzatadi.
- Tun/muhokama/ovoz vaqt chegaralari: 60/60/45 soniya. Barcha zarur qarorlar kelganda bosqich muddatidan oldin yakunlanadi.
- Mafia qolmasa tinch aholi yutadi; Mafia soni qolganlar soniga tenglashsa yoki oshsa Mafia yutadi. Rollar faqat o‘yin tugagach hammaga ochiladi.

## AI arxitekturasi

AI qoidaviy bot; LLM yoki tashqi servis ishlatilmaydi. Maxfiy ma’lumotni strategiyada suiiste’mol qilmaydi: UNO faqat o‘z kartalari va raqib kartalari sonini, Durak o‘z qo‘li va ochiq stolni hisobga oladi. Mafia sheriklarini, Komissar esa o‘z tekshiruv natijalarini biladi.

| Daraja | UNO | Durak |
| --- | --- | --- |
| Easy | Mos kartadan tasodifiy tanlov | Ruxsat etilgan kartadan tasodifiy tanlov |
| Medium | Qo‘ldagi ko‘p rangni saqlab o‘ynash, yaqin g‘olibga jarima | Eng arzon karta bilan hujum/himoya |
| Hard | Rang va maxsus kartalar ustuvorligi, raqibning kam kartasiga javob | Qimmat kozirni erta sarflash o‘rniga ayrim hujumlarni olish |

Mafia botlari roli bo‘yicha tanlaydi, qisqa tayyor jumlalar bilan suhbatda qatnashadi. Komissar aniqlangan Mafiani ovoz bilan nishonga oladi; Mafia sheriklariga hujum qilmaydi. Tabiiy tilni chuqur tahlil qilish yoki inson darajasidagi aldash strategiyasi yo‘q. Mafia uchun Easy/Medium/Hard strategiyasi alohida emas.

```text
src/main.jsx           React ekranlari va Socket.IO mijoz
src/styles.css        Responsive dizayn, kartalar, stol, chat
server/app.js         Xonalar, sessiyalar, ruxsatlar, bot rejalashtiruvchi
server/index.js       HTTP serverni ishga tushirish
server/games/index.js O‘yin registri
server/games/common.js Umumiy tekshiruvlar va aralashtirish
server/games/uno.js   UNO qoidalari, private view va bot
server/games/durak.js Durak qoidalari, private view va bot
server/games/mafia.js Mafia qoidalari, private view, timer va bot
tests/                Qoidalar va real Socket.IO integratsion testlar
```

Yangi o‘yin `min`, `max`, `create(players)`, `act(state, playerId, action)`, `view(state, playerId)`, `bot(state, playerId, level)` metodlarini eksport qiladi. Ixtiyoriy `tick(state)` vaqtga bog‘liq o‘tishlarni bajaradi. Modulni registrga qo‘shing, keyin frontend katalogi va o‘yin oynasini ulang. `view` faqat o‘yinchiga ko‘rinishi mumkin bo‘lgan ma’lumotni qaytarishi shart. Bot ham odamlarga tegishli `act` tekshiruvlaridan o‘tadi.

Socket hodisalari: `room:create`, `room:join`, `room:bot`, `room:removeBot`, `room:start`, `room:reset`, `room:settings`, `room:leave`, `game:action`. Har biri `{ok, error?}` acknowledgement qaytaradi. Server `session` va har o‘yinchiga mos `room` snapshot yuboradi. Auth `socket.handshake.auth.token` orqali, token kriptografik tasodifiy va brauzerda saqlanadi.

## Tekshiruvlar

```sh
npm test
npm run build
```

Testlar maxsus kartalar, noto‘g‘ri yurishlar, karta maxfiyligi, qayta aralashtirish, kozir, podkidka, durang/durak, Mafia tekshiruvi/himoyasi/ovoz/timerini qamrab oladi. Har uch o‘yinda 12 tadan yakunigacha AI partiyasi o‘tkaziladi; kartali o‘yinlarda har yurishda yaratilgan karta to‘plamlariga mos UNO karta soni, 36 ta Durak kartasi va ID noyobligi tekshiriladi. Socket.IO testlari haqiqiy lokal mijozlar bilan xona, host huquqi, limit, yashirin qo‘l va qayta ulanishni tekshiradi.

## Hosting va cheklovlar

Internetga joylashtirish uchun `render.yaml` va [DEPLOY.md](DEPLOY.md) kiritilgan. Render Web Service mavjud React + Node.js + Socket.IO arxitekturasini bir HTTPS manzilda ishga tushiradi. Hosting akkauntlarini ulash va deploy tasdig‘i olinmaguncha sayt internetga chiqqan hisoblanmaydi.

Bu **bir Node.js jarayonli MVP**. Xonalar va sessiyalar RAMda, server qayta ishga tushsa yo‘qoladi. DB, akkaunt, matchmaking, reyting, audio/video chat va Redis klasteri hozir yo‘q. Internetdagi doimiy hosting ushbu topshirishda sozlanmagan; lokal ishga tushirish va manba kod taqdim etiladi.

WebSocket qo‘llaydigan Node.js hostingda build buyrug‘i `npm install && npm run build`, start `npm start`. `PORT` hosting tomonidan berilishi mumkin, `HOST` standart `0.0.0.0`. Bitta domen orqali frontend/backend tavsiya etiladi. Boshqa frontend origin ishlatsangiz `ALLOWED_ORIGINS=https://example.com` kabi aniq ro‘yxat va mijoz manzilini sozlang. `.env.example` namunasi bor; `.env` fayli avtomatik o‘qilmaydi, muhit o‘zgaruvchilarini hostingda belgilang yoki `node --env-file=.env server/index.js` ishlating.

HTTPS/WSS, reverse proxy WebSocket upgrade va uzoq ulanishlarni qo‘llashi kerak. Static-only hosting Node.js backendni ishga tushirmaydi. Keng ommaga ochishdan oldin sessiyalar/xonalar uchun doimiy saqlash, IP darajasida limit, monitoring, yuklama testi va bir nechta server uchun Redis adapter qo‘shing. Hozir socket boshiga 15 amal/soniya, 16 KB so‘rov, 500 xona va 5000 sessiya limiti mavjud; bu to‘liq DDoS himoyasi emas.

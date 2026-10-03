# DavRA’ni internetga chiqarish

Render uchun `render.yaml` tayyor. Frontend, Node.js server va Socket.IO bitta **Web Service** sifatida ishlaydi. Fayl bepul compute rejasini tanlaydi. Mavjud `pnpm-lock.yaml` orqali paketlar aniq versiyalarda o‘rnatiladi; frontend yig‘iladi va server ishga tushadi.

## Joylashtirish

1. Shu `game-room` papkasining tarkibini GitHub repository ildiziga saqlang. `node_modules`, `.env` va loglarni yuklamang. `.gitignore` allaqachon bor. Yashirin repository ham mumkin: Render unga kirish huquqiga ega bo‘lishi kerak.
2. Render’da **New → Blueprint** orqali repository’ni tanlang. `render.yaml` ildizda bo‘lsin. Qo‘lda yaratishda **Web Service** va **Free** tanlang; Static Site tanlanmaydi.
3. Build: `npx --yes pnpm@11.19.0 install --frozen-lockfile --prod=false && npx --yes pnpm@11.19.0 run build`
4. Start: `node server/index.js`. Health check: `/api/health`. Node version: `24`.
5. Deploy muvaffaqiyatli tugagach, Render bergan HTTPS manzilni oching. Do‘stlar ham aynan shu manzilga kirib, xona kodini yozadi.

`PORT` Render tomonidan beriladi, `HOST=0.0.0.0`. `RENDER_EXTERNAL_URL` serverda ruxsat etilgan origin sifatida avtomatik ishlatiladi. O‘z domeningizni ulasangiz, `ALLOWED_ORIGINS` muhit o‘zgaruvchisiga uning aniq HTTPS originini ham kiriting. Frontendda alohida server manzilini yozish kerak emas.

Kod yangilanganda qo‘lda **Deploy latest commit** ishga tushiriladi. Avtomatik deploy o‘chirilgan: har kod o‘zgarishi davom etayotgan o‘yinlarni uzmasligi uchun.

## Tekshirish

- HTTPS bosh sahifa ochiladi; `/api/health` `{ok:true}` qaytaradi.
- Ikki alohida brauzer/profilda xona yaratib, kod bilan qo‘shiling.
- UNO’da bot qo‘shing, ikki odam bilan boshlang va navbatlar bir xil ko‘rinishini tekshiring.
- Karta oling; yangi raqamli kartaga shu raqamli boshqa rangdagi kartani qo‘shib birga tashlang.
- Sahifani yangilang: server ishlayotgan bo‘lsa, joy va qo‘l tiklanadi.
- Durak va Mafia’da ham alohida partiya boshlang.

## Bepul rejaning amaliy cheklovlari

Render Free xizmati 15 daqiqa kiruvchi HTTP yoki WebSocket xabari bo‘lmasa uxlaydi. Keyingi kirishda uyg‘onish taxminan bir daqiqa olishi mumkin. Server qayta ishga tushsa, ushbu MVP’ning RAMdagi xonalari va sessiyalari yo‘qoladi. Bitta server nusxasi ishlating; umumiy xona saqlash tizimi qo‘shilmaguncha nusxalar sonini oshirmang.

Free compute umumiy trafik va build limitlariga bo‘ysunadi. Akkauntga to‘lov kartasi ulangan bo‘lsa, limitdan ortiq foydalanish pullik bo‘lishi mumkin. Doimiy hosting, xonalarni saqlash va yuklama uchun alohida reja keyingi bosqichda belgilanadi.

Rasmiy manbalar: [Render Web Services](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket), [Blueprint](https://render.com/docs/blueprint-spec), [Free](https://render.com/docs/free).

**Hozirgi holat:** hosting fayllari tayyor; ushbu hujjatning mavjudligi sayt deploy bo‘lganini anglatmaydi. GitHub/Render akkauntlarini ulash va muvaffaqiyatli deploy tasdig‘i kerak.

# CameraKit — AR/VR laboratoriya uchun kamera moduli

Telefonda **orqa kamera**, kompyuterda **veb-kamera**; kameralar ro'yxati va almashtirish; Three.js / A-Frame foni; qo'l kuzatuvi uchun tez kadr sikli; o'zbekcha xato xabarlari. Tashqi kutubxonaga bog'liq emas.

| Fayl | Nima uchun |
|---|---|
| `camera-kit.js` | ES-modul (`import { CameraManager } from './camera-kit.js'`) |
| `camera-kit.classic.js` | Oddiy `<script>` uchun — hammasi `window.CameraKit` ichida |
| `camera-demo.html` | Ishlaydigan namuna: Three.js sahnasi, kamera foni, 🔄 almashtirish, xatolar |

> ⚠️ Kamera faqat **https://** sahifada (yoki `http://localhost`da) ishlaydi. Faylni telefon xotirasidan (`file://`, `content://`) ochsangiz, brauzer kamerani bermaydi — GitHub Pages orqali oching.

---

## 1. Tez boshlash

```html
<video id="cam" playsinline muted></video>
<button id="go">📷 Kamerani yoqish</button>
<div id="switcher"></div>

<script type="module">
import { CameraManager, createCameraSwitcher } from './camera-kit.js';

const cam = new CameraManager({ video: document.getElementById('cam'), resolution: '720p' });

cam.addEventListener('error', e => alert(e.detail.error.uz + '\n' + e.detail.error.hint));
createCameraSwitcher(cam, document.getElementById('switcher'));   // 🔄 + kameralar ro'yxati

document.getElementById('go').onclick = () => cam.start();         // telefonda orqa, PC'da veb-kamera
</script>
```

`start()` ni **tugma bosilganda** chaqiring — iOS Safari va ba'zi Android brauzerlari shunda ishonchliroq ishlaydi.

---

## 2. Kamera qanday tanlanadi (fallback zanjiri)

**Telefon / planshet** (`facing: 'auto'` yoki `'environment'`):

1. oxirgi marta foydalanuvchi tanlagan kamera (`deviceId`, `localStorage`da saqlanadi);
2. `facingMode: { exact: "environment" }` + 720p;
3. `facingMode: "environment"` (ideal) + 720p;
4. `facingMode: "environment"` sifat talabisiz (ba'zi telefonlar HD + facingMode birga bo'lsa rad etadi);
5. istalgan kamera 720p → istalgan kamera.

Keyingi pog'onaga faqat «mos kelmadi / topilmadi / band» xatolarida o'tiladi. **Ruxsat rad etilsa — zanjir darhol to'xtaydi**, foydalanuvchidan qayta-qayta so'ralmaydi.

Ochilgandan keyin ikki qo'shimcha tekshiruv bor:
- brauzer orqa so'ralganda **old** kamerani bergan bo'lsa (ba'zi Android brauzerlari `facingMode`ni e'tiborsiz qoldiradi) — orqa kamera `deviceId` bilan qayta ochiladi;
- **ultra-wide / telefoto** linza berilgan bo'lsa — AR uchun asosiy keng burchakli orqa kameraga o'tiladi (ultra-wide chetlarda qiyshaytiradi, telefoto qo'lni sig'dirmaydi).

**Kompyuter**: `exact` ishlatilmaydi, shuning uchun «orqa kamera yo'q» xatosi bo'lmaydi — mavjud veb-kamera ochiladi. USB-kamera ulansa, ro'yxatda paydo bo'ladi (`devicechange` hodisasi).

Qurilma turi `detectDevice()` bilan aniqlanadi: `userAgentData.mobile`, UA, iPadOS (o'zini Mac deb ko'rsatadi, lekin sensorli) hisobga olinadi.

---

## 3. API

### `new CameraManager(options)`

| Parametr | Standart | Izoh |
|---|---|---|
| `video` | yashirin `<video>` | Oqim ulanadigan element |
| `facing` | `'auto'` | `'auto'` — telefonda orqa, PC'da old; yoki `'environment'` / `'user'` |
| `resolution` | `'720p'` | `'480p'` (qo'l kuzatuvi — eng tez), `'720p'` (tavsiya), `'1080p'` |
| `frameRate` | `30` | Faqat *ideal* — majburiy emas, xato chiqarmaydi |
| `remember` | `true` | Tanlangan kamerani eslab qolish |
| `pauseWhenHidden` | `true` | Boshqa varaqqa o'tganda kamerani bo'shatib, qaytganda yoqish |

| Metod / xususiyat | Nima qiladi |
|---|---|
| `await start({facing?, deviceId?, resolution?})` | Kamerani yoqadi, `info` qaytaradi |
| `stop()` / `destroy()` | O'chiradi (kamera chirog'i o'chadi) / hamma narsani tozalaydi |
| `await listCameras()` | `[{deviceId, name, facing, kind, active}]` — `name`: «Orqa kamera», «Orqa ultra-wide», «Old kamera», «Logitech BRIO»… |
| `await switchCamera(mode?)` | Telefonda old ↔ orqa, PC'da ro'yxat bo'yicha keyingisi |
| `await selectCamera(deviceId)` | Aniq kamera (ro'yxatdan tanlash uchun) |
| `await setResolution('480p')` | Oqimni qayta ochmasdan sifatni o'zgartirish |
| `await setTorch(true)` | Chiroq (faqat qo'llaydigan orqa kameralarda) |
| `releaseForXR()` | WebXR `immersive-ar` sessiyasidan oldin kamerani bo'shatish |
| `info` | `{name, facing, kind, width, height, aspect, frameRate, mirrored, strategy}` |
| `mirrored` | Old kamera → `true` (tasvirni ko'zgudek ko'rsatish kerak) |

**Hodisalar:** `start`, `stop`, `error` (`detail.error`), `devicechange` (`detail.cameras`), `ended` (kamera tizim tomonidan uzildi).

### Yordamchilar

- `checkSupport()` — so'rovsiz oldindan tekshirish (https, brauzer): `{ok, error}`.
- `getPermissionState()` — `'granted' | 'denied' | 'prompt' | 'unknown'`.
- `createCameraSwitcher(cam, mount, {showErrors})` — tayyor 🔄 tugma + ro'yxat (faqat 2+ kamera bo'lsa ko'rinadi).
- `createFrameLoop(video, onFrame, {maxFps})` — kadr sikli (6-bo'lim).
- `useCameraBackground(THREE, renderer, scene, cam)` va `fitTextureCover(...)` — Three.js foni (4-bo'lim).
- `registerAFrameComponent()` — A-Frame komponenti.

---

## 4. Three.js / A-Frame foni

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const bg = useCameraBackground(THREE, renderer, scene, cam);
// oyna o'lchami o'zgarganda:
renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); bg.update();
```

- Tasvir **cho'zilmaydi**: CSS `object-fit: cover` kabi — ortiqcha qismi kesiladi (16:9 kamera portret ekranda ham to'g'ri).
- Old kamerada tasvir avtomatik **ko'zgulanadi**; kamera almashganda va telefon burilganda (`video.resize`) qayta moslanadi.
- Rang to'g'ri: Three r152+ uchun `SRGBColorSpace`, eskilari uchun `sRGBEncoding`.

**A-Frame:**
```html
<script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
<script src="camera-kit.classic.js"></script>
<script>CameraKit.registerAFrameComponent();</script>
<a-scene camera-background="resolution: 720p; facing: auto"> … </a-scene>
```

### WebXR bilan muhim farq
- **«Sehrli oyna» AR** (oddiy sahifada kamera foni + 3D) — shu modul bilan ishlaydi, barcha telefon va kompyuterlarda.
- **`immersive-ar` sessiyasi** (ARCore/ARKit) — brauzer kamerani o'zi ko'rsatadi. Android'da kamera bitta, shuning uchun sessiyadan **oldin** `cam.releaseForXR()` chaqiring, `end` hodisasida esa `cam.start()` bilan qayta yoqing. A-Frame komponenti buni o'zi qiladi. iOS Safari hozircha `immersive-ar`ni qo'llamaydi — u yerda «sehrli oyna» rejimi ishlatiladi.

---

## 5. Qo'l kuzatuvi (MediaPipe) bilan

```js
import { HandLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const cam = new CameraManager({ resolution: '480p', frameRate: 30 });   // kuzatuv uchun 480p eng tez
await cam.start();
const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
const hands = await HandLandmarker.createFromOptions(fs, {
  baseOptions: { modelAssetPath: 'hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2
});

const loop = createFrameLoop(cam.video, (video, now) => {
  const r = hands.detectForVideo(video, now);
  for (const lm of r.landmarks) {
    const x = cam.mirrored ? 1 - lm[8].x : lm[8].x;   // old kamerada chap-o'ng almashadi
    // … ko'rsatkich barmoq uchi (x, lm[8].y) → 3D sahnaga
  }
}, { maxFps: 30 });
```

- `createFrameLoop` faqat **yangi** kadrlarni beradi (`requestVideoFrameCallback`), FPSni cheklaydi, model hali ishlayotgan bo'lsa kadrni **tashlab yuboradi** — UI qotmaydi. `loop.fps`, `loop.dropped` — kuzatish uchun.
- Orqa kamerada MediaPipe'ning «Left/Right» belgilari teskari bo'ladi — `cam.info.facing === 'environment'` bo'lsa almashtiring.

---

## 6. Xatolar

Har bir xato `CameraError`: `code` (dastur uchun), `uz` (nima bo'ldi), `hint` (nima qilish kerak).

| `code` | Sabab | Foydalanuvchiga |
|---|---|---|
| `INSECURE` | `http://`, `file://`, `content://` | https orqali oching |
| `NO_API` | Eski brauzer | Chrome/Edge/Firefox/Safari yangi versiyasi |
| `DENIED` | `NotAllowedError` | 🔒 belgisi → Kamera → Ruxsat berish |
| `DENIED_SYSTEM` | OS sozlamalarida yopiq (macOS/Windows) | Tizim sozlamalari → Maxfiylik → Kamera |
| `IN_APP` | Telegram/Instagram ichidagi brauzer | «Brauzerda ochish» |
| `NOT_FOUND` | Kamera yo'q | Kamerani ulang |
| `BUSY` | `NotReadableError` — boshqa ilova ishlatyapti | Zoom, Telegram va h.k.ni yoping |
| `OVERCONSTRAINED` | Sozlamalar mos kelmadi (zanjir oxirigacha) | Boshqa kamera / pastroq sifat |

---

## 7. Sinovdan o'tgan holatlar

Soxta kameralar bilan (Chromium, telefon va PC qurilma profillari) tekshirildi:

| Holat | Natija |
|---|---|
| Android: old + 2 ta orqa | Orqa kamera (`exact`), 🔄 old ↔ orqa, bir vaqtda bitta oqim |
| Android: `exact` xato beradi | `ideal` orqali orqa kamera |
| Android: `facingMode` e'tiborsiz | Old berildi → `deviceId` bilan orqaga o'tildi |
| iPhone: ruxsatgacha nomlar bo'sh, brauzer ultra-wide beradi | Asosiy «Back Camera»ga o'tildi |
| Telefon: HD qo'llanmaydi | Sifatsiz `facingMode` bilan orqa kamera (640×480) |
| Faqat old kamerali qurilma | Old kamera, ko'zgu yoqilgan, xato yo'q |
| Noutbuk veb-kamerasi | Ochildi, ko'zgu yoqilgan |
| PC: ichki + USB + OBS virtual | Ro'yxat: ichki, USB, virtual (oxirida); almashtirish ishlaydi |
| Ruxsat rad / tizimda yopiq / kamera yo'q / band / Telegram / http | Har biri o'z aniq xabari bilan, sahifa qotmaydi |
| Ketma-ket 3 ta `start()` | Faqat oxirgisi qoladi, qolganlari `ABORTED` |
| Varaq yashirildi → qaytildi | Kamera bo'shatildi → qayta yoqildi |

Haqiqiy telefon kamerasi va real MediaPipe bu muhitda sinalmagan — GitHub Pages'ga joylab, telefon va kompyuterda bir marta tekshirib ko'ring.

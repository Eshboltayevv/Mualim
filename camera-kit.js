/**
 * CameraKit — AR/VR va qo'l kuzatuvi (hand tracking) uchun kamera boshqaruvi.
 * ---------------------------------------------------------------------------
 *  • Telefon/planshetda birlamchi — ORQA kamera:
 *      facingMode {exact:"environment"} → facingMode "environment" → eng yaxshi orqa kamera (deviceId)
 *      → istalgan kamera. Har bir pog'onada faqat «kamera mos kelmadi» turidagi xatoda keyingisiga o'tiladi;
 *      ruxsat rad etilsa zanjir darhol to'xtaydi (foydalanuvchidan qayta-qayta so'ralmaydi).
 *  • Kompyuterda — mavjud veb-kamera (orqa kamera so'ralmaydi, shuning uchun xato ham bo'lmaydi).
 *  • Barcha kameralar ro'yxati (enumerateDevices), tomoni va turi (asosiy / ultra-wide / tele / USB) aniqlanadi,
 *    almashtirish (switch) va tanlash (select) uchun toza API.
 *  • Video → <video>, Three.js / A-Frame foniga «cover» moslash (cho'zilmaydi), old kamerada ko'zgu.
 *  • Kadr sikli: requestVideoFrameCallback, faqat yangi kadrlar, FPS cheklovi, band bo'lsa kadr tashlash.
 *  • Xatolar: o'zbekcha aniq xabar + nima qilish kerakligi (err.uz, err.hint, err.code).
 *
 * Bog'liqliklar: yo'q (Three.js / A-Frame ixtiyoriy, tashqaridan beriladi).
 * Brauzerlar: Chrome/Edge/Samsung Internet/Firefox (Android, Windows, macOS, Linux), Safari (iOS 14.3+, macOS).
 * Talab: sahifa https:// (yoki http://localhost) orqali ochilishi shart.
 */

/* ============================== 1. Qurilma va muhit ============================== */

const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

/** Qurilma turini aniqlaydi: telefon / planshet / kompyuter. */
export function detectDevice() {
  const uaData = typeof navigator !== 'undefined' && navigator.userAgentData;
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 1;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const iPadOS = /Macintosh/.test(UA) && touch;                          // iPadOS o'zini «Mac» deb ko'rsatadi
  const ios = /iPhone|iPad|iPod/.test(UA) || iPadOS;
  const android = /Android/i.test(UA);
  const phoneUA = /Mobi|iPhone|iPod|Android.+Mobile|Windows Phone|Opera Mini/i.test(UA);
  const tabletUA = /iPad|Tablet|Android(?!.*Mobile)|Silk|Kindle/i.test(UA) || iPadOS;
  let type = 'desktop';
  if ((uaData && uaData.mobile) || phoneUA) type = 'phone';
  else if (tabletUA || (touch && coarse && (ios || android))) type = 'tablet';
  return {
    type,
    isMobile: type !== 'desktop',                                        // orqa kamerasi bo'lishi kutiladigan qurilma
    ios, android,
    inApp: /FBAN|FBAV|Instagram|Telegram|Line\/|MicroMessenger|; wv\)/i.test(UA) // ilova ichidagi brauzer
  };
}

/** Kamera umuman ishlay oladigan muhitmi? (xatoni oldindan, so'rovsiz aniqlash) */
export function checkSupport() {
  if (typeof window === 'undefined') return fail('NO_WINDOW');
  const p = location.protocol, h = location.hostname;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h);
  if (!window.isSecureContext || /^(file|content|blob):$/.test(p) || (p === 'http:' && !local)) return fail('INSECURE');
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return fail('NO_API');
  return { ok: true };
  function fail(code) { return { ok: false, error: makeError(code) }; }
}

/** Ruxsat holati: 'granted' | 'denied' | 'prompt' | 'unknown' (Safari/Firefox ba'zan bilmaydi). */
export async function getPermissionState() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
    const r = await navigator.permissions.query({ name: 'camera' });
    return r.state || 'unknown';
  } catch (_) { return 'unknown'; }
}

/* ============================== 2. Xatolar ============================== */

const MESSAGES = {
  INSECURE: ['Kamera faqat xavfsiz (https://) sahifada ishlaydi.',
    'Sahifani GitHub Pages yoki boshqa https manzil orqali oching. Faylni telefon xotirasidan (file://, content://) ochganda brauzer kamerani bermaydi.'],
  NO_API: ['Bu brauzer kamerani qo\'llab-quvvatlamaydi.',
    'Chrome, Edge, Firefox yoki Safari\'ning yangi versiyasida oching.'],
  IN_APP: ['Ilova ichidagi brauzer (Telegram, Instagram va h.k.) kamerani bermadi.',
    'Havolani «Brauzerda ochish» orqali Chrome yoki Safari\'da oching.'],
  DENIED: ['Kameraga ruxsat berilmadi.',
    'Manzil satridagi 🔒 (yoki ⓘ) belgisini bosing → «Kamera» → «Ruxsat berish», so\'ng sahifani yangilang.'],
  DENIED_SYSTEM: ['Kamera tizim sozlamalarida yopilgan.',
    'Telefon/kompyuter sozlamalari → Maxfiylik → Kamera bo\'limida brauzerga ruxsat bering.'],
  NOT_FOUND: ['Kamera topilmadi.',
    'Qurilmada kamera borligini va ulanganini tekshiring (USB-kamerani qayta ulang).'],
  BUSY: ['Kamera boshqa ilova yoki boshqa oynada band.',
    'Zoom, Telegram, boshqa brauzer oynasi kabi kamerani ishlatayotgan dasturlarni yoping va qayta urinib ko\'ring.'],
  OVERCONSTRAINED: ['Tanlangan kamera so\'ralgan sozlamalarni qo\'llamaydi.',
    'Boshqa kamerani tanlang yoki pastroq sifat (720p/480p) bilan urinib ko\'ring.'],
  ABORTED: ['Kamerani ishga tushirish to\'xtatildi.', 'Qayta urinib ko\'ring.'],
  UNKNOWN: ['Kamerani ochib bo\'lmadi.', 'Sahifani yangilab, qayta urinib ko\'ring.'],
  NO_WINDOW: ['Brauzer muhiti topilmadi.', '']
};

/** CameraKit xatosi: code (dasturchi uchun), uz (foydalanuvchi uchun xabar), hint (nima qilish kerak). */
export class CameraError extends Error {
  constructor(code, cause) {
    const [uz, hint] = MESSAGES[code] || MESSAGES.UNKNOWN;
    super(uz);
    this.name = 'CameraError';
    this.code = code; this.uz = uz; this.hint = hint; this.cause = cause;
  }
}
function makeError(code, cause) { return new CameraError(code, cause); }

/** Brauzerning DOMException xatosini CameraError'ga aylantiradi. */
export function normalizeError(e) {
  if (e instanceof CameraError) return e;
  const n = e && e.name, m = String((e && e.message) || '');
  switch (n) {
    case 'NotAllowedError': case 'PermissionDeniedError':
      // macOS/Windows tizim darajasida yopilgan bo'lsa Chrome «Permission denied by system» deydi
      if (/system/i.test(m)) return makeError('DENIED_SYSTEM', e);
      return makeError(detectDevice().inApp ? 'IN_APP' : 'DENIED', e);
    case 'SecurityError': return makeError('INSECURE', e);
    case 'NotFoundError': case 'DevicesNotFoundError': return makeError('NOT_FOUND', e);
    case 'NotReadableError': case 'TrackStartError': return makeError('BUSY', e);
    case 'OverconstrainedError': case 'ConstraintNotSatisfiedError': return makeError('OVERCONSTRAINED', e);
    case 'AbortError': return makeError('ABORTED', e);
    case 'TypeError': return makeError('NO_API', e);
    default: return makeError('UNKNOWN', e);
  }
}
/** Bu xatoda keyingi (yumshoqroq) talab bilan qayta urinish mantiqiymi? */
const isRetryable = err => err.code === 'OVERCONSTRAINED' || err.code === 'NOT_FOUND' || err.code === 'BUSY' || err.code === 'ABORTED' || err.code === 'UNKNOWN';

/* ============================== 3. Kameralar ro'yxati ============================== */

export const RESOLUTIONS = {
  '480p': { width: 640, height: 480 },     // qo'l kuzatuvi uchun eng tez
  '720p': { width: 1280, height: 720 },    // AR fon + kuzatuv uchun muvozanat (tavsiya)
  '1080p': { width: 1920, height: 1080 }   // faqat fon sifati muhim bo'lsa
};

const RX = {
  back: /back|rear|environment|world|orqa|задн|тыл|arrière|trasera|rück|후면|背面|後/i,
  front: /front|user|facetime|selfie|фронт|передн|avant|frontal|vorder|전면|前/i,
  ultra: /ultra|0[.,]5|wide[\s-]?angle|широк/i,
  tele: /tele|zoom|телефото/i,
  aux: /depth|infrared|\bir\b|tof|macro|глубин/i,
  virtual: /virtual|obs|snap camera|manycam|xsplit|nvidia broadcast/i,
  multi: /dual|triple/i,
  usb: /usb|logitech|webcam|hd pro|c9\d\d|brio|razer|elgato/i
};

/**
 * Bitta kamerani tasniflaydi.
 * @returns {{deviceId:string,groupId:string,label:string,facing:'user'|'environment'|'unknown',kind:string,score:number}}
 */
function classify(dev, index, settingsByDevice) {
  const label = dev.label || '';
  const s = settingsByDevice[dev.deviceId];
  let facing = (s && s.facingMode) || 'unknown';
  if (Array.isArray(facing)) facing = facing[0] || 'unknown';
  if (facing === 'left' || facing === 'right') facing = 'environment';
  if (facing === 'unknown') facing = RX.back.test(label) ? 'environment' : RX.front.test(label) ? 'user' : 'unknown';
  let kind = 'main';
  if (RX.ultra.test(label)) kind = 'ultrawide';
  else if (RX.tele.test(label)) kind = 'tele';
  else if (RX.aux.test(label)) kind = 'aux';
  else if (RX.virtual.test(label)) kind = 'virtual';
  else if (RX.multi.test(label)) kind = 'multi';
  else if (RX.usb.test(label)) kind = 'usb';
  // Asosiy kamera birinchi: Android'da «camera2 0» odatda asosiy orqa, iOS'da «Back Camera» — oddiy keng burchakli
  const n = /camera2?\s*(\d+)/i.exec(label);
  const score = { main: 0, usb: 1, multi: 2, ultrawide: 3, tele: 4, virtual: 6, aux: 8 }[kind] * 10 + (n ? Math.min(+n[1], 9) : index % 10);
  return { deviceId: dev.deviceId, groupId: dev.groupId, label, facing, kind, score };
}

/** Kameralarga foydalanuvchiga tushunarli nom beradi: «Orqa kamera», «Orqa ultra-wide», «Old kamera», «USB kamera». */
function niceName(cam, i, dev) {
  const side = cam.facing === 'environment' ? 'Orqa' : cam.facing === 'user' ? 'Old' : '';
  const extra = { ultrawide: ' ultra-wide', tele: ' telefoto', aux: ' (yordamchi)', virtual: ' (virtual)', multi: ' (ko\'p linzali)' }[cam.kind] || '';
  if (side) return side + (extra || ' kamera');
  if (!dev.isMobile) return cam.label ? cam.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '') : 'Veb-kamera ' + (i + 1);
  return cam.label || 'Kamera ' + (i + 1);
}

/* ============================== 4. CameraManager ============================== */

const STORE_KEY = 'camerakit.lastDevice';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) { return null; } },
  set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (_) { /* yashirin rejim */ } }
};
const stopStream = s => { if (s) s.getTracks().forEach(t => { t.onended = null; try { t.stop(); } catch (_) {} }); };

/**
 * Kamera boshqaruvchisi.
 * Hodisalar (addEventListener): 'start' {info}, 'stop', 'error' {error}, 'devicechange' {cameras}, 'ended'.
 *
 * @example
 *   const cam = new CameraManager({ video: document.querySelector('video'), resolution: '720p' });
 *   cam.addEventListener('error', e => showMessage(e.detail.error.uz, e.detail.error.hint));
 *   await cam.start();           // telefonda orqa, kompyuterda veb-kamera
 *   await cam.switchCamera();    // keyingi kamera
 */
export class CameraManager extends EventTarget {
  /**
   * @param {object}  [o]
   * @param {HTMLVideoElement} [o.video]   oqim ulanadigan video (bo'lmasa yashirin video yaratiladi)
   * @param {'environment'|'user'|'auto'} [o.facing='auto']  auto: telefonda orqa, kompyuterda old/veb-kamera
   * @param {'480p'|'720p'|'1080p'} [o.resolution='720p']
   * @param {number}  [o.frameRate=30]     so'raladigan FPS (ideal; majburiy emas)
   * @param {boolean} [o.remember=true]    tanlangan kamerani eslab qolish (localStorage)
   * @param {boolean} [o.pauseWhenHidden=true] boshqa varaqqa o'tganda kamerani bo'shatish (batareya, maxfiylik)
   */
  constructor(o = {}) {
    super();
    this.opts = { facing: 'auto', resolution: '720p', frameRate: 30, remember: true, pauseWhenHidden: true, ...o };
    this.device = detectDevice();
    this.video = o.video || createHiddenVideo();
    this.stream = null;
    this.info = null;            // {deviceId,label,name,facing,kind,width,height,frameRate,mirrored}
    this.cameras = [];           // listCameras() natijasi
    this._token = 0;             // eski (bekor qilingan) so'rovlarni tanish uchun
    this._busy = null;
    this._settings = {};         // deviceId → oxirgi ma'lum sozlamalar (facingMode)
    this._wasRunning = false;
    this._onDeviceChange = () => this.listCameras().then(c => this._emit('devicechange', { cameras: c })).catch(() => {});
    this._onVisibility = () => this._handleVisibility();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', this._onDeviceChange);
    if (this.opts.pauseWhenHidden) document.addEventListener('visibilitychange', this._onVisibility);
  }

  get active() { return !!(this.stream && this.stream.active); }
  /** Oldingi kamera tasvirini ko'zgudek ko'rsatish kerakmi (old kamera va kompyuter veb-kamerasi). */
  get mirrored() { return !!(this.info && this.info.mirrored); }

  /** Kerakli tomon: 'auto' telefonda orqa, kompyuterda old. */
  resolveFacing(f = this.opts.facing) {
    if (f === 'environment' || f === 'user') return f;
    return this.device.isMobile ? 'environment' : 'user';
  }

  /**
   * Kamerani ishga tushiradi.
   * @param {object} [o]  {facing, deviceId, resolution, frameRate} — bir martalik o'zgartirishlar
   * @returns {Promise<object>} this.info
   */
  async start(o = {}) {
    const sup = checkSupport();
    if (!sup.ok) return this._fail(sup.error);
    const token = ++this._token;
    const facing = this.resolveFacing(o.facing);
    const res = RESOLUTIONS[o.resolution || this.opts.resolution] || RESOLUTIONS['720p'];
    const fps = o.frameRate || this.opts.frameRate;
    const remembered = this.opts.remember && !o.facing && !o.deviceId ? store.get() : null;
    const deviceId = o.deviceId || (remembered && remembered.deviceId) || null;

    // Telefonda bir vaqtda ikki kamera ochib bo'lmaydi — avval eskisini yopamiz
    const previous = this.info;
    this._release();

    const attempts = this._buildAttempts({ facing, deviceId, res, fps });
    let lastErr = null, stream = null, used = null;
    for (const a of attempts) {
      if (token !== this._token) return this._fail(makeError('ABORTED'), true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: a.video });
        used = a; break;
      } catch (e) {
        lastErr = normalizeError(e);
        if (!isRetryable(lastErr)) break;                // ruxsat yo'q / xavfsiz emas — boshqa urinish befoyda
      }
    }
    if (!stream) {
      // yangi kamera ochilmasa — avvalgisiga qaytishga urinamiz (foydalanuvchi kamerasiz qolmasin)
      if (previous && o.deviceId && previous.deviceId !== o.deviceId && lastErr && isRetryable(lastErr)) {
        try { await this.start({ deviceId: previous.deviceId }); } catch (_) {}
        if (this.active) { this._emit('error', { error: lastErr }); throw lastErr; }
      }
      return this._fail(lastErr || makeError('NOT_FOUND'));
    }
    if (token !== this._token) { stopStream(stream); return this._fail(makeError('ABORTED'), true); }

    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    await this.listCameras().catch(() => {});           // ruxsatdan keyin nomlar (label) paydo bo'ladi

    // Telefonda orqa so'ralgan-u, old kamera berilgan bo'lsa (ba'zi Android brauzerlari) — orqani deviceId bilan ochamiz
    const got = this._describe(track);
    if (facing === 'environment' && this.device.isMobile && got.facing === 'user' && !deviceId && !o._retried) {
      const back = this.cameras.find(c => c.facing === 'environment');
      if (back) return this.start({ ...o, deviceId: back.deviceId, _retried: true }).catch(() => this.start({ ...o, facing: 'user', _retried: true }));
    }
    // Brauzer ultra-wide / telefoto / chuqurlik linzasini bergan bo'lsa — AR uchun asosiy (keng) orqa kameraga o'tamiz:
    // ultra-wide chetlarda qiyshaytiradi, telefoto esa qo'lni sig'dirmaydi
    if (facing === 'environment' && this.device.isMobile && !deviceId && !o._retried && /^(ultrawide|tele|aux)$/.test(got.kind)) {
      const main = this.cameras.find(c => c.facing === 'environment' && (c.kind === 'main' || c.kind === 'multi') && c.deviceId);
      if (main && main.deviceId !== got.deviceId) return this.start({ ...o, deviceId: main.deviceId, _retried: true });
    }

    track.onended = () => { this._emit('ended'); this.stop(); };
    await attachStream(this.video, stream, got.mirrored);
    if (token !== this._token) { stopStream(stream); return this._fail(makeError('ABORTED'), true); }
    this.info = { ...got, ...readVideoSize(this.video, track), strategy: used.name };
    if (this.opts.remember && o.deviceId && !o._retried) store.set({ deviceId: this.info.deviceId, facing: this.info.facing });
    this._emit('start', { info: this.info });
    return this.info;
  }

  /** Kamerani to'xtatadi va qurilmani bo'shatadi (kamera chirog'i o'chadi). */
  stop() {
    this._token++;
    const was = this.active;
    this._release();
    this.info = null;
    if (was) this._emit('stop');
  }

  /** Barcha resurslarni tozalaydi (sahifadan chiqishda). */
  destroy() {
    this.stop();
    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) navigator.mediaDevices.removeEventListener('devicechange', this._onDeviceChange);
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this.video && this.video.dataset.camerakit === 'hidden') this.video.remove();
  }

  /**
   * Mavjud kameralar ro'yxati. Ruxsatdan oldin nomlar bo'sh bo'lishi mumkin — start()dan keyin to'liq bo'ladi.
   * @returns {Promise<Array<{deviceId,label,name,facing,kind,active}>>}
   */
  async listCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return (this.cameras = []);
    const all = await navigator.mediaDevices.enumerateDevices();
    const vids = all.filter(d => d.kind === 'videoinput');
    const cur = this.stream && this.stream.getVideoTracks()[0];
    if (cur) { const s = safeSettings(cur); if (s.deviceId) this._settings[s.deviceId] = s; }
    const list = vids.map((d, i) => classify(d, i, this._settings));
    // tartib: telefonda — orqa (asosiy birinchi), keyin old; kompyuterda — tizim tartibi, virtual oxirida
    const sideRank = c => this.device.isMobile ? (c.facing === 'environment' ? 0 : c.facing === 'unknown' ? 1 : 2) : 0;
    list.sort((a, b) => sideRank(a) - sideRank(b) || a.score - b.score);
    const activeId = cur && safeSettings(cur).deviceId;
    this.cameras = list.map((c, i) => ({ ...c, name: niceName(c, i, this.device), active: !!activeId && c.deviceId === activeId }));
    // bir xil nomlarni raqamlaymiz: «Orqa kamera 2»
    const seen = {};
    this.cameras.forEach(c => { seen[c.name] = (seen[c.name] || 0) + 1; if (seen[c.name] > 1) c.name += ' ' + seen[c.name]; });
    return this.cameras;
  }

  /** Bir nechta kamera bormi (almashtirish tugmasini ko'rsatish uchun). */
  async hasMultipleCameras() { return (await this.listCameras()).filter(c => c.kind !== 'aux').length > 1; }

  /**
   * Keyingi kameraga o'tadi.
   * mode 'facing' — old ↔ orqa (telefon uchun qulay), 'cycle' — ro'yxatdagi barcha kameralar bo'yicha.
   */
  async switchCamera(mode = this.device.isMobile ? 'facing' : 'cycle') {
    await this.listCameras();
    const usable = this.cameras.filter(c => c.kind !== 'aux');
    if (usable.length < 2) return this.info;
    const cur = this.info;
    if (mode === 'facing' && cur && cur.facing !== 'unknown') {
      const want = cur.facing === 'environment' ? 'user' : 'environment';
      const target = usable.find(c => c.facing === want);
      if (target) return this.selectCamera(target.deviceId);
    }
    const i = cur ? usable.findIndex(c => c.deviceId === cur.deviceId) : -1;
    return this.selectCamera(usable[(i + 1) % usable.length].deviceId);
  }

  /** Aniq kamerani tanlaydi (UI ro'yxatidan). */
  selectCamera(deviceId) { return this.start({ deviceId }); }

  /** Sifatni o'zgartiradi (oqimni qayta ochmasdan, iloji bo'lsa). */
  async setResolution(name) {
    const r = RESOLUTIONS[name]; if (!r) return this.info;
    this.opts.resolution = name;
    const t = this.stream && this.stream.getVideoTracks()[0];
    if (!t) return this.info;
    try { await t.applyConstraints({ width: { ideal: r.width }, height: { ideal: r.height }, frameRate: { ideal: this.opts.frameRate } }); }
    catch (_) { return this.start({ deviceId: this.info && this.info.deviceId }); }
    await waitFrame(this.video);
    Object.assign(this.info, readVideoSize(this.video, t));
    this._emit('start', { info: this.info });
    return this.info;
  }

  /** Chiroq (torch) — faqat qo'llaydigan orqa kameralarda (Android Chrome). */
  async setTorch(on) {
    const t = this.stream && this.stream.getVideoTracks()[0];
    const caps = t && t.getCapabilities ? t.getCapabilities() : {};
    if (!caps.torch) return false;
    try { await t.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (_) { return false; }
  }

  /**
   * WebXR immersive-ar sessiyasidan OLDIN chaqiring: Android'da kamera bitta — XR uni o'zi ishlatadi.
   * Sessiya tugagach cam.start() bilan qaytadan yoqing.
   */
  releaseForXR() { this.stop(); }

  /* ---------- ichki ---------- */

  _buildAttempts({ facing, deviceId, res, fps }) {
    const base = { width: { ideal: res.width }, height: { ideal: res.height }, frameRate: { ideal: fps } };   // faqat «ideal» — majburiy talab OverconstrainedError'ga olib kelmasin
    const A = [];
    if (deviceId) A.push({ name: 'deviceId', video: { ...base, deviceId: { exact: deviceId } } });
    if (this.device.isMobile) {
      A.push({ name: 'exact-' + facing, video: { ...base, facingMode: { exact: facing } } });
      A.push({ name: 'ideal-' + facing, video: { ...base, facingMode: facing } });
      // ba'zi telefonlarda yuqori sifat + facingMode birga mos kelmaydi — sifatsiz urinamiz
      A.push({ name: 'facing-only', video: { facingMode: facing } });
    } else {
      // kompyuter: «orqa» so'ralsa ham ideal (exact emas) — veb-kamera baribir ochiladi
      A.push({ name: 'desktop', video: facing === 'environment' ? { ...base, facingMode: 'environment' } : base });
    }
    A.push({ name: 'any-hd', video: base });
    A.push({ name: 'any', video: true });               // eng oxirgi chora: istalgan kamera
    return A;
  }

  _describe(track) {
    const s = safeSettings(track);
    if (s.deviceId) this._settings[s.deviceId] = s;
    const cam = this.cameras.find(c => c.deviceId === s.deviceId);
    let facing = s.facingMode || (cam && cam.facing) || 'unknown';
    if (facing === 'left' || facing === 'right') facing = 'environment';
    if (facing === 'unknown') {
      const l = track.label || '';
      facing = RX.back.test(l) ? 'environment' : RX.front.test(l) ? 'user' : this.device.isMobile ? 'unknown' : 'user';
    }
    return {
      deviceId: s.deviceId || (cam && cam.deviceId) || '',
      label: track.label || (cam && cam.label) || '',
      name: cam ? cam.name : (facing === 'environment' ? 'Orqa kamera' : facing === 'user' ? 'Old kamera' : 'Kamera'),
      facing, kind: cam ? cam.kind : 'main',
      mirrored: facing === 'user'                       // old kamera ko'zgudek ko'rsatiladi (tabiiy his)
    };
  }

  _release() {
    stopStream(this.stream);
    this.stream = null;
    if (this.video) { try { this.video.pause(); } catch (_) {} this.video.srcObject = null; }
  }

  _handleVisibility() {
    if (document.hidden) {
      if (this.active) { this._wasRunning = this.info && this.info.deviceId; this.stop(); }
    } else if (this._wasRunning) {
      const id = this._wasRunning; this._wasRunning = false;
      this.start({ deviceId: id }).catch(() => {});
    }
  }

  _fail(err, silent) { if (!silent) this._emit('error', { error: err }); throw err; }
  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

/* ============================== 5. Video yordamchilari ============================== */

function createHiddenVideo() {
  const v = document.createElement('video');
  v.dataset.camerakit = 'hidden';
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText = 'position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(v);
  return v;
}

function safeSettings(t) { try { return t.getSettings ? t.getSettings() : {}; } catch (_) { return {}; } }

function readVideoSize(video, track) {
  const s = safeSettings(track);
  const width = video.videoWidth || s.width || 0, height = video.videoHeight || s.height || 0;
  return { width, height, aspect: width && height ? width / height : 4 / 3, frameRate: s.frameRate ? Math.round(s.frameRate) : null };
}

function waitFrame(video, ms = 3000) {
  return new Promise(res => {
    if (video.readyState >= 2 && video.videoWidth) return res();
    const done = () => { clearTimeout(t); video.removeEventListener('loadeddata', done); video.removeEventListener('resize', done); res(); };
    const t = setTimeout(done, ms);
    video.addEventListener('loadeddata', done); video.addEventListener('resize', done);
  });
}

/**
 * Oqimni <video>ga ulaydi. iOS Safari uchun muted + playsinline majburiy.
 * mirrored — faqat ko'rinish uchun (CSS), kadr tahliliga ta'sir qilmaydi.
 */
export async function attachStream(video, stream, mirrored = false) {
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.setAttribute('muted', '');
  video.autoplay = true;
  video.srcObject = stream;
  if (video.dataset.camerakit !== 'hidden') video.style.transform = mirrored ? 'scaleX(-1)' : '';
  try { await Promise.race([video.play(), new Promise(r => setTimeout(r, 1500))]); } catch (_) { /* avtoijro bloki — kadrlar baribir keladi */ }
  await waitFrame(video);
}

/* ============================== 6. Kadr sikli (hand tracking uchun) ============================== */

/**
 * Har bir YANGI video kadrda onFrame chaqiriladi. FPS cheklanadi, onFrame tugamaguncha keyingi kadr tashlanadi
 * (backpressure) — model sekin bo'lsa ham UI qotmaydi. Sahifa yashirin bo'lsa to'xtaydi.
 *
 * @param {HTMLVideoElement} video
 * @param {(video:HTMLVideoElement, nowMs:number, meta:object)=>void|Promise<void>} onFrame
 * @param {{maxFps?:number}} [o]
 * @returns {{stop:()=>void, readonly fps:number, readonly dropped:number}}
 */
export function createFrameLoop(video, onFrame, o = {}) {
  const minGap = 1000 / (o.maxFps || 30) - 2;
  let running = true, busy = false, last = -1, lastT = 0, handle = 0, fps = 0, dropped = 0, n = 0, t0 = performance.now();
  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const schedule = () => { if (!running) return; handle = rvfc ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick); };
  function tick(now, meta) {
    if (!running) return;
    const mt = meta && meta.mediaTime != null ? meta.mediaTime : video.currentTime;
    const fresh = mt !== last && video.readyState >= 2 && !document.hidden;
    if (fresh && now - lastT >= minGap) {
      if (busy) dropped++;
      else {
        last = mt; lastT = now; busy = true; n++;
        if (now - t0 >= 1000) { fps = Math.round(n * 1000 / (now - t0)); n = 0; t0 = now; }
        let r;
        try { r = onFrame(video, now, meta || {}); } catch (e) { console.warn('[CameraKit] onFrame:', e); }
        if (r && typeof r.then === 'function') r.catch(e => console.warn('[CameraKit] onFrame:', e)).finally(() => { busy = false; });
        else busy = false;
      }
    }
    schedule();
  }
  schedule();
  return {
    stop() { running = false; try { rvfc ? video.cancelVideoFrameCallback(handle) : cancelAnimationFrame(handle); } catch (_) {} },
    get fps() { return fps; },
    get dropped() { return dropped; }
  };
}

/* ============================== 7. Three.js / A-Frame foni ============================== */

/**
 * Teksturani «object-fit: cover» kabi moslaydi (cho'zilmaydi, ortiqchasi kesiladi) va kerak bo'lsa ko'zgulaydi.
 * scene.background uchun ham, to'liq ekran tekislik uchun ham ishlaydi (Three r128+).
 */
export function fitTextureCover(texture, videoAspect, viewAspect, mirrored = false) {
  let rx = 1, ry = 1;
  if (videoAspect > viewAspect) rx = viewAspect / videoAspect; else ry = videoAspect / viewAspect;
  let ox = (1 - rx) / 2; const oy = (1 - ry) / 2;
  if (mirrored) { ox = ox + rx; rx = -rx; }
  texture.repeat.set(rx, ry); texture.offset.set(ox, oy);
  texture.matrixAutoUpdate = true;
  texture.needsUpdate = true;
}

/**
 * Kamera tasvirini Three.js sahna foniga qo'yadi (AR «sehrli oyna» rejimi).
 * @param {object} THREE      Three.js moduli (yoki AFRAME.THREE)
 * @param {object} renderer   THREE.WebGLRenderer
 * @param {object} scene      THREE.Scene
 * @param {CameraManager} cam
 * @returns {{texture, update:()=>void, dispose:()=>void}}
 */
export function useCameraBackground(THREE, renderer, scene, cam) {
  const tex = new THREE.VideoTexture(cam.video);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;   // r152+
  else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;           // eski versiyalar
  const prev = scene.background;
  scene.background = tex;
  const update = () => {
    const c = renderer.domElement;
    const va = cam.video.videoWidth && cam.video.videoHeight ? cam.video.videoWidth / cam.video.videoHeight : 4 / 3;
    fitTextureCover(tex, va, (c.clientWidth || c.width) / Math.max(1, c.clientHeight || c.height), cam.mirrored);
  };
  const onStart = () => update();
  cam.addEventListener('start', onStart);
  cam.video.addEventListener('resize', update);         // telefon burilganda video o'lchami o'zgaradi
  window.addEventListener('resize', update);
  update();
  return {
    texture: tex, update,
    dispose() {
      cam.removeEventListener('start', onStart); cam.video.removeEventListener('resize', update); window.removeEventListener('resize', update);
      if (scene.background === tex) scene.background = prev || null;
      tex.dispose();
    }
  };
}

/** A-Frame komponenti: <a-scene camera-background="resolution: 720p; facing: auto"> */
export function registerAFrameComponent(AFRAME = globalThis.AFRAME) {
  if (!AFRAME || AFRAME.components['camera-background']) return;
  AFRAME.registerComponent('camera-background', {
    schema: { resolution: { default: '720p' }, facing: { default: 'auto' } },
    init() {
      this.cam = new CameraManager({ resolution: this.data.resolution, facing: this.data.facing });
      const go = () => {
        this.bg = useCameraBackground(AFRAME.THREE, this.el.renderer, this.el.object3D, this.cam);
        this.cam.start().catch(e => this.el.emit('camera-error', { error: e }));
      };
      this.el.hasLoaded ? go() : this.el.addEventListener('loaded', go, { once: true });
      // immersive-ar boshlanganda kamerani XR'ga bo'shatamiz, tugaganda qaytaramiz
      this.el.addEventListener('enter-vr', () => { if (this.el.is('ar-mode')) this.cam.releaseForXR(); });
      this.el.addEventListener('exit-vr', () => { if (!this.cam.active) this.cam.start().catch(() => {}); });
    },
    remove() { if (this.bg) this.bg.dispose(); this.cam.destroy(); }
  });
}

/* ============================== 8. Kamera tanlash UI (ixtiyoriy) ============================== */

/**
 * Tayyor, kichik boshqaruv paneli: 🔄 almashtirish tugmasi + kameralar ro'yxati + xabar qatori.
 * Uslub CSS o'zgaruvchilari bilan o'zgartiriladi; panelni istalgan joyga qo'yish mumkin.
 * @param {CameraManager} cam
 * @param {HTMLElement} mount
 * @param {{showErrors?:boolean}} [o]  showErrors:false — xatolarni o'zingiz ko'rsatsangiz (takrorlanmasin)
 * @returns {{el:HTMLElement, refresh:()=>Promise<void>, destroy:()=>void}}
 */
export function createCameraSwitcher(cam, mount, o = {}) {
  const showErrors = o.showErrors !== false;
  injectSwitcherCss();
  const el = document.createElement('div');
  el.className = 'ck-switch';
  el.innerHTML =
    '<button type="button" class="ck-btn" data-ck="flip" aria-label="Kamerani almashtirish" title="Kamerani almashtirish">🔄</button>' +
    '<label class="ck-sel"><span class="ck-vh">Kamera</span><select data-ck="list" aria-label="Kamerani tanlash"></select></label>' +
    '<p class="ck-msg" role="status" aria-live="polite" hidden></p>';
  mount.appendChild(el);
  const btn = el.querySelector('[data-ck=flip]'), sel = el.querySelector('[data-ck=list]'), msg = el.querySelector('.ck-msg');

  const setBusy = b => { btn.disabled = b; sel.disabled = b; el.classList.toggle('ck-busy', b); };
  const say = (t, kind) => { msg.hidden = !t; msg.textContent = t || ''; msg.dataset.kind = kind || ''; };
  const run = async fn => { setBusy(true); say(''); try { await fn(); } catch (e) { if (showErrors) say(e.uz ? e.uz + ' ' + (e.hint || '') : String(e), 'err'); } finally { setBusy(false); refresh(); } };

  async function refresh() {
    const list = await cam.listCameras().catch(() => []);
    const usable = list.filter(c => c.kind !== 'aux');
    sel.innerHTML = '';
    usable.forEach(c => { const o = document.createElement('option'); o.value = c.deviceId; o.textContent = c.name; o.selected = !!(cam.info && cam.info.deviceId === c.deviceId); sel.appendChild(o); });
    const many = cam.active && usable.length > 1 && usable.every(c => c.deviceId);   // faqat kamera ishlayotganda; ruxsatdan oldin deviceId bo'sh bo'ladi
    btn.hidden = !many; sel.parentElement.hidden = !many;
  }
  btn.addEventListener('click', () => run(() => cam.switchCamera()));
  sel.addEventListener('change', () => run(() => cam.selectCamera(sel.value)));
  const onErr = e => showErrors && say(e.detail.error.uz + ' ' + (e.detail.error.hint || ''), 'err');
  const onStart = () => { say(''); refresh(); };
  cam.addEventListener('error', onErr); cam.addEventListener('start', onStart); cam.addEventListener('stop', refresh); cam.addEventListener('devicechange', refresh);
  refresh();
  return {
    el, refresh,
    destroy() { cam.removeEventListener('error', onErr); cam.removeEventListener('start', onStart); cam.removeEventListener('stop', refresh); cam.removeEventListener('devicechange', refresh); el.remove(); }
  };
}

function injectSwitcherCss() {
  if (document.getElementById('ck-css')) return;
  const s = document.createElement('style'); s.id = 'ck-css';
  s.textContent = `
.ck-switch{--ck-bg:rgba(12,20,40,.78);--ck-fg:#f1f5ff;--ck-ac:#38bdf8;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:600 14px/1.3 system-ui,sans-serif;color:var(--ck-fg)}
.ck-btn{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:var(--ck-bg);color:var(--ck-fg);font-size:20px;cursor:pointer;backdrop-filter:blur(8px);transition:transform .25s}
.ck-btn:hover{border-color:var(--ck-ac)}.ck-btn:active{transform:rotate(180deg)}.ck-btn:disabled{opacity:.5;cursor:progress}
.ck-sel select{height:44px;max-width:220px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:var(--ck-bg);color:var(--ck-fg);padding:0 10px;font:inherit}
.ck-btn:focus-visible,.ck-sel select:focus-visible{outline:3px solid var(--ck-ac);outline-offset:2px}
.ck-msg{flex-basis:100%;margin:0;padding:8px 12px;border-radius:12px;background:var(--ck-bg)}.ck-msg[data-kind=err]{background:rgba(185,28,28,.85)}
.ck-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.ck-switch [hidden],.ck-switch[hidden]{display:none!important}`;
  document.head.appendChild(s);
}

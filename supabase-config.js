const SUPABASE_URL = "https://qnrwkdmonqdqvbzpkczn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vk1cjiFT2qdZ9_JPWx_8bg_ZsqmJwTZ";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// UUID generator
window.genUUID = function () {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Telefon raqamini tozalash (hash yoki login belgilaridan xoli qilish)
window.cleanPhone = function (val) {
  if (!val || typeof val !== 'string') return '';
  var s = val.trim();
  // Parol heshlari (p:..., c:...) yoki ichki identifikatorlarni butunlay tozalash
  if (/^[pc]:/i.test(s) || /^[0-9a-f]{32,}$/i.test(s)) return '';
  // Faqat raqamlar va oldidagi + belgisini qoldirish
  var hasPlus = s.startsWith('+');
  var digits = s.replace(/\D/g, '');
  if (digits.length < 7) return '';
  if (hasPlus) return '+' + digits;
  if (digits.length === 9) return '+998' + digits;
  if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
  return '+' + digits;
};

// O'quvchi ma'lumotlarini olish (barcha saqlash joylaridan xavfsiz va to'liq birlashtirish)
window.getStudent = function () {
  try {
    var raw = localStorage.getItem("currentStudent") || localStorage.getItem("emaktab_student") || localStorage.getItem("muallim_profile");
    var st = raw ? JSON.parse(raw) : null;
    var pn = null;
    try {
      pn = localStorage.getItem("pn") ? JSON.parse(localStorage.getItem("pn")) : null;
    } catch (e) {
      pn = localStorage.getItem("pn");
    }
    var pfs = null;
    try {
      pfs = localStorage.getItem("pfs") ? JSON.parse(localStorage.getItem("pfs")) : null;
    } catch (e) {}

    if (pfs && pn && pfs[pn]) {
      var p = pfs[pn];
      st = Object.assign({}, st || {}, {
        id: (st && st.id) ? st.id : window.genUUID(),
        full_name: (st && st.full_name) || pn,
        student_name: (st && st.student_name) || pn,
        avatar: (st && st.avatar) || p.av || '🧑‍🎓',
        grade: (st && st.grade) || p.cls || '7-sinf',
        school: (st && st.school) || p.sch || '',
        region: (st && st.region) || p.vil || '',
        district: (st && st.district) || p.tum || '',
        teacher_name: (st && st.teacher_name) || p.ust || '',
        school_address: (st && st.school_address) || p.adr || '',
        coordinates: (st && st.coordinates) || (p.loc ? (p.loc.lat + ', ' + p.loc.lng) : ''),
        phone: window.cleanPhone((st && st.phone) || p.phone || '')
      });
    }

    if (st) {
      var fullName = (st.full_name || st.student_name || [st.first_name, st.last_name].filter(Boolean).join(" ") || "").trim();
      if (!fullName && pn) fullName = String(pn).trim();
      if (fullName) {
        st.full_name = fullName;
        st.student_name = fullName;
        var parts = fullName.split(/\s+/);
        st.first_name = st.first_name || parts[0] || fullName;
        st.last_name = st.last_name || parts.slice(1).join(" ") || "";
      }
      st.phone = window.cleanPhone(st.phone);
      if (!st.id) st.id = window.genUUID();
      if (!st.avatar) st.avatar = '🧑‍🎓';
      if (!st.grade) st.grade = '7-sinf';
      delete st.ph;
      delete st.sl;
      delete st.password;
    }
    return st;
  } catch (err) {
    return null;
  }
};

window.saveStudent = function (obj) {
  try {
    if (!obj || typeof obj !== 'object') return;
    var fullName = (obj.full_name || obj.student_name || [obj.first_name, obj.last_name].filter(Boolean).join(" ") || "").trim();
    var parts = fullName.split(/\s+/);
    var first = obj.first_name || parts[0] || fullName;
    var last = obj.last_name || parts.slice(1).join(" ") || "";
    var cleanPh = window.cleanPhone(obj.phone);
    var coordStr = "";
    if (obj.coordinates) {
      coordStr = typeof obj.coordinates === 'object' ? (obj.coordinates.lat + ', ' + obj.coordinates.lng) : String(obj.coordinates);
    } else if (obj.loc) {
      coordStr = typeof obj.loc === 'object' ? (obj.loc.lat + ', ' + obj.loc.lng) : String(obj.loc);
    }

    var st = Object.assign({}, obj, {
      id: obj.id || window.genUUID(),
      full_name: fullName,
      student_name: fullName,
      first_name: first,
      last_name: last,
      phone: cleanPh,
      avatar: obj.avatar || obj.av || '🧑‍🎓',
      grade: obj.grade || obj.cls || '7-sinf',
      school: obj.school || obj.sch || '',
      region: obj.region || obj.vil || '',
      district: obj.district || obj.tum || '',
      teacher_name: obj.teacher_name || obj.ust || '',
      school_address: obj.school_address || obj.adr || '',
      coordinates: coordStr,
      current_topic: obj.current_topic || '7-sinf 1-mavzu',
      last_active: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    });

    delete st.ph;
    delete st.sl;
    delete st.password;
    delete st.login;

    var json = JSON.stringify(st);
    localStorage.setItem("currentStudent", json);
    localStorage.setItem("emaktab_student", json);
    localStorage.setItem("muallim_profile", json);

    if (fullName) {
      localStorage.setItem("pn", JSON.stringify(fullName));
      try {
        var rawPfs = localStorage.getItem("pfs");
        var pfs = rawPfs ? JSON.parse(rawPfs) : {};
        pfs[fullName] = Object.assign(pfs[fullName] || {}, {
          av: st.avatar,
          cls: st.grade,
          sch: st.school,
          vil: st.region,
          tum: st.district,
          ust: st.teacher_name,
          adr: st.school_address,
          phone: cleanPh,
          cr: (pfs[fullName] && pfs[fullName].cr) || new Date().toISOString().slice(0, 10),
          days: (pfs[fullName] && pfs[fullName].days) || [new Date().toISOString().slice(0, 10)]
        });
        delete pfs[fullName].ph;
        delete pfs[fullName].sl;
        delete pfs[fullName].lg;
        localStorage.setItem("pfs", JSON.stringify(pfs));
      } catch (ePfs) {}
    }
  } catch (e) {}
};

// Supabase clientiga qo'shimcha boyitish qatlami
function hookClient(client) {
  if (!client || client.__emaktab_hooked__) return client;
  client.__emaktab_hooked__ = true;

  var origFrom = client.from.bind(client);
  client.from = function (table) {
    var query = origFrom(table);
    if (table === 'test_results') {
      var origInsert = query.insert.bind(query);
      query.insert = function (rows, options) {
        if (Array.isArray(rows)) {
          var st = window.getStudent();
          rows = rows.map(function (row) {
            if (st) {
              if (!row.student_id && st.id) row.student_id = st.id;
              var isUnknown = !row.student_name || row.student_name === "Nomaʼlum oʻquvchi" || row.student_name === "Noma'lum o'quvchi" || row.student_name === "O'quvchi" || row.student_name === "Nomaʼlum";
              var name = (!isUnknown && (row.full_name || row.student_name)) ? (row.full_name || row.student_name) : (st.full_name || st.student_name || "O'quvchi");
              row.full_name = name;
              row.student_name = name;
              row.phone = window.cleanPhone(row.phone || st.phone);
              if (!row.grade) row.grade = st.grade || "7-sinf";
              if (!row.school) row.school = st.school || "";
              if (!row.region) row.region = st.region || "";
              if (!row.district) row.district = st.district || "";
            } else {
              row.phone = window.cleanPhone(row.phone);
            }
            return row;
          });
        }
        return origInsert(rows, options);
      };
    }
    return query;
  };
  return client;
}

// Safe client accessor and initializer
window.getSupabaseClient = function () {
  if (window.supabaseClient) {
    return hookClient(window.supabaseClient);
  }
  var factory = (window.supabase && typeof window.supabase.createClient === "function")
    ? window.supabase.createClient
    : (window.supabaseJs && typeof window.supabaseJs.createClient === "function")
      ? window.supabaseJs.createClient
      : (typeof window.createClient === "function" ? window.createClient : null);

  if (typeof factory === "function") {
    try {
      var client = factory(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: { headers: { "x-project-reference": "qnrwkdmonqdqvbzpkczn" } }
      });
      window.supabaseClient = hookClient(client);
      return window.supabaseClient;
    } catch (err) {
      console.warn("[E-Maktab] Supabase client init error:", err);
    }
  }
  return null;
};

// Global sinxronizatsiya funksiyasi: O'quvchini Supabase students jadvaliga yuborish
window.syncStudentToSupabase = async function (st) {
  if (!st) return { ok: false, error: "Bo'sh ma'lumot" };
  var client = window.getSupabaseClient();
  if (!client) {
    console.warn("[E-Maktab] Supabase mijozi topilmadi");
    return { ok: false, error: "Supabase client not ready" };
  }

  var studentId = st.id || window.genUUID();
  var fullName = (st.full_name || st.student_name || [st.first_name, st.last_name].filter(Boolean).join(" ") || "Oʻquvchi").trim();
  var parts = fullName.split(/\s+/);
  var firstName = st.first_name || parts[0] || fullName;
  var lastName = st.last_name || parts.slice(1).join(" ") || "";
  var phoneClean = window.cleanPhone(st.phone);

  var coordStr = "";
  if (st.coordinates) {
    coordStr = typeof st.coordinates === 'object' ? (st.coordinates.lat + ', ' + st.coordinates.lng) : String(st.coordinates);
  } else if (st.loc) {
    coordStr = typeof st.loc === 'object' ? (st.loc.lat + ', ' + st.loc.lng) : String(st.loc);
  }

  var payload = {
    id: studentId,
    full_name: fullName,
    student_name: fullName,
    first_name: firstName,
    last_name: lastName,
    phone: phoneClean,
    avatar: st.avatar || st.av || "🧑‍🎓",
    grade: st.grade || st.cls || "7-sinf",
    school: st.school || st.sch || "",
    region: st.region || st.vil || "",
    district: st.district || st.tum || "",
    teacher_name: st.teacher_name || st.ust || "",
    school_address: st.school_address || st.adr || "",
    coordinates: coordStr,
    current_topic: st.current_topic || "7-sinf 1-mavzu",
    last_active: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: st.created_at || st.cr || new Date().toISOString()
  };

  try {
    var res = await client.from("students").upsert([payload], { onConflict: "id" });
    if (res.error) {
      console.warn("[Supabase] Students upsert xatolik:", res.error);
      return { ok: false, error: res.error };
    }
    return { ok: true, data: payload };
  } catch (err) {
    console.warn("[Supabase] Students upsert istisno:", err);
    return { ok: false, error: err };
  }
};

// Immediate instantiation if CDN library is already loaded
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.getSupabaseClient();
}

window.__EMAKTAB_SUPABASE_CONFIG__ = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  projectReference: "qnrwkdmonqdqvbzpkczn",
  dbDirectHost: "db.qnrwkdmonqdqvbzpkczn.supabase.co:5432/postgres"
};

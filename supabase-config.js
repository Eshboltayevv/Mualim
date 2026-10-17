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

// O'quvchi ma'lumotlarini olish (localStorage va Shaxsiy kabinet profillaridan birlashtirilgan)
window.getStudent = function () {
  try {
    var raw = localStorage.getItem("currentStudent") || localStorage.getItem("emaktab_student");
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
        full_name: pn,
        student_name: pn,
        login: p.lg || (st && st.login) || '',
        avatar: p.av || (st && st.avatar) || '🧑‍🎓',
        grade: p.cls || (st && st.grade) || '7-sinf',
        school: p.sch || (st && st.school) || '',
        region: p.vil || (st && st.region) || '',
        district: p.tum || (st && st.district) || '',
        teacher_name: p.ust || (st && st.teacher_name) || '',
        school_address: p.adr || (st && st.school_address) || '',
        coordinates: p.loc ? (p.loc.lat + ', ' + p.loc.lng) : ((st && st.coordinates) || ''),
        phone: p.ph || (st && st.phone) || ''
      });
    }
    return st;
  } catch (err) {
    return null;
  }
};

window.saveStudent = function (obj) {
  try {
    localStorage.setItem("currentStudent", JSON.stringify(obj));
    localStorage.setItem("emaktab_student", JSON.stringify(obj));
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
              var name = row.full_name || row.student_name || st.full_name || st.student_name || [st.first_name, st.last_name].filter(Boolean).join(" ") || "O'quvchi";
              row.full_name = name;
              row.student_name = name;
              if (!row.phone) row.phone = st.phone || "";
              if (!row.grade) row.grade = st.grade || st.cls || "7-sinf";
              if (!row.school) row.school = st.school || st.sch || "";
              if (!row.region) row.region = st.region || st.vil || "";
              if (!row.district) row.district = st.district || st.tum || "";
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
  var fullName = (st.full_name || st.student_name || [st.first_name, st.last_name].filter(Boolean).join(" ") || "Nomaʼlum oʻquvchi").trim();
  var parts = fullName.split(/\s+/);
  var firstName = st.first_name || parts[0] || fullName;
  var lastName = st.last_name || parts.slice(1).join(" ") || "";

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
    phone: st.phone || "",
    login: st.login || st.lg || "",
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

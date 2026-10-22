// ============================================================================
// E-MAKTAB MUALLIM: SUPABASE CONFIGURATION & UNIVERSAL DATA SYNC
// ============================================================================

const SUPABASE_URL = "https://qnrwkdmonqdqvbzpkczn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vk1cjiFT2qdZ9_JPWx_8bg_ZsqmJwTZ";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// 1. UUID generator
window.genUUID = function () {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 2. Telefon raqamini tozalash (hash yoki login belgilaridan xoli qilish)
window.cleanPhone = function (val) {
  if (!val || typeof val !== 'string') return '';
  var s = val.trim();
  if (/^[pc]:/i.test(s) || /^[0-9a-f]{32,}$/i.test(s)) return '';
  var hasPlus = s.startsWith('+');
  var digits = s.replace(/\D/g, '');
  if (digits.length < 7) return '';
  if (hasPlus) return '+' + digits;
  if (digits.length === 9) return '+998' + digits;
  if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
  return '+' + digits;
};

// 3. Ism noma'lum yoki placeholder ekanligini tekshirish
function isUnknownName(name) {
  if (!name || typeof name !== 'string') return true;
  var s = name.trim().toLowerCase();
  if (!s || s === 'undefined' || s === 'null') return true;
  if (/^noma[’'ʼ`]lum\s*o[’'ʼ`]quvchi$/i.test(s)) return true;
  if (/^noma[’'ʼ`]lum$/i.test(s)) return true;
  if (/^o[’'ʼ`]quvchi$/i.test(s)) return true;
  return false;
}
window.isUnknownName = isUnknownName;

// 4. O'quvchi ma'lumotlarini barcha saqlash joylaridan (localStorage) mukammal qidirib topish
window.getRegisteredStudent = function () {
  try {
    var st = null;
    var keys = ["emaktab_student", "currentStudent", "muallim_profile", "studentProfile", "activeProfile"];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (!st) st = parsed;
            else st = Object.assign({}, parsed, st);
          }
        }
      } catch (e) {}
    }

    // Shaxsiy kabinet: pn (joriy profil nomi) va pfs (barcha profillar lug'ati)
    var pn = null;
    try {
      var rawPn = localStorage.getItem("pn");
      if (rawPn) {
        try { pn = JSON.parse(rawPn); } catch (e) { pn = rawPn; }
      }
    } catch (e) {}

    var pfs = null;
    try {
      var rawPfs = localStorage.getItem("pfs");
      if (rawPfs) pfs = JSON.parse(rawPfs);
    } catch (e) {}

    var profileData = null;
    var profileName = null;

    if (pfs && typeof pfs === 'object') {
      if (pn && pfs[pn]) {
        profileData = pfs[pn];
        profileName = pn;
      } else {
        var pKeys = Object.keys(pfs);
        for (var k = 0; k < pKeys.length; k++) {
          var candidate = pKeys[k];
          if (!isUnknownName(candidate) && pfs[candidate] && typeof pfs[candidate] === 'object') {
            profileData = pfs[candidate];
            profileName = candidate;
            break;
          }
        }
      }
    }

    if (profileData) {
      st = Object.assign({}, st || {}, {
        id: (st && st.id) ? st.id : window.genUUID(),
        full_name: (st && !isUnknownName(st.full_name) && st.full_name) || profileName || (st && st.student_name) || "",
        student_name: (st && !isUnknownName(st.student_name) && st.student_name) || profileName || (st && st.full_name) || "",
        avatar: (st && st.avatar) || profileData.av || '🧑‍🎓',
        grade: (st && st.grade) || profileData.cls || '7-sinf',
        school: (st && st.school) || profileData.sch || '',
        region: (st && st.region) || profileData.vil || '',
        district: (st && st.district) || profileData.tum || '',
        teacher_name: (st && st.teacher_name) || profileData.ust || '',
        school_address: (st && st.school_address) || profileData.adr || '',
        coordinates: (st && st.coordinates) || (profileData.loc ? (profileData.loc.lat + ', ' + profileData.loc.lng) : ''),
        phone: window.cleanPhone((st && st.phone) || profileData.phone || '')
      });
    }

    // Yakuniy tekshiruv va tozalash
    if (st) {
      var realName = (!isUnknownName(st.full_name) && st.full_name) ||
                     (!isUnknownName(st.student_name) && st.student_name) ||
                     (!isUnknownName(profileName) && profileName) ||
                     (!isUnknownName(pn) && String(pn).trim()) ||
                     ([st.first_name, st.last_name].filter(Boolean).join(" ").trim());

      if (realName && !isUnknownName(realName)) {
        realName = realName.trim();
        st.full_name = realName;
        st.student_name = realName;
        var parts = realName.split(/\s+/).filter(Boolean);
        st.first_name = st.first_name || parts[0] || realName;
        st.last_name = st.last_name || parts.slice(1).join(" ") || "";
      } else {
        st.full_name = "O'quvchi";
        st.student_name = "O'quvchi";
        st.first_name = "O'quvchi";
        st.last_name = "";
      }

      st.phone = window.cleanPhone(st.phone);
      if (!st.id) st.id = window.genUUID();
      if (!st.avatar) st.avatar = '🧑‍🎓';
      if (!st.grade) st.grade = '7-sinf';
      delete st.ph;
      delete st.sl;
      delete st.password;
      delete st.login;
    }

    return st;
  } catch (err) {
    console.warn("[E-Maktab] getRegisteredStudent error:", err);
    return null;
  }
};

// getStudent har doim getRegisteredStudent ga yo'naltiriladi
window.getStudent = window.getRegisteredStudent;

// 5. O'quvchi ma'lumotlarini barcha storage kalitlariga bir xil va to'liq yozish
window.saveStudent = function (obj) {
  try {
    if (!obj || typeof obj !== 'object') return null;
    var rawName = obj.full_name || obj.student_name || [obj.first_name, obj.last_name].filter(Boolean).join(" ") || "";
    var fullName = String(rawName).trim();
    if (isUnknownName(fullName)) fullName = "O'quvchi";
    var parts = fullName.split(/\s+/).filter(Boolean);
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
      last_seen_at: new Date().toISOString(),
      created_at: obj.created_at || obj.cr || new Date().toISOString()
    });

    delete st.ph;
    delete st.sl;
    delete st.password;
    delete st.login;

    var json = JSON.stringify(st);
    var targetKeys = ["emaktab_student", "currentStudent", "muallim_profile", "studentProfile", "activeProfile"];
    for (var i = 0; i < targetKeys.length; i++) {
      try { localStorage.setItem(targetKeys[i], json); } catch (e) {}
    }

    if (fullName && !isUnknownName(fullName)) {
      try { localStorage.setItem("pn", fullName); } catch (e) {}
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
    return st;
  } catch (e) {
    console.warn("[E-Maktab] saveStudent error:", e);
    return null;
  }
};

// 6. Supabase client insert interceptor (hookClient)
function hookClient(client) {
  if (!client || client.__emaktab_hooked__) return client;
  client.__emaktab_hooked__ = true;

  var origFrom = client.from.bind(client);
  client.from = function (table) {
    var query = origFrom(table);
    if (table === 'test_results') {
      var origInsert = query.insert.bind(query);
      query.insert = function (rows, options) {
        var st = window.getRegisteredStudent();
        var fixRow = function (row) {
          if (!row || typeof row !== 'object') return row;
          if (st) {
            if (!row.student_id && st.id) row.student_id = st.id;
            var curName = row.full_name || row.student_name;
            var realName = (!isUnknownName(curName) && curName ? curName : (st.full_name || st.student_name || "O'quvchi")).trim();
            row.full_name = realName;
            row.student_name = realName;
            row.phone = window.cleanPhone(row.phone || st.phone);
            if (!row.grade) row.grade = st.grade || "7-sinf";
            if (!row.school) row.school = st.school || "";
            if (!row.region) row.region = st.region || "";
            if (!row.district) row.district = st.district || "";
          } else {
            row.phone = window.cleanPhone(row.phone);
            if (isUnknownName(row.full_name) && isUnknownName(row.student_name)) {
              row.full_name = "O'quvchi";
              row.student_name = "O'quvchi";
            }
          }
          if (!row.subject) row.subject = "Fizika";
          return row;
        };

        if (Array.isArray(rows)) {
          rows = rows.map(fixRow);
        } else if (rows && typeof rows === 'object') {
          rows = fixRow(rows);
        }
        return origInsert(rows, options);
      };
    }
    return query;
  };
  return client;
}

// 7. REST Fetch Interceptor (direct fetch chaqiruvlarini ham ushlab qolib to'g'ri o'quvchini qo'shish)
if (typeof window.fetch === 'function' && !window.__emaktab_fetch_hooked__) {
  window.__emaktab_fetch_hooked__ = true;
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (url && url.indexOf('/rest/v1/test_results') !== -1 && init && init.method && init.method.toUpperCase() === 'POST' && init.body) {
        var st = window.getRegisteredStudent ? window.getRegisteredStudent() : null;
        if (st) {
          var parsed = JSON.parse(init.body);
          var fix = function (item) {
            if (item && typeof item === 'object') {
              if (!item.student_id && st.id) item.student_id = st.id;
              var curName = item.full_name || item.student_name;
              var name = (!isUnknownName(curName) && curName ? curName : (st.full_name || st.student_name || "O'quvchi")).trim();
              item.full_name = name;
              item.student_name = name;
              item.phone = window.cleanPhone(item.phone || st.phone);
              item.school = item.school || st.school || "";
              item.region = item.region || st.region || "";
              item.district = item.district || st.district || "";
              item.grade = item.grade || st.grade || "7-sinf";
              item.subject = item.subject || "Fizika";
            }
            return item;
          };
          if (Array.isArray(parsed)) parsed = parsed.map(fix);
          else parsed = fix(parsed);
          init.body = JSON.stringify(parsed);
        }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
}

// 8. Supabase clientni yaratish va xavfsiz qaytarish
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

// Agar CDN kutubxonasi allaqachon yuklangan bo'lsa darhol clientni ishga tushirish
if (window.supabase && typeof window.supabase.createClient === "function") {
  window.getSupabaseClient();
}

// 9. O'quvchi profilini Supabase "students" jadvaliga sinxronizatsiya qilish
window.syncStudentToSupabase = async function (st) {
  if (!st) st = window.getRegisteredStudent();
  if (!st) return { ok: false, error: "Bo'sh ma'lumot" };

  var studentId = st.id || window.genUUID();
  var realName = (!isUnknownName(st.full_name) && st.full_name) ||
                 (!isUnknownName(st.student_name) && st.student_name) ||
                 ([st.first_name, st.last_name].filter(Boolean).join(" ").trim()) || "Oʻquvchi";
  var parts = realName.split(/\s+/).filter(Boolean);
  var firstName = st.first_name || parts[0] || realName;
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
    full_name: realName,
    student_name: realName,
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

  var client = window.getSupabaseClient();
  if (client) {
    try {
      var res = await client.from("students").upsert([payload], { onConflict: "id" });
      if (!res.error) return { ok: true, data: payload };
    } catch (e) {}
  }

  // Fallback direct REST
  try {
    var res2 = await fetch(SUPABASE_URL + "/rest/v1/students?on_conflict=id", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify([payload])
    });
    if (res2.ok) return { ok: true, data: payload };
  } catch (err) {}

  return { ok: false, data: payload };
};

// 10. Test natijasini xavfsiz va kafolatlangan topshirish (Universal Test Submitter)
function showBadgeInTestCard(msg) {
  var card = document.querySelector("#test .card, #tq, #tst, #tb, #test, .test-box, .test-card, main");
  if (!card) return;
  if (document.getElementById("emaktab-sync-badge")) return;
  var badge = document.createElement("div");
  badge.id = "emaktab-sync-badge";
  badge.setAttribute("style", "margin-top:14px;padding:8px 14px;background:rgba(27,158,85,0.14);border:1.5px solid #1b9e55;border-radius:10px;color:#1b9e55;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(27,158,85,0.2);");
  badge.textContent = msg;
  card.appendChild(badge);
}

window.submitEmaktabTestResult = async function (score, total, customLessonTitle) {
  var st = window.getRegisteredStudent();
  var title = customLessonTitle;
  if (!title) {
    var titleEl = document.querySelector(".lesson-title, .topic-title, header h1, header h2, h1, h2");
    title = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || document.title || "7-sinf Fizika darsi";
  }
  title = title.replace(/—\s*7-sinf.*$/i, '').trim();

  var fullName = (st && (st.full_name || st.student_name)) || "O'quvchi";
  if (isUnknownName(fullName)) fullName = "O'quvchi";

  var record = {
    student_id: (st && st.id) ? st.id : window.genUUID(),
    student_name: fullName,
    full_name: fullName,
    phone: (st && st.phone) ? window.cleanPhone(st.phone) : "",
    grade: (st && st.grade) ? st.grade : "7-sinf",
    school: (st && st.school) ? st.school : "",
    region: (st && st.region) ? st.region : "",
    district: (st && st.district) ? st.district : "",
    subject: "Fizika",
    lesson_title: title,
    score: Number(score || 0),
    total_questions: Number(total || 10),
    created_at: new Date().toISOString()
  };

  // 1-usul: Supabase JS Client orqali yuborish
  var client = window.getSupabaseClient();
  if (client) {
    try {
      var res = await client.from("test_results").insert([record]);
      if (!res.error) {
        showBadgeInTestCard("✅ Natija serverga yuborildi");
        return { ok: true, data: record };
      }
    } catch (err) {
      console.warn("[E-Maktab] Client insert failed, trying REST:", err);
    }
  }

  // 2-usul: To'g'ridan-to'g'ri REST Fetch orqali yuborish (CDN kutubxona bo'lmasa ham ishlaydi)
  try {
    var res2 = await fetch(SUPABASE_URL + "/rest/v1/test_results", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify([record])
    });
    if (res2.ok) {
      showBadgeInTestCard("✅ Natija serverga yuborildi");
      return { ok: true, data: record };
    }
  } catch (err2) {
    console.warn("[E-Maktab] REST submission failed:", err2);
  }

  return { ok: false, data: record };
};

// Darslar ichidagi eski chaqiruvlarni universal funksiyaga yo'naltirish
window.submitTestResults = window.submitEmaktabTestResult;
window.__EMAKTAB_SUBMIT_TEST_RESULT__ = function (payload) {
  if (!payload || typeof payload !== 'object') return;
  var sc = payload.score != null ? payload.score : 0;
  var tot = payload.total_questions != null ? payload.total_questions : 10;
  var ttl = payload.lesson_title || null;
  return window.submitEmaktabTestResult(sc, tot, ttl);
};

// 11. Barcha darslar uchun avtomatik DOM Test Kuzatuvchisi (Universal DOM Test Observer)
(function () {
  if (window.__EMAKTAB_AUTO_OBSERVER_INITED__) return;
  window.__EMAKTAB_AUTO_OBSERVER_INITED__ = true;

  var hasSubmitted = false;

  function extractScoreAndTotal(container) {
    if (!container) return null;
    var text = container.innerText || container.textContent || "";

    // 1-shablon: "Siz X savoldan Y tasiga to'g'ri javob berdingiz"
    var m1 = text.match(/(\d+)\s*savoldan\s*(\d+)\s*tasiga/i);
    if (m1) {
      var tot1 = parseInt(m1[1], 10);
      var sc1 = parseInt(m1[2], 10);
      if (tot1 >= 3 && tot1 <= 100 && sc1 >= 0 && sc1 <= tot1) {
        return { score: sc1, total: tot1 };
      }
    }

    // 2-shablon: "Natija: X / Y", "To'g'ri javoblar: X / Y", "Natija: X/Y"
    var m2 = text.match(/(?:natija|to[‘'ʼ`]g[‘'ʼ`]ri\s*javoblar|to[‘'ʼ`]g[‘'ʼ`]ri)[^0-9\n\r]*(\d+)\s*(?:\/|dan)\s*(\d+)/i);
    if (m2) {
      var sc2 = parseInt(m2[1], 10);
      var tot2 = parseInt(m2[2], 10);
      if (tot2 >= 3 && tot2 <= 100 && sc2 >= 0 && sc2 <= tot2) {
        return { score: sc2, total: tot2 };
      }
    }

    // 3-shablon: Qayta topshirish tugmasi mavjud bo'lganda test natijasi ko'rsatilishi
    var hasRetry = !!container.querySelector('#qRetry, #qr, #rs, #rt, #tAgain, [id*="retry"], [id*="again"], button.pr, button.btn');
    if (hasRetry) {
      var fractions = text.matchAll(/(\d+)\s*\/\s*(\d+)/g);
      for (var f of fractions) {
        var sc = parseInt(f[1], 10);
        var tot = parseInt(f[2], 10);
        if (tot >= 3 && tot <= 50 && sc >= 0 && sc <= tot) {
          return { score: sc, total: tot };
        }
      }
    }

    return null;
  }

  function checkAllTestContainers() {
    if (hasSubmitted) return;
    var containers = document.querySelectorAll("#test, #tq, #tst, #tb, .test-box, .test-card, section#test, div#test, main");
    if (!containers || containers.length === 0) containers = [document.body];

    for (var i = 0; i < containers.length; i++) {
      var res = extractScoreAndTotal(containers[i]);
      if (res) {
        hasSubmitted = true;
        window.submitEmaktabTestResult(res.score, res.total);
        return;
      }
    }
  }

  // Qayta topshirish tugmasi bosilganda qayta yuborish imkoniyatini berish
  document.addEventListener("click", function (e) {
    if (e.target && (
      e.target.id === "qRetry" ||
      e.target.id === "qr" ||
      e.target.id === "rs" ||
      e.target.id === "rt" ||
      e.target.id === "tAgain" ||
      e.target.closest("#qRetry, #qr, #rs, #rt, #tAgain, [id*='retry'], [id*='again']") ||
      (e.target.tagName === 'BUTTON' && /qayta/i.test(e.target.textContent || ''))
    )) {
      hasSubmitted = false;
      var b = document.getElementById("emaktab-sync-badge");
      if (b) b.remove();
    }
  }, true);

  var obs = new MutationObserver(function () {
    checkAllTestContainers();
  });

  function startObserver() {
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      checkAllTestContainers();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();

window.__EMAKTAB_SUPABASE_CONFIG__ = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  projectReference: "qnrwkdmonqdqvbzpkczn",
  dbDirectHost: "db.qnrwkdmonqdqvbzpkczn.supabase.co:5432/postgres"
};

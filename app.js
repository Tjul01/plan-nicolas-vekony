// ═══════════════════════════════════════════════════════════════
// PLAN BADMINTON NICOLAS — app.js
// Backend : Supabase (données partagées en temps réel)
// PIN Athlète : 1234 | PIN Coach : 9999 (modifiables dans Réglages)
// ═══════════════════════════════════════════════════════════════

// ── SUPABASE CONFIG ───────────────────────────────────────────
const SUPABASE_URL = 'https://zuxkbilztknthcsfulyk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qWhizpkvYsJqQdChH-Od8A_6KPIjoRC';

// Hash SHA-256 pour PIN
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Appel Supabase générique
async function sb(method, table, body = null, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase ${method} ${table}: ${err}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const DB = {
  // Session logs
  async getLogs() {
    const rows = await sb('GET', 'session_logs', null, '?select=*');
    const out = {};
    (rows || []).forEach(r => { out[r.date] = { status: r.status, rpe: r.rpe, notes: r.notes, savedAt: r.saved_at }; });
    return out;
  },
  async saveLog(date, log) {
    await sb('POST', 'session_logs', { date, status: log.status, rpe: log.rpe, notes: log.notes, saved_at: log.savedAt });
  },
  // Poids
  async getPoids() {
    return await sb('GET', 'poids', null, '?select=*&order=created_at.asc') || [];
  },
  async addPoids(date, poids) {
    await sb('POST', 'poids', { date, poids });
  },
  // Messages
  async getMessages() {
    return await sb('GET', 'messages', null, '?select=*&order=created_at.asc') || [];
  },
  async addMessage(text) {
    await sb('POST', 'messages', { text, read_by_athlete: false });
  },
  async markMessagesRead() {
    await sb('PATCH', 'messages', { read_by_athlete: true }, '?read_by_athlete=eq.false');
  },
  // Plan overrides
  async getPlanOverrides() {
    const rows = await sb('GET', 'plan_overrides', null, '?select=*') || [];
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    return out.sessions ? { sessions: out.sessions } : {};
  },
  async savePlanOverride(key, value) {
    await sb('POST', 'plan_overrides', { key, value });
  },
  // Config / PIN
  async getConfig(key) {
    const rows = await sb('GET', 'config', null, `?key=eq.${key}&select=value`) || [];
    return rows[0]?.value || null;
  },
  async setConfig(key, value) {
    await sb('POST', 'config', { key, value });
  }
};

// ── DONNÉES ───────────────────────────────────────────────────
const ATHLETE_NAME = 'Nicolas';
const TYPE_COLORS = {
  force: '#c8a96e', kb: '#e0b060', cardio: '#7eb87a',
  mob: '#c87ab8', bad: '#7a9ec8', repos: '#5c6354'
};
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const BASE_PLAN = {
  "2026-06-30":[{type:'force',label:'Force A',detail:'Parking · poids corps 30\''}],
  "2026-07-02":[{type:'force',label:'Force B',detail:'Parking · core + haut 30\''}],
  "2026-07-03":[{type:'cardio',label:'EF 30\'',detail:'Forêt · zone 2'}],
  "2026-07-07":[{type:'force',label:'Force A',detail:'Parking · poids corps 30\''}],
  "2026-07-09":[{type:'force',label:'Force B',detail:'Parking · haut + core 30\''}],
  "2026-07-10":[{type:'cardio',label:'EF 30\'',detail:'Forêt · zone 2'}],
  "2026-07-14":[{type:'force',label:'Force A',detail:'Parking · bulgare + step-up 35\''}],
  "2026-07-16":[{type:'force',label:'Force B',detail:'Parking · anti-rotation 30\''}],
  "2026-07-17":[{type:'cardio',label:'Intervalles',detail:'Piste · 6×2\'/2\''}],
  "2026-07-21":[{type:'force',label:'Force A+',detail:'Parking · explosivité douce 35\''}],
  "2026-07-23":[{type:'force',label:'Force B+',detail:'Parking · core avancé 30\''}],
  "2026-07-24":[{type:'cardio',label:'EF 35\'',detail:'Forêt · zone 2'}],
  "2026-07-28":[{type:'force',label:'Force A',detail:'Parking · élastiques + swissball'}],
  "2026-07-30":[{type:'force',label:'Force B',detail:'Parking · Pallof press élastique'}],
  "2026-07-31":[{type:'cardio',label:'Intervalles',detail:'Piste · 8×2\'/90s'}],
  "2026-08-04":[{type:'cardio',label:'EF 30\'',detail:'Terrain vacances · zone 2'}],
  "2026-08-06":[{type:'force',label:'Force · poids corps',detail:'Circuit 30\''}],
  "2026-08-07":[{type:'cardio',label:'EF 35\'',detail:'Zone 2 vacances'}],
  "2026-08-11":[{type:'cardio',label:'Intervalles',detail:'6×2\' terrain libre'}],
  "2026-08-13":[{type:'force',label:'Force · poids corps',detail:'Circuit complet 35\''}],
  "2026-08-14":[{type:'cardio',label:'EF 35\'',detail:'Zone 2 vacances'}],
  "2026-08-18":[{type:'force',label:'KB intro · technique',detail:'Gobelet + hip hinge 16 kg · parking'}],
  "2026-08-20":[{type:'kb',label:'KB Force A',detail:'Swing 16 kg + gobelet · 40\''}],
  "2026-08-21":[{type:'cardio',label:'EF 35\'',detail:'Forêt · remise en route'}],
  "2026-08-25":[{type:'kb',label:'KB Force A',detail:'Swing 16 kg + hip thrust · 40\''}],
  "2026-08-27":[{type:'kb',label:'KB Force B',detail:'Fente lat. + row + Pallof · 40\''}],
  "2026-08-28":[{type:'cardio',label:'Intervalles',detail:'Piste · 6×3\'/2\''}],
  "2026-09-01":[{type:'kb',label:'KB circuit',detail:'Swing + gobelet + row + core · 40\''}],
  "2026-09-03":[{type:'kb',label:'KB Force B+',detail:'Suitcase carry + gainage'}],
  "2026-09-04":[{type:'cardio',label:'EF 40\'',detail:'Forêt · zone 2'}],
  "2026-09-08":[{type:'kb',label:'KB Force A+',detail:'Swing 20 kg · 40\''}],
  "2026-09-10":[{type:'kb',label:'KB circuit complet',detail:'Swing 20 kg + TGU intro · 45\''}],
  "2026-09-11":[{type:'cardio',label:'Intervalles',detail:'Piste · 8×3\'/90s'}],
  "2026-09-15":[{type:'kb',label:'KB Force A',detail:'Décharge 50% · swing 16 kg · 30\''}],
  "2026-09-17":[{type:'mob',label:'Mobilité + KB léger',detail:'Élastiques + swissball · 25\''}],
  "2026-09-18":[{type:'cardio',label:'EF léger 25\'',detail:'Forêt · zone 2'}],
};

const CONGES = [
  '2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05',
  '2026-08-06','2026-08-07','2026-08-08','2026-08-09','2026-08-10',
  '2026-08-11','2026-08-12','2026-08-13','2026-08-14','2026-08-15'
];

const PLAN_DETAIL = [
  {phase:'FORCE A — Bas du corps (S1–S4)', exercises:[
    {name:'Squat gobelet',detail:'Poids corps S1–S4 · KB 12 kg S5+',cues:'1. Dos droit, poitrine haute. 2. Genoux dans l\'axe des orteils, talons au sol. 3. Descente 2–3s, pousser dans les talons.'},
    {name:'Hip thrust sol',detail:'Poids corps · 3×12 · repos 60s',cues:'1. Pousser dans les talons — jamais la pointe. 2. Fessiers contractés 2s en haut. 3. Ne pas hyperétendre le dos.'},
    {name:'Fente avant unilatérale',detail:'Poids corps · 3×8/côté · repos 75s',cues:'1. Genou avant dans l\'axe du pied. 2. Buste droit, regard devant. 3. Réduire amplitude si gêne Achille côté droit.'},
    {name:'Élévation mollet ★ Achille',detail:'Sur marche · 3×15 · descente 4s',cues:'1. Montée 2 pieds → descente 4s sur 1 pied. 2. Descendre SOUS la marche. 3. Rambarde pour équilibre seulement.'},
    {name:'Step-up',detail:'Chaise/banc · 3×10/côté',cues:'1. Pousser dans le talon du pied posé. 2. Genou au-dessus du pied. 3. Réception contrôlée.'},
  ]},
  {phase:'FORCE B — Haut + Core (S1–S4)', exercises:[
    {name:'Pompes',detail:'3×10 · repos 60s',cues:'1. Corps en planche parfaite. 2. Coudes à 45°. 3. Hanches ni affaissées ni montantes.'},
    {name:'Rowing unilatéral',detail:'Élastique → KB 12 kg S5+',cues:'1. Tirer avec le coude vers la poche arrière. 2. Dos plat, ne pas vriller. 3. Descente contrôlée 2–3s.'},
    {name:'Dead bug',detail:'3×8/côté · poids corps',cues:'1. Bas du dos collé au sol. 2. Expirer pendant le mouvement. 3. Réduire amplitude si dos se décolle.'},
    {name:'Planche frontale',detail:'3×35s → swissball S5+',cues:'1. Fessiers contractés. 2. Pousser les coudes dans le sol. 3. Respiration lente et régulière.'},
    {name:'Rotation coiffe élastique ★',detail:'2×15/côté · élastique léger',cues:'1. Coude collé au flanc. 2. 2s aller, 3s retour. 3. Résistance légère — activation.'},
  ]},
  {phase:'KB FORCE A — Chaîne postérieure (S9+)', exercises:[
    {name:'KB Swing à 2 mains',detail:'KB 16 kg → 20 kg · 4×10',cues:'1. Hip hinge : les hanches propulsent. 2. Fessiers contractés en haut. 3. Talons ancrés au sol.'},
    {name:'Gobelet squat KB',detail:'KB 16 kg · 3×8',cues:'1. Dos droit, KB contre poitrine. 2. Talons au sol, descente lente. 3. Pousser dans les talons.'},
    {name:'Hip thrust KB',detail:'KB 20 kg · 3×12',cues:'1. Pousser dans les talons. 2. Fessiers contractés 2s. 3. Ne pas hyperétendre le dos.'},
    {name:'Suitcase Carry ★',detail:'KB 16→20 kg · 3×20m/côté',cues:'1. Buste parfaitement droit. 2. Épaule côté KB ancrée vers le bas. 3. Pas lents et contrôlés.'},
  ]},
  {phase:'KB FORCE B — Explosivité + gainage bad (S9+)', exercises:[
    {name:'Fente latérale KB gobelet',detail:'KB 12→16 kg · 3×8/côté',cues:'1. Grand pas latéral, pied à 30–45°. 2. Genou dans l\'axe du pied. 3. Spécifique déplacement bad.'},
    {name:'Pallof Press élastique',detail:'3×12/côté · repos 45s',cues:'1. Corps perpendiculaire à l\'élastique. 2. Extension + maintien 2s bras tendus. 3. Abdos gainés, épaules basses.'},
    {name:'KB Row unilatéral',detail:'KB 16→20 kg · 3×10/côté',cues:'1. Coude vers la poche arrière. 2. Dos plat. 3. Descente contrôlée 2–3s.'},
  ]},
  {phase:'PROTOCOLE ACHILLE — Chaque matin', exercises:[
    {name:'Excentrique bilatéral',detail:'3×15 · descente 4s pied droit',cues:'1. Montée 2 pieds → descente 4s sur 1. 2. Sous le niveau de la marche. 3. Gêne légère OK, douleur = stop.'},
    {name:'Excentrique unilatéral',detail:'Dès S5 si sans douleur · 3×12',cues:'1. Montée ET descente sur 1 pied. 2. Ajouter sac lesté si trop facile. 3. Rambarde pour équilibre.'},
    {name:'Isométrique contre mur',detail:'Si gêne aiguë · 5×45s',cues:'1. Maintien 45s sans bouger. 2. Respiration régulière. 3. Faire AVANT bad/match.'},
  ]},
];

// ── STATE ─────────────────────────────────────────────────────
let currentRole = null;
let currentPin = '';
let calMonth = 6, calYear = 2026;
let sessionLogs = {}, poidsData = [], messages = [], planOverrides = {};
let selectedDate = null, currentStatus = null;
let isLoading = false;

// ── HELPERS UI ────────────────────────────────────────────────
function showLoader(msg = 'Chargement…') {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,17,14,.85);display:flex;align-items:center;justify-content:center;z-index:999;font-family:"DM Mono",monospace;font-size:13px;color:#7eb87a;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'flex';
}
function hideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ── PLAN MERGE ────────────────────────────────────────────────
function getPlan() {
  const merged = JSON.parse(JSON.stringify(BASE_PLAN));
  if (planOverrides.sessions) {
    for (const [date, sessions] of Object.entries(planOverrides.sessions)) {
      if (sessions === null) delete merged[date];
      else merged[date] = sessions;
    }
  }
  return merged;
}

// ── LOGIN ─────────────────────────────────────────────────────
function pinPress(v) {
  if (v === 'del') { currentPin = currentPin.slice(0, -1); }
  else if (v === 'ok') { checkPin(); return; }
  else if (currentPin.length < 4) { currentPin += v; }
  if (currentPin.length === 4) { checkPin(); return; }
  updatePinDots();
}
function updatePinDots() {
  for (let i = 0; i < 4; i++)
    document.getElementById('pd' + i).classList.toggle('filled', i < currentPin.length);
}
async function checkPin() {
  showLoader('Vérification…');
  try {
    const hashed = await hashPin(currentPin);
    const pinAthleteHash = await DB.getConfig('pin_athlete');
    const pinCoachHash = await DB.getConfig('pin_coach');
    if (hashed === pinAthleteHash) { hideLoader(); login('athlete'); }
    else if (hashed === pinCoachHash) { hideLoader(); login('coach'); }
    else {
      hideLoader();
      document.getElementById('pin-error').textContent = 'PIN incorrect. Réessayez.';
      currentPin = ''; updatePinDots();
      setTimeout(() => document.getElementById('pin-error').textContent = '', 2000);
    }
  } catch (e) {
    hideLoader();
    document.getElementById('pin-error').textContent = 'Erreur de connexion. Réessayez.';
    currentPin = ''; updatePinDots();
  }
}
async function login(role) {
  currentRole = role;
  showLoader('Chargement des données…');
  try {
    sessionLogs = await DB.getLogs();
    poidsData = await DB.getPoids();
    messages = await DB.getMessages();
    planOverrides = await DB.getPlanOverrides();
  } catch (e) { console.error('Load error', e); }
  hideLoader();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-wrap').classList.add('visible');
  document.getElementById('role-badge').textContent = role === 'coach' ? '🎯 Coach' : '🏸 ' + ATHLETE_NAME;
  document.getElementById('role-badge').className = 'role-badge ' + (role === 'coach' ? 'role-coach' : 'role-athlete');
  buildNav();
  showPage('cal');
}
function logout() {
  currentRole = null; currentPin = ''; updatePinDots();
  sessionLogs = {}; poidsData = []; messages = []; planOverrides = {};
  document.getElementById('app-wrap').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('pin-error').textContent = '';
}

// ── NAV ───────────────────────────────────────────────────────
function buildNav() {
  const nav = document.getElementById('main-nav');
  const tabs = [
    { id: 'cal', label: 'Calendrier' },
    { id: 'plan', label: 'Plan' },
    { id: 'poids', label: 'Poids' },
    { id: 'historique', label: 'Historique' },
    { id: 'analyse', label: '⚡ Analyse IA' },
  ];
  if (currentRole === 'coach') {
    tabs.push({ id: 'coach', label: '🎯 Coach', isCoach: true });
    tabs.push({ id: 'settings', label: 'Réglages', isCoach: true });
  }
  nav.innerHTML = tabs.map(t =>
    `<button class="nav-btn${t.isCoach ? ' coach-tab' : ''}" onclick="showPage('${t.id}')" id="nav-${t.id}">${t.label}</button>`
  ).join('');
}

function showPage(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
  const mc = document.getElementById('main-content');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page active';
  mc.appendChild(page);
  const renders = {
    cal: renderCal, plan: renderPlan, poids: renderPoids,
    historique: renderHistorique, analyse: renderAnalyse,
    coach: renderCoach, settings: renderSettings
  };
  if (renders[name]) renders[name](page);
  if (name === 'cal' && currentRole === 'athlete') setTimeout(checkUnreadMessages, 100);
}

// ── REFRESH données depuis Supabase ───────────────────────────
async function refreshData() {
  try {
    sessionLogs = await DB.getLogs();
    poidsData = await DB.getPoids();
    messages = await DB.getMessages();
    planOverrides = await DB.getPlanOverrides();
  } catch (e) { console.error('Refresh error', e); }
}

// ── CALENDRIER ────────────────────────────────────────────────
function renderCal(container) {
  const plan = getPlan();
  const today = new Date();
  container.innerHTML = `<div class="card">
    <div class="cal-nav">
      <button class="cal-btn" onclick="prevMonth()">‹</button>
      <div class="month-name">${MONTHS[calMonth]} ${calYear}</div>
      <button class="cal-btn" onclick="nextMonth()">›</button>
    </div>
    <div class="legend">
      <div class="leg"><div class="leg-dot" style="background:#c8a96e"></div>Force</div>
      <div class="leg"><div class="leg-dot" style="background:#e0b060"></div>Force KB</div>
      <div class="leg"><div class="leg-dot" style="background:#7eb87a"></div>Cardio</div>
      <div class="leg"><div class="leg-dot" style="background:#c87ab8"></div>Mobilité</div>
      <div class="leg"><div class="leg-dot" style="background:#7a9ec8"></div>Bad</div>
    </div>
    <div class="cal-grid">
      <div class="cal-hdr">L</div><div class="cal-hdr">Ma</div><div class="cal-hdr">Me</div>
      <div class="cal-hdr">J</div><div class="cal-hdr">V</div><div class="cal-hdr">S</div><div class="cal-hdr">D</div>
    </div>
    <div class="cal-grid" id="cal-body"></div>
  </div><div id="day-detail"></div>`;
  const body = document.getElementById('cal-body');
  let sd = new Date(calYear, calMonth, 1).getDay();
  sd = sd === 0 ? 6 : sd - 1;
  const dim = new Date(calYear, calMonth + 1, 0).getDate();
  let rows = '';
  for (let i = 0; i < sd; i++) rows += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const isConge = CONGES.includes(ds);
    const ps = plan[ds] || [];
    const log = sessionLogs[ds];
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isConge) cls += ' conge';
    if (log?.status === 'done') cls += ' done';
    else if (log?.status === 'skipped') cls += ' skipped';
    const dot = ps.length > 0 ? `<div class="cal-dot" style="background:${TYPE_COLORS[ps[0].type] || '#5c6354'}"></div>` : '';
    rows += `<div class="${cls}" onclick="selectDay('${ds}')"><div class="cal-dn">${d}</div>${dot}</div>`;
  }
  body.innerHTML = rows;
}
function prevMonth() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } showPage('cal'); }
function nextMonth() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } showPage('cal'); }

function selectDay(ds) {
  selectedDate = ds;
  const plan = getPlan();
  const ps = plan[ds] || [];
  const log = sessionLogs[ds];
  const isConge = CONGES.includes(ds);
  const d = new Date(ds + 'T12:00:00');
  const dateStr = d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let html = `<div class="card"><div class="card-title">${dateStr}</div>`;
  if (isConge) {
    html += `<div style="color:#7a9ec8;font-size:12px;">🏖 Congés — pas de séance prévue</div>`;
  } else if (ps.length === 0) {
    html += `<div style="color:#5c6354;font-size:12px;">Pas de séance prévue — repos</div>`;
  } else {
    ps.forEach((s, idx) => {
      html += `<div class="session-row">
        <div class="s-dot" style="background:${TYPE_COLORS[s.type] || '#5c6354'}"></div>
        <div style="flex:1">
          <div style="font-size:12px;color:#e8ead5;">${s.label}</div>
          <div style="font-size:10px;color:#5c6354;">${s.detail || ''}</div>
          ${s.coachNote ? `<div style="font-size:10px;color:#c8a96e;margin-top:3px;padding:3px 6px;background:#2a1f00;border-radius:3px;">🎯 Coach : ${s.coachNote}</div>` : ''}
        </div>
        ${currentRole === 'coach' ? `<button class="btn" style="border-color:#185FA5;color:#7a9ec8;font-size:10px;padding:3px 7px;" onclick="openEditSession('${ds}',${idx})">✏️</button>` : ''}
      </div>`;
    });
    if (log) {
      const scol = { done: '#7eb87a', skipped: '#c47a6a', moved: '#c8a96e' };
      const slab = { done: 'Faite', skipped: 'Supprimée', moved: 'Déplacée' };
      html += `<div style="margin-top:8px;padding:8px;background:#1e2219;border-radius:6px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px;color:${scol[log.status]}">${slab[log.status]}</span>
          ${log.rpe ? `<span style="font-family:'Fraunces',serif;font-size:16px;color:#7eb87a">RPE ${log.rpe}</span>` : ''}
        </div>
        ${log.notes ? `<div style="font-size:11px;color:#9aa08a;margin-top:3px;font-style:italic;">${log.notes}</div>` : ''}
      </div>`;
    }
    html += `<button class="btn btn-primary" style="margin-top:10px;" onclick="openSessionModal('${ds}')">${log ? 'Modifier la séance' : 'Enregistrer la séance'}</button>`;
    if (currentRole === 'coach') {
      html += `<button class="btn" style="margin-top:6px;width:100%;border-color:#353b31;background:#1e2219;color:#9aa08a;font-size:11px;" onclick="openAddSessionForDate('${ds}')">+ Ajouter une séance ce jour</button>`;
    }
  }
  html += `</div>`;
  document.getElementById('day-detail').innerHTML = html;
}

// ── SESSION LOG ───────────────────────────────────────────────
function openSessionModal(ds) {
  selectedDate = ds;
  const plan = getPlan();
  const ps = plan[ds] || [];
  const d = new Date(ds + 'T12:00:00');
  document.getElementById('ms-title').textContent =
    d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' — ' + ps.map(s => s.label).join(', ');
  const ex = sessionLogs[ds] || {};
  currentStatus = ex.status || null;
  document.getElementById('ms-rpe').value = ex.rpe || 6;
  document.getElementById('ms-rpe-val').textContent = ex.rpe || 6;
  document.getElementById('ms-notes').value = ex.notes || '';
  updateStatusBtns();
  document.getElementById('modal-session').classList.remove('hidden');
}
function setStatus(s) { currentStatus = s; updateStatusBtns(); }
function updateStatusBtns() {
  ['done', 'skipped', 'moved'].forEach(s => {
    document.getElementById('ms-' + s).className = 'status-btn' + (currentStatus === s ? ' sel-' + s : '');
  });
  document.getElementById('ms-rpe-row').style.opacity = currentStatus === 'skipped' ? '0.4' : '1';
}
async function saveSessionLog() {
  if (!selectedDate || !currentStatus) return;
  const log = {
    status: currentStatus,
    rpe: currentStatus !== 'skipped' ? parseInt(document.getElementById('ms-rpe').value) : null,
    notes: document.getElementById('ms-notes').value.trim(),
    savedAt: new Date().toISOString()
  };
  showLoader('Enregistrement…');
  try {
    await DB.saveLog(selectedDate, log);
    sessionLogs[selectedDate] = log;
  } catch (e) { console.error(e); }
  hideLoader();
  closeModal('modal-session');
  showPage('cal');
}

// ── PLAN ──────────────────────────────────────────────────────
function renderPlan(container) {
  let html = '';
  PLAN_DETAIL.forEach(section => {
    html += `<div class="card"><div class="phase-hdr">${section.phase}</div>`;
    section.exercises.forEach(ex => {
      html += `<div class="ex-item">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-detail">${ex.detail}</div>
        <div class="ex-cue">${ex.cues}</div>
      </div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

// ── POIDS ─────────────────────────────────────────────────────
function renderPoids(container) {
  container.innerHTML = `<div class="card">
    <div class="card-title">Suivi du poids</div>
    <div class="poids-form">
      <input type="number" class="poids-input" id="poids-in" placeholder="85.0" step="0.1" min="70" max="120">
      <button class="btn-add" onclick="addPoids()">+ Ajouter</button>
    </div>
    <svg id="poids-svg" viewBox="0 0 400 140" preserveAspectRatio="none" style="width:100%;height:140px;display:block;"></svg>
    <div class="poids-stats" id="poids-stats"></div>
    <div id="poids-traject"></div>
    <div style="font-size:11px;color:#5c6354;margin-top:10px;line-height:1.5;">Fréquence conseillée : 2×/sem · matin à jeun · même conditions.</div>
  </div>`;
  drawPoids();
}
async function addPoids() {
  const v = parseFloat(document.getElementById('poids-in').value);
  if (isNaN(v) || v < 60 || v > 130) return;
  const entry = { date: new Date().toISOString().split('T')[0], poids: v };
  showLoader('Enregistrement…');
  try {
    await DB.addPoids(entry.date, entry.poids);
    poidsData.push(entry);
  } catch (e) { console.error(e); }
  hideLoader();
  document.getElementById('poids-in').value = '';
  drawPoids();
}
function drawPoids() {
  const svg = document.getElementById('poids-svg');
  const stats = document.getElementById('poids-stats');
  const traj = document.getElementById('poids-traject');
  if (!svg) return;
  if (poidsData.length === 0) {
    svg.innerHTML = '<text x="200" y="75" text-anchor="middle" fill="#5c6354" font-family="DM Mono" font-size="12">Aucune donnée</text>';
    stats.innerHTML = '';
    traj.innerHTML = '<div class="traject t-warn">Ajoute ta première pesée pour démarrer le suivi.</div>';
    return;
  }
  const W = 400, H = 140, P = 30, n = poidsData.length;
  const weights = poidsData.map(p => p.poids);
  const minW = Math.min(...weights, 80) - 2, maxW = Math.max(...weights, 88) + 2;
  const xs = i => P + (i / Math.max(n - 1, 7)) * (W - 2 * P);
  const ys = v => P + (1 - (v - minW) / (maxW - minW)) * (H - 2 * P);
  let sc = '';
  for (let v = Math.ceil(minW); v <= Math.floor(maxW); v += 2) {
    const y = ys(v);
    sc += `<line x1="${P}" y1="${y}" x2="${W - P}" y2="${y}" stroke="#2a2f27" stroke-width="1"/>`;
    sc += `<text x="${P - 3}" y="${y + 4}" text-anchor="end" fill="#5c6354" font-size="9" font-family="DM Mono">${v}</text>`;
  }
  sc += `<line x1="${P}" y1="${ys(85)}" x2="${W - P}" y2="${ys(83)}" stroke="#4a8a46" stroke-width="1" stroke-dasharray="4,3" opacity=".7"/>`;
  sc += `<text x="${W - P - 2}" y="${ys(84) - 4}" text-anchor="end" fill="#4a8a46" font-size="9" font-family="DM Mono">Cible ~83–85kg</text>`;
  if (n > 1) sc += `<polyline points="${poidsData.map((p, i) => `${xs(i)},${ys(p.poids)}`).join(' ')}" fill="none" stroke="#7eb87a" stroke-width="2"/>`;
  poidsData.forEach((p, i) => { sc += `<circle cx="${xs(i)}" cy="${ys(p.poids)}" r="4" fill="#7eb87a" stroke="#0f110e" stroke-width="2"/>`; });
  svg.innerHTML = sc;
  const first = poidsData[0].poids, last = poidsData[n - 1].poids, diff = (last - first).toFixed(1);
  stats.innerHTML = `
    <div class="stat-box"><div class="stat-val">${last} kg</div><div class="stat-label">Actuel</div></div>
    <div class="stat-box"><div class="stat-val" style="color:${diff <= 0 ? '#7eb87a' : '#c47a6a'}">${diff > 0 ? '+' : ''}${diff}</div><div class="stat-label">Depuis début</div></div>
    <div class="stat-box"><div class="stat-val">${(last - 84).toFixed(1)}</div><div class="stat-label">Vs cible</div></div>`;
  const weeks = n > 1 ? Math.max(1, Math.round((new Date(poidsData[n - 1].date) - new Date(poidsData[0].date)) / (7 * 24 * 3600 * 1000))) : 1;
  const rate = (first - last) / weeks;
  traj.innerHTML = n < 2 ? '<div class="traject t-warn">Ajoute au moins 2 pesées pour voir la trajectoire.</div>' :
    rate >= 0.4 ? `<div class="traject t-ok">✓ ~${rate.toFixed(2)} kg/sem — dans la trajectoire cible.</div>` :
    rate > 0 ? `<div class="traject t-warn">⚠ ~${rate.toFixed(2)} kg/sem — légèrement sous la cible.</div>` :
    '<div class="traject t-alert">↑ Poids stable ou en hausse. Ajuster l\'alimentation.</div>';
}

// ── HISTORIQUE ────────────────────────────────────────────────
function renderHistorique(container) {
  const plan = getPlan();
  const entries = Object.entries(sessionLogs).sort((a, b) => b[0].localeCompare(a[0]));
  let html = '<div class="card"><div class="card-title">Historique des séances</div>';
  if (entries.length === 0) { html += '<div class="empty">Aucune séance enregistrée</div>'; }
  else {
    const sl = { done: 'Faite', skipped: 'Supprimée', moved: 'Déplacée' };
    const sc = { done: 'sb-done', skipped: 'sb-skipped', moved: 'sb-moved' };
    entries.forEach(([date, log]) => {
      const ps = plan[date] || [];
      const label = ps.map(s => s.label).join(', ') || 'Séance';
      const d = new Date(date + 'T12:00:00');
      const ds = d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
      html += `<div class="hist-item">
        <div class="hist-header">
          <div><span class="hist-date">${ds}</span> — <span style="font-size:11px;color:#9aa08a;">${label}</span></div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${log.rpe ? `<span class="hist-rpe" style="color:${log.rpe >= 8 ? '#c47a6a' : log.rpe >= 5 ? '#c8a96e' : '#7eb87a'}">RPE ${log.rpe}</span>` : ''}
            <span class="sb ${sc[log.status]}">${sl[log.status]}</span>
          </div>
        </div>
        ${log.notes ? `<div class="hist-note">"${log.notes}"</div>` : ''}
      </div>`;
    });
  }
  html += '</div>';
  container.innerHTML = html;
}

// ── ANALYSE IA ────────────────────────────────────────────────
function renderAnalyse(container) {
  const entries = Object.entries(sessionLogs).sort((a, b) => a[0].localeCompare(b[0]));
  const done = entries.filter(([, v]) => v.status === 'done');
  const skipped = entries.filter(([, v]) => v.status === 'skipped');
  const rpes = done.filter(([, v]) => v.rpe).map(([d, v]) => ({ date: d, rpe: v.rpe, notes: v.notes || '' }));
  const avgRpe = rpes.length > 0 ? (rpes.reduce((a, b) => a + b.rpe, 0) / rpes.length).toFixed(1) : null;
  container.innerHTML = `<div class="card">
    <div class="card-title">Analyse IA — Conseils adaptatifs</div>
    <div class="data-stats">
      <div class="stat-box"><div class="stat-val">${done.length}</div><div class="stat-label">Séances faites</div></div>
      <div class="stat-box"><div class="stat-val">${avgRpe || '—'}</div><div class="stat-label">RPE moyen</div></div>
      <div class="stat-box"><div class="stat-val">${skipped.length}</div><div class="stat-label">Sautées</div></div>
    </div>
    <button class="btn btn-primary" id="btn-analyse" onclick="runAnalyse(${JSON.stringify(rpes.slice(-5))}, ${JSON.stringify(poidsData.slice(-5))})">
      ⚡ Générer les conseils pour les prochaines séances
    </button>
    <div class="analyse-result loading" id="analyse-result" style="margin-top:10px;">Lance une analyse pour obtenir des conseils personnalisés.</div>
    <div id="analyse-date" style="font-size:10px;color:#5c6354;text-align:right;margin-top:6px;"></div>
  </div>`;
}
async function runAnalyse(lastRpes, lastPoids) {
  const btn = document.getElementById('btn-analyse');
  const result = document.getElementById('analyse-result');
  btn.disabled = true; btn.textContent = 'Analyse en cours...';
  result.className = 'analyse-result loading'; result.textContent = 'Analyse de tes données...';
  const poidsInfo = lastPoids.length >= 2 ? `${lastPoids[0].poids}kg → ${lastPoids[lastPoids.length - 1].poids}kg` : 'Pas encore de données poids';
  const plan = getPlan(); const today = new Date(); const nextSessions = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (plan[ds]) nextSessions.push({ date: ds, sessions: plan[ds].map(s => s.label).join(', ') });
  }
  const prompt = `Tu es le coach sportif de ${ATHLETE_NAME}, 40 ans, joueur de badminton (reprise saison octobre 2026). Tendon Achille droit fragile.\n\nDONNÉES :\n${lastRpes.length > 0 ? lastRpes.map(r => `- ${r.date} · RPE ${r.rpe}${r.notes ? ' · "' + r.notes + '"' : ''}`).join('\n') : 'Aucune séance enregistrée encore'}\nPoids : ${poidsInfo}\nProchaines séances : ${nextSessions.map(s => `${s.date}: ${s.sessions}`).join(' | ') || 'aucune'}\n\nDonne 5 conseils CONCIS et ACTIONNABLES. Commence chaque conseil par une emoji. Sois direct.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    result.className = 'analyse-result';
    result.innerHTML = (data.content?.[0]?.text || 'Erreur').replace(/\n/g, '<br>');
    document.getElementById('analyse-date').textContent = 'Dernière analyse : ' + new Date().toLocaleString('fr-BE');
  } catch (e) {
    result.className = 'analyse-result error'; result.textContent = 'Erreur de connexion.';
  }
  btn.disabled = false; btn.textContent = '⚡ Générer les conseils pour les prochaines séances';
}

// ── COACH ─────────────────────────────────────────────────────
function renderCoach(container) {
  const plan = getPlan(); const today = new Date();
  const upcomingSessions = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (plan[ds]) upcomingSessions.push({ date: ds, sessions: plan[ds] });
  }
  const recentLogs = Object.entries(sessionLogs).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
  const rpes = recentLogs.filter(([, v]) => v.rpe).map(([d, v]) => ({ date: d, rpe: v.rpe }));

  let html = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div class="card-title" style="margin:0;">Vue d'ensemble — ${ATHLETE_NAME}</div>
      <button class="btn" style="border-color:#353b31;color:#9aa08a;font-size:10px;padding:4px 8px;" onclick="reloadCoachData()">↻ Rafraîchir</button>
    </div>
    <div class="data-stats">
      <div class="stat-box"><div class="stat-val">${Object.values(sessionLogs).filter(v => v.status === 'done').length}</div><div class="stat-label">Séances faites</div></div>
      <div class="stat-box"><div class="stat-val">${rpes.length > 0 ? (rpes.reduce((a, b) => a + b.rpe, 0) / rpes.length).toFixed(1) : '—'}</div><div class="stat-label">RPE moyen</div></div>
      <div class="stat-box"><div class="stat-val">${poidsData.length > 0 ? poidsData[poidsData.length - 1].poids + 'kg' : '—'}</div><div class="stat-label">Dernier poids</div></div>
    </div>
  </div>`;

  html += `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div class="card-title" style="margin:0;">Messages à ${ATHLETE_NAME}</div>
      <button class="btn" style="border-color:#c8a96e;color:#c8a96e;font-size:11px;padding:5px 10px;" onclick="openMessageModal()">+ Nouveau</button>
    </div>`;
  if (messages.length === 0) { html += `<div class="empty">Aucun message envoyé</div>`; }
  else {
    messages.slice().reverse().slice(0, 5).forEach(m => {
      html += `<div class="message-box">
        <div class="message-from">Toi → ${ATHLETE_NAME} ${m.read_by_athlete ? '· <span style="color:#7eb87a">Lu</span>' : '· <span style="color:#5c6354">Non lu</span>'}</div>
        <div class="message-text">${m.text}</div>
        <div class="message-date">${new Date(m.created_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      </div>`;
    });
  }
  html += `</div>`;

  html += `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div class="card-title" style="margin:0;">Prochaines séances <span class="coach-badge">Modifiables</span></div>
      <button class="btn" style="border-color:#185FA5;color:#7a9ec8;font-size:11px;padding:5px 10px;" onclick="openAddModal()">+ Ajouter</button>
    </div>`;
  if (upcomingSessions.length === 0) { html += `<div class="empty">Aucune séance dans les 14 prochains jours</div>`; }
  else {
    upcomingSessions.forEach(({ date, sessions }) => {
      const d = new Date(date + 'T12:00:00');
      const ds = d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
      sessions.forEach((s, idx) => {
        html += `<div class="edit-session-card" onclick="openEditSession('${date}',${idx})">
          <div class="esc-date">${ds}</div>
          <div class="esc-name">${s.label}</div>
          <div class="esc-detail">${s.detail || ''}</div>
          ${s.coachNote ? `<div style="font-size:10px;color:#c8a96e;margin-top:2px;">📌 ${s.coachNote}</div>` : ''}
        </div>`;
      });
    });
  }
  html += `</div>`;

  html += `<div class="card"><div class="card-title">Analyse IA — Vue coach</div>
    <button class="btn btn-blue" id="btn-coach-analyse" onclick="runCoachAnalyse()">⚡ Analyser et conseiller ${ATHLETE_NAME}</button>
    <div class="analyse-result loading" id="coach-analyse-result" style="margin-top:10px;">Lance une analyse pour obtenir des recommandations.</div>
  </div>`;

  container.innerHTML = html;
}

async function reloadCoachData() {
  showLoader('Rafraîchissement…');
  await refreshData();
  hideLoader();
  showPage('coach');
}

function openMessageModal() { document.getElementById('modal-message').classList.remove('hidden'); }
async function sendMessage() {
  const text = document.getElementById('msg-text').value.trim();
  if (!text) return;
  showLoader('Envoi…');
  try {
    await DB.addMessage(text);
    messages = await DB.getMessages();
  } catch (e) { console.error(e); }
  hideLoader();
  closeModal('modal-message');
  document.getElementById('msg-text').value = '';
  showPage('coach');
}

function openEditSession(date, idx) {
  const plan = getPlan();
  const sessions = plan[date] || [];
  const s = sessions[idx];
  if (!s) return;
  const d = new Date(date + 'T12:00:00');
  document.getElementById('mes-title').textContent = d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' — Modifier';
  document.getElementById('mes-date').value = date;
  document.getElementById('mes-idx').value = idx;
  document.getElementById('mes-label').value = s.label || '';
  document.getElementById('mes-detail').value = s.detail || '';
  document.getElementById('mes-coach-note').value = s.coachNote || '';
  document.getElementById('modal-edit-session').classList.remove('hidden');
}
function openAddModal() { document.getElementById('modal-add-session').classList.remove('hidden'); }
function openAddSessionForDate(date) {
  document.getElementById('mas-date').value = date;
  document.getElementById('modal-add-session').classList.remove('hidden');
}

async function saveEditSession() {
  const date = document.getElementById('mes-date').value;
  const idx = parseInt(document.getElementById('mes-idx').value);
  const plan = getPlan();
  const sessions = JSON.parse(JSON.stringify(plan[date] || []));
  if (!sessions[idx]) return;
  sessions[idx].label = document.getElementById('mes-label').value;
  sessions[idx].detail = document.getElementById('mes-detail').value;
  const note = document.getElementById('mes-coach-note').value.trim();
  if (note) sessions[idx].coachNote = note; else delete sessions[idx].coachNote;
  if (!planOverrides.sessions) planOverrides.sessions = {};
  planOverrides.sessions[date] = sessions;
  showLoader('Sauvegarde…');
  try { await DB.savePlanOverride('sessions', planOverrides.sessions); } catch (e) { console.error(e); }
  hideLoader();
  closeModal('modal-edit-session');
  showPage('coach');
}

async function deleteSession() {
  const date = document.getElementById('mes-date').value;
  const idx = parseInt(document.getElementById('mes-idx').value);
  const plan = getPlan();
  const sessions = JSON.parse(JSON.stringify(plan[date] || []));
  sessions.splice(idx, 1);
  if (!planOverrides.sessions) planOverrides.sessions = {};
  planOverrides.sessions[date] = sessions.length > 0 ? sessions : null;
  showLoader('Suppression…');
  try { await DB.savePlanOverride('sessions', planOverrides.sessions); } catch (e) { console.error(e); }
  hideLoader();
  closeModal('modal-edit-session');
  showPage('coach');
}

async function addNewSession() {
  const date = document.getElementById('mas-date').value;
  const type = document.getElementById('mas-type').value;
  const label = document.getElementById('mas-label').value;
  const detail = document.getElementById('mas-detail').value;
  if (!date || !label) return;
  const plan = getPlan();
  const sessions = JSON.parse(JSON.stringify(plan[date] || []));
  sessions.push({ type, label, detail });
  if (!planOverrides.sessions) planOverrides.sessions = {};
  planOverrides.sessions[date] = sessions;
  showLoader('Ajout…');
  try { await DB.savePlanOverride('sessions', planOverrides.sessions); } catch (e) { console.error(e); }
  hideLoader();
  closeModal('modal-add-session');
  showPage('coach');
}

async function runCoachAnalyse() {
  const btn = document.getElementById('btn-coach-analyse');
  const result = document.getElementById('coach-analyse-result');
  btn.disabled = true; btn.textContent = 'Analyse en cours...';
  result.className = 'analyse-result loading'; result.textContent = `Analyse des données de ${ATHLETE_NAME}...`;
  const recentLogs = Object.entries(sessionLogs).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  const rpes = recentLogs.filter(([, v]) => v.rpe).map(([d, v]) => ({ date: d, rpe: v.rpe, notes: v.notes || '' }));
  const poidsInfo = poidsData.length >= 2 ? `${poidsData[0].poids}kg → ${poidsData[poidsData.length - 1].poids}kg` : 'Pas encore de données';
  const skipped = Object.values(sessionLogs).filter(v => v.status === 'skipped').length;
  const plan = getPlan(); const today = new Date(); const next = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (plan[ds]) next.push(`${ds}: ${plan[ds].map(s => s.label).join(', ')}`);
  }
  const prompt = `Tu es un coach sportif expert. Analyse les données de ${ATHLETE_NAME} (40 ans, badminton, tendon Achille droit fragile, reprise saison octobre 2026).\n\nDONNÉES :\n- Séances faites : ${Object.values(sessionLogs).filter(v => v.status === 'done').length} · Sautées : ${skipped}\n- Derniers RPE : ${rpes.length > 0 ? rpes.map(r => `${r.date} RPE${r.rpe}${r.notes ? ' (' + r.notes + ')' : ''}`).join(' | ') : 'pas encore de données'}\n- Poids : ${poidsInfo}\n- Prochaines séances : ${next.join(' | ') || 'aucune planifiée'}\n\nDonne :\n1. Analyse courte de l'état de forme (2–3 phrases)\n2. 3 ajustements concrets à faire dans le plan\n3. Signal Achille à surveiller si pertinent\n\nFormat direct, sans préambule.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    result.className = 'analyse-result';
    result.innerHTML = (data.content?.[0]?.text || 'Erreur').replace(/\n/g, '<br>');
  } catch (e) {
    result.className = 'analyse-result error'; result.textContent = 'Erreur de connexion.';
  }
  btn.disabled = false; btn.textContent = `⚡ Analyser et conseiller ${ATHLETE_NAME}`;
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings(container) {
  container.innerHTML = `<div class="card"><div class="card-title">Réglages</div>
    <div class="settings-row">
      <div><div class="settings-label">PIN Athlète (${ATHLETE_NAME})</div><div class="settings-sub">Défaut : 1234</div></div>
      <input type="password" id="set-pin-athlete" placeholder="Nouveau PIN" style="width:120px;">
    </div>
    <div class="settings-row">
      <div><div class="settings-label">PIN Coach</div><div class="settings-sub">Défaut : 9999</div></div>
      <input type="password" id="set-pin-coach" placeholder="Nouveau PIN" style="width:120px;">
    </div>
    <button class="btn btn-primary" onclick="savePins()">Sauvegarder les PIN</button>
  </div>
  <div class="card" style="margin-top:12px;"><div class="card-title">Messages</div>
    <button class="btn" style="width:100%;border-color:#353b31;color:#9aa08a;" onclick="markAllRead()">Marquer tous les messages comme lus par ${ATHLETE_NAME}</button>
  </div>`;
}
async function savePins() {
  const a = document.getElementById('set-pin-athlete')?.value.trim();
  const c = document.getElementById('set-pin-coach')?.value.trim();
  showLoader('Sauvegarde…');
  try {
    if (a && a.length === 4 && /^\d+$/.test(a)) {
      const h = await hashPin(a);
      await DB.setConfig('pin_athlete', h);
    }
    if (c && c.length === 4 && /^\d+$/.test(c)) {
      const h = await hashPin(c);
      await DB.setConfig('pin_coach', h);
    }
  } catch (e) { console.error(e); }
  hideLoader();
  alert('PIN sauvegardés avec succès.');
}
async function markAllRead() {
  showLoader('Mise à jour…');
  try {
    await DB.markMessagesRead();
    messages = await DB.getMessages();
  } catch (e) { console.error(e); }
  hideLoader();
  showPage('settings');
}

// ── MESSAGES NON LUS ──────────────────────────────────────────
function checkUnreadMessages() {
  const unread = messages.filter(m => !m.read_by_athlete);
  if (unread.length > 0) {
    const mc = document.getElementById('main-content');
    if (mc.querySelector('.coach-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'coach-banner';
    banner.style.cssText = 'background:#2a1f00;border:1px solid #c8a96e;border-radius:6px;padding:10px 14px;margin-bottom:10px;cursor:pointer;';
    banner.innerHTML = `<div style="font-size:11px;color:#c8a96e;font-weight:500;">📩 ${unread.length} message${unread.length > 1 ? 's' : ''} de ton coach</div><div style="font-size:12px;color:#e8ead5;margin-top:4px;">"${unread[0].text.slice(0, 80)}${unread[0].text.length > 80 ? '…' : ''}"</div>`;
    banner.onclick = async () => {
      try { await DB.markMessagesRead(); messages = await DB.getMessages(); } catch (e) {}
      banner.remove();
    };
    if (mc.firstChild) mc.insertBefore(banner, mc.firstChild); else mc.appendChild(banner);
  }
}

// ── UTILS ─────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

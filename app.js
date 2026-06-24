// ═══════════════════════════════════════════════════════════════
// Bad · Nicolas — app.js  (version finale)
// Supabase backend · 6 onglets + Coach
// ═══════════════════════════════════════════════════════════════

// ── SUPABASE ──────────────────────────────────────────────────
const SB_URL = 'https://zuxkbilztknthcsfulyk.supabase.co';
const SB_KEY = 'sb_publishable_qWhizpkvYsJqQdChH-Od8A_6KPIjoRC';

async function sbFetch(method, table, body = null, qs = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${qs}`, {
    method,
    headers: {
      'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST'
        ? 'resolution=merge-duplicates,return=representation'
        : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`${method} ${table} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const DB = {
  async getLogs() {
    const rows = await sbFetch('GET','session_logs',null,'?select=*') || [];
    const out = {};
    rows.forEach(r => { out[r.date]={status:r.status,rpe:r.rpe,notes:r.notes,savedAt:r.saved_at}; });
    return out;
  },
  async saveLog(date,log){ await sbFetch('POST','session_logs',{date,status:log.status,rpe:log.rpe,notes:log.notes,saved_at:log.savedAt}); },
  async getPoids(){ return await sbFetch('GET','poids',null,'?select=*&order=created_at.asc')||[]; },
  async addPoids(date,poids){ await sbFetch('POST','poids',{date,poids}); },
  async getMessages(){ return await sbFetch('GET','messages',null,'?select=*&order=created_at.asc')||[]; },
  async addMessage(text){ await sbFetch('POST','messages',{text,read_by_athlete:false}); },
  async markRead(){ await sbFetch('PATCH','messages',{read_by_athlete:true},'?read_by_athlete=eq.false'); },
  async getDiscussions(){ return await sbFetch('GET','discussions',null,'?select=*&order=created_at.asc')||[]; },
  async addDiscussion(author,text,sessionRef=null){ await sbFetch('POST','discussions',{author,text,session_ref:sessionRef}); },
  async getPlanOverrides(){
    const rows = await sbFetch('GET','plan_overrides',null,'?select=*')||[];
    const out = {};
    rows.forEach(r => { out[r.key]=r.value; });
    return {
      sessions: out.sessions || null,
      exercises: out.exercises || null
    };
  },
  async savePlanOverride(key,value){ await sbFetch('POST','plan_overrides',{key,value}); },
  async getConfig(key){
    const r = await sbFetch('GET','config',null,`?key=eq.${key}&select=value`)||[];
    return r[0]?.value||null;
  },
  async setConfig(key,value){ await sbFetch('POST','config',{key,value}); }
};

// ── SHA-256 ───────────────────────────────────────────────────
async function sha256(s){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

// ── PLAN DE BASE ──────────────────────────────────────────────
const BASE_PLAN = {
  "2026-06-30":[{type:'force',label:'Force A',detail:"Parking · poids corps 30'"}],
  "2026-07-02":[{type:'force',label:'Force B',detail:"Parking · core + haut 30'"}],
  "2026-07-03":[{type:'cardio',label:"EF 30'",detail:'Forêt · zone 2'}],
  "2026-07-07":[{type:'force',label:'Force A',detail:"Parking · poids corps 30'"}],
  "2026-07-09":[{type:'force',label:'Force B',detail:"Parking · haut + core 30'"}],
  "2026-07-10":[{type:'cardio',label:"EF 30'",detail:'Forêt · zone 2'}],
  "2026-07-14":[{type:'force',label:'Force A',detail:"Parking · bulgare + step-up 35'"}],
  "2026-07-16":[{type:'force',label:'Force B',detail:"Parking · anti-rotation 30'"}],
  "2026-07-17":[{type:'cardio',label:'Intervalles',detail:"Piste · 6×2'/2'"}],
  "2026-07-21":[{type:'force',label:'Force A+',detail:"Parking · explosivité douce 35'"}],
  "2026-07-23":[{type:'force',label:'Force B+',detail:"Parking · core avancé 30'"}],
  "2026-07-24":[{type:'cardio',label:"EF 35'",detail:'Forêt · zone 2'}],
  "2026-07-28":[{type:'force',label:'Force A',detail:'Parking · élastiques + swissball'}],
  "2026-07-30":[{type:'force',label:'Force B',detail:'Parking · Pallof press élastique'}],
  "2026-07-31":[{type:'cardio',label:'Intervalles',detail:"Piste · 8×2'/90s"}],
  "2026-08-04":[{type:'cardio',label:"EF 30'",detail:'Terrain vacances · zone 2'}],
  "2026-08-06":[{type:'force',label:'Force · poids corps',detail:"Circuit 30'"}],
  "2026-08-07":[{type:'cardio',label:"EF 35'",detail:'Zone 2 vacances'}],
  "2026-08-11":[{type:'cardio',label:'Intervalles',detail:"6×2' terrain libre"}],
  "2026-08-13":[{type:'force',label:'Force · poids corps',detail:"Circuit complet 35'"}],
  "2026-08-14":[{type:'cardio',label:"EF 35'",detail:'Zone 2 vacances'}],
  "2026-08-18":[{type:'force',label:'KB intro · technique',detail:'Gobelet + hip hinge 16 kg · parking'}],
  "2026-08-20":[{type:'kb',label:'KB Force A',detail:"Swing 16 kg + gobelet · 40'"}],
  "2026-08-21":[{type:'cardio',label:"EF 35'",detail:'Forêt · remise en route'}],
  "2026-08-25":[{type:'kb',label:'KB Force A',detail:"Swing 16 kg + hip thrust · 40'"}],
  "2026-08-27":[{type:'kb',label:'KB Force B',detail:"Fente lat. + row + Pallof · 40'"}],
  "2026-08-28":[{type:'cardio',label:'Intervalles',detail:"Piste · 6×3'/2'"}],
  "2026-09-01":[{type:'kb',label:'KB circuit',detail:"Swing + gobelet + row + core · 40'"}],
  "2026-09-03":[{type:'kb',label:'KB Force B+',detail:'Suitcase carry + gainage'}],
  "2026-09-04":[{type:'cardio',label:"EF 40'",detail:'Forêt · zone 2'}],
  "2026-09-08":[{type:'kb',label:'KB Force A+',detail:"Swing 20 kg · 40'"}],
  "2026-09-10":[{type:'kb',label:'KB circuit complet',detail:"Swing 20 kg + TGU intro · 45'"}],
  "2026-09-11":[{type:'cardio',label:'Intervalles',detail:"Piste · 8×3'/90s"}],
  "2026-09-15":[{type:'kb',label:'KB Force A',detail:"Décharge 50% · swing 16 kg · 30'"}],
  "2026-09-17":[{type:'mob',label:'Mobilité + KB léger',detail:"Élastiques + swissball · 25'"}],
  "2026-09-18":[{type:'cardio',label:"EF léger 25'",detail:'Forêt · zone 2'}],
};

const CONGES = ['2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05',
  '2026-08-06','2026-08-07','2026-08-08','2026-08-09','2026-08-10',
  '2026-08-11','2026-08-12','2026-08-13','2026-08-14','2026-08-15'];

// ── SÉANCES TYPE BASE ─────────────────────────────────────────
const BASE_SESSION_TYPES = {
  force_a: {
    name:'Force A — Bas du corps',
    warmup:"5 min · marche rapide + mobilité dynamique (cercles bras, fentes légères)",
    exercises:[
      {name:'Squat gobelet',sets:"3×10 · repos 75s",cues:"1. Dos droit, poitrine haute — le KB tire vers l'avant, résister. 2. Genoux dans l'axe des orteils, talons au sol. 3. Descente 2–3s, pousser dans les talons à la remontée."},
      {name:'Hip thrust sol',sets:"3×12 · repos 60s",cues:"1. Pousser dans les talons — jamais la pointe du pied. 2. Contraction fessiers 2s en haut, aligner épaules–hanches–genoux. 3. Ne pas hyperétendre le bas du dos en haut."},
      {name:'Fente avant unilatérale',sets:"3×8/côté · repos 75s",cues:"1. Genou avant dans l'axe du pied, ne pas dépasser la cheville. 2. Buste droit, regard devant. 3. Réduire amplitude si gêne Achille côté droit."},
      {name:'Élévation mollet ★ Achille',sets:"Sur marche · 3×15 · descente 4s",cues:"1. Montée 2 pieds → descente 4s sur pied droit uniquement. 2. Descendre SOUS le niveau de la marche — amplitude complète. 3. Rambarde pour équilibre uniquement, pas pour alléger la charge."},
      {name:'Step-up',sets:"Chaise/banc · 3×10/côté",cues:"1. Pousser dans le talon du pied posé sur la marche. 2. Genou au-dessus du pied, jamais en valgus. 3. Réception douce — surveiller Achille droit."},
    ],
    cooldown:"Protocole Achille (excentrique 3×15) + étirements mollet 2×45s/côté"
  },
  force_b: {
    name:'Force B — Haut + Core',
    warmup:"5 min · mobilité épaule (cercles) + rotation thoracique debout",
    exercises:[
      {name:'Pompes',sets:"3×10 · repos 60s",cues:"1. Corps en planche parfaite : fessiers contractés, ventre rentré. 2. Coudes à 45° du corps — pas complètement écartés. 3. Ne pas laisser les hanches s'affaisser ou monter."},
      {name:'Rowing unilatéral',sets:"Élastique ou KB 12 kg → 3×10/côté",cues:"1. Tirer avec le coude vers la poche arrière, pas avec la main. 2. Dos plat, ne pas vriller le torse. 3. Descente contrôlée 2–3s, pause 1s en haut."},
      {name:'Dead bug',sets:"3×8/côté · poids corps",cues:"1. Bas du dos collé au sol en permanence — c'est la condition de l'exercice. 2. Expirer pendant le mouvement pour maintenir le gainage. 3. Si le dos se décolle, réduire l'amplitude de la jambe."},
      {name:'Planche frontale',sets:"3×35s → swissball S5+",cues:"1. Fessiers contractés — empêche les hanches de monter. 2. Pousser les coudes dans le sol pour activer épaules et dos. 3. Respiration lente et régulière — ne pas retenir son souffle."},
      {name:'Rotation coiffe élastique ★',sets:"2×15/côté · élastique léger",cues:"1. Coude collé au flanc en permanence — ne pas le laisser s'écarter. 2. Mouvement lent : 2s aller, 3s retour — activation, pas force. 3. Ne pas hausser l'épaule pendant la rotation."},
    ],
    cooldown:"Protocole Achille + thread the needle 2×8/côté"
  },
  kb: {
    name:'Force KB — Chaîne postérieure',
    warmup:"5 min · halo KB 12 kg 3×5/sens + around the world 3×3/sens",
    exercises:[
      {name:'KB Swing à 2 mains',sets:"KB 16→20 kg · 4×10 · repos 60s",cues:"1. Hip hinge explosif : les HANCHES propulsent, les bras guident seulement. 2. Fessiers contractés et abdos gainés en haut — pas de cambrure lombaire. 3. Ne pas laisser les talons se soulever — ancrer les pieds dans le sol."},
      {name:'Gobelet squat KB',sets:"KB 16 kg · 3×8 · repos 75s",cues:"1. Dos droit, KB contre la poitrine. 2. Talons au sol, descente lente 2–3s. 3. Pousser dans les talons à la remontée."},
      {name:'Hip thrust KB',sets:"KB 20 kg · 3×12 · repos 60s",cues:"1. Pousser dans les talons, genoux à 90° en haut. 2. Fessiers contractés 2s en haut — aligner épaules–hanches–genoux. 3. Ne pas hyperétendre le bas du dos."},
      {name:'Suitcase Carry ★',sets:"KB 16→20 kg · 3×20m/côté",cues:"1. Buste parfaitement droit — ne PAS pencher du côté de la KB. 2. Épaule côté KB ancrée vers le bas — pas de haussement. 3. Pas lents et contrôlés, regard devant — très spécifique déplacements bad."},
      {name:'Fente latérale KB gobelet',sets:"KB 12→16 kg · 3×8/côté · repos 75s",cues:"1. Grand pas latéral, pied orienté à 30–45° vers l'extérieur. 2. Genou dans l'axe du pied, buste droit. 3. Côté droit : surveiller la cheville Achille lors de la réception."},
    ],
    cooldown:"Protocole Achille + pigeon modifié swissball 2×45s/côté"
  },
  cardio: {
    name:'Endurance fondamentale',
    warmup:"5 min · marche active + accélération progressive vers zone 2",
    exercises:[
      {name:'Course zone 2 (EF)',sets:"Zone 2 · conversation possible en phrases complètes",cues:"1. Allure où tu peux parler facilement. FC cible : ~111–130 bpm (Z2 sur max 185 bpm à 40 ans). 2. Sol souple préférable (forêt) — moins d'impact sur l'Achille que le bitume. 3. Si la forêt : attention aux racines, chemin dégagé."},
    ],
    cooldown:"Marche 5 min + Protocole Achille + étirements mollet 2×45s"
  },
  cardio_int: {
    name:'Intervalles',
    warmup:"10 min EF zone 2 + 3 accélérations progressives sur 20s",
    exercises:[
      {name:'Blocs d\'intervalles',sets:"Voir détail de la séance prévue",cues:"1. Phase effort : Z4–Z5, impossible de parler en phrases. 2. Phase récup : allure très légère ou marche active. 3. Arrêter immédiatement si gêne Achille pendant l'effort."},
    ],
    cooldown:"10 min retour calme zone 2 + Protocole Achille obligatoire"
  },
  mob: {
    name:'Mobilité & Récupération active',
    warmup:"Aucun — cette séance EST la récupération",
    exercises:[
      {name:'Rotation coiffe élastique ★',sets:"2×15/côté · élastique léger",cues:"1. Coude collé au flanc. 2. 2s aller, 3s retour — activation uniquement. 3. Ne pas hausser l'épaule."},
      {name:'Ouverture thoracique swissball',sets:"3×45s · dos sur balle · bras en croix",cues:"1. Swissball sous les omoplates — pas sous les lombaires. 2. Laisser la gravité faire le travail, ne pas forcer. 3. Expirer complètement — la cage thoracique s'ouvre davantage."},
      {name:'Thread the needle ★',sets:"2×8/côté · à 4 pattes",cues:"1. Hanches restent hautes et stables — seul le haut du corps tourne. 2. Expirer en glissant le bras — augmente l'amplitude naturellement. 3. Amplitude progressive, jamais forcer."},
      {name:'Pigeon modifié swissball',sets:"2×60s/côté · respiration abdominale",cues:"1. Dos droit — c'est le bassin qui avance, pas le dos qui se plie. 2. Respiration abdominale lente : relâcher à chaque expiration. 3. La swissball comme curseur : plus tu te penches, plus c'est intense."},
      {name:'Excentrique mollet Achille',sets:"3×15 · descente 4s · sur marche",cues:"1. Montée 2 pieds → descente 4s sur pied droit uniquement. 2. Sous le niveau de la marche — amplitude complète. 3. Non négociable même les jours de repos."},
    ],
    cooldown:""
  }
};

function getSessionTypeKey(s) {
  if (!s) return 'force_a';
  const l = s.label.toLowerCase();
  if (l.includes('kb') || l.includes('swing') || l.includes('kettl')) return 'kb';
  if (l.includes('force b') || l.includes('haut') || l.includes('core')) return 'force_b';
  if (l.includes('intervalle') || l.includes('interval')) return 'cardio_int';
  if (l.includes('ef ') || l.includes('endurance') || l.includes('course') || l.includes('cardio')) return 'cardio';
  if (l.includes('mobil') || l.includes('récup')) return 'mob';
  return 'force_a';
}

window.getBadPlan = () => getPlan();

// ── CONSTANTES UI ─────────────────────────────────────────────
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS = ['L','Ma','Me','J','V','S','D'];
const TYPE_COLORS = { force:'#d29922',kb:'#c8a96e',cardio:'#3fb950',mob:'#bc8cff',bad:'#58a6ff',repos:'#484f58' };
const TAG_CLS = { force:'tf',kb:'tk',cardio:'tc',mob:'tm',bad:'tb',repos:'tr' };

function tag(type) {
  const labels = { force:'Force',kb:'KB',cardio:'Cardio',mob:'Mobilité',bad:'Bad',repos:'Repos' };
  return `<span class="tag ${TAG_CLS[type]||'tr'}">${labels[type]||type}</span>`;
}

// ── STATE ─────────────────────────────────────────────────────
let role = null, pinBuf = '';
let logs = {}, poidsData = [], messages = [], discussions = [], planOverrides = {};
let calMonth = 6, calYear = 2026;
let curPage = 'today';
let selDate = null, curStatus = null, detailDate = null;
let discRefDate = null; // séance liée dans Discussion

// ── PLAN MERGE ────────────────────────────────────────────────
function getPlan() {
  const m = JSON.parse(JSON.stringify(BASE_PLAN));
  if (planOverrides.sessions) {
    for (const [d,s] of Object.entries(planOverrides.sessions)) {
      if (s === null) delete m[d]; else m[d] = s;
    }
  }
  return m;
}
function getSessionType(key) {
  const base = BASE_SESSION_TYPES[key];
  if (!planOverrides.exercises?.[key]) return JSON.parse(JSON.stringify(base));
  return JSON.parse(JSON.stringify(planOverrides.exercises[key]));
}
function getSessionTypeForSession(s) {
  return getSessionType(getSessionTypeKey(s));
}

// ── LOADER ────────────────────────────────────────────────────
function showLoad(msg='Chargement…') {
  document.getElementById('loader-msg').textContent = msg;
  document.getElementById('loader').classList.remove('off');
}
function hideLoad() { document.getElementById('loader').classList.add('off'); }

// ── PIN ───────────────────────────────────────────────────────
function pk(v) {
  if (v==='del') { pinBuf=pinBuf.slice(0,-1); }
  else if (v==='ok') { verifyPin(); return; }
  else if (pinBuf.length<4) pinBuf+=v;
  if (pinBuf.length===4) { verifyPin(); return; }
  updDots();
}
function updDots() {
  for(let i=0;i<4;i++) document.getElementById('pd'+i).classList.toggle('on',i<pinBuf.length);
}
async function verifyPin() {
  showLoad('Vérification…');
  try {
    const h = await sha256(pinBuf);
    const [ha,hc] = await Promise.all([DB.getConfig('pin_athlete'),DB.getConfig('pin_coach')]);
    if (h===ha) { hideLoad(); await doLogin('athlete'); }
    else if (h===hc) { hideLoad(); await doLogin('coach'); }
    else {
      hideLoad();
      document.getElementById('perr').textContent='PIN incorrect';
      pinBuf=''; updDots();
      setTimeout(()=>document.getElementById('perr').textContent='',2000);
    }
  } catch(e) {
    hideLoad();
    document.getElementById('perr').textContent='Erreur de connexion';
    pinBuf=''; updDots();
  }
}
async function doLogin(r) {
  role = r;
  showLoad('Chargement des données…');
  try {
    [logs, poidsData, messages, discussions, planOverrides] = await Promise.all([
      DB.getLogs(), DB.getPoids(), DB.getMessages(), DB.getDiscussions(), DB.getPlanOverrides()
    ]);
  } catch(e) { console.error(e); }
  hideLoad();
  document.getElementById('login').classList.add('off');
  document.getElementById('app').classList.add('on');
  const pill = document.getElementById('rpill');
  pill.textContent = r==='coach' ? '🎯 Coach' : '🏸 Nicolas';
  pill.className = 'rpill '+(r==='coach'?'coach':'ath');
  // Onglet Coach conditionnel
  if (r==='coach' && !document.querySelector('[data-pg="coach"]')) {
    const btn = document.createElement('button');
    btn.className='ni'; btn.dataset.pg='coach';
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>Coach`;
    btn.onclick = () => goPage('coach',btn);
    document.getElementById('bnav').appendChild(btn);
  }
  // Badge messages non lus
  updDiscBadge();
  goPage('today', document.querySelector('[data-pg="today"]'));
}
function logout() {
  role=null; pinBuf=''; updDots();
  logs={}; poidsData=[]; messages=[]; discussions=[]; planOverrides={};
  document.getElementById('app').classList.remove('on');
  document.getElementById('login').classList.remove('off');
  document.getElementById('perr').textContent='';
  const cb = document.querySelector('[data-pg="coach"]');
  if (cb) cb.remove();
}

// ── NAV ───────────────────────────────────────────────────────
function goPage(pgId, btn) {
  document.querySelectorAll('.ni').forEach(b=>b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  const pg = document.getElementById('pg-'+pgId);
  if (pg) { pg.classList.add('on'); renderPage(pgId); }
  curPage = pgId;
}
function renderPage(id) {
  const R = {today:renderToday,plan:renderPlan,log:renderLog,hist:renderHist,analyse:renderAnalyse,disc:renderDisc,coach:renderCoach};
  if (R[id]) R[id]();
}
function updDiscBadge() {
  const unread = messages.filter(m=>!m.read_by_athlete).length;
  const badge = document.getElementById('disc-badge');
  if (!badge) return;
  badge.textContent = unread;
  badge.classList.toggle('off', unread===0);
}

// ── AUJOURD'HUI ───────────────────────────────────────────────
function renderToday() {
  const plan = getPlan();
  const today = new Date();
  const ds = today.toISOString().split('T')[0];
  const sessions = plan[ds]||[];
  const isConge = CONGES.includes(ds);
  const log = logs[ds];
  const dateStr = today.toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
  const unread = messages.filter(m=>!m.read_by_athlete);
  let h = '';

  // Bannière messages non lus
  if (unread.length>0 && role==='athlete') {
    h+=`<div style="margin:10px 12px 0;padding:9px 11px;background:#1a1400;border:1px solid #bb8009;border-radius:5px;cursor:pointer;" onclick="markMsgsRead()">
      <div style="font-size:10px;color:var(--amber);font-weight:500;margin-bottom:2px;">📩 ${unread.length} message${unread.length>1?'s':''} de ton coach</div>
      <div style="font-size:12px;color:var(--text);">"${unread[0].text.slice(0,80)}${unread[0].text.length>80?'…':''}"</div>
    </div>`;
  }

  // Hero
  h+=`<div style="padding:12px;background:linear-gradient(135deg,var(--bg2),var(--bg3));border-bottom:1px solid var(--border);">
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">${dateStr}</div>`;

  if (isConge) {
    h+=`<div style="font-family:'Fraunces',serif;font-size:20px;font-weight:300;">🏖 Congés</div>
      <div style="font-size:11px;color:var(--text2);margin-top:5px;">Profite ! Maintien poids corps + cardio léger si envie.</div>`;
  } else if (sessions.length===0) {
    h+=`<div style="font-family:'Fraunces',serif;font-size:20px;font-weight:300;">Repos</div>
      <div style="font-size:11px;color:var(--text2);margin-top:5px;">Pas de séance prévue aujourd'hui.</div>`;
  } else {
    h+=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px;">`;
    sessions.forEach(s=>{ h+=tag(s.type); });
    h+=`</div>`;
    h+=`<div style="font-family:'Fraunces',serif;font-size:20px;font-weight:300;">${sessions.map(s=>s.label).join(' · ')}</div>`;
    h+=`<div style="font-size:11px;color:var(--text2);margin-top:4px;">${sessions.map(s=>s.detail||'').filter(Boolean).join(' · ')}</div>`;
    sessions.forEach(s=>{
      if (s.coachNote) h+=`<div style="margin-top:7px;padding:5px 9px;background:#1a1400;border:1px solid var(--amber2);border-radius:4px;font-size:11px;color:var(--amber);">🎯 Coach : ${s.coachNote}</div>`;
    });
    if (log) {
      const sc={done:'var(--green)',skip:'var(--red)',moved:'var(--amber)'};
      const sl={done:'Faite ✓',skip:'Sautée',moved:'Déplacée'};
      h+=`<div style="margin-top:8px;padding:6px 9px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:${sc[log.status]}">${sl[log.status]}</span>
        ${log.rpe?`<span style="font-family:'Fraunces',serif;font-size:17px;color:var(--blue);">RPE ${log.rpe}</span>`:''}
        ${log.notes?`<span style="font-size:10px;color:var(--text2);font-style:italic;">"${log.notes.slice(0,35)}…"</span>`:''}
      </div>`;
    }
  }
  h+=`</div>`;

  // Achille strip
  const achLoad = weeklyAchilleLoad();
  const achCls = achLoad>200?'red':achLoad>150?'warn':'ok';
  const achTxt = achLoad>200?`⚠ Charge Achille élevée (${achLoad} min/sem). Surveiller la gêne matinale.`
    : achLoad>150?`→ Charge modérée (${achLoad} min/sem). Excentrique matin non négociable.`
    : `✓ Achille OK — charge hebdo dans les limites (${achLoad} min/sem)`;
  h+=`<div class="sec"><div class="ibox ${achCls}">${achTxt}</div></div>`;

  // Boutons actions
  if (sessions.length>0 && !isConge) {
    h+=`<div class="sec" style="display:flex;gap:6px;">
      <button class="btn bp" style="flex:1;" onclick="openSessModal('${ds}')">
        ${log?'✏️ Modifier le log':'+ Loguer la séance'}
      </button>
      <button class="btn bg bsm" onclick="openDetail('${ds}')">🔍 Détail</button>
    </div>`;
  }

  // Prochaines séances
  h+=`<div class="sec sec-last"><div class="card">
    <div class="ch"><div class="ct">Prochaines séances</div></div>
    <div style="padding:0 12px;">`;
  let cnt=0;
  for (let i=1; i<=12&&cnt<3; i++) {
    const d=new Date(); d.setDate(d.getDate()+i);
    const nextDs=d.toISOString().split('T')[0];
    const ns=getPlan()[nextDs];
    if (!ns||CONGES.includes(nextDs)) continue;
    const lbl=d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:.5px solid var(--border);cursor:pointer;" onclick="openDetail('${nextDs}')">
      <div style="font-size:10px;color:var(--text3);width:55px;flex-shrink:0;">${lbl}</div>
      <div style="flex:1;">
        <div style="font-size:11px;color:var(--text);">${ns.map(s=>s.label).join(' · ')}</div>
        <div style="font-size:10px;color:var(--text3);">${ns.map(s=>s.detail||'').filter(Boolean).join(' · ')}</div>
      </div>
      ${ns.map(s=>tag(s.type)).join('')}
    </div>`;
    cnt++;
  }
  if (cnt===0) h+=`<div class="empty">Aucune séance dans les 12 prochains jours</div>`;
  h+=`</div></div>`;

  // Rappel Achille
  h+=`<div class="ibox warn" style="margin:0 12px 12px;">
    <b>Achille · chaque matin :</b> excentrique bilatéral 3×15 · descente 4s · avant de descendre du lit.
  </div></div>`;

  document.getElementById('pg-today').innerHTML = h;
}

function weeklyAchilleLoad() {
  let load=0;
  Object.entries(logs).forEach(([date,log])=>{
    const diff=(Date.now()-new Date(date+'T12:00:00').getTime())/86400000;
    if (diff<=7&&log.status==='done') load+=40;
  });
  return Math.round(load);
}

// ── PLAN ──────────────────────────────────────────────────────
function renderPlan() {
  const plan = getPlan();
  const today = new Date().toISOString().split('T')[0];
  const pg = document.getElementById('pg-plan');

  // Tabs internes
  let h=`<div style="display:flex;gap:2px;padding:10px 12px 0;">
    <button id="pt-cal" onclick="switchPlanTab('cal')" class="btn bp bsm" style="flex:1;border-radius:5px 5px 0 0;border-bottom:none;">📅 Calendrier</button>
    <button id="pt-type" onclick="switchPlanTab('type')" class="btn bg bsm" style="flex:1;border-radius:5px 5px 0 0;border-bottom:none;">📋 Séances type</button>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r) var(--r);margin:0 12px 10px;">
    <!-- Calendrier -->
    <div id="pv-cal">
      <div class="cnav">
        <button class="carr" onclick="prevCal()">‹</button>
        <div class="cmn">${MONTHS[calMonth]} ${calYear}</div>
        <button class="carr" onclick="nextCal()">›</button>
      </div>
      <div class="cgrid">`;
  DAYS.forEach(d=>{ h+=`<div class="chdr">${d}</div>`; });
  h+=`</div><div class="cgrid" id="cal-grid"></div>
      <div id="cal-detail" style="padding:0 12px 10px;"></div>
    </div>
    <!-- Séances type -->
    <div id="pv-type" style="display:none;padding:10px 12px;">`;

  Object.entries(BASE_SESSION_TYPES).forEach(([key,st])=>{
    const stOverride = planOverrides.exercises?.[key]||st;
    h+=`<div class="card" style="margin-bottom:8px;">
      <div class="ch">
        <div class="ct">${stOverride.name}</div>
        ${role==='coach'?`<button class="btn bg bsm" onclick="openExEdit('${key}')">✏️ Modifier</button>`:''}
      </div>
      <div class="cb" style="padding:4px 12px;">`;
    if (stOverride.warmup) h+=`<div style="font-size:10px;color:var(--text3);padding:4px 0 5px;border-bottom:.5px solid var(--border);">Échauffement : ${stOverride.warmup}</div>`;
    stOverride.exercises.forEach(ex=>{
      h+=`<div class="exblock">
        <div class="exname">${ex.name}</div>
        <div class="exsets">${ex.sets}</div>
        <div class="excue">${ex.cues}</div>
      </div>`;
    });
    if (stOverride.cooldown) h+=`<div style="font-size:10px;color:var(--text3);padding:5px 0 2px;border-top:.5px solid var(--border);">Retour au calme : ${stOverride.cooldown}</div>`;
    h+=`</div></div>`;
  });
  h+=`</div></div>`;

  pg.innerHTML = h;
  renderCalGrid(plan, today);
}

function switchPlanTab(tab) {
  document.getElementById('pv-cal').style.display = tab==='cal'?'block':'none';
  document.getElementById('pv-type').style.display = tab==='type'?'block':'none';
  document.getElementById('pt-cal').className = 'btn bsm '+(tab==='cal'?'bp':'bg')+' '+(tab==='cal'?'':'');
  document.getElementById('pt-cal').style.cssText = 'flex:1;border-radius:5px 5px 0 0;border-bottom:none;';
  document.getElementById('pt-type').className = 'btn bsm '+(tab==='type'?'bp':'bg');
  document.getElementById('pt-type').style.cssText = 'flex:1;border-radius:5px 5px 0 0;border-bottom:none;';
}

function renderCalGrid(plan, today) {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  let sd = new Date(calYear,calMonth,1).getDay(); sd=sd===0?6:sd-1;
  const dim = new Date(calYear,calMonth+1,0).getDate();
  let rows='';
  for (let i=0;i<sd;i++) rows+='<div class="cday empty"></div>';
  for (let d=1;d<=dim;d++) {
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=ds===today, isC=CONGES.includes(ds), ps=plan[ds]||[], log=logs[ds];
    let cls='cday';
    if(isT)cls+=' today'; if(isC)cls+=' conge';
    if(log?.status==='done')cls+=' done'; else if(log?.status==='skip')cls+=' skip';
    const dot=ps.length>0?`<div class="cdot" style="background:${TYPE_COLORS[ps[0].type]||'#484f58'}"></div>`:'';
    rows+=`<div class="${cls}" onclick="selectCalDay('${ds}')"><div class="cdn">${d}</div>${dot}</div>`;
  }
  grid.innerHTML=rows;
}

function selectCalDay(ds) {
  const plan=getPlan(), ps=plan[ds]||[], log=logs[ds], isC=CONGES.includes(ds);
  const d=new Date(ds+'T12:00:00');
  const lbl=d.toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
  const det=document.getElementById('cal-detail');
  if (!det) return;
  let h=`<div style="padding:7px 0;border-top:.5px solid var(--border);">
    <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:6px;">${lbl}</div>`;
  if (isC) { h+=`<div style="font-size:12px;color:var(--blue);">🏖 Congés</div>`; }
  else if (ps.length===0) { h+=`<div style="font-size:12px;color:var(--text3);">Repos</div>`; }
  else {
    ps.forEach((s,idx)=>{
      h+=`<div style="margin-bottom:7px;">
        ${tag(s.type)} <b style="font-size:12px;">${s.label}</b>
        <div style="font-size:10px;color:var(--text3);margin:2px 0;">${s.detail||''}</div>
        ${s.coachNote?`<div style="font-size:10px;color:var(--amber);padding:2px 7px;background:#1a1400;border-radius:3px;">🎯 ${s.coachNote}</div>`:''}
      </div>`;
    });
    if (log) {
      const sc={done:'var(--green)',skip:'var(--red)',moved:'var(--amber)'};
      const sl={done:'Faite ✓',skip:'Sautée',moved:'Déplacée'};
      h+=`<div style="padding:5px 9px;background:var(--bg3);border-radius:4px;display:flex;gap:8px;align-items:center;margin-bottom:6px;">
        <span style="font-size:11px;color:${sc[log.status]}">${sl[log.status]}</span>
        ${log.rpe?`<span style="font-family:'Fraunces',serif;font-size:16px;color:var(--blue);">RPE ${log.rpe}</span>`:''}
        ${log.notes?`<span style="font-size:10px;color:var(--text2);font-style:italic;">"${log.notes.slice(0,40)}"</span>`:''}
      </div>`;
    }
    h+=`<div style="display:flex;gap:6px;">
      <button class="btn bp bsm" style="flex:1;" onclick="openSessModal('${ds}')">${log?'✏️ Modifier':'+ Loguer'}</button>
      <button class="btn bg bsm" onclick="openDetail('${ds}')">🔍 Détail</button>
      ${role==='coach'?`<button class="btn bg bsm" onclick="openCalEdit('${ds}',0)">✏️ Modifier</button>`:''}
    </div>`;
    if (role==='coach') h+=`<button class="btn bg bsm" onclick="openCalAdd('${ds}')" style="margin-top:4px;width:100%;">+ Ajouter une séance</button>`;
  }
  h+=`</div>`;
  det.innerHTML=h;
}

function prevCal() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} if(curPage==='plan') renderPlan(); }
function nextCal() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} if(curPage==='plan') renderPlan(); }

// ── LOGUER ────────────────────────────────────────────────────
function renderLog() {
  const plan=getPlan(), today=new Date().toISOString().split('T')[0];
  const todaySess=plan[today]||[];
  const last7p=poidsData.slice(-7);
  let h=`<div class="sec">`;

  // Séance du jour
  h+=`<div class="card"><div class="ch"><div class="ct">Loguer une séance</div></div><div class="cb">`;
  if (todaySess.length>0&&!CONGES.includes(today)) {
    h+=`<div style="margin-bottom:10px;"><div style="font-size:10px;color:var(--text3);margin-bottom:5px;">AUJOURD'HUI</div>`;
    todaySess.forEach(s=>{
      const log=logs[today];
      h+=`<button onclick="openSessModal('${today}')" class="btn bp" style="margin-bottom:5px;justify-content:flex-start;gap:8px;">
        ${tag(s.type)} <span style="flex:1;text-align:left;">${s.label}</span>
        ${log?'<span style="font-size:10px;opacity:.7;">(modifier)</span>':''}
      </button>`;
    });
    h+=`</div>`;
  }
  // Séances récentes non loggées
  h+=`<div style="font-size:10px;color:var(--text3);margin-bottom:5px;">SÉANCES RÉCENTES</div>`;
  let shown=0;
  for (let i=-6;i<=0&&shown<5;i++) {
    const d=new Date(); d.setDate(d.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    if (ds===today) continue;
    const ps=plan[ds];
    if (!ps||CONGES.includes(ds)) continue;
    const dlbl=d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
    const log=logs[ds];
    h+=`<button onclick="openSessModal('${ds}')" class="btn bg" style="margin-bottom:4px;justify-content:flex-start;gap:7px;">
      <span style="font-size:10px;color:var(--text3);width:50px;flex-shrink:0;">${dlbl}</span>
      ${tag(ps[0].type)}
      <span style="font-size:11px;flex:1;text-align:left;">${ps.map(s=>s.label).join(', ')}</span>
      ${log?`<span style="font-size:9px;color:var(--green);">✓</span>`:''}
    </button>`;
    shown++;
  }
  if (shown===0&&todaySess.length===0) h+=`<div class="empty">Aucune séance récente à loguer</div>`;
  h+=`</div></div>`;

  // Poids
  h+=`<div class="card"><div class="ch"><div class="ct">Poids</div><button class="btn bg bsm" onclick="openOv('ov-poids')">+ Pesée</button></div><div class="cb">`;
  if (last7p.length===0) {
    h+=`<div class="empty">Ajoute ta première pesée</div>`;
  } else {
    h+=buildPoidsChart(last7p);
    if (last7p.length>=2) {
      const first=last7p[0].poids,last2=last7p[last7p.length-1].poids,diff=(last2-first).toFixed(1);
      h+=`<div class="mgrid" style="padding:8px 0 0;"><div class="mbox"><div class="mv ${last2<84?'g':''}">${last2}</div><div class="ml">kg actuels</div></div>
        <div class="mbox"><div class="mv ${parseFloat(diff)<=0?'g':'a'}">${diff>0?'+':''}${diff}</div><div class="ml">évolution</div></div>
        <div class="mbox"><div class="mv ${(last2-84)<=0?'g':'a'}">${(last2-84).toFixed(1)}</div><div class="ml">vs cible 84</div></div></div>`;
    }
  }
  h+=`</div></div></div>`;
  document.getElementById('pg-log').innerHTML=h;
}

function buildPoidsChart(data) {
  if (!data||data.length===0) return '';
  const W=300,H=90,P=24,n=data.length;
  const weights=data.map(d=>d.poids);
  const minW=Math.min(...weights,82)-1,maxW=Math.max(...weights,88)+1;
  const xs=i=>P+(i/Math.max(n-1,1))*(W-2*P),ys=v=>P+(1-(v-minW)/(maxW-minW))*(H-2*P);
  let sc='';
  for (let v=Math.ceil(minW);v<=Math.floor(maxW);v++) {
    if(v%2===0){
      sc+=`<line x1="${P}" y1="${ys(v)}" x2="${W-P}" y2="${ys(v)}" stroke="#21262d" stroke-width="1"/>`;
      sc+=`<text x="${P-3}" y="${ys(v)+3}" text-anchor="end" fill="#484f58" font-size="8" font-family="DM Mono">${v}</text>`;
    }
  }
  sc+=`<line x1="${P}" y1="${ys(84)}" x2="${W-P}" y2="${ys(84)}" stroke="#238636" stroke-width="1" stroke-dasharray="3,3" opacity=".6"/>`;
  if(n>1) sc+=`<polyline points="${data.map((d,i)=>`${xs(i)},${ys(d.poids)}`).join(' ')}" fill="none" stroke="#3fb950" stroke-width="1.5"/>`;
  data.forEach((d,i)=>{ sc+=`<circle cx="${xs(i)}" cy="${ys(d.poids)}" r="3" fill="#3fb950" stroke="#0d1117" stroke-width="1.5"/>`; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;">${sc}</svg>`;
}

// ── HISTORIQUE ────────────────────────────────────────────────
function renderHist() {
  const plan=getPlan();
  const entries=Object.entries(logs).sort((a,b)=>b[0].localeCompare(a[0]));
  const sl={done:'Faite',skip:'Sautée',moved:'Déplacée'};
  const scol={done:'var(--green)',skip:'var(--red)',moved:'var(--amber)'};
  let h=`<div class="sec sec-last">`;

  // Résumé rapide
  const doneCount=entries.filter(([,v])=>v.status==='done').length;
  const skipCount=entries.filter(([,v])=>v.status==='skip').length;
  const rpes=entries.filter(([,v])=>v.rpe).map(([,v])=>v.rpe);
  const avgRpe=rpes.length>0?(rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1):null;
  h+=`<div class="mgrid" style="margin-bottom:10px;padding:0;">
    <div class="mbox"><div class="mv g">${doneCount}</div><div class="ml">Séances faites</div></div>
    <div class="mv d">${avgRpe?avgRpe:'—'}</div>
    <div class="mbox"><div class="mv ${skipCount>3?'r':'d'}">${skipCount}</div><div class="ml">Sautées</div></div>
  </div>`;

  if (entries.length===0) {
    h+=`<div class="empty">Aucune séance enregistrée</div>`;
  } else {
    entries.forEach(([date,log])=>{
      const ps=plan[date]||[];
      const label=ps.map(s=>s.label).join(', ')||'Séance';
      const d=new Date(date+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
      h+=`<div class="hitem" onclick="openHistDetail('${date}')">
        <div class="htop">
          <div><span class="hdate">${d}</span> <span style="font-size:11px;color:var(--text2);">· ${label}</span></div>
          <div style="display:flex;align-items:center;gap:5px;">
            ${log.rpe?`<span class="hrpe" style="color:${log.rpe>=8?'var(--red)':log.rpe>=5?'var(--amber)':'var(--green)'}">RPE ${log.rpe}</span>`:''}
            <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--bg4);color:${scol[log.status]}">${sl[log.status]}</span>
          </div>
        </div>
        ${log.notes?`<div class="hnote">"${log.notes}"</div>`:''}
        <div style="font-size:10px;color:var(--text3);margin-top:3px;">Tap pour voir le détail · 💬 Discuter</div>
      </div>`;
    });
  }
  h+=`</div>`;
  document.getElementById('pg-hist').innerHTML=h;
}

function openHistDetail(date) {
  openDetail(date);
}

// ── ANALYSE IA ────────────────────────────────────────────────
function renderAnalyse() {
  const entries=Object.entries(logs).sort((a,b)=>a[0].localeCompare(b[0]));
  const done=entries.filter(([,v])=>v.status==='done');
  const skip=entries.filter(([,v])=>v.status==='skip');
  const rpes=done.filter(([,v])=>v.rpe).map(([d,v])=>({date:d,rpe:v.rpe,notes:v.notes||''}));
  const avgRpe=rpes.length>0?(rpes.reduce((a,b)=>a+b.rpe,0)/rpes.length).toFixed(1):null;

  let h=`<div class="sec sec-last">
    <div class="card">
      <div class="ch"><div class="ct">Analyse IA — Conseils adaptatifs</div></div>
      <div class="mgrid">
        <div class="mbox"><div class="mv g">${done.length}</div><div class="ml">Séances faites</div></div>
        <div class="mbox"><div class="mv ${avgRpe&&parseFloat(avgRpe)>7?'r':'b'}">${avgRpe||'—'}</div><div class="ml">RPE moyen</div></div>
        <div class="mbox"><div class="mv ${skip.length>3?'r':'d'}">${skip.length}</div><div class="ml">Sautées</div></div>
      </div>
      <div class="cb">
        <button class="btn bp" id="btn-ia" onclick="runIA(${JSON.stringify(rpes.slice(-5))},${JSON.stringify(poidsData.slice(-5))})">
          ⚡ Générer les conseils pour les prochaines séances
        </button>
        <div class="ai-box loading" id="ia-box" style="margin-top:10px;">Lance une analyse pour obtenir des conseils personnalisés basés sur tes données récentes.</div>
        <div id="ia-date" style="font-size:10px;color:var(--text3);text-align:right;margin-top:5px;"></div>
      </div>
    </div>

    <div class="card">
      <div class="ch"><div class="ct">Plan prévu vs réalisé · 14 j.</div></div>
      <div class="cb" style="padding:0 12px;">
        ${renderAdherence()}
      </div>
    </div>

    <div class="card">
      <div class="ch"><div class="ct">Charge Achille · 7 j.</div></div>
      <div class="cb">
        ${renderAchilleCard()}
      </div>
    </div>
  </div>`;
  document.getElementById('pg-analyse').innerHTML=h;
}

function renderAdherence() {
  const plan=getPlan(), today=new Date();
  const rows=[];
  for (let i=13;i>=0;i--) {
    const d=new Date(today); d.setDate(today.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    const ps=plan[ds];
    if (!ps||CONGES.includes(ds)) continue;
    rows.push({ds,label:d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'}),sessions:ps,log:logs[ds]});
  }
  if (rows.length===0) return `<div class="empty">Aucune séance prévue sur les 14 derniers jours</div>`;
  let h='';
  rows.forEach(({label,sessions,log})=>{
    const icon=log?.status==='done'?'✅':log?.status==='skip'?'⭕':log?.status==='moved'?'🔄':'⬜';
    const rpeStr=log?.rpe?` · RPE ${log.rpe}`:'';
    h+=`<div class="arow">
      <span style="font-size:14px;">${icon}</span>
      <div class="albl">${label}</div>
      <div class="aval" style="font-size:10px;">${sessions.map(s=>s.label).join(' / ')}${rpeStr}</div>
    </div>`;
  });
  return h;
}

function renderAchilleCard() {
  const load=weeklyAchilleLoad();
  const col=load>200?'var(--red)':load>150?'var(--amber)':'var(--green)';
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <div style="font-family:'Fraunces',serif;font-size:28px;color:${col};">${load}</div>
    <div style="font-size:11px;color:var(--text3);">min/sem · activités à impact</div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <div class="prog"><div class="progf" style="width:${Math.min(100,load/3)}%;background:${col};"></div></div>
    <div style="font-size:10px;color:var(--text3);">max 300</div>
  </div>
  <div class="arow"><div class="adot" style="background:var(--green);"></div><div class="albl">< 150 min/sem</div><div class="aval" style="color:var(--green);">Sécurisé</div></div>
  <div class="arow"><div class="adot" style="background:var(--amber);"></div><div class="albl">150–200 min/sem</div><div class="aval" style="color:var(--amber);">Surveiller</div></div>
  <div class="arow"><div class="adot" style="background:var(--red);"></div><div class="albl">> 200 min/sem</div><div class="aval" style="color:var(--red);">Réduire</div></div>`;
}

async function runIA(lastRpes, lastPoids) {
  const btn=document.getElementById('btn-ia');
  const box=document.getElementById('ia-box');
  btn.disabled=true; btn.textContent='Analyse en cours…';
  box.className='ai-box loading'; box.textContent='Analyse de tes données…';
  const poidsInfo=lastPoids.length>=2?`${lastPoids[0].poids}kg → ${lastPoids[lastPoids.length-1].poids}kg`:'pas encore de données';
  const plan=getPlan(), today=new Date(), next=[];
  for (let i=0;i<10;i++) {
    const d=new Date(today); d.setDate(today.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    if(plan[ds]) next.push(`${ds}: ${plan[ds].map(s=>s.label).join(', ')}`);
  }
  const prompt=`Tu es le coach sportif de Nicolas, 40 ans, joueur de badminton (reprise saison octobre 2026). Tendon Achille droit fragile — surveillance prioritaire.

DONNÉES RÉCENTES :
Séances : ${lastRpes.length>0?lastRpes.map(r=>`${r.date} RPE${r.rpe}${r.notes?' ('+r.notes+')':''}`).join(' | '):'aucune encore'}
Poids : ${poidsInfo}
Prochaines séances : ${next.slice(0,5).join(' | ')||'aucune planifiée'}
Charge Achille sem. : ${weeklyAchilleLoad()} min

CONTEXTE : Créneaux midi (mar/jeu/ven) · KB 12/16/20 kg · élastiques · swissball · piste/forêt/parking couvert · protocole Achille chaque matin non négociable.

Donne 5 conseils CONCIS et ACTIONNABLES. Une emoji par conseil. Direct, sans préambule. Si peu de données, conseils de démarrage adaptés au contexte.`;
  try {
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:800,messages:[{role:'user',content:prompt}]})});
    const data=await resp.json();
    box.className='ai-box'; box.innerHTML=(data.content?.[0]?.text||'Erreur').replace(/\n/g,'<br>');
    const el=document.getElementById('ia-date');
    if(el) el.textContent='Dernière analyse : '+new Date().toLocaleString('fr-BE');
  } catch(e) { box.className='ai-box error'; box.textContent='Erreur de connexion. Réessaie.'; }
  btn.disabled=false; btn.textContent='⚡ Générer les conseils pour les prochaines séances';
}

// ── DISCUSSION ────────────────────────────────────────────────
function renderDisc() {
  // Marquer les messages coach comme lus
  if (role==='athlete') markMsgsRead();

  const pg=document.getElementById('pg-disc');
  let h=`<div class="disc-wrap">
    <div class="disc-msgs" id="disc-msgs"></div>
    <div class="disc-ref-banner off" id="disc-ref-banner">
      <span id="disc-ref-lbl"></span>
      <button class="ref-clear" onclick="clearDiscRef()">×</button>
    </div>
    <div class="disc-input">
      <textarea id="disc-text" placeholder="Message…" oninput="autoResize(this)"></textarea>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <button class="disc-send" onclick="sendDisc()" title="Envoyer">↑</button>
        <button class="disc-send" onclick="pickDiscRef()" title="Lier une séance" style="background:var(--amber2);border-color:var(--amber2);font-size:11px;">📎</button>
      </div>
    </div>
  </div>`;
  pg.innerHTML=h;
  renderDiscMsgs();
}

function renderDiscMsgs() {
  const msgs=document.getElementById('disc-msgs');
  if (!msgs) return;

  // Fusionner messages système (ancien système) + discussions
  const allItems = [
    ...messages.map(m=>({
      id:m.id, author:m.read_by_athlete===false&&role==='athlete'?'coach':'coach',
      text:m.text, created_at:m.created_at, session_ref:null, isOld:true
    })),
    ...discussions.map(d=>({...d, isOld:false}))
  ].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if (allItems.length===0) {
    msgs.innerHTML=`<div class="empty" style="padding:30px;">Démarrez la conversation !</div>`;
    return;
  }

  let h='';
  allItems.forEach(item=>{
    const isMine = (role==='athlete'&&item.author==='athlete') || (role==='coach'&&item.author==='coach');
    const authorLabel = item.author==='coach'?'Coach':'Nicolas';
    const time = new Date(item.created_at).toLocaleDateString('fr-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const bubbleClass = isMine?'mine':'theirs';
    const refClass = isMine?'':'theirs-ref';
    h+=`<div class="bubble ${bubbleClass}">
      ${!isMine?`<div class="bubble-author">${authorLabel}</div>`:''}
      ${item.session_ref?`<div class="bubble-ref ${refClass}">📎 ${formatSessionRef(item.session_ref)}</div>`:''}
      <div>${item.text}</div>
      <div class="bubble-time">${time}</div>
    </div>`;
  });
  msgs.innerHTML=h;
  msgs.scrollTop=msgs.scrollHeight;
}

function formatSessionRef(ref) {
  if (!ref) return '';
  try {
    const d=new Date(ref+'T12:00:00');
    const label=d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
    const ps=getPlan()[ref]||[];
    return `${label}${ps.length>0?' · '+ps[0].label:''}`;
  } catch(e) { return ref; }
}

function pickDiscRef() {
  // Affiche un sélecteur de date depuis les séances planifiées (14 jours)
  const plan=getPlan(), today=new Date();
  const options=[];
  for (let i=-7;i<=14;i++) {
    const d=new Date(today); d.setDate(today.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    if(plan[ds]&&!CONGES.includes(ds)) {
      const lbl=d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
      options.push({ds,lbl,label:plan[ds][0].label});
    }
  }
  if (options.length===0) { alert('Aucune séance disponible à lier'); return; }
  const sel=document.createElement('select');
  sel.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:700;padding:8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:5px;font-family:DM Mono,monospace;font-size:12px;width:80%;max-width:320px;';
  sel.innerHTML=`<option value="">-- Choisir une séance --</option>`
    +options.map(o=>`<option value="${o.ds}">${o.lbl} · ${o.label}</option>`).join('');
  sel.onchange=()=>{
    const v=sel.value;
    if (v) { discRefDate=v; updDiscRefBanner(); }
    document.body.removeChild(sel);
  };
  document.body.appendChild(sel);
  setTimeout(()=>sel.focus(),50);
}

function updDiscRefBanner() {
  const banner=document.getElementById('disc-ref-banner');
  const lbl=document.getElementById('disc-ref-lbl');
  if (!banner||!lbl) return;
  if (discRefDate) {
    banner.classList.remove('off');
    lbl.textContent='📎 Lié à : '+formatSessionRef(discRefDate);
  } else {
    banner.classList.add('off');
  }
}

function clearDiscRef() {
  discRefDate=null;
  const banner=document.getElementById('disc-ref-banner');
  if (banner) banner.classList.add('off');
}

async function sendDisc() {
  const ta=document.getElementById('disc-text');
  const text=ta?.value.trim();
  if (!text) return;
  const author=role==='coach'?'coach':'athlete';
  showLoad('Envoi…');
  try {
    await DB.addDiscussion(author,text,discRefDate||null);
    discussions=await DB.getDiscussions();
    ta.value='';
    clearDiscRef();
  } catch(e) { console.error(e); }
  hideLoad();
  renderDiscMsgs();
}

function autoResize(ta) {
  ta.style.height='auto';
  ta.style.height=Math.min(ta.scrollHeight,90)+'px';
}

function openDiscFromDetail() {
  // Ouvre la discussion avec la séance actuelle liée
  if (detailDate) discRefDate=detailDate;
  closeOv('ov-detail');
  goPage('disc', document.querySelector('[data-pg="disc"]'));
  setTimeout(()=>{ updDiscRefBanner(); }, 100);
}

async function markMsgsRead() {
  try { await DB.markRead(); messages=await DB.getMessages(); updDiscBadge(); } catch(e) {}
}

// ── COACH ─────────────────────────────────────────────────────
function renderCoach() {
  const plan=getPlan(), today=new Date();
  const upcoming=[];
  for (let i=0;i<=14;i++) {
    const d=new Date(today); d.setDate(today.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    if(plan[ds]&&!CONGES.includes(ds)) upcoming.push({ds,sessions:plan[ds]});
  }
  const doneC=Object.values(logs).filter(l=>l.status==='done').length;
  const rpes=Object.values(logs).filter(l=>l.rpe).map(l=>l.rpe);
  const avgR=rpes.length>0?(rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1):'—';
  const lastP=poidsData.length>0?poidsData[poidsData.length-1].poids+' kg':'—';

  let h=`<div class="sec sec-last">
    <!-- Stats Nicolas -->
    <div class="card">
      <div class="ch"><div class="ct">Nicolas — Vue d'ensemble</div>
        <button class="btn bg bsm" onclick="refreshCoach()">↻</button>
      </div>
      <div class="mgrid">
        <div class="mbox"><div class="mv g">${doneC}</div><div class="ml">Séances faites</div></div>
        <div class="mbox"><div class="mv b">${avgR}</div><div class="ml">RPE moyen</div></div>
        <div class="mbox"><div class="mv">${lastP}</div><div class="ml">Dernier poids</div></div>
      </div>
    </div>

    <!-- Prochaines séances modifiables -->
    <div class="card">
      <div class="ch"><div class="ct">Prochaines séances</div>
        <button class="btn bg bsm" onclick="openOv('ov-cadd')">+ Ajouter</button>
      </div>
      <div class="cb" style="padding:0 12px;">`;

  if (upcoming.length===0) { h+=`<div class="empty">Aucune séance dans les 14 prochains jours</div>`; }
  else {
    upcoming.forEach(({ds,sessions})=>{
      const d=new Date(ds+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
      sessions.forEach((s,idx)=>{
        h+=`<div style="padding:7px 0;border-top:.5px solid var(--border);display:flex;align-items:flex-start;gap:7px;">
          <div style="flex:1;">
            <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${d}</div>
            <div style="font-size:12px;color:var(--text);">${s.label}</div>
            <div style="font-size:10px;color:var(--text3);">${s.detail||''}</div>
            ${s.coachNote?`<div style="font-size:10px;color:var(--amber);">📌 ${s.coachNote}</div>`:''}
          </div>
          <button class="btn bg bsm" onclick="openCalEdit('${ds}',${idx})">✏️</button>
        </div>`;
      });
    });
  }
  h+=`</div></div>

    <!-- Éditeur séances type -->
    <div class="card">
      <div class="ch"><div class="ct">Séances type — Modifier les exercices</div></div>
      <div class="cb" style="padding:0 12px;">`;

  Object.entries(BASE_SESSION_TYPES).forEach(([key,st])=>{
    const stO=planOverrides.exercises?.[key]||st;
    h+=`<div style="padding:7px 0;border-top:.5px solid var(--border);display:flex;align-items:center;gap:8px;">
      <div style="flex:1;">
        <div style="font-size:12px;color:var(--text);">${stO.name}</div>
        <div style="font-size:10px;color:var(--text3);">${stO.exercises.length} exercices</div>
        ${planOverrides.exercises?.[key]?`<span style="font-size:9px;color:var(--amber);">● Modifiée</span>`:''}
      </div>
      <button class="btn bg bsm" onclick="openExEdit('${key}')">✏️ Modifier</button>
    </div>`;
  });
  h+=`</div></div>

    <!-- Analyse IA coach -->
    <div class="card">
      <div class="ch"><div class="ct">Analyse IA — Vue coach</div></div>
      <div class="cb">
        <button class="btn bb" id="btn-coach-ia" onclick="runCoachIA()">⚡ Analyser et ajuster le plan</button>
        <div class="ai-box loading" id="coach-ia-box" style="margin-top:10px;">Lance une analyse pour obtenir des recommandations.</div>
      </div>
    </div>

    <!-- Settings -->
    <button class="btn bg" onclick="openOv('ov-settings')" style="margin-bottom:10px;">⚙️ Réglages PIN</button>
  </div>`;

  document.getElementById('pg-coach').innerHTML=h;
}

async function refreshCoach() {
  showLoad('Rafraîchissement…');
  try {
    [logs,poidsData,messages,discussions,planOverrides]=await Promise.all([
      DB.getLogs(),DB.getPoids(),DB.getMessages(),DB.getDiscussions(),DB.getPlanOverrides()
    ]);
  } catch(e) { console.error(e); }
  hideLoad(); renderCoach();
}

async function runCoachIA() {
  const btn=document.getElementById('btn-coach-ia');
  const box=document.getElementById('coach-ia-box');
  btn.disabled=true; btn.textContent='Analyse…';
  box.className='ai-box loading'; box.textContent='Analyse des données de Nicolas…';
  const rpes=Object.entries(logs).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10)
    .filter(([,v])=>v.rpe).map(([d,v])=>`${d} RPE${v.rpe}${v.notes?' ('+v.notes+')':''}`);
  const doneC=Object.values(logs).filter(l=>l.status==='done').length;
  const skipC=Object.values(logs).filter(l=>l.status==='skip').length;
  const poidsInfo=poidsData.length>=2?`${poidsData[0].poids}kg → ${poidsData[poidsData.length-1].poids}kg`:'pas de données';
  const plan=getPlan(), today=new Date(), next=[];
  for (let i=0;i<14;i++){const d=new Date(today);d.setDate(today.getDate()+i);const ds=d.toISOString().split('T')[0];if(plan[ds])next.push(`${ds}: ${plan[ds].map(s=>s.label).join(', ')}`);}
  const prompt=`Tu es un coach sportif expert. Analyse les données de Nicolas (40 ans, badminton, Achille droit fragile, reprise saison oct. 2026).\n\nDONNÉES :\n- Séances faites : ${doneC} · Sautées : ${skipC}\n- RPE récents : ${rpes.join(' | ')||'aucun'}\n- Poids : ${poidsInfo}\n- Prochaines : ${next.join(' | ')||'aucune'}\n\nDonne : 1. Analyse état de forme (2–3 phrases) 2. 3 ajustements concrets 3. Signal Achille si pertinent\n\nDirect, sans préambule.`;
  try {
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:800,messages:[{role:'user',content:prompt}]})});
    const data=await resp.json();
    box.className='ai-box'; box.innerHTML=(data.content?.[0]?.text||'Erreur').replace(/\n/g,'<br>');
  } catch(e){box.className='ai-box error';box.textContent='Erreur de connexion.';}
  btn.disabled=false; btn.textContent='⚡ Analyser et ajuster le plan';
}

// ── MODALS ────────────────────────────────────────────────────
function openOv(id) { document.getElementById(id).classList.remove('off'); }
function closeOv(id) { document.getElementById(id).classList.add('off'); }

// Détail séance
function openDetail(ds) {
  detailDate=ds;
  const plan=getPlan(), ps=plan[ds]||[], isC=CONGES.includes(ds);
  const d=new Date(ds+'T12:00:00');
  document.getElementById('ov-detail-title').textContent=d.toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
  let h='';
  if (isC) { h=`<div style="color:var(--blue);font-size:13px;">🏖 Congés</div>`; }
  else if (ps.length===0) { h=`<div class="empty">Repos — pas de séance prévue</div>`; }
  else {
    ps.forEach(s=>{
      const st=getSessionTypeForSession(s);
      h+=`<div style="margin-bottom:12px;">${tag(s.type)} <b style="font-size:13px;">${s.label}</b>
        <div style="font-size:11px;color:var(--text3);margin:3px 0;">${s.detail||''}</div>
        ${s.coachNote?`<div style="font-size:11px;color:var(--amber);padding:4px 8px;background:#1a1400;border-radius:3px;margin-bottom:6px;">🎯 Coach : ${s.coachNote}</div>`:''}`;
      if (st.warmup) h+=`<div style="font-size:10px;color:var(--text3);padding:5px 0;border-bottom:.5px solid var(--border);margin-bottom:5px;">Échauffement : ${st.warmup}</div>`;
      st.exercises.forEach(ex=>{
        h+=`<div class="exblock"><div class="exname">${ex.name}</div><div class="exsets">${ex.sets}</div><div class="excue">${ex.cues}</div></div>`;
      });
      if (st.cooldown) h+=`<div style="font-size:10px;color:var(--text3);padding:5px 0;border-top:.5px solid var(--border);margin-top:4px;">Retour au calme : ${st.cooldown}</div>`;
      h+=`</div>`;
    });
    const log=logs[ds];
    if (log) {
      const sc={done:'var(--green)',skip:'var(--red)',moved:'var(--amber)'};
      const sl={done:'Faite ✓',skip:'Sautée',moved:'Déplacée'};
      h+=`<div style="padding:7px 10px;background:var(--bg3);border-radius:5px;display:flex;gap:8px;align-items:center;margin-top:8px;">
        <span style="font-size:11px;color:${sc[log.status]}">${sl[log.status]}</span>
        ${log.rpe?`<span style="font-family:'Fraunces',serif;font-size:17px;color:var(--blue);">RPE ${log.rpe}</span>`:''}
        ${log.notes?`<span style="font-size:10px;color:var(--text2);font-style:italic;">"${log.notes}"</span>`:''}
      </div>`;
    }
  }
  document.getElementById('ov-detail-body').innerHTML=h;
  openOv('ov-detail');
}

function openLogFromDetail() {
  closeOv('ov-detail');
  if (detailDate) openSessModal(detailDate);
}

// Log séance
function openSessModal(ds) {
  selDate=ds;
  const plan=getPlan(), ps=plan[ds]||[], log=logs[ds]||{};
  const d=new Date(ds+'T12:00:00');
  document.getElementById('ov-sess-title').textContent=d.toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
  curStatus=log.status||null;
  document.getElementById('rslider').value=log.rpe||6;
  document.getElementById('rvl').textContent=log.rpe||6;
  document.getElementById('snotes').value=log.notes||'';
  updStBtns();
  // Aperçu séance
  const st=getSessionTypeForSession(ps[0]);
  let exH=ps.map(s=>`<div style="margin-bottom:5px;">${tag(s.type)} <b style="font-size:12px;">${s.label}</b><div style="font-size:10px;color:var(--text3);">${s.detail||''}</div></div>`).join('');
  exH+=`<div style="border-top:.5px solid var(--border);padding-top:6px;margin-bottom:4px;">`;
  st.exercises.slice(0,3).forEach(ex=>{
    exH+=`<div style="font-size:11px;color:var(--text2);padding:2px 0;"><b style="color:var(--text);">${ex.name}</b> · <span style="color:var(--text3);">${ex.sets}</span></div>`;
  });
  if (st.exercises.length>3) exH+=`<div style="font-size:10px;color:var(--text3);">+${st.exercises.length-3} exercices · voir Détail</div>`;
  exH+=`</div>`;
  document.getElementById('ov-sess-ex').innerHTML=exH;
  openOv('ov-sess');
}

function setSt(s) { curStatus=s; updStBtns(); }
function updStBtns() {
  document.getElementById('sb-done').className='sbtn'+(curStatus==='done'?' sd':'');
  document.getElementById('sb-skip').className='sbtn'+(curStatus==='skip'?' ss':'');
  document.getElementById('sb-moved').className='sbtn'+(curStatus==='moved'?' sm':'');
  document.getElementById('rpe-sec').style.opacity=curStatus==='skip'?'0.4':'1';
}

async function saveLog() {
  if (!selDate||!curStatus) return;
  const log={status:curStatus,rpe:curStatus!=='skip'?parseInt(document.getElementById('rslider').value):null,notes:document.getElementById('snotes').value.trim(),savedAt:new Date().toISOString()};
  showLoad('Enregistrement…');
  try { await DB.saveLog(selDate,log); logs[selDate]=log; } catch(e){console.error(e);}
  hideLoad(); closeOv('ov-sess'); renderPage(curPage);
}

// Poids
async function savePoids() {
  const v=parseFloat(document.getElementById('poids-in').value);
  if(isNaN(v)||v<50||v>150) return;
  showLoad('Enregistrement…');
  try { await DB.addPoids(new Date().toISOString().split('T')[0],v); poidsData.push({date:new Date().toISOString().split('T')[0],poids:v}); }
  catch(e){console.error(e);}
  hideLoad(); document.getElementById('poids-in').value=''; closeOv('ov-poids'); renderPage(curPage);
}

// Coach — modifier séance calendrier
function openCalEdit(date,idx) {
  const plan=getPlan(), s=(plan[date]||[])[idx];
  if (!s) return;
  const d=new Date(date+'T12:00:00');
  document.getElementById('ov-cedit-title').textContent=d.toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('ced-date').value=date;
  document.getElementById('ced-idx').value=idx;
  document.getElementById('ced-label').value=s.label||'';
  document.getElementById('ced-detail').value=s.detail||'';
  document.getElementById('ced-note').value=s.coachNote||'';
  openOv('ov-cedit');
}
function openCalAdd(date) {
  if(date) document.getElementById('cadd-date').value=date;
  openOv('ov-cadd');
}

async function saveCalEdit() {
  const date=document.getElementById('ced-date').value;
  const idx=parseInt(document.getElementById('ced-idx').value);
  const plan=getPlan(), sessions=JSON.parse(JSON.stringify(plan[date]||[]));
  if(!sessions[idx]) return;
  sessions[idx].label=document.getElementById('ced-label').value;
  sessions[idx].detail=document.getElementById('ced-detail').value;
  const note=document.getElementById('ced-note').value.trim();
  if(note) sessions[idx].coachNote=note; else delete sessions[idx].coachNote;
  if(!planOverrides.sessions) planOverrides.sessions={};
  planOverrides.sessions[date]=sessions;
  showLoad('Sauvegarde…');
  try{await DB.savePlanOverride('sessions',planOverrides.sessions);}catch(e){console.error(e);}
  hideLoad(); closeOv('ov-cedit'); renderPage(curPage);
}

async function deleteCalSession() {
  const date=document.getElementById('ced-date').value;
  const idx=parseInt(document.getElementById('ced-idx').value);
  const plan=getPlan(), sessions=JSON.parse(JSON.stringify(plan[date]||[]));
  sessions.splice(idx,1);
  if(!planOverrides.sessions) planOverrides.sessions={};
  planOverrides.sessions[date]=sessions.length>0?sessions:null;
  showLoad('Suppression…');
  try{await DB.savePlanOverride('sessions',planOverrides.sessions);}catch(e){console.error(e);}
  hideLoad(); closeOv('ov-cedit'); renderPage(curPage);
}

async function addCalSession() {
  const date=document.getElementById('cadd-date').value;
  const type=document.getElementById('cadd-type').value;
  const label=document.getElementById('cadd-label').value;
  const detail=document.getElementById('cadd-detail').value;
  if(!date||!label) return;
  const plan=getPlan(), sessions=JSON.parse(JSON.stringify(plan[date]||[]));
  sessions.push({type,label,detail});
  if(!planOverrides.sessions) planOverrides.sessions={};
  planOverrides.sessions[date]=sessions;
  showLoad('Ajout…');
  try{await DB.savePlanOverride('sessions',planOverrides.sessions);}catch(e){console.error(e);}
  hideLoad(); closeOv('ov-cadd'); renderPage(curPage);
}

// Coach — éditeur exercices séance type
function openExEdit(key) {
  const st=getSessionType(key);
  document.getElementById('exed-key').value=key;
  document.getElementById('exed-name').value=st.name||'';
  document.getElementById('exed-warmup').value=st.warmup||'';
  document.getElementById('exed-cooldown').value=st.cooldown||'';
  renderExEditorList(st.exercises);
  document.getElementById('ov-exedit-title').textContent='Modifier : '+st.name;
  openOv('ov-exedit');
}

function renderExEditorList(exercises) {
  const container=document.getElementById('exed-exercises');
  let h='';
  exercises.forEach((ex,i)=>{
    h+=`<div class="ex-editor">
      <div class="ex-editor-hdr">
        <span class="ex-num">${i+1}.</span>
        <span style="font-size:11px;color:var(--text2);font-weight:500;">${ex.name}</span>
        <button onclick="removeEx(${i})" class="btn bd bsm" style="margin-left:auto;">✕</button>
      </div>
      <div class="fr"><label class="fl">Nom</label><input type="text" id="exn-${i}" value="${escHtml(ex.name)}"></div>
      <div class="fr"><label class="fl">Sets / charge</label><input type="text" id="exs-${i}" value="${escHtml(ex.sets)}"></div>
      <div class="fr"><label class="fl">Points clés d'exécution (cues)</label><textarea id="exc-${i}" style="min-height:70px;">${escHtml(ex.cues)}</textarea></div>
    </div>`;
  });
  container.innerHTML=h;
  container.dataset.count=exercises.length;
}

function addExercice() {
  const count=parseInt(document.getElementById('exed-exercises').dataset.count||0);
  const exercises=collectExercises();
  exercises.push({name:'Nouvel exercice',sets:'3×10',cues:'1. Point 1. 2. Point 2. 3. Point 3.'});
  renderExEditorList(exercises);
}

function removeEx(idx) {
  const exercises=collectExercises();
  exercises.splice(idx,1);
  renderExEditorList(exercises);
}

function collectExercises() {
  const container=document.getElementById('exed-exercises');
  const count=parseInt(container.dataset.count||0);
  const exercises=[];
  for (let i=0;i<count;i++) {
    const nEl=document.getElementById(`exn-${i}`);
    const sEl=document.getElementById(`exs-${i}`);
    const cEl=document.getElementById(`exc-${i}`);
    if (nEl&&sEl&&cEl) exercises.push({name:nEl.value,sets:sEl.value,cues:cEl.value});
  }
  return exercises;
}

async function saveExEdit() {
  const key=document.getElementById('exed-key').value;
  const name=document.getElementById('exed-name').value;
  const warmup=document.getElementById('exed-warmup').value;
  const cooldown=document.getElementById('exed-cooldown').value;
  const exercises=collectExercises();
  if(!planOverrides.exercises) planOverrides.exercises={};
  planOverrides.exercises[key]={name,warmup,exercises,cooldown};
  showLoad('Sauvegarde…');
  try{await DB.savePlanOverride('exercises',planOverrides.exercises);}catch(e){console.error(e);}
  hideLoad(); closeOv('ov-exedit'); renderPage(curPage);
}

// PIN
async function savePins() {
  const a=document.getElementById('set-ath')?.value.trim();
  const c=document.getElementById('set-coach')?.value.trim();
  showLoad('Sauvegarde…');
  try{
    if(a&&a.length===4&&/^\d+$/.test(a)) await DB.setConfig('pin_athlete',await sha256(a));
    if(c&&c.length===4&&/^\d+$/.test(c)) await DB.setConfig('pin_coach',await sha256(c));
  }catch(e){console.error(e);}
  hideLoad(); closeOv('ov-settings'); alert('PIN sauvegardés.');
}

// Utilitaires
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── INIT ──────────────────────────────────────────────────────
(async ()=>{
  showLoad('Initialisation…');
  try {
    await DB.getConfig('pin_athlete');
    hideLoad();
    document.getElementById('login').classList.remove('off');
  } catch(e) {
    hideLoad();
    document.getElementById('login').classList.remove('off');
    document.getElementById('perr').textContent='Hors ligne — vérifier la connexion';
  }
})();

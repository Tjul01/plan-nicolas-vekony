// ═══════════════════════════════════════════════════════════════
// garmin.js — Parser FIT + Import JSON pour l'app Badminton Nicolas
// Adapté depuis la version volley : activités badminton + course + force
// ═══════════════════════════════════════════════════════════════

window.GarminBad = (() => {

  // ── STORE en mémoire (complété par Supabase dans app.js) ──────
  let _data = {
    activities: [],   // activités parsées
    wellness:   [],   // données bien-être (sommeil, Body Battery)
    lastSync:   null
  };

  // ── DÉTECTION TYPE ACTIVITÉ ───────────────────────────────────
  const SPORT_MAP = {
    1:  'running',    2:  'cycling',   3:  'transition',
    4:  'fitness',    5:  'swimming',  17: 'walking',
    22: 'badminton',  31: 'generic',   37: 'training',
    52: 'badminton',  53: 'squash',    62: 'badminton'
  };

  function detectBadSport(name = '') {
    const n = name.toLowerCase();
    if (n.includes('bad') || n.includes('badminton') || n.includes('raquette')) return 'badminton';
    if (n.includes('run') || n.includes('cours') || n.includes('jogg')) return 'running';
    if (n.includes('force') || n.includes('muscu') || n.includes('strength') || n.includes('hiit')) return 'strength';
    if (n.includes('vélo') || n.includes('cycl') || n.includes('spin')) return 'cycling';
    if (n.includes('mobil') || n.includes('yoga') || n.includes('stretch')) return 'mobility';
    return 'other';
  }

  // ── PARSER FIT BINAIRE ────────────────────────────────────────
  // Lit les messages Garmin FIT : SESSION (245), RECORD (20), LAP (19), ACTIVITY (34)
  function parseFIT(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Valider header FIT
    if (bytes.length < 14) throw new Error('Fichier trop petit');
    const magic = String.fromCharCode(...bytes.slice(8, 12));
    if (magic !== '.FIT') throw new Error('Format FIT invalide');

    const result = {
      sport: 'other', name: '', date: null,
      duration: 0, distance: 0, avgHR: 0, maxHR: 0,
      calories: 0, avgSpeed: 0,
      hrZones: [0, 0, 0, 0, 0], // Z1-Z5 en secondes
      records: [], laps: []
    };

    let offset = view.getUint8(0); // header size
    const dataSize = view.getUint32(4, true);
    const end = offset + dataSize;

    // Table des définitions de messages locaux
    const localMsgDefs = {};

    const FIELD_TYPES = {
      0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 1, 7: 1,
      8: 4, 9: 4, 10: 2, 11: 2, 12: 4, 13: 1, 14: 1,
      15: 2, 16: 4, 17: 2, 18: 4, 131: 4, 132: 2
    };

    function readField(offset, size, isSigned, isFloat) {
      if (isFloat) return view.getFloat32(offset, true);
      if (size === 1) return isSigned ? view.getInt8(offset) : view.getUint8(offset);
      if (size === 2) return isSigned ? view.getInt16(offset, true) : view.getUint16(offset, true);
      if (size === 4) return isSigned ? view.getInt32(offset, true) : view.getUint32(offset, true);
      return 0;
    }

    // Max HR pour zones (utiliser 185 comme défaut pour Nicolas, 40 ans)
    const MAX_HR = 185;
    const zones = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(f => Math.round(f * MAX_HR));

    while (offset < end - 2) {
      const header = bytes[offset];
      offset++;

      if (header & 0x40) {
        // Message de définition
        const localMsgType = header & 0x0F;
        offset++; // reserved
        const isBigEndian = bytes[offset++];
        const globalMsgNum = isBigEndian
          ? (bytes[offset] << 8) | bytes[offset + 1]
          : bytes[offset] | (bytes[offset + 1] << 8);
        offset += 2;
        const numFields = bytes[offset++];
        const fields = [];
        for (let i = 0; i < numFields; i++) {
          const fieldDef = bytes[offset]; offset++;
          const size = bytes[offset]; offset++;
          const baseType = bytes[offset]; offset++;
          fields.push({ fieldDef, size, baseType });
        }
        localMsgDefs[localMsgType] = { globalMsgNum, isBigEndian, fields };
      } else if (!(header & 0x80)) {
        // Message de données
        const localMsgType = header & 0x0F;
        const def = localMsgDefs[localMsgType];
        if (!def) { offset++; continue; }

        const msgStart = offset;
        const msgData = {};

        def.fields.forEach(f => {
          try {
            const val = readField(offset, f.size, false, false);
            msgData[f.fieldDef] = val;
          } catch(e) {}
          offset += f.size;
        });

        // SESSION (245) — données globales de l'activité
        if (def.globalMsgNum === 245 || def.globalMsgNum === 18) {
          // timestamp (253), total_elapsed_time (7), total_distance (9)
          // avg_heart_rate (16), max_heart_rate (17), sport (5), calories (11)
          if (msgData[253]) result.date = new Date((msgData[253] + 631065600) * 1000);
          if (msgData[7]) result.duration = Math.round(msgData[7] / 1000);
          if (msgData[9]) result.distance = msgData[9] / 100000;
          if (msgData[16]) result.avgHR = msgData[16];
          if (msgData[17]) result.maxHR = msgData[17];
          if (msgData[11]) result.calories = msgData[11];
          if (msgData[5]) result.sport = SPORT_MAP[msgData[5]] || 'other';
          if (msgData[7]) result.avgSpeed = result.distance / (result.duration / 3600);
        }

        // ACTIVITY (34) — nom de l'activité
        if (def.globalMsgNum === 34) {
          if (msgData[253]) result.date = new Date((msgData[253] + 631065600) * 1000);
        }

        // RECORD (20) — données seconde par seconde
        if (def.globalMsgNum === 20) {
          const hr = msgData[3];
          if (hr && hr > 30 && hr < 220) {
            result.records.push({ hr });
            // Calcul zones HR
            if (hr < zones[1]) result.hrZones[0]++;
            else if (hr < zones[2]) result.hrZones[1]++;
            else if (hr < zones[3]) result.hrZones[2]++;
            else if (hr < zones[4]) result.hrZones[3]++;
            else result.hrZones[4]++;
          }
        }

        // LAP (19)
        if (def.globalMsgNum === 19) {
          result.laps.push({
            duration: msgData[7] ? msgData[7] / 1000 : 0,
            distance: msgData[9] ? msgData[9] / 100000 : 0,
            avgHR: msgData[16] || 0
          });
        }
      } else {
        offset++;
      }
    }

    // Si sport non détecté depuis FIT, tenter via durée/distance
    if (result.sport === 'other') {
      if (result.distance < 0.1 && result.duration > 600) result.sport = 'badminton';
    }
    if (!result.date) result.date = new Date();

    return result;
  }

  // ── PARSE FICHIER(S) FIT ──────────────────────────────────────
  async function parseFITFiles(files) {
    const results = [];
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseFIT(buf);
        parsed.name = file.name.replace('.fit', '').replace('.FIT', '');
        parsed.sport = detectBadSport(parsed.name) !== 'other'
          ? detectBadSport(parsed.name)
          : parsed.sport;
        parsed.fileName = file.name;
        parsed.source = 'fit';
        results.push(parsed);
      } catch (e) {
        console.error('FIT parse error:', file.name, e);
      }
    }
    return results;
  }

  // ── IMPORT JSON GARMIN CONNECT ────────────────────────────────
  // Supporte : activities export, wellness/sleep, bodyBattery
  function parseGarminJSON(json) {
    const activities = [];
    const wellness = [];

    try {
      // Format 1 : tableau direct d'activités
      const arr = Array.isArray(json) ? json : (json.activities || json.activityList || [json]);

      arr.forEach(act => {
        if (!act) return;

        // Activité
        if (act.activityId || act.activityType || act.startTimeLocal) {
          const sport = detectBadSport(
            (act.activityName || act.activityType?.typeKey || '')
          );
          activities.push({
            name: act.activityName || 'Activité',
            sport,
            date: act.startTimeLocal ? new Date(act.startTimeLocal) : new Date(),
            duration: Math.round((act.duration || act.movingDuration || 0)),
            distance: (act.distance || 0) / 1000,
            avgHR: act.averageHR || 0,
            maxHR: act.maxHR || 0,
            calories: act.calories || 0,
            avgSpeed: act.averageSpeed || 0,
            hrZones: [
              act.hrTimeInZone_1 || 0,
              act.hrTimeInZone_2 || 0,
              act.hrTimeInZone_3 || 0,
              act.hrTimeInZone_4 || 0,
              act.hrTimeInZone_5 || 0
            ],
            records: [], laps: [],
            source: 'json'
          });
        }

        // Wellness / Body Battery / Sommeil
        if (act.dailySteps || act.bodyBatteryFeedback || act.sleepTimeSeconds) {
          wellness.push({
            date: act.calendarDate ? new Date(act.calendarDate) : new Date(),
            steps: act.dailySteps || 0,
            bodyBattery: act.bodyBatteryFeedback?.[0]?.bodyBatteryLevel ?? null,
            sleepSeconds: act.sleepTimeSeconds || 0,
            deepSleepSeconds: act.deepSleepSeconds || 0,
            remSleepSeconds: act.remSleepSeconds || 0,
            restingHR: act.restingHeartRate || 0
          });
        }
      });
    } catch (e) {
      console.error('JSON parse error', e);
    }

    return { activities, wellness };
  }

  // ── CALCUL CHARGE / FATIGUE (CORRIGÉ) ────────────────────────
  // Retourne null si pas de données (au lieu d'une valeur arbitraire)
  function computeAnalytics(sessionLogs = {}, garminActivities = []) {

    const recent7 = garminActivities.filter(a => {
      const diff = (Date.now() - new Date(a.date).getTime()) / 86400000;
      return diff <= 7;
    });
    const recent14 = garminActivities.filter(a => {
      const diff = (Date.now() - new Date(a.date).getTime()) / 86400000;
      return diff <= 14;
    });

    // Score fatigue : null si pas d'activités récentes
    let fatigueScore = null;
    let recoveryScore = null;

    if (recent7.length > 0 || Object.keys(sessionLogs).length > 0) {
      // Charge 7 jours : somme des RPE × durée estimée
      let load7 = 0;
      Object.entries(sessionLogs).forEach(([date, log]) => {
        const diff = (Date.now() - new Date(date + 'T12:00:00').getTime()) / 86400000;
        if (diff <= 7 && log.status === 'done' && log.rpe) {
          load7 += log.rpe * 40; // 40 min estimées par séance
        }
      });
      recent7.forEach(a => {
        const min = a.duration / 60;
        const rpeEst = a.avgHR > 0 ? Math.min(10, Math.round(a.avgHR / 18)) : 6;
        load7 += rpeEst * min;
      });

      // Charge 14 jours
      let load14 = 0;
      Object.entries(sessionLogs).forEach(([date, log]) => {
        const diff = (Date.now() - new Date(date + 'T12:00:00').getTime()) / 86400000;
        if (diff <= 14 && log.status === 'done' && log.rpe) {
          load14 += log.rpe * 40;
        }
      });
      recent14.forEach(a => {
        const min = a.duration / 60;
        const rpeEst = a.avgHR > 0 ? Math.min(10, Math.round(a.avgHR / 18)) : 6;
        load14 += rpeEst * min;
      });

      // Ratio charge aiguë (7j) / chronique (14j moyenne)
      const chronicLoad = load14 / 2;
      const ratio = chronicLoad > 0 ? load7 / chronicLoad : 1;

      // Score fatigue 0-100 basé sur ratio (1.0 = optimal)
      // ratio > 1.5 = surcharge → fatigue haute
      // ratio < 0.5 = décharge → fatigue basse
      fatigueScore = Math.min(100, Math.max(0, Math.round(50 + (ratio - 1) * 50)));

      // Score récupération : inverse de la fatigue + bonus séances sautées
      const skippedRecently = Object.values(sessionLogs).filter(l =>
        l.status === 'done'
      ).slice(-3).filter(l => l.rpe && l.rpe <= 5).length;
      recoveryScore = Math.min(100, Math.max(0, 100 - fatigueScore + skippedRecently * 5));
    }

    // Charge Achille : minutes d'activités à impact cette semaine
    let achilleLoad = 0;
    Object.entries(sessionLogs).forEach(([date, log]) => {
      const diff = (Date.now() - new Date(date + 'T12:00:00').getTime()) / 86400000;
      if (diff <= 7 && log.status === 'done') {
        // Badminton et cardio = impact Achille
        achilleLoad += 40; // estimation 40 min/séance
      }
    });
    recent7.forEach(a => {
      if (['badminton', 'running'].includes(a.sport)) {
        achilleLoad += a.duration / 60;
      }
    });

    // Adhérence au plan : séances faites / prévues cette semaine
    const planSessions = Object.keys(window.getBadPlan ? window.getBadPlan() : {}).filter(date => {
      const diff = (Date.now() - new Date(date + 'T12:00:00').getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    const doneSessions = planSessions.filter(date =>
      sessionLogs[date]?.status === 'done'
    );
    const adherence = planSessions.length > 0
      ? Math.round((doneSessions.length / planSessions.length) * 100)
      : null;

    // Dernier Body Battery disponible
    const latestWellness = _data.wellness.sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    )[0];

    return {
      fatigueScore,     // null si pas de données
      recoveryScore,    // null si pas de données
      achilleLoad: Math.round(achilleLoad),
      adherence,        // null si pas de séances prévues cette semaine
      bodyBattery: latestWellness?.bodyBattery ?? null,
      restingHR: latestWellness?.restingHR ?? null,
      sleepHours: latestWellness?.sleepSeconds
        ? Math.round(latestWellness.sleepSeconds / 3600 * 10) / 10
        : null,
      recent7Count: recent7.length
    };
  }

  // ── API PUBLIQUE ──────────────────────────────────────────────
  return {
    getData: () => _data,

    setActivities(acts) { _data.activities = acts; },
    setWellness(w) { _data.wellness = w; },

    async handleFITDrop(files) {
      const parsed = await parseFITFiles(files);
      _data.activities = [..._data.activities, ...parsed];
      _data.lastSync = new Date();
      return parsed;
    },

    handleJSONImport(jsonText) {
      try {
        const json = JSON.parse(jsonText);
        const { activities, wellness } = parseGarminJSON(json);
        _data.activities = [..._data.activities, ...activities];
        _data.wellness = [..._data.wellness, ...wellness];
        _data.lastSync = new Date();
        return { activities: activities.length, wellness: wellness.length };
      } catch (e) {
        throw new Error('JSON invalide : ' + e.message);
      }
    },

    computeAnalytics,

    formatDuration(secs) {
      if (!secs) return '—';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
    },

    sportLabel(sport) {
      const labels = {
        badminton: '🏸 Badminton', running: '🏃 Course',
        cycling: '🚴 Vélo', strength: '💪 Force',
        mobility: '🧘 Mobilité', walking: '🚶 Marche', other: '⚡ Activité'
      };
      return labels[sport] || '⚡ Activité';
    },

    sportColor(sport) {
      const colors = {
        badminton: '#58a6ff', running: '#3fb950',
        cycling: '#bc8cff', strength: '#d29922',
        mobility: '#58a6ff', walking: '#3fb950', other: '#8b949e'
      };
      return colors[sport] || '#8b949e';
    }
  };
})();

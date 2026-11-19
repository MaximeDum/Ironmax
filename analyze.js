/* Ironmax · analyse d'une séance par répétition.
   Même code utilisé par l'appli (navigateur) et par Claude pour les mises à jour manuelles (node).
   Entrées :
     plan    = {sport:"velo"|"course", n, repSec, recSec, target}  target en W (vélo) ou m/s (course)
               (n=0 → séance continue : analyse de dérive uniquement)
     st      = {time:[s], hr:[bpm], watts:[W]?, speed:[m/s]?}  (1 point par seconde de préférence)
     prof    = {fcmax, fcrest}
   Sortie : {reps:[], recs:[], sum:{}, verdict:"ok"|"up"|"warn", comment:"..."} */
(function (root) {
  "use strict";
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const median = a => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const fmtT = s => { s = Math.round(s); return Math.floor(s / 60) + "'" + (s % 60 ? String(s % 60).padStart(2, "0") + "\"" : ""); };
  const pace = v => { if (!v) return "—"; const s = Math.round(1000 / v); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + "/km"; };

  // Rééchantillonne à 1 Hz (les fichiers peuvent avoir des trous).
  function resample(st) {
    const t = st.time || st.hr.map((_, i) => i), T = Math.round(t[t.length - 1]) + 1, out = { hr: new Array(T), val: new Array(T) };
    const val = st.watts || st.speed || [];
    let j = 0;
    for (let s = 0; s < T; s++) { while (j < t.length - 1 && t[j + 1] <= s) j++; out.hr[s] = st.hr ? st.hr[j] : null; out.val[s] = val[j] != null ? val[j] : 0; }
    return out;
  }
  // FC nettoyée : un point qui s'écarte de plus de 10 bpm de la médiane sur 15 s est remplacé par cette médiane (pics de capteur).
  function cleanHR(hr) {
    const out = hr.slice();
    for (let i = 0; i < hr.length; i++) {
      if (hr[i] == null) continue;
      const w = []; for (let k = Math.max(0, i - 7); k <= Math.min(hr.length - 1, i + 7); k++) if (hr[k] != null && hr[k] > 30) w.push(hr[k]);
      const m = median(w); if (!isNaN(m) && Math.abs(hr[i] - m) > 10) out[i] = m;
    }
    return out;
  }
  const smooth = (a, w) => { const o = new Array(a.length); let s = 0; const q = []; for (let i = 0; i < a.length; i++) { q.push(a[i] || 0); s += a[i] || 0; if (q.length > w) s -= q.shift(); o[i] = s / q.length; } return o; };

  function detectReps(val, plan) {
    const sm = smooth(val, plan.sport === "velo" ? 30 : 20), thr = plan.target * 0.88;
    let segs = [], start = -1;
    for (let i = 0; i < sm.length; i++) {
      if (sm[i] >= thr && start < 0) start = i;
      if ((sm[i] < thr || i === sm.length - 1) && start >= 0) { segs.push([start, i]); start = -1; }
    }
    // fusionne les coupures de moins de 20 s (feu rouge, virage, relance)
    const merged = [];
    segs.forEach(s => { const l = merged[merged.length - 1]; if (l && s[0] - l[1] < 20) l[1] = s[1]; else merged.push(s.slice()); });
    // le lissage décale les bords : on recale de la moitié de la fenêtre
    const off = plan.sport === "velo" ? 15 : 10;
    let reps = merged.map(s => [Math.max(0, s[0] - off), Math.max(0, s[1] - off)]).filter(s => s[1] - s[0] >= plan.repSec * 0.5);
    if (reps.length > plan.n) reps = reps.map((s, i) => [s, i]).sort((a, b) => (b[0][1] - b[0][0]) - (a[0][1] - a[0][0])).slice(0, plan.n).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    return reps;
  }

  function analyze(plan, st, prof) {
    const R = prof.fcmax - prof.fcrest, z1 = Math.round(prof.fcrest + 0.6 * R);
    const r = resample(st), hr = cleanHR(r.hr), val = r.val, isBike = plan.sport === "velo";
    const fmtV = v => isBike ? Math.round(v) + " W" : pace(v);
    const res = { reps: [], recs: [], sum: {}, verdict: "ok", comment: "" };
    if (!val.some(v => v > 0)) {
      const h = hr.filter(x => x > 30), m = mean(h);
      res.sum = { avgHR: m };
      res.comment = isNaN(m) ? "Ni puissance ni FC exploitables sur cette séance." : `Pas de ${isBike ? "puissance" : "vitesse"} enregistrée (${isBike ? "vélo hors Zwift, ex. Technogym" : "capteur absent"}) : FC moyenne ${Math.round(m)} bpm, max ${Math.round(Math.max(...h))} bpm. Analyse des répétitions impossible.`;
      return res;
    }
    // --- séance continue : dérive cardiaque (efficacité 1re moitié vs 2e moitié, hors 10 premières minutes)
    if (!plan.n) {
      const a = 600, b = val.length; if (b - a < 1200) { res.comment = "Séance trop courte pour mesurer la dérive."; return res; }
      const m = a + ((b - a) >> 1), ef = (x, y) => mean(val.slice(x, y).filter(v => v > 0)) / mean(hr.slice(x, y).filter(h => h > 30));
      const d = (ef(a, m) / ef(m, b) - 1) * 100;
      res.sum = { drift: d, avgHR: mean(hr.filter(h => h > 30)), avgV: mean(val.filter(v => v > 0)) };
      res.verdict = d <= 5 ? "ok" : "warn";
      res.comment = `${fmtV(res.sum.avgV)} pour ${Math.round(res.sum.avgHR)} bpm de moyenne · dérive cardiaque ${d.toFixed(1).replace(".", ",")} % (${d <= 3 ? "très stable" : d <= 5 ? "correcte" : "marquée : chaleur, hydratation ou fatigue"}).`;
      return res;
    }
    // --- séance fractionnée
    let reps = detectReps(val, plan);
    // tours de la montre : complètent la détection auto (ex. bloc ralenti par le GPS), sans la remplacer (tours souvent appuyés en retard)
    if (st.laps && st.laps.length && reps.length < plan.n) {
      const ov = (x, y) => Math.max(0, Math.min(x[1], y[1]) - Math.max(x[0], y[0]));
      (() => { const pw = st.power, rp = pw && reps.length ? mean(reps.map(r => mean(pw.slice(r[0], r[1]).filter(x => x > 0)))) : null;
        return st.laps.filter(l => { const d = l[1] - l[0]; if (d < plan.repSec * 0.7 || d > plan.repSec * 1.3) return false;
          const v = mean(val.slice(l[0], l[1])), p = rp ? mean(pw.slice(l[0], l[1]).filter(x => x > 0)) : null;
          return v >= plan.target * 0.8 || (p && p >= rp * 0.93); }); })()
        .forEach(l => { if (reps.length < plan.n && !reps.some(r => ov(r, l) > (l[1] - l[0]) * 0.3)) { reps.push([l[0], l[1]]); } });
      reps.sort((x, y) => x[0] - y[0]);
    }
    reps.forEach((s, i) => {
      const seg = val.slice(s[0], s[1]), h = hr.slice(s[0] + 60, s[1]).filter(x => x > 30);   // FC hors 1re minute (temps de réponse)
      const avgV = mean(seg), third = Math.max(30, Math.floor((s[1] - s[0] - 60) / 3));
      const hStart = mean(hr.slice(s[0] + 60, s[0] + 60 + third).filter(x => x > 30)), hEnd = mean(hr.slice(s[1] - third, s[1]).filter(x => x > 30));
      const pw = st.power ? mean(st.power.slice(s[0], s[1]).filter(x => x > 0)) : null;
      res.reps.push({ i: i + 1, dur: s[1] - s[0], v: avgV, pct: avgV / plan.target * 100, hr: mean(h), hrEnd: hEnd, intra: hEnd - hStart, pw });
      const next = reps[i + 1] ? reps[i + 1][0] : Math.min(val.length, s[1] + (plan.recSec || 300));
      if (reps[i + 1] || plan.recSec) {
        const peak = Math.max(...hr.slice(Math.max(0, s[1] - 10), Math.min(hr.length, s[1] + 15)).filter(x => x > 30));
        const at60 = hr[Math.min(hr.length - 1, s[1] + 60)];
        let tz = null; for (let k = s[1]; k < Math.min(next, hr.length); k++) if (hr[k] > 30 && hr[k] < z1) { tz = k - s[1]; break; }
        if (reps[i + 1]) res.recs.push({ i: i + 1, dur: next - s[1], drop60: peak - at60, tz });
      }
    });
    // --- partie continue (Z2) : hors 10 premières et 10 dernières minutes, hors blocs et 3 min après chaque bloc
    { const inRep = new Uint8Array(val.length); reps.forEach(s => { for (let k = s[0]; k < Math.min(val.length, s[1] + 180); k++) inRep[k] = 1; });
      const idx = []; for (let k = 600; k < val.length - 600; k++) if (!inRep[k] && val[k] > 0) idx.push(k);
      if (idx.length >= 600) { const v = mean(idx.map(k => val[k])), h = mean(idx.map(k => hr[k]).filter(x => x > 30)); res.z2 = [idx.length, v, h]; } }
    // contrôle GPS (course) : un bloc nettement plus lent avec la même puissance, la même FC → allure estimée depuis la puissance
    if (!isBike && res.reps.length >= 3 && res.reps.every(x => x.pw > 0)) {
      const med = arr => { const s = arr.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
      const mV = med(res.reps.map(x => x.v)), mP = med(res.reps.map(x => x.pw)), mH = med(res.reps.map(x => x.hr));
      res.reps.forEach(x => { if (Math.abs(x.v / mV - 1) > 0.025 && Math.abs(x.pw / mP - 1) < 0.03 && Math.abs(x.hr - mH) < 5) { x.gps = 1; x.vMeas = x.v; x.v = mV * x.pw / mP; x.pct = x.v / plan.target * 100; } });
      const g = res.reps.filter(x => x.gps); if (g.length) res.gps = g.map(x => `bloc ${x.i} mesuré à ${pace(x.vMeas)} mais même puissance que les autres → ≈ ${pace(x.v)} (GPS)`);
    }
    const n = res.reps.length, pct = mean(res.reps.map(x => x.pct)), first = res.reps[0], last = res.reps[n - 1];
    const drift = n > 1 ? (last.hr / first.hr - 1) * 100 : (first ? first.intra / first.hr * 100 : 0);
    const shortReps = res.reps.filter(x => x.dur < plan.repSec * 0.9).length;
    const drop = mean(res.recs.map(x => x.drop60));
    res.sum = { n, N: plan.n, pct, drift, drop, z1, shortReps };
    // --- verdict
    const bits = [], warn = [];
    if (!n) { res.verdict = "warn"; res.comment = "Aucune répétition détectée à l'intensité prévue : séance faite plus facile, ou capteur absent."; return res; }
    if (n < plan.n) warn.push(`${n}/${plan.n} répétitions`);
    if (shortReps) warn.push(`${shortReps} répétition${shortReps > 1 ? "s" : ""} écourtée${shortReps > 1 ? "s" : ""}`);
    const cible = pct >= 97 && pct <= 103 ? "cible tenue" : pct > 103 ? `+${Math.round(pct - 100)} % au-dessus de la cible` : `${Math.round(100 - pct)} % sous la cible`;
    if (pct < 97) warn.push("intensité sous la cible");
    bits.push(`${n}/${plan.n} × ${fmtT(plan.repSec)} à ${fmtV(mean(res.reps.map(x => x.v)))} (${cible})`);
    bits.push(`FC moyenne ${res.reps.map(x => Math.round(x.hr)).join(" → ")} bpm` + (n > 1 ? ` (${drift >= 0 ? "+" : ""}${drift.toFixed(1).replace(".", ",")} %, ${Math.abs(drift) <= 3 ? "stable" : drift <= 7 ? "dérive modérée" : "dérive marquée"})` : ""));
    if (drift > 7) warn.push("dérive cardiaque marquée");
    if (res.recs.length) {
      const tz = res.recs.map(x => x.tz).filter(x => x != null);
      // La vitesse de récup ne veut dire quelque chose qu'après des répétitions dures (FC ≥ 80 % de la réserve).
      // Après de la force, du sweet spot ou du tempo, avec une récup pédalée, une baisse de 10 à 15 bpm est normale.
      const hard = mean(res.reps.map(x => x.hr)) >= prof.fcrest + 0.8 * R;
      bits.push(`récup : FC −${Math.round(drop)} bpm en 1'` + (tz.length ? `, sous ${z1} bpm en ${fmtT(mean(tz))}` : `, jamais sous ${z1} bpm`) + (hard ? ` (${drop >= 30 ? "rapide" : drop >= 20 ? "correcte" : "lente"})` : ""));
      if (hard && drop < 20) warn.push("récupération cardiaque lente");
      res.sum.hard = hard;
    }
    const margin = pct > 103 || (drift < 2 && (!res.sum.hard || drop >= 30));
    // exécution parfaite : toutes les répétitions, cible tenue à ±3 %, FC qui monte peu d'un bloc à l'autre, récup correcte
    const perfect = n >= plan.n && pct >= 97 && pct <= 103 && drift <= 5 && (!res.recs.length || drop >= 18);
    res.verdict = warn.length ? "warn" : (margin || perfect) ? "up" : "ok";
    const concl = warn.length ? `À surveiller : ${warn.join(", ")}.` : margin ? "Séance maîtrisée avec de la marge : la cible pourra monter si ça se confirme." : perfect ? "Séance exécutée parfaitement : cible tenue, FC sous contrôle." : "Séance maîtrisée.";
    res.comment = bits.join(" · ") + ". " + concl + (res.gps ? " ⚠ " + res.gps.join(" ; ") + "." : "");
    return res;
  }

  // Natation : distance (corrigée par la description si besoin), allure /100 m et FC vs l'intensité prévue (au ressenti).
  // plan = {m, feel:"facile"|"modere"|"soutenu", ow:bool} ; act = {distance, moving_time, hr, description}
  function realSwimDistance(act) {
    const d = act.description || "";
    let m = /(\d[\d\s.,]*)\s*\*/.exec(d);
    if (m) { const v = parseFloat(m[1].replace(/\s/g, "").replace(",", ".")); if (v > 0) return v < 20 ? v * 1000 : v; }
    m = /(\d+(?:[.,]\d+)?)\s*km au compteur/i.exec(d);
    if (m) return parseFloat(m[1].replace(",", ".")) * 1000;
    return act.distance || 0;
  }
  function analyzeSwim(plan, act, prof) {
    const R = prof.fcmax - prof.fcrest, dist = realSwimDistance(act), corr = dist !== act.distance;
    const sec100 = act.moving_time / (dist / 100), p100 = Math.floor(sec100 / 60) + ":" + String(Math.round(sec100 % 60)).padStart(2, "0");
    const pctD = plan.m ? dist / plan.m * 100 : 100, hr = act.hr, res = (hr - prof.fcrest) / R;
    // repères natation (FC plus basse qu'à pied) : facile < 55 % de réserve, modéré 55–68 %, soutenu > 62 %
    const zone = !hr ? null : res < 0.55 ? "facile" : res < 0.68 ? "modéré" : "soutenu";
    const want = plan.feel || "modere", wantN = { facile: "facile", modere: "modéré", soutenu: "soutenu" }[want] || "modéré";
    const bits = [`${Math.round(dist).toLocaleString("fr-FR")} m${corr ? " (distance corrigée)" : ""} pour ${plan.m ? Number(plan.m).toLocaleString("fr-FR") + " m prévus" : "—"} · ${p100}/100 m` + (hr ? ` · FC ${Math.round(hr)} bpm (${zone})` : "")];
    const warn = [];
    if (pctD < 85) warn.push(`volume à ${Math.round(pctD)} % du prévu`);
    if (zone && want === "facile" && zone === "soutenu") warn.push("plus intense que prévu");
    if (zone && want === "soutenu" && zone === "facile") warn.push("plus facile que prévu");
    const verdict = warn.length ? "warn" : pctD > 110 ? "up" : "ok";
    const concl = warn.length ? `À surveiller : ${warn.join(", ")}.` : `Conforme à la séance ${wantN}e prévue.`.replace("modérée", "modérée").replace("facilee", "facile");
    return { verdict, comment: bits.join("") + ". " + concl, sum: { dist, sec100, pctD, zone } };
  }
  // "3×18'" + "5'" → {n, repSec, recSec}
  function parseSets(sets, rec) {
    const m = /^(\d+)×(\d+)'(\d+)?/.exec(sets || ""); const r = /(\d+)'(\d+)?/.exec(rec || "");
    return m ? { n: +m[1], repSec: +m[2] * 60 + (+m[3] || 0), recSec: r ? +r[1] * 60 + (+r[2] || 0) : 0 } : (/^(\d+)'$/.test(sets || "") ? { n: 1, repSec: parseInt(sets) * 60, recSec: 0 } : null);
  }

  // Allure équivalente à une FC donnée (140 bpm), calculée sur les portions stables d'une séance de course :
  // tranches de 30 s après les 5 premières minutes, vitesse stable depuis 90 s (la FC a eu le temps de suivre),
  // puis droite vitesse = a + b × FC sur ces tranches. Marche pour le continu comme pour le fractionné.
  function speedAtHR(st, target, prof) {
    target = target || 140;
    const r = resample(st), hr = cleanHR(r.hr), v = r.val, B = 30, bins = [];
    for (let s = 300; s + B <= v.length; s += B) {
      const vv = v.slice(s, s + B), hh = hr.slice(s, s + B).filter(x => x > 30);
      if (hh.length < B * .6) { bins.push(null); continue; }
      bins.push({ v: mean(vv), h: mean(hh), lo: Math.min(...vv) });
    }
    const pts = [];
    for (let i = 3; i < bins.length; i++) {
      const b = bins[i], p = [bins[i - 1], bins[i - 2], bins[i - 3]];
      if (!b || p.some(x => !x) || b.v < 1.8 || b.h < 105 || b.h > 190) continue;
      if (p.every(x => Math.abs(x.v / b.v - 1) <= .06) && Math.abs(b.h - p[0].h) <= 4) pts.push(b);
    }
    if (pts.length < 8) return null;
    const mh = mean(pts.map(x => x.h)), mv = mean(pts.map(x => x.v));
    let sxy = 0, sxx = 0; pts.forEach(x => { sxy += (x.h - mh) * (x.v - mv); sxx += (x.h - mh) ** 2; });
    const lo = Math.min(...pts.map(x => x.h)), hi = Math.max(...pts.map(x => x.h));
    const sl = prof && prof.slope || .021;                       // m/s par bpm (pente personnelle si connue)
    let b = sxx > 0 ? sxy / sxx : sl;
    const spread = hi - lo >= 12;                               // assez d'écart de FC pour mesurer la pente
    if (!spread || b < .008 || b > .045) b = sl;
    // si 140 est hors des FC de la séance, on part du groupe de tranches le plus proche
    let v140;
    if (target >= lo - 3 && target <= hi + 3) v140 = mv + b * (target - mh);
    else { const near = pts.filter(x => Math.abs(x.h - (target < lo ? lo : hi)) <= 6); v140 = mean(near.map(x => x.v)) + b * (target - mean(near.map(x => x.h))); }
    return { v: v140, slope: spread ? b : null, n: pts.length, lo: Math.round(lo), hi: Math.round(hi) };
  }
  const api = { speedAtHR, analyze, analyzeSwim, realSwimDistance, parseSets, cleanHR, pace };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.IronAnalyze = api;
})(typeof self !== "undefined" ? self : this);

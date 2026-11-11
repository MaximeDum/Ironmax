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
  const pace = v => { if (!v) return "—"; const s = 1000 / v; return Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0") + "/km"; };

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
    const reps = detectReps(val, plan);
    reps.forEach((s, i) => {
      const seg = val.slice(s[0], s[1]), h = hr.slice(s[0] + 60, s[1]).filter(x => x > 30);   // FC hors 1re minute (temps de réponse)
      const avgV = mean(seg), third = Math.max(30, Math.floor((s[1] - s[0] - 60) / 3));
      const hStart = mean(hr.slice(s[0] + 60, s[0] + 60 + third).filter(x => x > 30)), hEnd = mean(hr.slice(s[1] - third, s[1]).filter(x => x > 30));
      res.reps.push({ i: i + 1, dur: s[1] - s[0], v: avgV, pct: avgV / plan.target * 100, hr: mean(h), hrEnd: hEnd, intra: hEnd - hStart });
      const next = reps[i + 1] ? reps[i + 1][0] : Math.min(val.length, s[1] + (plan.recSec || 300));
      if (reps[i + 1] || plan.recSec) {
        const peak = Math.max(...hr.slice(Math.max(0, s[1] - 10), Math.min(hr.length, s[1] + 15)).filter(x => x > 30));
        const at60 = hr[Math.min(hr.length - 1, s[1] + 60)];
        let tz = null; for (let k = s[1]; k < Math.min(next, hr.length); k++) if (hr[k] > 30 && hr[k] < z1) { tz = k - s[1]; break; }
        if (reps[i + 1]) res.recs.push({ i: i + 1, dur: next - s[1], drop60: peak - at60, tz });
      }
    });
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
      bits.push(`récup : FC −${Math.round(drop)} bpm en 1'` + (tz.length ? `, sous ${z1} bpm en ${fmtT(mean(tz))}` : `, jamais sous ${z1} bpm`) + ` (${drop >= 30 ? "rapide" : drop >= 20 ? "correcte" : "lente"})`);
      if (drop < 20) warn.push("récupération cardiaque lente");
    }
    res.verdict = warn.length ? "warn" : (pct > 103 || (drift < 2 && drop >= 30)) ? "up" : "ok";
    const concl = warn.length ? `À surveiller : ${warn.join(", ")}.` : res.verdict === "up" ? "Séance maîtrisée avec de la marge : la cible pourra monter si ça se confirme." : "Séance maîtrisée.";
    res.comment = bits.join(" · ") + ". " + concl;
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
  const api = { analyze, analyzeSwim, realSwimDistance, parseSets, cleanHR, pace };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.IronAnalyze = api;
})(typeof self !== "undefined" ? self : this);

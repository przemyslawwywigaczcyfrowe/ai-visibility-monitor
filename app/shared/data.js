/* ---------- measurement data: loading, and the numbers every report is built from ----------
   config/config.json is public, data/index.enc holds the positions of every run,
   data/runs/*.enc the full answers of one run. */
var REPO = 'przemyslawwywigaczcyfrowe/ai-visibility-monitor';
var LOGO = { PL: 'assets/stores/pl-cyfrowe.svg', UK: 'assets/stores/uk-wex.png', NL: 'assets/stores/nl-cameranu.svg', DE: 'assets/stores/de-calumet.svg' };
var IDX = null, CFG = null, M = [], ENG = [], RUNS = {}, CELL = {}, DET = {}, START = {}, PLIKI = {}, CACHE = {};
/* One answer per prompt and engine a day, so a single prompt moves visibility by 4 points.
   "Visibility up/down" and "ahead of" need a difference of at least PROG prompts (PROG_GRUPA for all stores). */
var PROG = 3, PROG_GRUPA = 6;
/* Names on the watch list that are not stores: price comparison sites, classifieds, review sites.
   They are shown, but they do not take a place in the position (config.json, field "kind"). */
var NIE_SKLEP = {};
var TYP_NAZWA = { comparison: 'price comparison', classifieds: 'classifieds', review: 'review site' };
function sklepyWOdp(lista) { return String(lista || '').split('; ').filter(function (n) { return n && !NIE_SKLEP[n]; }); }
function miejsceSklepu(h, store) {
  if (h[3] == null || !h[4]) return h[3];
  var i = sklepyWOdp(h[4]).indexOf(store);
  return i < 0 ? h[3] : i + 1;
}
/* Engine name as shown: the API model, and which app it approximates (config.json, field "short"). */
function nazwaSil(e) {
  var x = ((CFG && CFG.engines) || []).filter(function (k) { return k.label === e; })[0];
  return x && x.short ? x.short : e;
}
function typTag(t) { return t ? ' <span class="tag" title="Shown for reference, does not take a place in the position">' + esc(TYP_NAZWA[t] || t) + '</span>' : ''; }
function dzien(run) { if (/^\d{4}-\d\d-\d\d$/.test(run)) return new Date(run + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); var t = START[run]; return t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : run; }
function kiedy(run) { if (/^\d{4}-\d\d-\d\d$/.test(run)) return new Date(run + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); var t = START[run]; return t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : run; }
function logo(code, h) { return '<img src="' + LOGO[code] + '" alt="' + esc(rynek(code).store) + '" class="' + (code === 'UK' ? 'wex' : '') + '"' + (h ? ' style="height:' + h + 'px"' : '') + '>'; }
function szczegoly(run) {
  if (!CACHE[run]) CACHE[run] = odszyfruj('data/runs/' + PLIKI[run] + '.enc').then(function (o) { DET[run] = o.details; return o.details; });
  return CACHE[run];
}

/* ---------- data ---------- */
async function wczytaj() {
  var w = await Promise.all([odszyfruj('data/index.enc'), fetch('config/config.json', { cache: 'no-store' }).then(function (r) { return r.json(); })]);
  IDX = w[0]; CFG = w[1];
  NIE_SKLEP = {}; (CFG.shops || []).forEach(function (s) { if (s.kind) NIE_SKLEP[s.name] = s.kind; });
  var sklepRynku = {}; (IDX.markets || []).forEach(function (m) { sklepRynku[m.code] = m.store; });
  IDX.hist.forEach(function (h) { h[3] = miejsceSklepu(h, sklepRynku[String(h[1]).slice(0, 2)]); });
  /* every slice loads its own data (checklist, change log) */
  await Promise.all(zbierz('wczytaj'));
  IDX.runs.forEach(function (r) { PLIKI[r.run] = r.file; START[r.run] = r.start; });
  ENG = IDX.engines.map(function (e) { return e.label; });
  IDX.hist.forEach(function (h) {
    CELL[h[0] + '|' + h[1] + '|' + h[2]] = h;
    var k = h[1].slice(0, 2); RUNS[k] = RUNS[k] || []; if (RUNS[k].indexOf(h[0]) < 0) RUNS[k].push(h[0]);
  });
  Object.keys(RUNS).forEach(function (k) { RUNS[k].sort(); });
  M = IDX.markets.map(function (m) {
    var prompts = IDX.prompts.filter(function (p) { return p.market === m.code; }).map(function (p) {
      var n = +p.id.slice(2);
      return { id: p.id, n: n, text: p.text, topic: p.topic, en: (CFG.prompts_en && CFG.prompts_en[m.code] || [])[n - 1] || p.text };
    });
    var re; try { re = new RegExp('(' + (m.pattern || m.store) + ')', 'gi'); } catch (e) { re = /$^/g; }
    return { code: m.code, name: m.name, city: m.city, store: m.store, domains: m.domains, re: re, prompts: prompts };
  });
  await Promise.all(M.map(function (m) { var r = ostatni(m); return r ? szczegoly(r) : null; }));
}
function rynek(code) { return M.filter(function (m) { return m.code === code; })[0] || M[0]; }
function runy(m) { return RUNS[m.code] || []; }
function ostatni(m) { var r = runy(m); return r[r.length - 1]; }
function przed(m, run) { var r = runy(m), i = r.indexOf(run); return i > 0 ? r[i - 1] : null; }
function silniki() { return S.engine === 'all' ? ENG : [S.engine]; }
function kom(run, id, e) { return CELL[run + '|' + id + '|' + e] || null; }
/* Position of a prompt = best (lowest) place of our store among the selected engines, like one SERP position per keyword. */
function poz(run, id, eng) {
  var najl = null, dane = false;
  (eng || silniki()).forEach(function (e) { var c = kom(run, id, e); if (!c || c[6]) return; dane = true; if (c[3] != null && (najl == null || c[3] < najl)) najl = c[3]; });
  return dane ? najl : undefined;
}
function prompty(m) {
  var q = S.q.toLowerCase();
  return m.prompts.filter(function (p) { return (!S.topic || p.topic === S.topic) && !(S.bez4 && p.n === 4) && (!q || (p.en + ' ' + p.text).toLowerCase().indexOf(q) >= 0); });
}
function kpi(m, run, eng) {
  var o = { n: 0, ment: 0, odp: [], first: 0, top3: 0, cited: 0, b: { 1: 0, 3: 0, 10: 0, 0: 0 } };
  if (!run) return o;
  eng = eng || silniki();
  prompty(m).forEach(function (p) {
    var v = poz(run, p.id, eng); if (v === undefined) return;
    o.n++;
    /* Unit = prompt: its best place in the selected engines, as in the Position column. */
    if (v != null) { o.ment++; o.odp.push(v); o.b[v === 1 ? 1 : v <= 3 ? 3 : 10]++; if (v === 1) o.first++; if (v <= 3) o.top3++; } else o.b[0]++;
    var cyt = false;
    eng.forEach(function (e) { var c = kom(run, p.id, e); if (!c || c[6]) return; if (c[5]) cyt = true; });
    if (cyt) o.cited++;
  });
  o.vis = o.n ? o.ment / o.n * 100 : 0;
  o.avg = o.odp.length ? o.odp.reduce(function (a, b) { return a + b; }, 0) / o.odp.length : null;
  return o;
}
function sklepy(m, run, eng) {
  var s = {}, wszystkie = 0, n = 0;
  eng = eng || silniki();
  prompty(m).forEach(function (p) {
    var byl = false;
    eng.forEach(function (e) {
      var c = kom(run, p.id, e); if (!c || c[6]) return; byl = true;
      if (!c[4]) return;
      var j = 0;
      c[4].split('; ').forEach(function (nm) {
        var o = s[nm] = s[nm] || { name: nm, p: {}, best: {}, odp: 0, typ: NIE_SKLEP[nm] || '' };
        o.p[p.id] = 1; o.odp++; wszystkie++;
        if (!o.typ) { j++; if (o.best[p.id] == null || j < o.best[p.id]) o.best[p.id] = j; }
      });
    });
    if (byl) n++;
  });
  /* Visibility and share of voice count every name; place, average and "named first" only stores,
     per prompt (best place in the selected engines), the same unit as for our store. */
  var l = Object.keys(s).map(function (k) {
    var o = s[k], b = Object.keys(o.best).map(function (x) { return o.best[x]; });
    o.count = Object.keys(o.p).length; o.vis = n ? o.count / n * 100 : 0;
    o.avg = b.length ? b.reduce(function (a, x) { return a + x; }, 0) / b.length : null;
    o.first = b.filter(function (x) { return x === 1; }).length; o.sov = wszystkie ? o.odp / wszystkie * 100 : 0; return o;
  });
  if (!l.some(function (x) { return x.name === m.store; })) l.push({ name: m.store, count: 0, vis: 0, avg: null, first: 0, sov: 0, odp: 0, typ: '' });
  return l.sort(function (a, b) { return (a.typ ? 1 : 0) - (b.typ ? 1 : 0) || b.count - a.count || b.first - a.first || (a.avg || 99) - (b.avg || 99); });
}
/* Prompts that moved between the compare run and the chosen run. */
function ruchy(m) {
  var o = { up: [], down: [], nw: [], lost: [] };
  if (!S.cmp) return o;
  prompty(m).forEach(function (p) {
    var v = poz(S.run, p.id), a = poz(S.cmp, p.id); if (v === undefined || a === undefined) return;
    var x = { p: p, v: v, a: a };
    if (v != null && a == null) o.nw.push(x); else if (v == null && a != null) o.lost.push(x);
    else if (v != null && v < a) o.up.push(x); else if (v != null && v > a) o.down.push(x);
  });
  return o;
}

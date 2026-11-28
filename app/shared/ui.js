/* ---------- small pieces ---------- */
/* Change against the compare run. For counts more is better, for positions less is better. */
function dl(teraz, wtedy, wiecej, d, jedn) {
  if (wtedy == null || teraz == null || !S.cmp) return '';
  var r = teraz - wtedy;
  if (Math.abs(r) < 1e-9) return '<span class="dl same">no change</span>';
  var dobrze = wiecej ? r > 0 : r < 0;
  return '<span class="dl ' + (dobrze ? 'up' : 'down') + '">' + (dobrze ? '▲' : '▼') + fmt(Math.abs(r), d) + (jedn || '') + '</span>';
}
function dlPoz(v, a) {
  if (a === undefined || !S.cmp) return '';
  if (v != null && a == null) return '<span class="dl new">new</span>';
  if (v == null && a != null) return '<span class="dl lost">lost</span>';
  if (v == null || v === a) return '';
  return '<span class="dl ' + (v < a ? 'up' : 'down') + '">' + (v < a ? '▲' : '▼') + Math.abs(v - a) + '</span>';
}
function pozHtml(v) { return v === undefined ? '<span class="poz brak">n/a</span>' : v == null ? '<span class="poz brak">not named</span>' : '<span class="poz ' + (v === 1 ? 'p1' : '') + '">' + v + '</span>'; }
function spark(vals, odwr, w, h) {
  w = w || 92; h = h || 26; var pts = [];
  var ok = vals.filter(function (v) { return v != null; });
  if (vals.length < 2 || !ok.length) return '<span class="szary">-</span>';
  var max = odwr ? Math.max(4, Math.max.apply(null, ok)) : 100;
  vals.forEach(function (v, i) { if (v != null) pts.push([i * w / (vals.length - 1), odwr ? 3 + (h - 6) * (v - 1) / (max - 1) : h - 3 - (h - 6) * v / max]); });
  return '<svg width="' + w + '" height="' + h + '" aria-hidden="true"><polyline fill="none" stroke="#0B57D0" stroke-width="1.6" points="' +
    pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' + (pts.length ? '<circle cx="' + pts[pts.length - 1][0] + '" cy="' + pts[pts.length - 1][1] + '" r="2.5" fill="#0B57D0"/>' : '') + '</svg>';
}
/* Line chart with hover, one point per run. */
var WYK = {};
function wykres(id, labels, series, o) {
  o = o || {};
  WYK[id] = { labels: labels, series: series, o: o };
  return '<div class="wyk" id="' + id + '"></div>';
}
function narysujWykresy() {
  Object.keys(WYK).forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    var d = WYK[id], o = d.o, L = d.labels, W = Math.max(el.clientWidth, 300), Hh = o.h || 260, l = 44, r = 14, t = 12, b = 28;
    if (L.length < 2) { el.innerHTML = '<div class="pusto">The trend appears after the second daily run. First run: ' + esc(L[0] ? dzien(L[0]) : '-') + '.</div>'; return; }
    var max = o.max, min = o.min || 0;
    if (max == null) { max = 0; d.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && v > max) max = v; }); }); max = Math.max(max, 1); }
    function X(i) { return l + i * (W - l - r) / (L.length - 1); }
    function Y(v) { return o.invert ? t + (Hh - t - b) * (v - min) / (max - min) : t + (Hh - t - b) * (1 - (v - min) / (max - min)); }
    var svg = '', kroki = o.ticks || [min, (min + max) / 2, max];
    kroki.forEach(function (v) { svg += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#EEF0F2"/><text class="os" x="' + (l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + fmt(v, o.dec || 0) + (o.unit || '') + '</text>'; });
    var co = Math.max(1, Math.ceil(L.length / 10));
    L.forEach(function (p, i) { if (i % co === 0 || i === L.length - 1) svg += '<text class="os" x="' + X(i) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + esc(dzien(p)) + '</text>'; });
    d.series.slice().reverse().forEach(function (s) {
      var seg = [], cur = [];
      s.values.forEach(function (v, i) { if (v == null) { if (cur.length) seg.push(cur); cur = []; } else cur.push(X(i).toFixed(1) + ',' + Y(v).toFixed(1)); });
      if (cur.length) seg.push(cur);
      seg.forEach(function (c) { svg += '<polyline fill="none" stroke="' + s.color + '" stroke-width="' + (s.w || 2) + '" stroke-linejoin="round" stroke-linecap="round" points="' + c.join(' ') + '"/>'; });
      var li = s.values.length - 1; if (s.values[li] != null) svg += '<circle cx="' + X(li) + '" cy="' + Y(s.values[li]) + '" r="' + (s.w > 2 ? 4.5 : 3.5) + '" fill="' + s.color + '" stroke="#fff" stroke-width="1.5"/>';
    });
    svg += '<line class="kursor" y1="' + t + '" y2="' + (Hh - b) + '" stroke="#9AA0A6" stroke-dasharray="3 3" style="display:none"/>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="height:' + Hh + 'px">' + svg + '</svg><div class="dymek"></div>' +
      '<div class="legenda">' + d.series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    var sv = el.querySelector('svg'), dy = el.querySelector('.dymek'), ku = el.querySelector('.kursor');
    sv.onmousemove = function (ev) {
      var rr = sv.getBoundingClientRect(), x = (ev.clientX - rr.left) * W / rr.width, i = Math.round((x - l) / ((W - l - r) / (L.length - 1)));
      i = Math.max(0, Math.min(L.length - 1, i));
      ku.setAttribute('x1', X(i)); ku.setAttribute('x2', X(i)); ku.style.display = '';
      dy.innerHTML = '<b>' + esc(kiedy(L[i])) + '</b><br>' + d.series.map(function (s) { var v = s.values[i]; return '<span style="color:' + s.color + '">●</span> ' + esc(s.name) + ': <b>' + (v == null ? '-' : fmt(v, o.dec || 0) + (o.unit || '')) + '</b>'; }).join('<br>');
      dy.style.display = 'block'; dy.style.left = Math.min(X(i) * rr.width / W + 14, rr.width - dy.offsetWidth - 4) + 'px'; dy.style.top = '8px';
    };
    sv.onmouseleave = function () { dy.style.display = 'none'; ku.style.display = 'none'; };
  });
}
var BUCKETS = [[1, 'Named 1st', 'var(--b1)'], [3, 'Named 2nd-3rd', 'var(--b2)'], [10, 'Named 4th or later', 'var(--b3)'], [0, 'Not named', 'var(--b0)']];
var tm; window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(narysujWykresy, 150); });

/* White header card of a store view: what is shown on the left (the sentence carries numbers),
   three number tiles on the right, so the card has no empty half. lead is HTML. */
function naglowek(tytul, lead, kafle) {
  var m = rynek(S.market);
  return '<section class="naglowek"><div class="hl"><div class="kick">' + esc(m.name + ' · ' + m.store + ' · ' + silnikiTekst() + (S.topic ? ' · ' + S.topic : '') + ' · run of ' + kiedy(S.run)) + '</div><h1>' + esc(tytul) + '</h1>' +
    (lead ? '<p class="lead">' + lead + '</p>' : '') + '</div>' +
    (kafle && kafle.length ? '<div class="hr">' + kafle.map(function (k) { return '<div class="kf"><span>' + esc(k[0]) + '</span><b class="num" title="' + esc(String(k[1]).replace(/<[^>]+>/g, '')) + '">' + k[1] + '</b>' + (k[2] ? '<small>' + esc(k[2]) + '</small>' : '') + '</div>'; }).join('') + '</div>' : '') + '</section>';
}
function silnikiTekst() { return (S.engine === 'all' ? ENG.map(nazwaSil).join(' and ') + ' together' : nazwaSil(S.engine)) + (S.bez4 ? ', without prompt 4' : ''); }
/* Blue header card (Summary, All stores): verdict sentence on the left, key number on the right. */
function hero(o) {
  return '<section class="hero"><svg class="ksztalt" viewBox="0 0 100 100" aria-hidden="true"><path fill="#A8C7FA" d="M50 0l12 26 28-4-10 27 20 19-28 6-2 28-20-17-20 17-2-28-28-6 20-19-10-27 28 4z"/></svg>' +
    '<div class="hero-l"><div class="meta">' + (o.ocena ? '<span class="ocena ' + o.ocena[0] + '">' + esc(o.ocena[1]) + '</span>' : '') + '<span class="okres">' + esc(o.okres) + '</span></div>' +
    '<h1 class="werdykt">' + o.werdykt + '</h1><p class="zd">' + o.zd + '</p>' + (o.akcje ? '<div class="akcje">' + o.akcje + '</div>' : '') + '</div>' +
    '<div class="hero-r">' + o.prawa + '</div></section>';
}

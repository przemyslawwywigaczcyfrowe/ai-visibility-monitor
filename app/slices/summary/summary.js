/* ---------- Summary ---------- */
function widokSummary() {
  var m = rynek(S.market); if (!S.run) return '<div class="pusto">No run yet.</div>';
  var a = kpi(m, S.run), b = S.cmp ? kpi(m, S.cmp) : null, mv = ruchy(m);
  /* Small trend line in every tile: the same metric in the last 14 runs. */
  var R14 = runy(m).filter(function (r) { return r <= S.run; }).slice(-14), K14 = R14.map(function (r) { return kpi(m, r); });
  function tr(f, max) { return R14.length < 2 ? '' : spark2(K14.map(f), max); }
  var wsz = sklepy(m, S.run), lider = wsz.filter(function (s) { return s.name !== m.store && !s.typ; })[0], my = wsz.filter(function (s) { return s.name === m.store; })[0];
  /* Change in prompts, not in percent: below PROG prompts the difference is within day-to-day variation. */
  var roz = b ? a.ment - b.ment : null;
  var R7 = runy(m).filter(function (r) { return r <= S.run; }).slice(-7), V7 = R7.map(function (r) { return kpi(m, r).vis; });
  var sr7 = V7.length ? V7.reduce(function (x, y) { return x + y; }, 0) / V7.length : null;
  var roznica = lider ? a.ment - lider.count : null;
  var h = hero({
    ocena: roz == null ? null : roz >= PROG ? ['good', 'Visibility up'] : roz <= -PROG ? ['bad', 'Visibility down'] : ['', 'No clear change'],
    okres: 'Run of ' + kiedy(S.run) + (S.cmp ? ' compared with ' + kiedy(S.cmp) : ''),
    werdykt: esc(m.store) + ' is named in <span class="kw">' + a.ment + ' of ' + a.n + ' prompts</span>',
    zd: esc(silnikiTekst()) + (S.topic ? ', topic ' + esc(S.topic) : '') + '. Of these ' + a.n + ' prompts, named first in <b>' + a.first + '</b> and in the top 3 in <b>' + a.top3 + '</b>. ' +
      (lider ? (roznica <= -PROG ? '<b>' + esc(lider.name) + '</b> is named more often: ' + lider.count + ' prompts. ' : roznica >= PROG ? 'Ahead of every store, next is <b>' + esc(lider.name) + '</b> with ' + lider.count + ' prompts. ' : 'Close to <b>' + esc(lider.name) + '</b> (' + lider.count + ' prompts), a gap within day-to-day variation. ') : '') +
      (S.cmp ? 'Since ' + esc(dzien(S.cmp)) + ': <b>' + (mv.up.length + mv.nw.length) + '</b> prompts better, <b>' + (mv.down.length + mv.lost.length) + '</b> worse.' : ''),
    akcje: '<button class="btn primary duzy" data-go="rankings">' + ic('i-list') + 'See all ' + a.n + ' prompts</button><button class="btn bialy duzy" data-go="competitors">' + ic('i-store') + 'Competitors</button>',
    prawa: '<div class="kw-l">Visibility</div><div class="kw-v num">' + fmt(a.vis) + '%</div>' +
      '<div class="kw-d">' + (b ? dl(a.vis, b.vis, true, 0, ' pts') + '<span>' + esc(dzien(S.cmp)) + ': ' + fmt(b.vis) + '%</span>' : '<span>no comparison</span>') + '</div>' +
      (V7.length > 1 ? '<div class="kw-d"><span>Average of the last ' + V7.length + ' runs: <b>' + fmt(sr7) + '%</b>, range ' + fmt(Math.min.apply(null, V7)) + '-' + fmt(Math.max.apply(null, V7)) + '%</span></div>' : '') +
      (R14.length > 1 ? '<div class="kw-s">' + sparkSzeroki(K14.map(function (k) { return k.vis; }), 100) + '</div><div class="kw-p"><span>' + esc(dzien(R14[0])) + '</span><span>last ' + R14.length + ' runs</span><span>' + esc(dzien(R14[R14.length - 1])) + '</span></div>' : '') +
      '<div class="kw-w"><div><span>Top competitor</span><b>' + (lider ? esc(lider.name) + ' · ' + fmt(lider.vis) + '%' : '-') + '</b></div><div><span>Share of voice</span><b>' + fmt(my ? my.sov : 0, 1) + '%</b></div></div>'
  });
  var t = [
    ['Average position', a.avg == null ? '-' : fmt(a.avg, 1), 'when named', dl(a.avg, b && b.avg, false, 1), tr(function (k) { return k.avg == null ? null : -k.avg; })],
    ['Named first', String(a.first), 'of ' + a.n + ' prompts', dl(a.first, b && b.first, true), tr(function (k) { return k.first; })],
    ['Named in top 3', String(a.top3), 'of ' + a.n + ' prompts', dl(a.top3, b && b.top3, true), tr(function (k) { return k.top3; })],
    ['Improved / declined', '<span style="color:var(--up)">' + mv.up.length + '</span> / <span style="color:var(--down)">' + mv.down.length + '</span>', 'prompts', S.cmp ? '<span class="szary">' + mv.nw.length + ' new · ' + mv.lost.length + ' lost</span>' : ''],
    ['Our website cited', String(a.cited), 'of ' + a.n + ' prompts', dl(a.cited, b && b.cited, true), tr(function (k) { return k.cited; })]
  ];
  h += '<div class="kpi">' + t.map(function (x) { return '<div class="t"><div class="k">' + x[0] + '</div><div class="v"><b class="num">' + x[1] + '</b><small>' + x[2] + '</small></div><div class="d"><span>' + (x[3] || (S.cmp ? '' : '<span class="szary">no comparison</span>')) + '</span>' + (x[4] || '') + '</div></div>'; }).join('') + '</div>';

  /* trend chart: us against the 4 most visible competitors */
  var R = runy(m).filter(function (r) { return r <= S.run; }), konk = sklepy(m, S.run).filter(function (s) { return s.name !== m.store && !s.typ; }).slice(0, 4);
  var metr = { vis: ['Visibility', '%', 0, false, 100], avg: ['Average position', '', 1, true, null], sov: ['Share of voice', '%', 0, false, null] }[S.metric];
  function wart(nm, r) {
    var l = sklepy(m, r).filter(function (s) { return s.name === nm; })[0];
    if (!l) return S.metric === 'avg' ? null : 0;
    return S.metric === 'vis' ? l.vis : S.metric === 'sov' ? l.sov : l.avg;
  }
  var seria = [{ name: m.store, color: '#0B57D0', w: 3, values: R.map(function (r) { return wart(m.store, r); }) }].concat(konk.map(function (k, i) { return { name: k.name, color: KOLOR_KONK[i], w: 1.6, values: R.map(function (r) { return wart(k.name, r); }) }; }));
  var maxAvg = 1; if (S.metric === 'avg') seria.forEach(function (s) { s.values.forEach(function (v) { if (v > maxAvg) maxAvg = v; }); });
  var opts = S.metric === 'vis' ? { max: 100, min: 0, unit: '%', ticks: [0, 25, 50, 75, 100] } : S.metric === 'sov' ? { min: 0, unit: '%' } : { min: 1, max: Math.ceil(maxAvg), invert: true, dec: 0, ticks: [1, Math.ceil(maxAvg)] };
  h += '<div class="g2"><section class="card"><div class="ch"><h2>' + metr[0] + ' <small>' + esc(m.store) + ' and the 4 most visible competitors</small></h2><span class="gap"></span>' +
    '<div class="tabsm">' + [['vis', 'Visibility'], ['avg', 'Average position'], ['sov', 'Share of voice']].map(function (x) { return '<button data-metric="' + x[0] + '" class="' + (S.metric === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    wykres('w-trend', R, seria, opts) + '</section>';

  /* distribution */
  h += '<section class="card rozklad"><div class="ch"><h2>Positions distribution <small>prompts by our best place in the answer</small></h2></div>' +
    '<div class="pasek">' + BUCKETS.map(function (bk) { return '<i style="width:' + (a.n ? a.b[bk[0]] / a.n * 100 : 0) + '%;background:' + bk[2] + '"></i>'; }).join('') + '</div>' +
    BUCKETS.map(function (bk) { return '<div class="wiersz"><i style="background:' + bk[2] + '"></i><span>' + bk[1] + '</span><b class="num">' + a.b[bk[0]] + '</b><span style="text-align:right">' + (b ? dl(a.b[bk[0]], b.b[bk[0]], bk[0] !== 0) : '') + '</span></div>'; }).join('') +
    '<div style="margin-top:14px">' + rozkladWykres(m, R) + '</div></section></div>';

  /* movers and competitors */
  function lista(tyt, l, klasa) {
    return '<section class="card"><div class="ch"><h2>' + tyt + ' <small>' + l.length + ' prompts</small></h2></div>' + (l.length ? '<ul class="ruch">' + l.slice(0, 8).map(function (x) {
      return '<li data-id="' + x.p.id + '"><span class="q">' + esc(x.p.en) + '</span><span class="z">' + (x.a == null ? 'not named' : x.a) + ' → <b style="color:var(--' + klasa + ')">' + (x.v == null ? 'not named' : x.v) + '</b></span></li>';
    }).join('') + '</ul>' : '<div class="pusto">' + (S.cmp ? 'None.' : 'Pick a run to compare with.') + '</div>') + '</section>';
  }
  var sk = sklepy(m, S.run).filter(function (s) { return !s.typ; }).slice(0, 8);
  h += '<div class="g3">' + lista('Improved', mv.up.concat(mv.nw), 'up') + lista('Declined', mv.down.concat(mv.lost), 'down') +
    '<section class="card"><div class="ch"><h2>Competitors <small>visibility in this run</small></h2></div><table class="t"><tbody>' +
    sk.map(function (s, i) { return '<tr class="' + (s.name === m.store ? 'us' : '') + '"><td class="szary" style="width:28px">' + (s.typ ? '' : i + 1) + '</td><td>' + esc(s.name) + typTag(s.typ) + '</td><td class="r"><b class="num">' + fmt(s.vis) + '%</b></td></tr>'; }).join('') +
    '</tbody></table></section></div>';
  return h;
}
function rozkladWykres(m, R) {
  if (R.length < 2) return '';
  var W = 100 / R.length;
  return '<div style="display:flex;align-items:flex-end;gap:3px;height:90px" title="Positions distribution per run">' + R.map(function (r) {
    var a = kpi(m, r);
    return '<div style="flex:1;display:flex;flex-direction:column-reverse;height:100%;border-radius:3px;overflow:hidden" title="' + esc(dzien(r)) + '">' +
      BUCKETS.slice(0, 3).map(function (bk) { return '<i style="display:block;height:' + (a.n ? a.b[bk[0]] / a.n * 100 : 0) + '%;background:' + bk[2] + '"></i>'; }).join('') + '</div>';
  }).join('') + '</div><div class="legenda" style="justify-content:space-between;margin-top:4px"><span>' + esc(dzien(R[0])) + '</span><span>' + esc(dzien(R[R.length - 1])) + '</span></div>';
}
/* Colours of the 4 competitors in the trend chart. */
var KOLOR_KONK = ['#E8710A', '#9334E6', '#12B5CB', '#E52592'];
/* Tile trend: plain line, higher is better (average position is passed negated). */
function spark2(vals, max) {
  var ok = vals.filter(function (v) { return v != null; }); if (ok.length < 2) return '';
  var hi = max != null ? max : Math.max.apply(null, ok), lo = max != null ? 0 : Math.min.apply(null, ok); if (hi === lo) { hi += 1; lo -= 1; }
  var w = 84, h = 22, pts = [];
  vals.forEach(function (v, i) { if (v != null) pts.push((i * w / (vals.length - 1)).toFixed(1) + ',' + (h - 2 - (h - 4) * (v - lo) / (hi - lo)).toFixed(1)); });
  return '<svg width="' + w + '" height="' + h + '" aria-hidden="true"><polyline fill="none" stroke="#7BAAF7" stroke-width="1.6" stroke-linejoin="round" points="' + pts.join(' ') + '"/></svg>';
}
/* Wide trend line for the key number card, with a light area under it. */
function sparkSzeroki(vals, max) {
  var ok = vals.filter(function (v) { return v != null; }); if (ok.length < 2) return '';
  var hi = max != null ? max : Math.max.apply(null, ok), w = 360, h = 44, pts = [];
  hi = Math.max(hi, 1);
  vals.forEach(function (v, i) { if (v != null) pts.push([(i * w / (vals.length - 1)), h - 3 - (h - 8) * v / hi]); });
  var l = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polygon fill="#D3E3FD" opacity=".6" points="' + pts[0][0].toFixed(1) + ',' + h + ' ' + l + ' ' + pts[pts.length - 1][0].toFixed(1) + ',' + h + '"/>' +
    '<polyline fill="none" stroke="#0B57D0" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="' + l + '"/></svg>';
}
PLASTER('summary', {
  nazwa: 'Summary', menu: { ikona: 'i-sum' }, naSklep: true, filtry: true,
  stan: { metric: 'vis' },
  rysuj: widokSummary,
  podepnij: function () {
    document.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { S.view = b.getAttribute('data-go'); rysuj(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-metric]').forEach(function (b) { b.onclick = function () { S.metric = b.getAttribute('data-metric'); rysuj(); }; });
  },
  doAdresu: function (q) { if (S.metric !== 'vis') q.set('metric', S.metric); },
  zAdresu: function (q) { S.metric = ['vis', 'avg', 'sov'].indexOf(q.get('metric')) >= 0 ? q.get('metric') : 'vis'; }
});

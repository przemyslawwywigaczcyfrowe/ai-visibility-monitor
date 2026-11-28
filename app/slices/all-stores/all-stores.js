/* ---------- All stores (Senuto main view) ---------- */
function widokAll() {
  var w = M.map(function (m) { var r = ostatni(m), c = przed(m, r); var sv = S.engine; S.engine = 'all'; var a = kpi(m, r), b = c ? kpi(m, c) : null, sk = sklepy(m, r); S.engine = sv; return { m: m, r: r, c: c, a: a, b: b, sk: sk }; });
  var tot = w.reduce(function (s, x) { s.n += x.a.n; s.ment += x.a.ment; s.first += x.a.first; s.cited += x.a.cited; return s; }, { n: 0, ment: 0, first: 0, cited: 0 });
  var pop = w.reduce(function (s, x) { if (x.b) { s.n += x.b.n; s.ment += x.b.ment; } return s; }, { n: 0, ment: 0 });
  var vis = tot.n ? tot.ment / tot.n * 100 : 0, visPop = pop.n ? pop.ment / pop.n * 100 : null;
  var po = w.slice().sort(function (x, y) { return y.a.vis - x.a.vis; });
  S.cmp = pop.n ? 'x' : null;
  var zm = visPop == null ? '' : dl(vis, visPop, true, 0, ' pts');
  var h = hero({
    ocena: visPop == null ? null : tot.ment - pop.ment >= PROG_GRUPA ? ['good', 'Visibility up'] : tot.ment - pop.ment <= -PROG_GRUPA ? ['bad', 'Visibility down'] : ['', 'No clear change'],
    okres: 'European Imaging Group · latest run of each store · ' + ENG.map(nazwaSil).join(' and ') + ' together' + (S.bez4 ? ', without prompt 4' : ''),
    werdykt: 'Our stores are named in <span class="kw">' + tot.ment + ' of ' + tot.n + ' prompts</span>',
    zd: 'Most visible: <b>' + esc(po[0].m.store) + '</b> with ' + fmt(po[0].a.vis) + '%. Least visible: <b>' + esc(po[po.length - 1].m.store) + '</b> with ' + fmt(po[po.length - 1].a.vis) + '%. ' +
      'Named first in <b>' + tot.first + ' prompts</b>, our websites cited in <b>' + tot.cited + ' prompts</b>.',
    prawa: '<div class="kw-l">Visibility, ' + M.length + ' stores</div><div class="kw-v num">' + fmt(vis) + '%</div>' +
      '<div class="kw-d">' + (zm ? zm + '<span>run before: ' + fmt(visPop) + '%</span>' : '<span>no comparison yet</span>') + '</div>' +
      '<div class="kw-w">' + po.map(function (x) { return '<div style="align-items:center;min-height:30px"><span>' + logo(x.m.code, { PL: 20, UK: 19, NL: 14.5, DE: 16.7 }[x.m.code]) + '</span><b class="num">' + fmt(x.a.vis) + '%</b></div>'; }).join('') + '</div>'
  });
  h += '<div class="rk4">' + w.map(function (x) {
    var lider = x.sk.filter(function (s) { return s.name !== x.m.store && !s.typ; })[0];
    var hist = runy(x.m).map(function (r) { var sv = S.engine; S.engine = 'all'; var v = kpi(x.m, r).vis; S.engine = sv; return v; });
    S.cmp = x.c;
    var d = dl(x.a.vis, x.b && x.b.vis, true, 0, ' pts');
    return '<button class="card rkc" data-p="' + x.m.code + '"><div class="lg">' + logo(x.m.code) + '<span>' + esc(x.m.name) + '</span></div>' +
      '<div class="kk">Visibility</div><div class="vv"><b class="num">' + fmt(x.a.vis) + '%</b><small>' + x.a.ment + ' of ' + x.a.n + ' prompts</small>' + d + '</div>' +
      '<div style="margin:10px 0 12px" title="Visibility in the last ' + hist.length + ' runs">' + spark(hist, false, 360, 44).replace('<svg ', '<svg style="width:100%;height:44px" preserveAspectRatio="none" viewBox="0 0 360 44" ') + '</div>' +
      '<div class="pasek" title="Prompts by our best place in the answer">' + BUCKETS.map(function (bk) { return '<i style="width:' + (x.a.n ? x.a.b[bk[0]] / x.a.n * 100 : 0) + '%;background:' + bk[2] + '" title="' + bk[1] + ': ' + x.a.b[bk[0]] + '"></i>'; }).join('') + '</div>' +
      '<div class="mm"><span>Average position</span><b>' + (x.a.avg == null ? '-' : fmt(x.a.avg, 1)) + '</b></div>' +
      '<div class="mm"><span>Named first</span><b>' + x.a.first + ' prompts</b></div>' +
      '<div class="mm"><span>Top competitor</span><b>' + (lider ? esc(lider.name) + ' (' + fmt(lider.vis) + '%)' : '-') + '</b></div></button>';
  }).join('') + '</div>';
  h += '<div class="legenda" style="margin:-4px 0 18px">' + BUCKETS.map(function (bk) { return '<span><i style="background:' + bk[2] + '"></i>' + bk[1] + '</span>'; }).join('') + '</div>';
  var tem = []; M[0].prompts.forEach(function (p) { if (tem.indexOf(p.topic) < 0) tem.push(p.topic); });
  h += '<section class="card"><div class="ch"><h2>Visibility by topic <small>share of prompts in the topic where the store is named</small></h2></div><div class="tw"><table class="t"><thead><tr><th>Topic</th><th class="r">Prompts</th>' +
    w.map(function (x) { return '<th class="r">' + esc(x.m.store) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    tem.map(function (t) {
      return '<tr><td><b style="font-weight:500">' + esc(t) + '</b></td><td class="r szary">' + M[0].prompts.filter(function (p) { return p.topic === t; }).length + '</td>' + w.map(function (x) {
        var sv = S.topic, se = S.engine; S.topic = t; S.engine = 'all'; var a = kpi(x.m, x.r); S.topic = sv; S.engine = se;
        return '<td class="r"><div class="bar-in" style="justify-content:flex-end"><span class="num" style="min-width:42px;text-align:right;font-weight:600;color:' + (a.ment ? 'var(--ink)' : 'var(--faint)') + '">' + fmt(a.vis) + '%</span><span class="b" style="max-width:120px"><i style="width:' + a.vis + '%;background:var(--b1)"></i></span></div></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></section>';
  S.cmp = przed(rynek(S.market), S.run);
  return h;
}
PLASTER('all', {
  nazwa: 'All stores',
  grupa: function () { return true; },
  rysuj: widokAll,
  podepnij: function () {
    document.querySelectorAll('.rkc[data-p]').forEach(function (b) { b.onclick = function () { wybierzRynek(b.getAttribute('data-p')); S.view = WIDOK_SKLEPU; rysuj(); window.scrollTo(0, 0); }; });
  }
});

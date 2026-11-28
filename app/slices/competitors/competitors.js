/* ---------- Competitors ---------- */
function widokCompetitors() {
  var m = rynek(S.market), sk = sklepy(m, S.run), stare = S.cmp ? sklepy(m, S.cmp) : [];
  var tylko = sk.filter(function (s) { return !s.typ; });
  var ja = tylko.map(function (s) { return s.name; }).indexOf(m.store), lid = tylko.filter(function (s) { return s.name !== m.store; })[0], my = tylko[ja];
  var h = naglowek('Competitors', (lid ? '<b>' + esc(lid.name) + '</b> is named in ' + lid.count + ' prompts, ' : '') + '<b>' + esc(m.store) + '</b> in ' + (my ? my.count : 0) + '.' +
      (sk.length > tylko.length ? ' Price comparison, classifieds and review sites are listed at the end and take no place.' : ''),
    [['Stores named', tylko.length, 'in the answers'], ['Our rank', '#' + (ja + 1), 'of ' + tylko.length + ' stores'], ['Top competitor', lid ? esc(lid.name) : '-', lid ? fmt(lid.vis) + '% visibility' : '']]);
  var top = tylko.slice(0, 15), max = Math.max.apply(null, top.map(function (s) { return s.count; }).concat([1]));
  h += '<section class="card" style="margin-bottom:16px"><div class="ch"><h2>Prompts where each store is named <small>split by the store\'s best place in the answer</small></h2></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' + top.map(function (s) {
      var b = { 1: 0, 3: 0, 10: 0 };
      prompty(m).forEach(function (p) {
        var najl = null; silniki().forEach(function (e) { var c = kom(S.run, p.id, e); if (!c || !c[4]) return; var i = sklepyWOdp(c[4]).indexOf(s.name); if (i >= 0 && (najl == null || i + 1 < najl)) najl = i + 1; });
        if (najl != null) b[najl === 1 ? 1 : najl <= 3 ? 3 : 10]++;
      });
      return '<div style="display:grid;grid-template-columns:200px 1fr 40px;gap:12px;align-items:center;font-size:14px"><span style="' + (s.name === m.store ? 'font-weight:700;color:var(--acc-dark)' : '') + '">' + esc(s.name) + '</span>' +
        '<span style="display:flex;height:18px;border-radius:9px;overflow:hidden;gap:2px;width:' + (s.count / max * 100) + '%;min-width:2px">' + BUCKETS.slice(0, 3).map(function (bk) { return '<i style="display:block;width:' + (s.count ? b[bk[0]] / s.count * 100 : 0) + '%;background:' + bk[2] + '"></i>'; }).join('') + '</span><b class="num" style="text-align:right">' + s.count + '</b></div>';
    }).join('') + '</div><div class="legenda">' + BUCKETS.slice(0, 3).map(function (bk) { return '<span><i style="background:' + bk[2] + '"></i>' + bk[1] + '</span>'; }).join('') + '</div></section>';
  h += '<section class="card" style="padding:4px 8px 8px"><table class="t"><thead><tr><th>#</th><th>Store</th><th class="r">Visibility</th><th class="r">Change</th><th class="r">Prompts</th><th class="r">Average position</th><th class="r">Named first (prompts)</th><th class="r">Share of voice</th></tr></thead><tbody>' +
    sk.map(function (s, i) {
      var o = stare.filter(function (x) { return x.name === s.name; })[0];
      return '<tr class="' + (s.name === m.store ? 'us' : '') + '"><td class="szary num">' + (s.typ ? '' : i + 1) + '</td><td><b style="font-weight:' + (s.name === m.store ? 700 : 500) + '">' + esc(s.name) + '</b>' + typTag(s.typ) + '</td>' +
        '<td class="r"><div class="bar-in" style="justify-content:flex-end"><b class="num">' + fmt(s.vis) + '%</b><span class="b" style="max-width:140px"><i style="width:' + s.vis + '%;background:' + (s.name === m.store ? 'var(--b1)' : '#9AA0A6') + '"></i></span></div></td>' +
        '<td class="r">' + dl(s.vis, o ? o.vis : (S.cmp ? 0 : null), true, 0, ' pts') + '</td><td class="r num">' + s.count + '</td><td class="r num">' + (s.avg == null ? '-' : fmt(s.avg, 1)) + '</td><td class="r num">' + s.first + '</td><td class="r num">' + fmt(s.sov, 1) + '%</td></tr>';
    }).join('') + '</tbody></table></section>';
  return h;
}
PLASTER('competitors', { nazwa: 'Competitors', menu: { ikona: 'i-store' }, naSklep: true, filtry: true, rysuj: widokCompetitors });

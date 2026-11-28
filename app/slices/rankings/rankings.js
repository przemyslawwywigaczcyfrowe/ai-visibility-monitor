/* ---------- Rankings (keyword table) ---------- */
function widokRankings() {
  var m = rynek(S.market), R = runy(m).filter(function (r) { return r <= S.run; }).slice(-14), det = DET[S.run] || {};
  var wiersze = prompty(m).map(function (p) {
    var v = poz(S.run, p.id), a = S.cmp ? poz(S.cmp, p.id) : undefined, lid = '', url = '';
    silniki().forEach(function (e) { var c = kom(S.run, p.id, e); if (c && c[4] && !lid) lid = sklepyWOdp(c[4])[0] || ''; var z = det[p.id + '|' + e]; if (z && z.url && !url) url = z.url; });
    return { p: p, v: v, a: a, lid: lid, url: url };
  });
  var k = S.sort, d = S.dir;
  wiersze.sort(function (x, y) {
    function val(w) { return k === 'pos' ? (w.v == null ? 999 : w.v === undefined ? 1000 : w.v) : k === 'chg' ? (w.v != null && w.a != null ? w.v - w.a : w.v != null && w.a == null ? -50 : w.v == null && w.a != null ? 50 : 0) : w.p.n; }
    return (val(x) - val(y)) * d;
  });
  function th(key, t, kl) { return '<th class="srt ' + (kl || '') + (S.sort === key ? ' on' : '') + '" data-sort="' + key + '">' + t + (S.sort === key ? (S.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>'; }
  var a = kpi(m, S.run), nie = wiersze.filter(function (w) { return w.v === null; }).length;
  var h = naglowek('Rankings', 'Position of <b>' + esc(m.store) + '</b> in each prompt, 1 = the first store named. Named in <b>' + a.ment + '</b> prompts, not named in <b>' + nie + '</b>.',
    [['Prompts', wiersze.length, S.topic || 'all topics'], ['Named', a.ment, 'of ' + a.n + ' prompts'], ['Average position', a.avg == null ? '-' : fmt(a.avg, 1), 'when named']]);
  h += '<section class="card" style="padding:4px 8px 8px"><div class="tw"><table class="t"><thead><tr>' + th('n', '#') + '<th>Prompt</th><th>Topic</th>' +
    th('pos', 'Position', 'c') + th('chg', 'Change', 'c') + ENG.filter(function (e) { return silniki().indexOf(e) >= 0; }).map(function (e) { return '<th class="c">' + esc(nazwaSil(e)) + '</th>'; }).join('') +
    '<th>Last ' + R.length + ' runs</th><th>Named first</th><th>Our page cited</th></tr></thead><tbody>' +
    wiersze.map(function (w) {
      return '<tr class="klik" data-id="' + w.p.id + '"><td class="szary num">' + w.p.n + '</td><td class="q" style="min-width:340px">' + esc(w.p.en) + (m.code !== 'UK' ? '<small>' + esc(w.p.text) + '</small>' : '') + '</td>' +
        '<td><span class="tag">' + esc(w.p.topic) + '</span>' + (w.p.n === 4 ? ' <span class="tag" title="This prompt names a competitor, so that competitor is almost always named first. The prompt set belongs to EIG.">names a competitor</span>' : '') + '</td><td class="c">' + pozHtml(w.v) + '</td><td class="c">' + dlPoz(w.v, w.a) + '</td>' +
        ENG.filter(function (e) { return silniki().indexOf(e) >= 0; }).map(function (e) { var c = kom(S.run, w.p.id, e); return '<td class="c">' + (c ? (c[6] ? '<span class="szary">error</span>' : c[3] == null ? '<span class="szary">-</span>' : '<span class="num" style="font-weight:500">' + c[3] + '</span>') : '<span class="szary">n/a</span>') + '</td>'; }).join('') +
        '<td>' + spark(R.map(function (r) { var v = poz(r, w.p.id); return v == null ? null : v; }), true) + '</td>' +
        '<td>' + (w.lid ? '<span class="tag' + (w.lid === m.store ? ' us' : '') + '">' + esc(w.lid) + '</span>' : '<span class="szary">no store named</span>') + '</td>' +
        '<td>' + (w.url ? '<a class="url" href="' + esc(w.url) + '" target="_blank" rel="noopener">' + esc(w.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 42)) + '</a>' : '<span class="szary">-</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div></section>';
  return h;
}
PLASTER('rankings', {
  nazwa: 'Rankings', menu: { ikona: 'i-list' }, naSklep: true, filtry: true,
  stan: { sort: 'n', dir: 1 },
  rysuj: widokRankings,
  podepnij: function () {
    document.querySelectorAll('th[data-sort]').forEach(function (t) { t.onclick = function () { var k = t.getAttribute('data-sort'); S.dir = S.sort === k ? -S.dir : 1; S.sort = k; rysuj(); }; });
  },
  doAdresu: function (q) { if (S.sort !== 'n' || S.dir !== 1) q.set('sort', S.sort + (S.dir < 0 ? '-desc' : '')); },
  zAdresu: function (q) { var so = (q.get('sort') || 'n').split('-'); S.sort = ['n', 'pos', 'chg'].indexOf(so[0]) >= 0 ? so[0] : 'n'; S.dir = so[1] === 'desc' ? -1 : 1; }
});

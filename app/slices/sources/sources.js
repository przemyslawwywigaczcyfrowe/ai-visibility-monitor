/* ---------- Sources ---------- */
function widokSources() {
  var m = rynek(S.market), det = DET[S.run] || {}, d = {};
  prompty(m).forEach(function (p) {
    silniki().forEach(function (e) { var z = det[p.id + '|' + e]; (z && z.sources ? z.sources.split(', ') : []).forEach(function (x) { var o = d[x] = d[x] || { p: {}, e: {} }; o.p[p.id] = 1; o.e[e] = (o.e[e] || 0) + 1; }); });
  });
  var l = Object.keys(d).map(function (k) { return { name: k, count: Object.keys(d[k].p).length, e: d[k].e, us: m.domains.some(function (x) { return k === x || k.slice(-(x.length + 1)) === '.' + x; }) }; })
    .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  var n = prompty(m).length;
  var nasz = l.filter(function (x) { return x.us; }).reduce(function (a, x) { return Math.max(a, x.count); }, 0);
  var h = naglowek('Sources', 'Websites the engines read before answering. Our website is cited in <b>' + nasz + ' of ' + n + '</b> prompts.',
    [['Websites cited', l.length, 'in this run'], ['Our website', nasz, 'of ' + n + ' prompts'], ['Most cited', l[0] ? esc(l[0].name) : '-', l[0] ? l[0].count + ' prompts' : '']]);
  h += '<section class="card" style="padding:4px 8px 8px"><table class="t"><thead><tr><th>#</th><th>Website</th><th class="r">Prompts citing it</th>' + silniki().map(function (e) { return '<th class="r">' + esc(e) + ' answers</th>'; }).join('') + '</tr></thead><tbody>' +
    (l.length ? l.map(function (x, i) {
      return '<tr class="' + (x.us ? 'us' : '') + '"><td class="szary num">' + (i + 1) + '</td><td><b style="font-weight:' + (x.us ? 700 : 500) + '">' + esc(x.name) + '</b>' + (x.us ? ' <span class="tag us">our website</span>' : '') + '</td>' +
        '<td class="r"><div class="bar-in" style="justify-content:flex-end"><b class="num">' + x.count + '</b><span class="b" style="max-width:160px"><i style="width:' + (x.count / n * 100) + '%;background:' + (x.us ? 'var(--b1)' : '#9AA0A6') + '"></i></span></div></td>' +
        silniki().map(function (e) { return '<td class="r num">' + (x.e[e] || '<span class="szary">-</span>') + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="5" class="pusto">No sources in this run.</td></tr>') + '</tbody></table></section>';
  return h;
}
PLASTER('sources', { nazwa: 'Sources', menu: { ikona: 'i-link' }, naSklep: true, filtry: true, rysuj: widokSources });

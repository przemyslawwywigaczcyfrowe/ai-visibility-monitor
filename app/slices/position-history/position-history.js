/* ---------- Position history (Senuto grid) ---------- */
function widokHistory() {
  var m = rynek(S.market), R = runy(m).filter(function (r) { return r <= S.run; }).slice(-14);
  var mv = ruchy(m);
  var h = naglowek('Position history', 'Best place of <b>' + esc(m.store) + '</b> per prompt in each run. Green: better than the run before, red: worse.',
    [['Runs shown', R.length, R.length ? dzien(R[0]) + ' - ' + dzien(R[R.length - 1]) : ''], ['Better', mv.up.length + mv.nw.length, S.cmp ? 'prompts since ' + dzien(S.cmp) : 'no comparison'], ['Worse', mv.down.length + mv.lost.length, S.cmp ? 'prompts since ' + dzien(S.cmp) : 'no comparison']]);
  h += '<section class="card" style="padding:4px 8px 8px"><div class="tw"><table class="t hg"><thead><tr><th>#</th><th>Prompt</th>' + R.map(function (r) { return '<th class="d">' + esc(dzien(r)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    prompty(m).map(function (p) {
      return '<tr class="klik" data-id="' + p.id + '"><td class="szary num">' + p.n + '</td><td class="q" style="min-width:320px">' + esc(p.en) + '</td>' + R.map(function (r, i) {
        var v = poz(r, p.id), a = i ? poz(R[i - 1], p.id) : undefined, kl = '';
        if (a !== undefined && v !== undefined) { if (v != null && (a == null || v < a)) kl = 'up'; else if ((v == null && a != null) || (v != null && a != null && v > a)) kl = 'down'; }
        return '<td class="d ' + kl + (v == null ? ' nn' : '') + '">' + (v === undefined ? '' : '<span>' + (v == null ? '-' : v) + '</span>') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></section>';
  return h;
}
PLASTER('history', { nazwa: 'Position history', menu: { ikona: 'i-hist' }, naSklep: true, filtry: true, rysuj: widokHistory });

/* ---------- shell: the frame around the views ----------
   Rail, store switcher, run status, filter bar and the address. It draws the open view by asking
   the slice registry (app/shared/slices.js) and knows no view by name. */
function rysuj() {
  var def = PLASTRY[S.view], grupa = !!(def.grupa && def.grupa());
  zbierz('przedRysowaniem');
  document.body.classList.toggle('bez-filtrow', !def.filtry);
  document.getElementById('projekty').innerHTML = '<button class="all ' + (grupa ? 'on' : '') + '" data-p="all">All stores</button>' + M.map(function (m) {
    return '<button data-p="' + m.code + '" class="' + (!grupa && def.naSklep && S.market === m.code ? 'on' : '') + '" title="' + esc(m.name + ': ' + m.store) + '">' + logo(m.code) + '<span class="kod">' + m.code + '</span></button>';
  }).join('');
  document.querySelectorAll('#projekty button').forEach(function (b) {
    b.onclick = function () {
      var p = b.getAttribute('data-p'), d = PLASTRY[S.view]; zbierz('zamknij');
      if (p === 'all') { if (d.naWszystkie) d.naWszystkie(); else S.view = WIDOK_GLOWNY; }
      else { wybierzRynek(p); zbierz('poKliknieciuSklepu'); if (!d.naSklep) S.view = WIDOK_SKLEPU; }
      rysuj(); window.scrollTo(0, 0);
    };
  });
  document.querySelectorAll('.rlink[data-v]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === S.view); });
  /* Run status: how many runs there are, when the last one was, when the next one is due. */
  /* runs every fourth day: the next one is planned 4 calendar days after the last, at 07:00 UTC (GitHub often starts later) */
  var ost = IDX.runs[IDX.runs.length - 1], nast = new Date(ost && ost.start ? ost.start : Date.now()); nast.setUTCHours(7, 0, 0, 0); nast.setUTCDate(nast.getUTCDate() + 4); while (nast <= new Date()) nast.setUTCDate(nast.getUTCDate() + 1);
  var st = document.getElementById('stan');
  /* orange dot when the last run is older than 108 hours: the run every fourth day did not happen */
  st.classList.toggle('stary', !ost || !ost.start || Date.now() - new Date(ost.start) > 108 * 36e5);
  st.innerHTML = '<i></i>' + IDX.runs.length + (IDX.runs.length === 1 ? ' run' : ' runs') + ' · last ' + esc(ost ? kiedy(ost.run) : '-') + '<span class="dalej"> · next ' +
    esc(nast.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })) + '</span>';
  st.onclick = function () { S.view = WIDOK_DZIENNIKA; rysuj(); var l = document.getElementById('dziennik'); if (l) l.scrollIntoView({ block: 'start' }); };
  if (def.filtry) rysujFiltry();
  WYK = {};
  document.getElementById('tresc').innerHTML = def.rysuj();
  zbierz('poRysowaniu');
  podepnij(); narysujWykresy();
  zapiszAdres();
}
/* Handlers of the open view, and of the slices without a view (they work on top of every view). */
function podepnij() {
  Object.keys(PLASTRY).forEach(function (k) { var p = PLASTRY[k]; if (p.podepnij && (!p.rysuj || k === S.view)) p.podepnij(); });
}
/* Rail: one button per slice that asks for it ("menu"), in the order of registration. */
function zbudujMenu() {
  var h = '';
  Object.keys(PLASTRY).forEach(function (k) {
    var p = PLASTRY[k], m = p.menu; if (!m) return;
    h += '<button class="rlink' + (m.dol ? ' dol' : '') + '" data-v="' + k + '"' + (m.title ? ' title="' + esc(m.title) + '"' : '') + '><span class="pg">' + ic(m.ikona) + '</span>' + esc(p.nazwa) + '</button>';
  });
  document.getElementById('wyloguj').insertAdjacentHTML('beforebegin', h);
  document.querySelectorAll('.rlink[data-v]').forEach(function (b) { b.onclick = function () { S.view = b.getAttribute('data-v'); rysuj(); window.scrollTo(0, 0); }; });
  document.getElementById('dom').onclick = function () { zbierz('zamknij'); S.view = WIDOK_GLOWNY; rysuj(); window.scrollTo(0, 0); };
}

/* ---------- shareable URLs ----------
   #/<view>/<store>?run=…&cmp=…&engine=…&topic=…&q=…&metric=…&prompt=…
   Only values that differ from the defaults go into the address, so links stay short.
   A new view or store adds a browser history entry; filters only replace the current one. */
var BEZ_ZAPISU = false;
function adres() {
  var def = PLASTRY[S.view];
  if (def.adres) return def.adres();
  var czesci = [S.view], q = new URLSearchParams();
  if (def.filtry) {
    czesci.push(S.market.toLowerCase());
    var m = rynek(S.market);
    if (S.run && S.run !== ostatni(m)) q.set('run', S.run);
    var domCmp = przed(m, S.run);
    if ((S.cmp || null) !== (domCmp || null)) q.set('cmp', S.cmp || 'none');
    if (S.engine !== 'all') q.set('engine', S.engine);
    if (S.topic) q.set('topic', S.topic);
    if (S.bez4) q.set('q4', '0');
    if (S.q) q.set('q', S.q);
    if (def.doAdresu) def.doAdresu(q);
    Object.keys(PLASTRY).forEach(function (k) { var p = PLASTRY[k]; if (!p.rysuj && p.doAdresu) p.doAdresu(q); });
  }
  var s = q.toString();
  return '#/' + czesci.join('/') + (s ? '?' + s : '');
}
function zapiszAdres() {
  if (BEZ_ZAPISU) return;
  var nowy = adres(), stary = location.hash || '';
  if (nowy === stary) return;
  var sciezka = function (h) { return h.split('?')[0]; };
  history[sciezka(nowy) !== sciezka(stary) ? 'pushState' : 'replaceState'](null, '', nowy);
}
/* Reads the address into the state. Returns false when the address names no view. */
function czytajAdres() {
  var h = (location.hash || '').replace(/^#\/?/, ''), sciezka = h.split('?')[0].split('/'), q = new URLSearchParams(h.split('?')[1] || '');
  var def = PLASTRY[sciezka[0]];
  if (!sciezka[0] || !def || !def.rysuj || def.zLinku === false) return false;
  S.view = sciezka[0];
  var kod = (sciezka[1] || '').toUpperCase();
  if (kod && M.some(function (m) { return m.code === kod; })) { S.market = kod; }
  var m = rynek(S.market), R = runy(m);
  S.run = q.get('run') && R.indexOf(q.get('run')) >= 0 ? q.get('run') : ostatni(m);
  var c = q.get('cmp');
  S.cmp = c === 'none' ? null : c && R.indexOf(c) >= 0 ? c : przed(m, S.run);
  S.engine = q.get('engine') && ENG.indexOf(q.get('engine')) >= 0 ? q.get('engine') : 'all';
  S.topic = q.get('topic') || '';
  S.bez4 = q.get('q4') === '0';
  S.q = q.get('q') || '';
  zbierz('zAdresu', q, sciezka);
  return true;
}
async function wejdzZAdresu() {
  var ok = czytajAdres();
  await szczegoly(S.run);
  BEZ_ZAPISU = true; rysuj(); BEZ_ZAPISU = false;
  zbierz('poAdresie', ok);
}
window.addEventListener('popstate', function () { if (D_GOTOWE) wejdzZAdresu(); });
var D_GOTOWE = false;
function wybierzRynek(code) {
  S.market = code; S.topic = ''; S.q = '';
  var m = rynek(code); S.run = ostatni(m); S.cmp = przed(m, S.run);
  try { localStorage.setItem('aiv-market', code); } catch (e) {}
}
function rysujFiltry() {
  var m = rynek(S.market), r = runy(m).slice().reverse();
  var tem = []; m.prompts.forEach(function (p) { if (tem.indexOf(p.topic) < 0) tem.push(p.topic); });
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>'; }
  document.getElementById('filtry').innerHTML =
    '<label class="pole">Run<select id="f-run">' + r.map(function (x) { return opt(x, kiedy(x), S.run); }).join('') + '</select></label>' +
    '<label class="pole">compared with<select id="f-cmp">' + opt('', 'no comparison', S.cmp || '') + r.filter(function (x) { return x < S.run; }).map(function (x) { return opt(x, kiedy(x), S.cmp); }).join('') + '</select></label>' +
    '<span class="sep"></span>' +
    '<label class="pole">Engine<select id="f-eng">' + opt('all', 'All engines', S.engine) + ENG.map(function (e) { return opt(e, nazwaSil(e), S.engine); }).join('') + '</select></label>' +
    '<label class="pole">Topic<select id="f-top">' + opt('', 'All topics', S.topic) + tem.map(function (t) { return opt(t, t, S.topic); }).join('') + '</select></label>' +
    '<label class="pole p4" title="Prompt 4 of every store names a competitor (Allegro, Amazon, bol.com). The prompt set belongs to EIG."><input type="checkbox" id="f-q4"' + (S.bez4 ? ' checked' : '') + '>Without prompt 4</label>' +
    '<span class="gap"></span><input type="search" id="f-q" placeholder="Filter prompts" value="' + esc(S.q) + '" aria-label="Filter prompts">' +
    zbierz('przyciskFiltrow').join('');
  document.getElementById('f-run').onchange = function (e) { S.run = e.target.value; S.cmp = przed(m, S.run); szczegoly(S.run).then(rysuj); };
  document.getElementById('f-cmp').onchange = function (e) { S.cmp = e.target.value || null; rysuj(); };
  document.getElementById('f-eng').onchange = function (e) { S.engine = e.target.value; rysuj(); };
  document.getElementById('f-top').onchange = function (e) { S.topic = e.target.value; rysuj(); };
  document.getElementById('f-q4').onchange = function (e) { S.bez4 = e.target.checked; rysuj(); };
  var q = document.getElementById('f-q'); q.oninput = function () { S.q = q.value; clearTimeout(q.t); q.t = setTimeout(function () { rysuj(); var n = document.getElementById('f-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  zbierz('podepnijFiltry');
}

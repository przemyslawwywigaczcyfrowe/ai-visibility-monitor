/* The open prompt (goes into the address), and the prompt an address asks to open. */
var OTW = null, DO_OTWARCIA = null;
/* ---------- prompt detail: position history + the answers ("SERP snapshot") ---------- */
function formatuj(t, re) {
  var out = [], lista = false;
  esc(t).split(/\n/).forEach(function (l) {
    l = l.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    l = l.replace(/(<a [^>]*>.*?<\/a>)|([^<]+)/g, function (x, a, txt) { return a ? a : txt.replace(re, '<mark>$1</mark>'); });
    var li = /^\s*([-*•]|\d+\.)\s+/.test(l);
    if (li && !lista) { out.push('<ul>'); lista = true; }
    if (!li && lista) { out.push('</ul>'); lista = false; }
    if (/^#{1,4}\s/.test(l)) out.push('<h4>' + l.replace(/^#+\s/, '') + '</h4>');
    else if (li) out.push('<li>' + l.replace(/^\s*([-*•]|\d+\.)\s+/, '') + '</li>');
    else if (l.trim() && !/^[-*_]{3,}$/.test(l.trim())) out.push('<p>' + l + '</p>');
  });
  if (lista) out.push('</ul>');
  return out.join('');
}
var fokus = null;
async function otworz(id, run) {
  var m = rynek(S.market), p = m.prompts.filter(function (x) { return x.id === id; })[0];
  if (!p) return;
  run = run || S.run;
  if (!document.getElementById('szuf').classList.contains('on')) fokus = document.activeElement;
  OTW = id; zapiszAdres(); zdarzenieUzycia('odpowiedz', 'Prompt opened · ' + m.store);
  var R = runy(m).slice().reverse();
  document.getElementById('sz-k').innerHTML = '<span>' + esc(m.store + ' · ' + p.topic + ' · prompt ' + p.n) + ' · answers from</span><select id="sz-run" class="btn" style="height:32px">' +
    R.map(function (r) { return '<option value="' + esc(r) + '"' + (r === run ? ' selected' : '') + '>' + esc(kiedy(r)) + '</option>'; }).join('') + '</select>';
  document.getElementById('sz-h').textContent = p.en;
  document.getElementById('sz-o').textContent = m.code !== 'UK' ? 'Original prompt: ' + p.text : '';
  document.getElementById('sz-run').onchange = function (e) { otworz(id, e.target.value); };
  document.getElementById('szuf').classList.add('on'); document.getElementById('cien').classList.add('on');
  document.getElementById('sz-x').focus();
  var cel = document.getElementById('sz-b');
  if (!DET[run]) { cel.innerHTML = '<div class="pusto">Loading the answers…</div>'; try { await szczegoly(run); } catch (err) { cel.innerHTML = '<div class="pusto">Could not load: ' + esc(err.message) + '</div>'; return; } }
  var Rh = runy(m).slice(-30), det = DET[run];
  WYK = {};
  var h = '<section class="card hist"><div class="ch"><h2>Position history <small>' + esc(m.store) + ' in each engine, 1 = named first</small></h2></div>' +
    wykres('w-prompt', Rh, ENG.map(function (e, i) { return { name: nazwaSil(e), color: i ? '#E8710A' : '#0B57D0', w: 2, values: Rh.map(function (r) { var c = kom(r, id, e); return c && !c[6] ? c[3] : null; }) }; }),
      { min: 1, max: 6, invert: true, ticks: [1, 3, 6], h: 170 }) + '</section><div class="ans2">';
  h += ENG.map(function (e) {
    var c = kom(run, id, e), z = det[id + '|' + e];
    var head = '<div class="h"><div><b>' + esc(nazwaSil(e)) + '</b>';
    if (!c || !z) return '<div class="ans">' + head + '</div></div><div class="pusto">This prompt was not asked in this run.</div></div>';
    if (c[6]) return '<div class="ans">' + head + '</div></div><div class="pusto">The engine returned an error: ' + esc(z.error) + '</div></div>';
    var v = c[3], st = c[4] ? c[4].split('; ') : [], src = z.sources ? z.sources.split(', ') : [];
    return '<div class="ans">' + head + '<div class="m">' + esc(z.model) + ' · ' + esc(new Date(z.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })) + '</div></div>' +
      '<span class="bd ' + (v != null ? 'ok' : '') + '">' + (v == null ? 'Not named' : 'Position ' + v) + '</span></div>' +
      '<div class="lab">Stores named, in order</div><div class="tags">' + (st.length ? st.map(function (s, i) { return '<span class="tag ' + (s === m.store ? 'us' : '') + '">' + (i + 1) + '. ' + esc(s) + '</span>'; }).join('') : '<span class="szary">No store from the watch list</span>') + '</div>' +
      '<div class="lab">Sources</div><div class="tags">' + (src.length ? src.map(function (s) { var us = m.domains.some(function (x) { return s === x || s.slice(-(x.length + 1)) === '.' + x; }); return '<span class="tag ' + (us ? 'us' : '') + '">' + esc(s) + '</span>'; }).join('') : '<span class="szary">None</span>') + '</div>' +
      '<div class="tresc">' + formatuj(z.answer, m.re) + '</div></div>';
  }).join('') + '</div>';
  cel.innerHTML = h; cel.scrollTop = 0; narysujWykresy();
}
function zamknijCicho() { OTW = null; document.getElementById('szuf').classList.remove('on'); document.getElementById('cien').classList.remove('on'); }
function zamknij() {
  if (!OTW && !document.getElementById('szuf').classList.contains('on')) return;
  zamknijCicho(); zapiszAdres(); if (fokus && fokus.focus) fokus.focus();
}
document.getElementById('sz-x').onclick = zamknij;
document.getElementById('cien').onclick = zamknij;
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zamknij(); });
PLASTER('prompt', {
  /* a click on a prompt row, in any view that lists prompts, opens the drawer */
  podepnij: function () {
    document.querySelectorAll('tr.klik, .ruch li').forEach(function (r) { r.onclick = function (e) { if (e.target.closest('a')) return; otworz(r.getAttribute('data-id')); }; });
  },
  doAdresu: function (q) { if (OTW) q.set('prompt', OTW); },
  zAdresu: function (q) { var p = q.get('prompt'); DO_OTWARCIA = p && rynek(S.market).prompts.some(function (x) { return x.id === p; }) ? p : null; },
  poAdresie: function (ok) { var p = ok ? DO_OTWARCIA : null; DO_OTWARCIA = null; if (p) otworz(p); else if (OTW) zamknijCicho(); },
  zamknij: zamknijCicho
});

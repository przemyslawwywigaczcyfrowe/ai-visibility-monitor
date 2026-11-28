/* ---------- Access view ---------- */
var DOST_LOKALNE = [];   /* invitations and removals sent from this browser, until the sync shows them */
function widokAccess() {
  if (Date.now() - ACC_CZAS > 12e4) { ACC_CZAS = Date.now(); wczytajDostep().then(function () { if (S.view === 'access') rysuj(); }); }
  var lud = Object.keys(ACC.people || {}).map(function (k) { return ACC.people[k]; });
  DOST_LOKALNE.forEach(function (d) {
    var p = lud.filter(function (x) { return x.email === d.email; })[0];
    if (d.t === 'invite') { if (!p) { p = { email: d.email, name: d.name, status: 'invited', invitedBy: JA, invitedAt: d.at, lokalne: true }; lud.push(p); } else if (!p.invitedAt || p.invitedAt < d.at) { p.lokalne = true; if (p.status !== 'active') p.status = 'invited'; p.invitedAt = d.at; p.invitedBy = JA; } }
    if (d.t === 'remove' && p && (!p.removedAt || p.removedAt < d.at)) { p.status = 'removed'; p.lokalne = true; }
  });
  /* the signed-in person has a login even before the sync records it */
  lud.forEach(function (p) { if (p.email === JA && p.status === 'invited') { p.status = 'active'; p.since = p.since || new Date().toISOString(); } });
  var akt = lud.filter(function (p) { return p.status === 'active'; }), zapr = lud.filter(function (p) { return p.status === 'invited'; });
  var tydz = new Date(Date.now() - 7 * 864e5).toISOString();
  function wizyty(p, dni) { var od = new Date(Date.now() - dni * 864e5).toISOString().slice(0, 10); return Object.keys(p.visitDays || {}).filter(function (d) { return d >= od; }).reduce(function (a, d) { return a + p.visitDays[d]; }, 0); }
  function kiedyO(t) { if (!t) return '-'; var d = new Date(t), dzis = new Date(); var godz = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); if (d.toDateString() === dzis.toDateString()) return 'today ' + godz; if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return 'yesterday ' + godz; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + godz; }
  function inicjaly(p) { return (p.name || p.email).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0].toUpperCase(); }).join(''); }
  var firmy = {}; akt.forEach(function (p) { firmy[p.email.split('@')[1]] = 1; });
  var h = naglowekProsty('Who can open this panel', 'Access', '<b>' + akt.length + (akt.length === 1 ? ' person' : ' people') + '</b> have their own login. Anyone with access can invite a colleague or remove access. An invitation goes by e-mail and is valid for 7 days.',
    [['People with access', akt.length, Object.keys(firmy).length + (Object.keys(firmy).length === 1 ? ' company' : ' companies')], ['Invitations waiting', zapr.length, zapr.length ? 'oldest ' + kiedyKrotko(zapr.map(function (p) { return p.invitedAt; }).sort()[0]) : 'none'],
      ['Active in 7 days', akt.filter(function (p) { return p.lastSeen && p.lastSeen >= tydz; }).length, 'of ' + akt.length + ' people']]);
  var rzad = lud.filter(function (p) { return p.status !== 'removed'; }).sort(function (a, b) { return (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1) || String(a.name || a.email).localeCompare(String(b.name || b.email)); });
  h += '<div class="acc-grid"><section class="card" style="padding:4px 8px 8px"><table class="t"><thead><tr><th>Person</th><th>Status</th><th>Invited by</th><th class="r">Last visit</th><th class="r">Visits, 30 days</th><th></th></tr></thead><tbody>' +
    rzad.map(function (p) {
      var wl = p.email === WLASCICIEL, ja = p.email === JA;
      var st = p.status === 'active' ? '<span class="stat ok">Active</span>' : '<span class="stat wait">' + (p.lokalne ? 'E-mail on its way' : 'Invitation sent') + '</span>';
      var akc = '';
      if (p.status === 'invited') akc = '<button class="lnk" data-zapros="' + esc(p.email) + '" data-imie="' + esc(p.name || '') + '">Send again</button>' + (wl ? '' : '<button class="lnk red" data-usun="' + esc(p.email) + '">Cancel</button>');
      else if (!wl && !ja) akc = '<button class="lnk red" data-usun="' + esc(p.email) + '">Remove</button>';
      return '<tr><td><div class="os"><span class="av2">' + (wl ? '<img src="assets/author.jpg" alt="">' : esc(inicjaly(p))) + '</span><span><b>' + esc(p.name || p.email) + (ja ? ' (you)' : '') + '</b><small>' + esc(p.email) + (wl ? ' · panel author' : '') + '</small></span></div></td>' +
        '<td>' + st + '</td><td>' + (p.invitedBy ? esc((osoba(p.invitedBy) || {}).name || p.invitedBy) : '<span class="szary">-</span>') + '</td>' +
        '<td class="r">' + (p.status === 'active' ? esc(kiedyO(p.lastSeen)) : '<span class="szary">-</span>') + '</td><td class="r num">' + (p.status === 'active' ? wizyty(p, 30) : '<span class="szary">-</span>') + '</td><td class="r" style="white-space:nowrap">' + akc + '</td></tr>';
    }).join('') + '</tbody></table></section>' +
    '<section class="card"><div class="ch"><h2>Invite a colleague<small>They get an e-mail with a link to set their own password.</small></h2></div>' +
    '<form id="zapros-form" style="display:flex;flex-direction:column;gap:14px"><label class="pole-t">Work e-mail<input type="email" id="z-email" required autocomplete="off"></label>' +
    '<label class="pole-t">Name (shown in the e-mail and in this list)<input id="z-imie" required autocomplete="off"></label>' +
    '<button class="btn primary duzy" type="submit">Send invitation</button><p class="wsk" id="z-info">The e-mail is sent from przemyslaw.wywigacz@cyfrowe.pl within about 15 minutes, with your name as the person who invited them.</p></form></section></div>';
  return h;
}
/* a white header card for views without a store (Access) */
function naglowekProsty(kick, tytul, lead, kafle) {
  return '<section class="naglowek"><div class="hl"><div class="kick">' + esc(kick) + '</div><h1>' + esc(tytul) + '</h1><p class="lead">' + lead + '</p></div>' +
    '<div class="hr">' + kafle.map(function (k) { return '<div class="kf"><span>' + esc(k[0]) + '</span><b class="num">' + k[1] + '</b><small>' + esc(k[2]) + '</small></div>'; }).join('') + '</div></section>';
}
var WLASCICIEL = 'przemyslaw.wywigacz@cyfrowe.pl';
function podepnijAccess() {
  var f = document.getElementById('zapros-form');
  async function zapros(email, name) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { alert('Check the e-mail address.'); return false; }
    var e = { t: 'invite', email: email, name: String(name || '').trim().slice(0, 80), by: JA, id: b64url(crypto.getRandomValues(new Uint8Array(9))), tok: b64url(crypto.getRandomValues(new Uint8Array(32))), at: new Date().toISOString() };
    try { await wyslijWiadomosc(e); } catch (err) { alert('The invitation was not sent: ' + (err && err.message || err)); return false; }
    DOST_LOKALNE.push({ t: 'invite', email: email, name: e.name, at: e.at }); zdarzenieUzycia('zaproszenie', 'Access');
    return true;
  }
  if (f) f.onsubmit = async function (ev) {
    ev.preventDefault(); var b = f.querySelector('button'); b.disabled = true;
    if (await zapros(document.getElementById('z-email').value, document.getElementById('z-imie').value)) { rysuj(); var i = document.getElementById('z-info'); if (i) i.innerHTML = '<b style="color:var(--up)">Invitation queued.</b> The e-mail goes out within about 15 minutes.'; }
    else b.disabled = false;
  };
  document.querySelectorAll('[data-zapros]').forEach(function (b) { b.onclick = async function () { b.disabled = true; if (await zapros(b.getAttribute('data-zapros'), b.getAttribute('data-imie'))) rysuj(); else b.disabled = false; }; });
  document.querySelectorAll('[data-usun]').forEach(function (b) {
    b.onclick = async function () {
      var email = b.getAttribute('data-usun'), p = osoba(email) || {};
      if (!confirm('Remove access for ' + (p.name || email) + '? They will not be able to sign in. You can invite them again later.')) return;
      var e = { t: 'remove', email: email, by: JA, at: new Date().toISOString() };
      try { await wyslijWiadomosc(e); DOST_LOKALNE.push({ t: 'remove', email: email, at: e.at }); rysuj(); } catch (err) { alert('Not saved: ' + (err && err.message || err)); }
    };
  });
}
PLASTER('access', { nazwa: 'Access', menu: { ikona: 'i-user', title: 'Who can open this panel, and invitations' }, rysuj: widokAccess, podepnij: podepnijAccess });

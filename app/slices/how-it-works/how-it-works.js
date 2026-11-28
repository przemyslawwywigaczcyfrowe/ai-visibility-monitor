/* Change log of the panel and the measurement, from config/changelog.json. */
var ZMIANY = [];
/* ---------- How it works ---------- */
function widokHow() {
  var ost = IDX.runs[IDX.runs.length - 1] || {};
  return '<div class="tytul"><h1>How it works</h1><span class="op">Definitions and method</span></div><div class="metoda">' +
    '<section class="card"><h2>Metrics</h2>' +
    '<h3>Position</h3><p>The order in which the answer text first names stores from the watch list in <code>config/config.json</code>: 1 means our store is the first store named. It is the order of names, not a recommendation: a store named in a warning counts too. Price comparison sites, classifieds and review sites (for example Ceneo, Skąpiec, OLX, Optyczne.pl, Marktplaats, Kleinanzeigen) are shown in the lists but take no place. With "All engines", a prompt\'s position is its best place in any engine.</p>' +
    '<h3>Visibility</h3><p>Share of prompts where the answer text names the store, by name or by domain. A link that appears only in the sources does not count here; it shows in "Our website cited".</p>' +
    '<h3>Day-to-day variation</h3><p>Each prompt is asked once a day in each engine, and answers change from day to day, so one prompt moves visibility by 4 points. "Visibility up", "Visibility down" and "ahead of" appear only for a difference of at least ' + PROG + ' prompts (' + PROG_GRUPA + ' for all stores together). The average of the last 7 runs shows the steadier level.</p>' +
    '<h3>Average position</h3><p>Average of the prompt positions, counted only over prompts that name the store.</p>' +
    '<h3>Named first, named in top 3</h3><p>Number of prompts whose position is 1, or 1 to 3. The unit is always the prompt, not the answer.</p>' +
    '<h3>Share of voice</h3><p>The store\'s mentions divided by all store mentions in the answers.</p>' +
    '<h3>Change, new, lost</h3><p>Compared with the run chosen in "compared with". Green ▲ is better, red ▼ is worse, "new" means named now and not before, "lost" the other way round.</p></section>' +
    '<section class="card"><h2>Method</h2>' +
    '<h3>Engines</h3><ul>' + (CFG.engines || IDX.engines).map(function (e) { return '<li><b>' + esc(e.short || e.label) + '</b>: <code>' + esc(e.model) + '</code>' + (e.note ? '. ' + esc(e.note) : '') + '</li>'; }).join('') + '</ul>' +
    '<h3>Clean context</h3><p>Each prompt is a new conversation with web search, no history, no account and no mention of our stores. The only extra information is the customer\'s approximate city: ' + esc(M.map(function (m) { return m.city; }).join(', ')) + '.</p>' +
    '<h3>Prompts</h3><p>25 prompts per store, in the local language, with an English version in the tables. The prompt set belongs to EIG. Prompt 4 of every store names a competitor (Allegro, Amazon, bol.com), so that competitor is almost always named first; tick "Without prompt 4" in the filters to see the results without it.</p>' +
    '<h3>Schedule</h3><p>Every fourth day. GitHub Actions plans the run for 07:00 UTC but often starts it several hours later, so the time differs from run to run. Latest measurement started ' + esc(kiedy(ost.run)) + (ost.cost ? ', cost ' + fmt(ost.cost, 2) + ' USD' : '') + '. The exact start of every run is in the run log below.</p>' +
    '<h3>Privacy</h3><p>Results are encrypted (AES-256) before they are stored. Everyone signs in with their own e-mail and password; the password never leaves your device and nobody else can read it. To see how the panel is used, it records per person which views are opened, active time and what is clicked, and sends this encrypted to Cyfrowe.pl (the panel author). Checklist ticks and invitations go the same way and are visible to everyone with access, with the name of the person.</p>' +
    '<h3 id="dziennik">Run log</h3><table class="t" style="margin-top:6px"><thead><tr><th>Run</th><th class="r">Answers</th><th class="r">Errors</th><th class="r">Duration</th><th class="r">Google searches</th><th class="r">Cost</th></tr></thead><tbody>' +
    IDX.runs.slice().reverse().map(function (r) {
      var min = r.start && r.end ? Math.round((new Date(r.end) - new Date(r.start)) / 60000) : null;
      return '<tr><td>' + esc(kiedy(r.run)) + '</td><td class="r num">' + (r.ok != null ? r.ok : '-') + (r.calls ? ' of ' + r.calls : '') + '</td><td class="r num">' + (r.calls != null && r.ok != null ? r.calls - r.ok : '-') + '</td>' +
        '<td class="r num">' + (min != null ? min + ' min' : '-') + '</td><td class="r num" title="5,000 free a month across Gemini 3.x, then 14 USD per 1,000">' + (r.googleSearches ? r.googleSearches : '<span class="szary">via OpenRouter</span>') + '</td><td class="r num">' + (r.cost != null ? fmt(r.cost, 2) + ' USD' : '-') + '</td></tr>';
    }).join('') + '</tbody></table>' +
    '<p style="margin-top:16px"><a class="btn" href="https://github.com/' + REPO + '/actions/workflows/measure.yml" target="_blank" rel="noopener">' + ic('i-play') + 'Run a measurement now (admins)</a></p></section>' +
    /* change log of the panel and the measurement, from config/changelog.json, newest first */
    (ZMIANY.length ? '<section class="card" id="zmiany"><h2>Change log</h2><table class="t" style="margin-top:6px"><thead><tr><th>Version</th><th>Date</th><th>What changed</th></tr></thead><tbody>' +
      ZMIANY.map(function (z) { return '<tr><td class="num">' + esc(z.version) + '</td><td style="white-space:nowrap">' + esc(new Date(z.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + '</td><td>' + esc(z.text) + '</td></tr>'; }).join('') +
      '</tbody></table></section>' : '') + '</div>';
}
PLASTER('how', {
  nazwa: 'How it works', menu: { ikona: 'i-info', dol: true },
  wczytaj: async function () {
    try { ZMIANY = await (await fetch('config/changelog.json', { cache: 'no-store' })).json(); } catch (e) { ZMIANY = []; }
  },
  rysuj: widokHow
});

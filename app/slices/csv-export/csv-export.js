/* ---------- CSV ---------- */
function csv() {
  zdarzenieUzycia('csv', 'CSV export · ' + rynek(S.market).store);
  var m = rynek(S.market), det = DET[S.run] || {};
  function f(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var w = ['store,run,prompt_id,topic,prompt,prompt_english,engine,position,stores_in_order,our_url,sources'];
  prompty(m).forEach(function (p) {
    silniki().forEach(function (e) {
      var c = kom(S.run, p.id, e), z = det[p.id + '|' + e] || {}; if (!c) return;
      w.push([m.store, S.run, p.id, p.topic, p.text, p.en, nazwaSil(e), c[3] == null ? 'not named' : c[3], c[4], z.url, z.sources].map(f).join(','));
    });
  });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + w.join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ai-visibility-' + m.code + '-' + S.run.replace(/[ :]/g, '') + '.csv'; a.click();
}
PLASTER('csv', {
  przyciskFiltrow: function () { return '<button class="btn" id="csv">' + ic('i-down') + 'Export CSV</button>'; },
  podepnijFiltry: function () { document.getElementById('csv').onclick = csv; }
});

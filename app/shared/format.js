/* ---------- text and number formatting ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ic(id) { return '<svg class="ic"><use href="#' + id + '"/></svg>'; }
function fmt(n, d) { return Number(n).toLocaleString('en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function kiedyKrotko(t) { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

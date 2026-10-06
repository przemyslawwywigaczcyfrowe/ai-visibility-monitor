// Shared logic: OpenRouter request, response parsing, answer analysis, encryption.
// The browser panel (index.html) uses the same encryption format.
import { gzipSync, gunzipSync } from 'node:zlib';

const { subtle } = globalThis.crypto;

/* ---------- request ---------- */

/**
 * One prompt = one stateless API call. No chat history, no store name, no referrer header,
 * no "user" field. The only instruction is the user's approximate location, which ChatGPT
 * and Gemini also know in their own apps. Without it, English prompts get US answers.
 */
export function buildRequest(prompt, engine, market, key) {
  const body = {
    model: engine.model,
    messages: [{ role: 'system', content: market.location }, { role: 'user', content: prompt }],
    usage: { include: true }
  };
  if (engine.web) {
    body.plugins = [{ id: 'web', max_results: 5 }];
    body.web_search_options = {
      search_context_size: 'low',
      user_location: { type: 'approximate', approximate: { country: market.country, city: market.city } }
    };
  }
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    init: { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  };
}

/* Gemini returns Google redirect links as sources and puts the real domain in the title. */
function sourceUrl(c) {
  const url = String(c.url || '');
  const title = String(c.title || '').trim().toLowerCase();
  if (/vertexaisearch\.cloud\.google\.com/.test(url) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(title)) return 'https://' + title + '/';
  return url;
}

export function parseResponse(status, text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return { error: 'HTTP ' + status + ': response is not JSON' }; }
  if (status !== 200 || j.error) return { error: 'HTTP ' + status + ': ' + String(j.error && j.error.message || '').slice(0, 300) };
  const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const answer = typeof msg.content === 'string' ? msg.content : (msg.content || []).map(c => c.text || '').join('');
  if (!answer) return { error: 'empty answer' };
  const sources = (msg.annotations || []).filter(a => a.type === 'url_citation' && a.url_citation).map(a => sourceUrl(a.url_citation));
  const u = j.usage || {};
  return { answer, sources, model: j.model, tokens: u.total_tokens || 0, cost: u.cost || 0 };
}

/* ---------- analysis ---------- */

export function domainOf(url) {
  const m = String(url).match(/^https?:\/\/([^\/?#:]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

function matchesDomain(dom, list) {
  return list.some(d => dom === d || dom.endsWith('.' + d));
}

export function shopsForMarket(shops, code) {
  return shops.filter(s => s.market === '*' || s.market === code).map(s => ({
    ...s, re: (() => { try { return new RegExp(s.pattern, 'i'); } catch (e) { return null; } })()
  }));
}

/**
 * Position = place of our store in the order in which the answer first mentions the stores
 * from the list. A store that only appears in sources gets no position, but its URL is kept.
 */
export function analyse(answer, sources, shops) {
  const text = String(answer || '');
  const lower = text.toLowerCase();
  const hits = [];
  for (const s of shops) {
    let idx = -1;
    if (s.re) { const m = text.match(s.re); if (m) idx = m.index; }
    for (const d of s.domains) { const i = lower.indexOf(d); if (i >= 0 && (idx < 0 || i < idx)) idx = i; }
    if (idx >= 0) hits.push({ name: s.name, idx, ours: s.ours });
  }
  hits.sort((a, b) => a.idx - b.idx);
  const mentioned = hits.map(h => h.name);
  const pos = hits.findIndex(h => h.ours);
  const urls = (sources || []).slice();
  (text.match(/https?:\/\/[^\s)\]>"']+/g) || []).forEach(u => urls.push(u.replace(/[.,;]+$/, '')));
  const domains = [];
  urls.forEach(u => { const d = domainOf(u); if (d && !domains.includes(d)) domains.push(d); });
  const ours = shops.filter(s => s.ours).flatMap(s => s.domains);
  const ourUrl = (urls.find(u => matchesDomain(domainOf(u), ours)) || '').split('?utm_')[0];
  return { pos: pos < 0 ? null : pos + 1, mentioned, ourUrl, domains };
}

/* ---------- encryption ----------
   AES-256-GCM, key from the password with PBKDF2-SHA-256. One salt for the whole site
   (data/salt.json), a fresh 12-byte IV per file. File = base64(iv + ciphertext of gzip(JSON)). */

export const ITERATIONS = 600000;

export async function deriveKey(password, saltB64, iterations = ITERATIONS) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(saltB64, 'base64'), iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, gzipSync(Buffer.from(JSON.stringify(obj)))));
  return Buffer.concat([Buffer.from(iv), Buffer.from(ct)]).toString('base64');
}

export async function decryptJson(key, b64) {
  const raw = Buffer.from(b64.trim(), 'base64');
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return JSON.parse(gunzipSync(Buffer.from(plain)).toString('utf8'));
}

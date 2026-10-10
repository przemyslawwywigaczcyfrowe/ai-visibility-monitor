// One-time switch (10 Oct 2026) from the shared panel password to personal accounts.
// Re-encrypts every file from the old key (PBKDF2 of PANEL_PASSWORD) to the random DATA_KEY,
// then the shared password stops working. Decrypts everything first: all or nothing.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { deriveKey, encryptJson, decryptJson } from './lib.mjs';

const { PANEL_PASSWORD, DATA_KEY } = process.env;
if (!PANEL_PASSWORD || !DATA_KEY) { console.error('PANEL_PASSWORD and DATA_KEY are both needed.'); process.exit(1); }
if (!existsSync('data/salt.json')) { console.log('Already migrated (no data/salt.json).'); process.exit(0); }
const salt = JSON.parse(readFileSync('data/salt.json', 'utf8'));
const stary = await deriveKey(PANEL_PASSWORD, salt.salt, salt.iterations);
const nowy = await webcrypto.subtle.importKey('raw', Buffer.from(DATA_KEY, 'base64'), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
if (Buffer.from(DATA_KEY, 'base64').length !== 32) { console.error('DATA_KEY must be 32 bytes.'); process.exit(1); }
const pliki = ['data/index.enc', 'data/checklist.enc', 'data/access.enc'].filter(existsSync)
  .concat(readdirSync('data/runs').filter(f => f.endsWith('.enc')).map(f => 'data/runs/' + f));
const jawne = {};
for (const f of pliki) jawne[f] = await decryptJson(stary, readFileSync(f, 'utf8'));
for (const f of pliki) writeFileSync(f, await encryptJson(nowy, jawne[f]) + '\n');
for (const f of ['data/salt.json', 'data/public-key.json']) if (existsSync(f)) unlinkSync(f);
console.log(`Moved ${pliki.length} files to the new data key. The shared password no longer opens anything.`);

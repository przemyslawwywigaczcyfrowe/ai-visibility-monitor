// Re-encrypts all results with a new PANEL_PASSWORD and a fresh salt.
// Needed after public access was on: the published key (still in git history) opens the old
// encryption, so the data must move to a key derived from a new password.
// The old key is taken from git history (data/public-key.json) or from env OLD_KEY (base64).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { encryptJson, decryptJson, deriveKey, ITERATIONS } from './lib.mjs';

const NEW = process.env.PANEL_PASSWORD;
if (!NEW) { console.error('PANEL_PASSWORD missing.'); process.exit(1); }

let oldB64 = process.env.OLD_KEY;
if (!oldB64) {
  for (const h of execSync('git log --format=%H -- data/public-key.json').toString().split('\n').filter(Boolean)) {
    try { oldB64 = JSON.parse(execSync(`git show ${h}:data/public-key.json`).toString()).key; break; } catch (e) {}
  }
}
if (!oldB64) { console.error('Old key not found.'); process.exit(1); }

const oldSalt = JSON.parse(readFileSync('data/salt.json', 'utf8'));
if (pbkdf2Sync(NEW, Buffer.from(oldSalt.salt, 'base64'), oldSalt.iterations, 32, 'sha256').toString('base64') === oldB64) {
  console.error('PANEL_PASSWORD is still the old password. Change the secret first, then run this again.');
  process.exit(1);
}
const oldKey = await crypto.subtle.importKey('raw', Buffer.from(oldB64, 'base64'), { name: 'AES-GCM' }, false, ['decrypt']);
const salt = { salt: randomBytes(16).toString('base64'), iterations: ITERATIONS };
const newKey = await deriveKey(NEW, salt.salt, salt.iterations);

const files = ['data/index.enc'].concat(readdirSync('data/runs').filter(f => f.endsWith('.enc')).map(f => 'data/runs/' + f));
const plain = {};
for (const f of files) plain[f] = await decryptJson(oldKey, readFileSync(f, 'utf8'));   // all or nothing: decrypt everything first
for (const f of files) writeFileSync(f, await encryptJson(newKey, plain[f]) + '\n');
writeFileSync('data/salt.json', JSON.stringify(salt, null, 2) + '\n');
console.log(`Re-encrypted ${files.length} files with the new password.`);

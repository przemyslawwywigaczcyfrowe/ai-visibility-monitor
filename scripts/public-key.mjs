// Public access switch. "on" writes data/public-key.json with the AES key derived from
// PANEL_PASSWORD, so the panel opens without the sign-in screen. "off" removes the file.
// The password itself is never written; the key cannot be turned back into it.
// Turning access off again only protects data written AFTER the password is changed:
// everything encrypted while the key was public stays readable for whoever saved the key.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';

const mode = process.argv[2];
if (mode === 'off') { if (existsSync('data/public-key.json')) rmSync('data/public-key.json'); console.log('Public access off.'); process.exit(0); }
if (mode !== 'on') { console.error('Usage: node scripts/public-key.mjs on|off'); process.exit(1); }
const pass = process.env.PANEL_PASSWORD;
if (!pass) { console.error('PANEL_PASSWORD missing.'); process.exit(1); }
const salt = JSON.parse(readFileSync('data/salt.json', 'utf8'));
/* Same derivation as the panel (PBKDF2-SHA-256 → 256-bit AES-GCM key). */
const key = pbkdf2Sync(pass, Buffer.from(salt.salt, 'base64'), salt.iterations, 32, 'sha256').toString('base64');
writeFileSync('data/public-key.json', JSON.stringify({ key, note: 'Public access is on. Remove this file and change PANEL_PASSWORD to restore the sign-in screen.' }, null, 2) + '\n');
console.log('Public access on.');

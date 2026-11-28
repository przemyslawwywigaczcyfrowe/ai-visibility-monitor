# AI Visibility Monitor

Check, every fourth day, of whether ChatGPT and Google AI Mode recommend the EIG photo stores when customers ask
for advice: cyfrowe.pl (PL), Wex Photo Video (UK), Cameranu (NL) and Calumet (DE). 25 prompts per market,
each in the local language. Works like a keyword rank tracker: for every prompt you see the position of
our store in each model's answer, the change since the previous run and which store is named first.

Panel: https://przemyslawwywigaczcyfrowe.github.io/ai-visibility-monitor/ (password required)

## How it measures

- Models via OpenRouter, both with web search, chosen as the defaults people actually get:
  - ChatGPT: `openai/gpt-5.6-luna`, default model in free ChatGPT since 6 Aug 2026.
  - Google AI Mode: `google/gemini-3.8-flash`, default model in AI Mode in Google Search since 2 Sep 2026.
- Every prompt is a separate, stateless API call: no chat history, no store name, no referrer.
  The only instruction is the user's approximate location (Warsaw, London, Amsterdam, Hamburg),
  which the consumer apps also know. Without it, English prompts get answers for US shoppers.
- Position = where our store appears in the order the answer names stores from `config/config.json`.
- Every fourth day at 07:00 UTC (`.github/workflows/measure.yml` starts daily; `measure.mjs` skips until 4 calendar days have passed since the last run), also runnable by hand from the Actions tab,
  optionally for selected markets or prompt ids.

## Privacy

- Results are encrypted with AES-256-GCM before they are committed. The key is derived from a password
  (PBKDF2-SHA-256, 600,000 iterations). The panel asks for the password and decrypts in the browser.
  Anyone with the link only sees the password screen and ciphertext.
- Public in this repository: the code, the prompts and the list of stores (`config/config.json`).
- Secrets (Settings > Secrets and variables > Actions): `OPENROUTER_KEY`, `PANEL_PASSWORD`.
  Changing `PANEL_PASSWORD` later makes the existing history unreadable; the run stops instead of
  overwriting it.

## Files

- `index.html` - the page frame: icons, the sign-in form, the rail, and the list of styles and scripts. No build step.
- `app/` - the panel code, cut into vertical slices (see "Panel code" below).
- `config/config.json` - markets, models, prompts, topics, stores and their name patterns.
- `config/changelog.json` - change log shown at the end of How it works. Every change that people in the EIG stores should know about (measurement, schedule, metrics, views, access) gets a new entry on top with the next version number; internal changes (exports, usage tracking) do not.
- `scripts/measure.mjs`, `scripts/lib.mjs` - measurement, analysis, encryption.
- `data/` - encrypted results: `index.enc` (positions history), `runs/*.enc` (full answers per run).

## Panel code

The panel is cut into vertical slices: one folder per feature, with everything that feature needs.

- `app/slices/<name>/` - one feature: its view, its click handlers, its part of the address and its styles.
  Views: `all-stores`, `summary`, `rankings`, `position-history`, `competitors`, `sources`, `checklist`,
  `how-it-works`, `access`. Without a view: `prompt-detail` (the answer drawer), `csv-export`, `sign-in`,
  `usage-tracking`. `usage-legacy` is the counter and the Usage view from before 10 Oct 2026; nothing links to it.
- `app/shared/` - only what at least two slices use: the slice registry, decryption, the measurement data
  and its numbers, charts and header cards, the session.
- `app/shell/` - the frame around the views: rail, store switcher, filter bar, address.
- `app/start.js` - runs last: builds the rail and opens the sign-in.

A slice registers itself with `PLASTER(name, definition)`. The frame knows no slice by name; it asks the
registry. The fields of a definition are listed at the top of `app/shared/slices.js`.

To add a view:

1. Create `app/slices/<name>/<name>.js` with a function that returns the HTML and a `PLASTER(...)` call.
2. Add its `<script>` tag in `index.html`. The order of the tags is the order of the buttons in the rail.
3. Change the `?v=` value on every tag in `index.html`, so browsers do not mix old and new files.
4. Run `node scripts/check-slices.mjs`.

All files share one global scope (plain scripts, no modules), so a function name must be unique in the panel.

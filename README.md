# AI Visibility Monitor

Daily check of whether ChatGPT and Google AI Mode recommend the EIG photo stores when customers ask
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
- Daily at 07:00 UTC (`.github/workflows/measure.yml`), also runnable by hand from the Actions tab,
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

- `index.html` - the panel (static, no build step).
- `config/config.json` - markets, models, prompts, topics, stores and their name patterns.
- `scripts/measure.mjs`, `scripts/lib.mjs` - measurement, analysis, encryption.
- `data/` - encrypted results: `index.enc` (positions history), `runs/*.enc` (full answers per run).

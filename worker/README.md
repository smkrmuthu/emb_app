# Explain My Bill — LLM Scanning Backend

A small Cloudflare Worker that reads a bill photo directly with Claude (vision)
instead of on-device OCR + regex parsing. Currently handles **restaurant,
grocery, and electricity** bills — other types still use the existing
OCR pipeline automatically.

Your Anthropic API key lives only here, as a Worker secret. It never reaches
the browser.

## One-time setup

You'll need a free [Cloudflare account](https://dash.cloudflare.com/sign-up)
(separate from Anthropic — this is just where the tiny backend function runs).

```bash
cd worker
npm install

# Log in to Cloudflare (opens a browser tab to authorize)
npx wrangler login

# Store your Anthropic API key as a secret (paste it when prompted —
# it's entered directly into your terminal, never typed into chat)
npx wrangler secret put ANTHROPIC_API_KEY
```

Get the API key from [console.anthropic.com](https://console.anthropic.com) →
Settings → API Keys (this is the same account whose balance you checked earlier
— NOT your Claude Pro subscription).

## Deploy

```bash
npx wrangler deploy
```

This prints a URL like:

```
https://emb-bill-scanner.<your-subdomain>.workers.dev
```

## Wire it into the app

Copy that URL into `src/services/llmScanService.ts`:

```ts
export const LLM_SCAN_ENDPOINT = 'https://emb-bill-scanner.<your-subdomain>.workers.dev';
```

Then rebuild and push the frontend as usual (`npm run build`, commit, push —
GitHub Pages redeploys automatically). Once that's live, restaurant/grocery/
electricity scans will use the LLM path first, falling back to the existing
OCR pipeline automatically if the request ever fails.

## Cost control

- `console.anthropic.com` → **Settings → Billing → Adjust limit** sets a hard
  monthly spend cap on the account this key belongs to.
- Cloudflare Workers' free tier covers 100,000 requests/day — you won't hit
  Cloudflare costs at this app's scale.

## Local testing

```bash
npx wrangler dev
```

Runs the worker at `http://localhost:8787` using your real secret. You can
point `LLM_SCAN_ENDPOINT` at this local URL temporarily to test end-to-end
before deploying, or just call it directly:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<base64 jpeg>","mediaType":"image/jpeg","billType":"restaurant"}'
```

## Extending to hotel / gas / credit_card

Add a Zod schema + prompt for the type in `src/index.ts` (follow the pattern
of the existing three), then add a matching case to
`buildBillFromLLMExtraction()` in `../src/services/billParser.ts` that maps
the extracted fields into that bill type's existing `build*` function —
the compliance-flag logic doesn't need to change, only the mapping.

# Worker regression fixtures

Every time a real bill/photo exposed a bug during development (a discom's
layout misread, a wrong-category scan silently producing fake numbers, an
EMI comparison-table calculation drifting), the fix landed in
`worker/src/index.ts` — but the specific test case that *proved* the bug
usually got thrown away once that debugging session ended. Nothing then
stopped a later prompt/schema edit, or a model update, from quietly
reintroducing the same mistake.

`run_fixtures.py` is the fix for that: each case is a synthetic bill
generated on the fly (nothing binary is committed, and no real personal
bill data is ever involved — see the root `.gitignore`'s `*.png`/`*.pdf`
rule, which this deliberately works around by never writing an image to
disk at all) paired with the extraction we've independently verified is
correct against the deployed worker.

## Running it

```bash
pip install pillow
python3 worker/fixtures/run_fixtures.py
```

Run this after any change to `worker/src/index.ts` (schemas, prompts,
dispatch logic) and before `wrangler deploy` — it hits the **deployed**
worker directly (same methodology used throughout development: curl/script
against the real endpoint, bypassing the browser entirely), so it also
catches deploy-time surprises like a schema exceeding Anthropic's
16-nullable-field structured-output limit.

To inspect one case's raw response while adding a new fixture:

```bash
python3 worker/fixtures/run_fixtures.py --dump <case_name>
```

## Adding a new fixture

When a new bill format/edge case gets fixed, capture it here so it stays
fixed:

1. Write a `_yourcase_request()` that returns the JSON body to POST
   (use `render_text_image([...])` for image-based types, or a `pdfText`
   string for text-based types like `credit_card`).
2. Run it with `--dump` first and read the actual response — don't guess
   expected values.
3. Write a `_yourcase_check(r)` that returns a list of failure strings
   (empty list = pass) asserting only the fields that matter for the bug
   being guarded against — not a full-object equality check, since minor
   OCR-style misreads of irrelevant fields (e.g. a digit in a photographed
   ID number) aren't the regression this suite exists to catch.
4. Append a `Case(name, description, request_fn, check_fn)` to `CASES`.

## What this deliberately does NOT do

It doesn't store real customer bill photos as a growing "training set" —
that wouldn't help (the hosted model isn't being fine-tuned) and would be
a privacy liability for no benefit. Every fixture here is a synthetic,
hand-built stand-in with representative field values, not a real bill.

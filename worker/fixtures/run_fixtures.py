#!/usr/bin/env python3
"""
Regression fixtures for the bill-scanning worker.

Every time a real bill/photo exposes a bug (wrong category read, a discom's
layout misread, a comparison-table calculation error, etc.), the FIX lands in
worker/src/index.ts — but the specific test case that proved the bug usually
gets thrown away once the conversation that found it ends. Nothing then stops
a later prompt/schema change, or a model update, from quietly reintroducing
the same mistake.

This script is the fix for that: each fixture below is a synthetic bill
(generated on the fly — nothing binary is committed, and no real personal
bill data is ever involved) paired with the extraction we've independently
verified is correct. Run it after any worker prompt/schema change, and before
`wrangler deploy`, to catch a regression before it reaches real users.

Requires: pip install pillow
Usage:    python3 worker/fixtures/run_fixtures.py
          python3 worker/fixtures/run_fixtures.py --dump NAME   (print raw
              response for one case — useful when adding a new fixture)

To add a new fixture: write a `build_request()` that returns the JSON body to
POST, and a `check(response)` that returns a list of human-readable failure
strings (empty list = pass). Append a Case(...) to CASES.
"""
import base64
import io
import json
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Optional

from PIL import Image, ImageDraw, ImageFilter

WORKER_URL = "https://emb-bill-scanner.smkrmuthu.workers.dev"
ORIGIN = "https://smkrmuthu.github.io"  # must match worker's ALLOWED_ORIGIN


def render_text_image(lines: list[str], size=(700, 450)) -> str:
    """Renders plain text onto a white PNG and returns it as base64 — a
    synthetic stand-in for a photographed bill, good enough for the LLM to
    read printed field labels/numbers back out of."""
    img = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(img)
    y = 20
    for line in lines:
        draw.text((20, y), line, fill="black")
        y += 32
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


MAX_ATTEMPTS = 3  # mirrors the client's own retry count in llmScanService.ts


def call_worker(body: dict) -> dict:
    req = urllib.request.Request(
        WORKER_URL,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Origin": ORIGIN,
            # Cloudflare's bot check flags Python's default "Python-urllib/x.y"
            # User-Agent as a bot and returns a 403 (error code 1010) before the
            # request ever reaches our worker code — a browser-shaped UA avoids it.
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
        method="POST",
    )
    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            # A transient 502/503 (worker cold-start, upstream model hiccup) is
            # worth a quick retry — the same class of blip the real app already
            # retries through. A 4xx (bad request, bot check, etc.) will not
            # change on retry, so fail fast instead of wasting attempts.
            last_err = e
            if e.code < 500 or attempt == MAX_ATTEMPTS:
                raise
            time.sleep(0.6 * attempt)
    raise last_err  # pragma: no cover — loop always returns or raises above


@dataclass
class Case:
    name: str
    description: str
    build_request: Callable[[], dict]
    check: Callable[[dict], list]


def approx(actual, expected, tol=1) -> bool:
    if actual is None or expected is None:
        return actual == expected
    return abs(actual - expected) <= tol


# ─── Fixture: Telangana (TGSPDCL) electricity bill, correctly categorized ───

def _telangana_request() -> dict:
    img = render_text_image([
        "TGSPDCL - TELANGANA STATE SOUTHERN POWER DISTRIBUTION",
        "Service Connection No: 987654321",
        "Consumer Name: RAVI KUMAR",
        "Category: Domestic (Cat 1A)",
        "Contracted Load: 3.00 KW    Ph: 1",
        "Present Reading: 4550   Previous Reading: 4300",
        "Billed Units: 250",
        "Energy Charges: Rs. 1125.00",
        "Customer Charges: Rs. 50.00",
        "Surcharge: Rs. 12.00",
        "Total Due: Rs. 1187.00",
    ])
    return {"imageBase64": img, "mediaType": "image/png", "billType": "electricity"}


def _telangana_check(r: dict) -> list:
    errs = []
    if r.get("matchesCategory") is not True:
        errs.append(f"expected matchesCategory=True, got {r.get('matchesCategory')}")
    if not approx(r.get("consumedUnits"), 250, 0):
        errs.append(f"expected consumedUnits=250, got {r.get('consumedUnits')}")
    if r.get("category") is None or "domestic" not in r["category"].lower():
        errs.append(f"expected category to mention Domestic, got {r.get('category')}")
    if not approx(r.get("contractedLoadKW"), 3.0, 0.1):
        errs.append(f"expected contractedLoadKW≈3.0, got {r.get('contractedLoadKW')}")
    if r.get("phase") != 1:
        errs.append(f"expected phase=1, got {r.get('phase')}")
    if not approx(r.get("grandTotal"), 1187, 1):
        errs.append(f"expected grandTotal≈1187, got {r.get('grandTotal')}")
    return errs


# ─── Fixture: Kerala (KSEB) electricity bill, correctly categorized ─────────

def _kerala_request() -> dict:
    img = render_text_image([
        "KSEB LIMITED - KERALA STATE ELECTRICITY BOARD",
        "Service Connection No: KL-445566",
        "Consumer Name: ANITHA MENON",
        "Tariff: LT-I Domestic",
        "Present Reading: 8820   Previous Reading: 8640",
        "Consumption: 180 units",
        "Energy Charges: Rs. 810.00",
        "Fixed Charge: Rs. 40.00",
        "Total Amount Due: Rs. 850.00",
    ])
    return {"imageBase64": img, "mediaType": "image/png", "billType": "electricity"}


def _kerala_check(r: dict) -> list:
    errs = []
    if r.get("matchesCategory") is not True:
        errs.append(f"expected matchesCategory=True, got {r.get('matchesCategory')}")
    if not approx(r.get("consumedUnits"), 180, 0):
        errs.append(f"expected consumedUnits=180, got {r.get('consumedUnits')}")
    if not approx(r.get("grandTotal"), 850, 1):
        errs.append(f"expected grandTotal≈850, got {r.get('grandTotal')}")
    return errs


# ─── Fixture: category mismatch — an electricity bill scanned as "grocery" ──
# (This exact case was curl-verified live against the deployed worker when
# the matchesCategory feature was built — see conversation history.)

def _mismatch_image() -> str:
    return render_text_image([
        "TANGEDCO - TAMIL NADU ELECTRICITY BOARD",
        "Service Connection No: 123456789",
        "Consumer Name: TEST USER",
        "Meter No: M12345",
        "Previous Reading: 1000",
        "Present Reading: 1250",
        "Consumption: 250 units",
        "Energy Charges: Rs. 1500.00",
        "Tariff: Domestic LT-1",
        "Grand Total Due: Rs. 1650.00",
        "Due Date: 25-09-2026",
    ])


def _mismatch_as_grocery_request() -> dict:
    return {"imageBase64": _mismatch_image(), "mediaType": "image/png", "billType": "grocery"}


def _mismatch_as_restaurant_request() -> dict:
    return {"imageBase64": _mismatch_image(), "mediaType": "image/png", "billType": "restaurant"}


def _expect_mismatch_false(r: dict) -> list:
    if r.get("matchesCategory") is not False:
        return [f"expected matchesCategory=False for a wrong category pick, got {r.get('matchesCategory')}"]
    return []


def _electricity_as_electricity_request() -> dict:
    return {"imageBase64": _mismatch_image(), "mediaType": "image/png", "billType": "electricity"}


def _expect_matches_true(r: dict) -> list:
    if r.get("matchesCategory") is not True:
        return [f"expected matchesCategory=True for the correct category, got {r.get('matchesCategory')}"]
    return []


# ─── Fixture: degraded veg-restaurant bill — item names must never come out
# as non-veg dishes. (Found live: a real, slightly-blurry "A2B — VEG.
# RESTAURANT" bill's "POORI [2 NOS]" and "SAMBAR VADAI [1 PC]" were
# hallucinated as "PORK EZ MOZI" and "SHRIMP CHIKN ELPL" — confidently wrong,
# unrelated, and non-vegetarian on a bill explicitly headed "Veg". The
# blur/downscale below is a synthetic stand-in for a real photographed
# thermal receipt's degradation, not a byte-for-byte reproduction of that
# bill — the check only asserts the specific failure mode is gone, not that
# every character is read perfectly off a genuinely hard image.)

NON_VEG_WORDS = ['pork', 'chicken', 'chikn', 'mutton', 'beef', 'fish', 'shrimp', 'prawn', 'egg', 'meat']


def _veg_restaurant_blurry_request() -> dict:
    img = Image.new('RGB', (500, 350), 'white')
    draw = ImageDraw.Draw(img)
    lines = [
        "A2B ADYAR ANANDA BHAVAN SWEETS",
        "VEG. RESTAURANT",
        "TAX INVOICE",
        "",
        "PLAIN DOSAI       1   70.00   70.00",
        "POORI [2 NOS]     1   75.00   75.00",
        "SAMBAR VADAI [1 PC] 1 55.00   55.00",
        "TEA               1   35.00   35.00",
        "",
        "SubTotal              235.00",
        "SGST 2.5%                5.88",
        "CGST 2.5%                5.88",
        "Total(Rs)               247.00",
    ]
    y = 10
    for line in lines:
        draw.text((10, y), line, fill='black')
        y += 24
    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    img = img.resize((250, 175)).resize((500, 350))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"imageBase64": b64, "mediaType": "image/png", "billType": "restaurant"}


def _veg_restaurant_blurry_check(r: dict) -> list:
    errs = []
    if r.get("matchesCategory") is not True:
        errs.append(f"expected matchesCategory=True, got {r.get('matchesCategory')}")
    for item in (r.get("items") or []):
        label = (item.get("label") or "").lower()
        hit = next((w for w in NON_VEG_WORDS if w in label), None)
        if hit:
            errs.append(f"item label {item.get('label')!r} looks non-veg (matched {hit!r}) on a Veg-labelled bill")
    return errs


# ─── Fixture: plain grocery receipt, correctly categorized (happy path) ────

def _grocery_request() -> dict:
    img = render_text_image([
        "DMART SUPERMARKET",
        "Rice 5kg           250.00",
        "Milk 1L             55.00",
        "Cooking Oil 1L     180.00",
        "Soap x3             90.00",
        "Total: Rs. 575.00",
    ])
    return {"imageBase64": img, "mediaType": "image/png", "billType": "grocery"}


def _grocery_check(r: dict) -> list:
    errs = []
    if r.get("matchesCategory") is not True:
        errs.append(f"expected matchesCategory=True, got {r.get('matchesCategory')}")
    if not approx(r.get("grandTotal"), 575, 1):
        errs.append(f"expected grandTotal≈575, got {r.get('grandTotal')}")
    return errs


# ─── Fixture: credit card statement (text-based extraction, not vision) ────

def _credit_card_request() -> dict:
    pdf_text = """
    IDFC FIRST Bank Credit Card Statement
    Card Number: XXXX XXXX XXXX 4821
    Statement Period: 18/Jul/2026 - 17/Aug/2026
    Statement Date: 18/Aug/2026
    Payment Due Date: 05/Sep/2026

    Total Amount Due: Rs. 24,560.00
    Minimum Amount Due: Rs. 1,230.00
    Credit Limit: Rs. 2,00,000.00
    Annual Percentage Rate (APR): 42.00%
    """
    return {"pdfText": pdf_text, "billType": "credit_card"}


def _credit_card_check(r: dict) -> list:
    errs = []
    if r.get("matchesCategory") is not True:
        errs.append(f"expected matchesCategory=True, got {r.get('matchesCategory')}")
    if not approx(r.get("totalAmountDue"), 24560, 1):
        errs.append(f"expected totalAmountDue≈24560, got {r.get('totalAmountDue')}")
    if not approx(r.get("minimumAmountDue"), 1230, 1):
        errs.append(f"expected minimumAmountDue≈1230, got {r.get('minimumAmountDue')}")
    if not approx(r.get("aprPercent"), 42.0, 0.1):
        errs.append(f"expected aprPercent≈42.0, got {r.get('aprPercent')}")
    return errs


# ─── Fixture: EMI offer screen with multiple bank/tenure options ───────────
# (This exact case was curl-verified live against the deployed worker when
# the True-APR comparison-table stability bug was fixed — see conversation
# history: options/rates/totals below are the real verified worker output.)

def _emi_offer_request() -> dict:
    img = render_text_image([
        "Amazon Pay ICICI Credit Card EMI Options",
        "iPhone - Total Price Not Shown Separately",
        "",
        "3 months - No Cost EMI - Rs.4000/mo - Total Rs.12000",
        "6 months - 9.8% p.a. - Rs.2094/mo - Total Rs.12918",
        "9 months - 11.7% p.a. - Rs.1424/mo - Total Rs.13166",
    ])
    return {"imageBase64": img, "mediaType": "image/png", "billType": "emi_offer"}


def _emi_offer_check(r: dict) -> list:
    errs = []
    options = r.get("options") or []
    if len(options) != 3:
        errs.append(f"expected 3 EMI options, got {len(options)}")
        return errs
    expected = [
        (3, 4000, True, 12000),
        (6, 2094, False, 12918),
        (9, 1424, False, 13166),
    ]
    for i, (tenure, monthly, is_no_cost, total) in enumerate(expected):
        opt = options[i]
        if opt.get("tenureMonths") != tenure:
            errs.append(f"option {i}: expected tenureMonths={tenure}, got {opt.get('tenureMonths')}")
        if not approx(opt.get("monthlyEMI"), monthly, 1):
            errs.append(f"option {i}: expected monthlyEMI≈{monthly}, got {opt.get('monthlyEMI')}")
        if opt.get("isNoCost") != is_no_cost:
            errs.append(f"option {i}: expected isNoCost={is_no_cost}, got {opt.get('isNoCost')}")
        if not approx(opt.get("totalCost"), total, 1):
            errs.append(f"option {i}: expected totalCost≈{total}, got {opt.get('totalCost')}")
    return errs


CASES = [
    Case("telangana_eb_correct", "Telangana (TGSPDCL) EB bill, correctly categorized",
         _telangana_request, _telangana_check),
    Case("kerala_eb_correct", "Kerala (KSEB) EB bill, correctly categorized",
         _kerala_request, _kerala_check),
    Case("grocery_correct", "Plain grocery receipt, correctly categorized",
         _grocery_request, _grocery_check),
    Case("veg_restaurant_no_nonveg_hallucination", "Degraded veg-restaurant bill must not hallucinate non-veg item names",
         _veg_restaurant_blurry_request, _veg_restaurant_blurry_check),
    Case("credit_card_correct", "Credit card statement text, correctly categorized",
         _credit_card_request, _credit_card_check),
    Case("emi_offer_multi_option", "EMI offer screen with 3 bank/tenure options",
         _emi_offer_request, _emi_offer_check),
    Case("mismatch_electricity_as_electricity", "Electricity bill scanned as electricity (sanity control)",
         _electricity_as_electricity_request, _expect_matches_true),
    Case("mismatch_electricity_as_grocery", "Electricity bill wrongly scanned as grocery",
         _mismatch_as_grocery_request, _expect_mismatch_false),
    Case("mismatch_electricity_as_restaurant", "Electricity bill wrongly scanned as restaurant",
         _mismatch_as_restaurant_request, _expect_mismatch_false),
]


def main():
    dump_name: Optional[str] = None
    if len(sys.argv) >= 3 and sys.argv[1] == "--dump":
        dump_name = sys.argv[2]

    if dump_name and not any(c.name == dump_name for c in CASES):
        print(f"No case named {dump_name!r} found.", file=sys.stderr)
        sys.exit(1)

    failures = 0
    for case in CASES:
        if dump_name and case.name != dump_name:
            continue
        try:
            response = call_worker(case.build_request())
        except Exception as e:
            print(f"[ERROR] {case.name}: request failed — {e}")
            failures += 1
            if dump_name:
                sys.exit(1)
            continue

        if dump_name:
            print(json.dumps(response, indent=2))
            return

        errs = case.check(response)
        if errs:
            failures += 1
            print(f"[FAIL] {case.name} — {case.description}")
            for e in errs:
                print(f"        {e}")
        else:
            print(f"[PASS] {case.name} — {case.description}")

    print(f"\n{len(CASES) - failures}/{len(CASES)} passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()

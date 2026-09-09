/**
 * llmScanService.ts
 * Calls the LLM-based scanning backend (see worker/) as a higher-accuracy
 * alternative to on-device OCR + regex parsing. Only used when LLM_SCAN_ENDPOINT
 * is configured (empty by default) and the bill type is one it supports —
 * everything else keeps using the existing Tesseract + regex pipeline untouched.
 *
 * Two modes:
 *  - Image (vision): restaurant/grocery/electricity — sends a photo.
 *  - Text: credit_card — sends the PDF's already-extracted text (every page,
 *    however many there are) instead of a photo. Credit card statements are
 *    always multi-page digital PDFs in practice, so reading the text sidesteps
 *    both the "only page 1 gets rendered" and "one photo per scan" limits that
 *    a vision-only approach would hit.
 */
import { BillData, BillType } from '../types/bill';
import { buildBillFromLLMExtraction, LLMBillExtraction } from './billParser';

// Set this to your deployed worker's URL after running `wrangler deploy` from
// worker/ (see worker/README.md). Left blank so the app safely falls back to
// the existing OCR pipeline until this is configured.
export const LLM_SCAN_ENDPOINT = 'https://emb-bill-scanner.smkrmuthu.workers.dev';

const IMAGE_TYPES: BillType[] = ['restaurant', 'grocery', 'electricity'];
const TEXT_TYPES: BillType[] = ['credit_card'];

export function isLLMScanSupported(billType: BillType): boolean {
  return Boolean(LLM_SCAN_ENDPOINT) && (IMAGE_TYPES.includes(billType) || TEXT_TYPES.includes(billType));
}

/** Credit card (and any future text-based type) needs a real PDF with extractable
 *  text, not a photo — a camera shot can't reliably capture a multi-page statement. */
export function requiresPdfText(billType: BillType): boolean {
  return TEXT_TYPES.includes(billType);
}

function dataUrlToBase64(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Expected a base64 data URL image');
  return { mediaType: match[1], base64: match[2] };
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Thrown when the model itself flags that the scanned content doesn't match the
 *  category the user picked (matchesCategory: false) — retrying with the same
 *  wrong category would just waste attempts, so this skips the retry loop. */
export class CategoryMismatchError extends Error {
  constructor(public billType: BillType) {
    super(`Scanned content doesn't match the selected "${billType}" category`);
    this.name = 'CategoryMismatchError';
  }
}

async function callScanEndpoint<T = LLMBillExtraction>(body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(LLM_SCAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null) as { error?: string } | null;
    throw new Error(errBody?.error || `LLM scan request failed (HTTP ${resp.status})`);
  }

  return await resp.json() as T;
}

// Observed in practice: the model occasionally returns a transient "request not
// allowed" style error that succeeds on an immediate retry (no change in input).
// A couple of quick retries here means a one-off hiccup doesn't force a user all
// the way back to the OCR fallback for bills where OCR alone can't read the table.
const MAX_ATTEMPTS = 3;

async function withRetries(body: Record<string, unknown>, billType: BillType): Promise<BillData> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await callScanEndpoint(body);
      if (data.matchesCategory === false) {
        throw new CategoryMismatchError(billType);
      }
      return buildBillFromLLMExtraction(data, billType);
    } catch (err) {
      if (err instanceof CategoryMismatchError) throw err;
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await delay(600 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('LLM scan failed after retries');
}

export async function scanBillWithLLM(imageDataUrl: string, billType: BillType): Promise<BillData> {
  if (!IMAGE_TYPES.includes(billType)) {
    throw new Error(`Image-based LLM scanning is not configured/supported for "${billType}"`);
  }
  const { base64, mediaType } = dataUrlToBase64(imageDataUrl);
  return withRetries({ imageBase64: base64, mediaType, billType }, billType);
}

export async function scanBillTextWithLLM(pdfText: string, billType: BillType, pageImageDataUrl?: string): Promise<BillData> {
  if (!TEXT_TYPES.includes(billType)) {
    throw new Error(`Text-based LLM scanning is not configured/supported for "${billType}"`);
  }
  const body: Record<string, unknown> = { pdfText, billType };
  // Page 1 is typically the visual "summary" page — including it lets the model
  // cross-check headline numbers (Total Due, Min Due, etc.) against their actual
  // visual layout, which linearized text can't reliably preserve for a tile/card
  // style summary section.
  if (pageImageDataUrl) {
    try {
      const { base64, mediaType } = dataUrlToBase64(pageImageDataUrl);
      body.imageBase64 = base64;
      body.mediaType = mediaType;
    } catch {
      // Not a usable image — proceed with text only, no worse than before.
    }
  }
  return withRetries(body, billType);
}

// ─── EMI offer screenshot scanning ──────────────────────────────────────────────
// Not a bill at all (no BillType, no BillData) — this just pre-fills the "No-Cost
// EMI" true-APR calculator from a photo of an EMI options screen (Apple India,
// Amazon/Flipkart checkout, a bank's own site), which usually list several
// bank/tenure combinations at once rather than a single value.

export interface EMIOfferOption {
  bankName: string;
  tenureMonths: number;
  monthlyEMI: number | null;
  interestRatePercent: number | null;
  processingFee: number | null;
  isNoCost: boolean;
  /** The plan's own final total, when the screen already states it directly
   *  (e.g. an Amazon/Flipkart-style "Total cost" column) — more reliable than
   *  anything estimated from rate/tenure, so prefer this when present. */
  totalCost: number | null;
}

export interface EMIOfferExtraction {
  productName: string | null;
  retailer: string | null;
  cashPrice: number | null;
  options: EMIOfferOption[];
}

async function withRetriesRaw<T>(body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callScanEndpoint<T>(body);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await delay(600 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('EMI offer scan failed after retries');
}

export async function scanEMIOfferWithLLM(imageDataUrl: string): Promise<EMIOfferExtraction> {
  const { base64, mediaType } = dataUrlToBase64(imageDataUrl);
  return withRetriesRaw<EMIOfferExtraction>({ imageBase64: base64, mediaType, billType: 'emi_offer' });
}

/** For a PDF upload (e.g. a bank's Key Fact Statement) instead of a screenshot —
 *  same extraction, text-based (see worker/src/index.ts, emi_offer is registered
 *  for both modes). */
export async function scanEMIOfferTextWithLLM(pdfText: string): Promise<EMIOfferExtraction> {
  return withRetriesRaw<EMIOfferExtraction>({ pdfText, billType: 'emi_offer' });
}

/**
 * llmScanService.ts
 * Calls the LLM-based scanning backend (see worker/) as a higher-accuracy
 * alternative to on-device OCR + regex parsing. Only used when LLM_SCAN_ENDPOINT
 * is configured (empty by default) and the bill type is one it supports —
 * everything else keeps using the existing Tesseract + regex pipeline untouched.
 */
import { BillData, BillType } from '../types/bill';
import { buildBillFromLLMExtraction, LLMBillExtraction } from './billParser';

// Set this to your deployed worker's URL after running `wrangler deploy` from
// worker/ (see worker/README.md). Left blank so the app safely falls back to
// the existing OCR pipeline until this is configured.
export const LLM_SCAN_ENDPOINT = 'https://emb-bill-scanner.smkrmuthu.workers.dev';

const SUPPORTED_TYPES: BillType[] = ['restaurant', 'grocery', 'electricity'];

export function isLLMScanSupported(billType: BillType): boolean {
  return Boolean(LLM_SCAN_ENDPOINT) && SUPPORTED_TYPES.includes(billType);
}

function dataUrlToBase64(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Expected a base64 data URL image');
  return { mediaType: match[1], base64: match[2] };
}

export async function scanBillWithLLM(imageDataUrl: string, billType: BillType): Promise<BillData> {
  if (!isLLMScanSupported(billType)) {
    throw new Error(`LLM scanning is not configured/supported for "${billType}"`);
  }

  const { base64, mediaType } = dataUrlToBase64(imageDataUrl);

  const resp = await fetch(LLM_SCAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType, billType })
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `LLM scan request failed (HTTP ${resp.status})`);
  }

  const data = await resp.json() as LLMBillExtraction;
  return buildBillFromLLMExtraction(data, billType);
}

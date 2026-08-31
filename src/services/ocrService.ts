/**
 * ocrService.ts
 * Orchestrates the full bill-scanning pipeline:
 *  1. Real OCR via Tesseract.js (for uploaded images)
 *  2. Bill type auto-detection (filename + OCR text)
 *  3. Parsing & auditing via billParser engine
 *  4. Sample bill fallback (for demo chips)
 */

import { BillData, BillType } from '../types/bill';
import { SAMPLE_BILLS } from '../data/sampleBills';
import { extractTextFromImage } from './realOCR';
import { parseBillFromOCR } from './billParser';

export interface ScanProgressCallback {
  stepIndex: number;
  totalSteps: number;
  statusText: string;
  subText: string;
}

// ─── Bill Type Detection ─────────────────────────────────────────────────────

/**
 * Detects bill type from filename using broad prefix matching
 * to handle common misspellings (restaurent, restauran, etc.)
 */
export function detectBillTypeFromFilename(fileName: string): BillType | null {
  const n = fileName.toLowerCase();
  if (/electricit|\beb\b|tnpdcl|kseb|tangedco|tsspdcl|tsnpdcl|bescom|msedcl|kwh/.test(n)) return 'electricity';
  // "restaur" prefix catches: restaurant, restaurent, restauran, restaurateur
  if (/restaur|cafe|dining|zomato|swiggy|saravana|sangeetha|bhavan|biryani|\bdosa\b|idly|thali|eatery|\bfood\b|canteen/.test(n)) return 'restaurant';
  if (/credit.?card|hdfc.*card|icici.*card|axis.*card|sbi.*card|\bemi\b|card.*stmt/.test(n)) return 'credit_card';
  if (/grocer|supermarket|dmart|bigbasket|reliance.*fresh|kirana/.test(n)) return 'grocery';
  if (/\bhotel\b|resort|\binn\b|lodge|folio|check.?in/.test(n)) return 'hotel';
  if (/\bgas\b|\blpg\b|indane|\bigl\b|\bmgl\b|cylinder/.test(n)) return 'gas';
  return null;
}

/**
 * Detects bill type from OCR-extracted text
 */
function detectBillTypeFromText(text: string): BillType | null {
  const t = text.toLowerCase();
  if (/tangedco|tnpdcl|kseb|tsspdcl|bescom|electricity\s*bill|units\s*consumed|kwh|tariff\s*slab/.test(t)) return 'electricity';
  if (/cgst|sgst|restaurant|cafe|dining|food\s*bill|take\s*away|takeaway|menu|dosa|biryani|thali/.test(t)) return 'restaurant';
  if (/credit\s*card|statement|minimum.*due|total.*due|credit\s*limit|outstanding\s*balance/.test(t)) return 'credit_card';
  if (/grocery|supermarket|dmart|bigbasket|mrt|mrp|net.*amount.*items/.test(t)) return 'grocery';
  if (/hotel|resort|folio|room\s*(?:charge|tariff|rate)|check.?in|check.?out/.test(t)) return 'hotel';
  if (/lpg|cylinder|indane|bharat\s*gas|igl|mgl|piped\s*gas/.test(t)) return 'gas';
  return null;
}

/** Returns the best matching sample bill for a given type */
export function getBestMatchingSample(type: BillType): BillData {
  return SAMPLE_BILLS.find(b => b.type === type) ?? SAMPLE_BILLS[0];
}

// ─── Main Scan Pipeline ──────────────────────────────────────────────────────

export interface ScanResult {
  bill: BillData;
  ocrText?: string;
  needsBillTypePicker?: boolean;  // true if type could not be determined
}

/**
 * Full scanning pipeline for a real uploaded image.
 * Runs actual Tesseract.js OCR and parses the result.
 */
export async function scanRealBill(
  imageDataUrl: string,
  fileName: string,
  hintedType: BillType | null,
  onProgress: (p: ScanProgressCallback) => void
): Promise<ScanResult> {

  // Step 1 — OCR
  onProgress({ stepIndex: 1, totalSteps: 4, statusText: 'Scanning bill with OCR engine…', subText: `Reading "${fileName}"` });

  let ocrText = '';
  let ocrConfidence = 0;

  try {
    const ocr = await extractTextFromImage(imageDataUrl, (status, pct) => {
      onProgress({
        stepIndex: 1, totalSteps: 4,
        statusText: status,
        subText: `OCR progress: ${pct}%`
      });
    });
    ocrText = ocr.text;
    ocrConfidence = ocr.confidence;
  } catch (err) {
    console.warn('OCR failed, using filename detection:', err);
  }

  // Step 2 — Detect type
  onProgress({ stepIndex: 2, totalSteps: 4, statusText: 'Identifying bill type…', subText: 'Matching patterns against Indian bill formats' });
  await delay(400);

  const detectedType = hintedType
    ?? detectBillTypeFromFilename(fileName)
    ?? (ocrText ? detectBillTypeFromText(ocrText) : null);

  // If still no type detected, signal that picker is needed
  if (!detectedType) {
    return { bill: getBestMatchingSample('restaurant'), ocrText, needsBillTypePicker: true };
  }

  // Step 3 — Parse and audit
  onProgress({
    stepIndex: 3, totalSteps: 4,
    statusText: 'Auditing against Indian consumer law…',
    subText: detectedType === 'restaurant'
      ? 'Checking CCPA 2022 service charge rules & 5% GST'
      : detectedType === 'electricity'
      ? 'Verifying SERC slab rates (TN / Kerala / Telangana)'
      : detectedType === 'credit_card'
      ? 'Calculating true APR and hidden charges'
      : detectedType === 'hotel'
      ? 'Checking 12% vs 18% hotel GST slab'
      : 'Verifying applicable GST and statutory rules'
  });
  await delay(500);

  let parsedBill: BillData;
  if (ocrText && ocrText.trim().length > 50 && ocrConfidence > 30) {
    // Good OCR — use real parsed data
    parsedBill = parseBillFromOCR(ocrText, detectedType);
  } else {
    // Poor OCR quality — use sample as template
    parsedBill = { ...getBestMatchingSample(detectedType), id: `scanned-${Date.now()}` };
    parsedBill.flags = [
      {
        id: 'ocr-low-quality',
        severity: 'warning',
        title: '⚠ Image Quality Too Low for Full Scan',
        description: 'The uploaded image was not clear enough for full text extraction. Try uploading a higher-resolution photo in good lighting. Showing the standard breakdown for this bill type.',
        lawCitation: ''
      },
      ...parsedBill.flags
    ];
  }

  // Step 4 — Done
  onProgress({ stepIndex: 4, totalSteps: 4, statusText: 'Generating plain-language breakdown…', subText: 'Translating jargon into actionable insights' });
  await delay(400);

  return { bill: parsedBill, ocrText };
}

/**
 * For sample chips (demo mode) — returns a well-known sample bill with animation.
 */
export async function scanSampleBill(
  sampleId: string,
  fileName: string,
  onProgress: (p: ScanProgressCallback) => void
): Promise<BillData> {
  const steps: ScanProgressCallback[] = [
    { stepIndex: 1, totalSteps: 4, statusText: 'Loading sample bill data…', subText: `"${fileName.substring(0, 30)}"` },
    { stepIndex: 2, totalSteps: 4, statusText: 'Matching statutory tariff schedules…', subText: 'Applying state-specific rules' },
    { stepIndex: 3, totalSteps: 4, statusText: 'Auditing against Indian consumer law…', subText: 'Checking compliance flags' },
    { stepIndex: 4, totalSteps: 4, statusText: 'Generating plain-language breakdown…', subText: 'Ready in a moment…' }
  ];
  for (const step of steps) {
    onProgress(step);
    await delay(500);
  }
  return SAMPLE_BILLS.find(b => b.id === sampleId) ?? SAMPLE_BILLS[0];
}

// ─── Util ────────────────────────────────────────────────────────────────────
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Keep legacy export for any existing callers
export async function simulateBillScan(
  billId: string | null,
  fileName: string,
  onProgress: (p: ScanProgressCallback) => void,
  billType?: BillType
): Promise<BillData> {
  if (billId) return scanSampleBill(billId, fileName, onProgress);
  const steps: ScanProgressCallback[] = [
    { stepIndex: 1, totalSteps: 4, statusText: 'Extracting text…', subText: `Reading "${fileName}"` },
    { stepIndex: 2, totalSteps: 4, statusText: 'Matching tariff rules…', subText: 'Applying GST and state schedules' },
    { stepIndex: 3, totalSteps: 4, statusText: 'Auditing compliance…', subText: 'Checking flags' },
    { stepIndex: 4, totalSteps: 4, statusText: 'Generating breakdown…', subText: 'Almost done' }
  ];
  for (const step of steps) { onProgress(step); await delay(500); }
  return billType ? getBestMatchingSample(billType) : getBestMatchingSample('restaurant');
}

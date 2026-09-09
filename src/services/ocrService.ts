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
import { CategoryMismatchError, isLLMScanSupported, requiresPdfText, scanBillTextWithLLM, scanBillWithLLM } from './llmScanService';

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
// Hotel and Gas are temporarily disabled app-wide — not in active use yet (see
// BillTypePicker.tsx). Auto-detection deliberately skips them below so an upload
// that would've matched one of those keywords falls through to the picker (which
// only offers active categories) instead of silently scanning as a disabled type.
// Credit Card is active but text-only — see requiresPdfText() and its handling below.
export function detectBillTypeFromFilename(fileName: string): BillType | null {
  const n = fileName.toLowerCase();
  if (/electricit|\beb\b|tnpdcl|kseb|tangedco|tsspdcl|tsnpdcl|bescom|msedcl|kwh/.test(n)) return 'electricity';
  // "restaur" prefix catches: restaurant, restaurent, restauran, restaurateur
  if (/restaur|cafe|dining|zomato|swiggy|saravana|sangeetha|geeraas|bhavan|biryani|\bdosa\b|idly|thali|eatery|\bfood\b|canteen/.test(n)) return 'restaurant';
  if (/grocer|supermarket|dmart|bigbasket|reliance.*fresh|kirana/.test(n)) return 'grocery';
  if (/credit.?card|hdfc.*card|icici.*card|axis.*card|sbi.*card|idfc.*card|\bemi\b|card.*stmt|card.*statement/.test(n)) return 'credit_card';
  return null;
}

/**
 * Detects bill type from OCR-extracted text
 */
function detectBillTypeFromText(text: string): BillType | null {
  const t = text.toLowerCase();
  if (/geeraas|restaurant|restaurent|saravana|sangeetha|cafe|dining|food\s*bill|take\s*away|takeaway|menu|dosa|idly|vadai|biryani|thali|cgst|sgst/.test(t)) return 'restaurant';
  if (/tangedco|tnpdcl|kseb|tsspdcl|bescom|electricity|units\s*consumed|kwh|tariff\s*slab|current\s*consumption|service\s*connection|minnagam|tnebenet/.test(t)) return 'electricity';
  if (/grocery|supermarket|dmart|bigbasket|mrt|mrp|net.*amount.*items/.test(t)) return 'grocery';
  if (/credit\s*card\s*statement|total\s*amount\s*due|minimum\s*amount\s*due|credit\s*limit|statement\s*period/.test(t)) return 'credit_card';
  return null;
}

/** Returns the best matching sample bill for a given type */
export function getBestMatchingSample(type: BillType): BillData {
  return SAMPLE_BILLS.find(b => b.type === type) ?? SAMPLE_BILLS[0];
}

/**
 * An honest "couldn't read this" result — no borrowed numbers from an unrelated
 * sample bill. Substituting a real sample's total/items here (as this used to do)
 * reads as a genuine result for a different bill, which is actively misleading:
 * a user scanning their own ₹693 receipt seeing a confident "₹80" with a small
 * warning banner easily mistakes it for a (wrong) read of their bill, not a
 * stand-in for a bill that couldn't be read at all.
 */
function buildUnreadablePlaceholder(type: BillType, title: string, description: string): BillData {
  return {
    id: `scanned-${Date.now()}`,
    type,
    state: 'national',
    billerName: 'Could Not Read This Bill',
    categoryLabel: getBestMatchingSample(type).categoryLabel,
    billNumber: '-',
    billingCycle: '-',
    billDate: '-',
    dueDate: '-',
    totalAmount: 0,
    summaryPlain: 'We could not reliably read this bill. Please retake a clearer photo in good light, or re-upload the original file.',
    lineItems: [],
    flags: [{ id: 'ocr-low-quality', severity: 'warning', title, description, lawCitation: '' }]
  };
}

/** Credit card (and any future text-only type) genuinely can't be read from a photo —
 *  a camera shot only captures one page, and statements are routinely 3+ pages. */
function buildPdfRequiredPlaceholder(type: BillType): BillData {
  return {
    id: `scanned-${Date.now()}`,
    type,
    state: 'national',
    billerName: 'PDF Statement Needed',
    categoryLabel: 'Credit Card Statement',
    billNumber: '-',
    billingCycle: '-',
    billDate: '-',
    dueDate: '-',
    totalAmount: 0,
    summaryPlain: 'Credit card statements need to be uploaded as the original PDF, not a photo — a camera shot only captures one page, and statements usually run several.',
    lineItems: [],
    flags: [{
      id: 'pdf-required',
      severity: 'warning',
      title: '⚠ Please Upload the PDF Statement',
      description: 'A photo can only capture one page, but credit card statements are usually 3+ pages. Download the PDF statement from your bank\'s app/website (Statements section) and upload that file instead — every page will be read.',
      lawCitation: ''
    }]
  };
}

/** The model itself determined the scanned content doesn't match the category the
 *  user picked (e.g. an electricity bill scanned as "grocery") — a dedicated result
 *  distinct from "unreadable", since the photo is likely fine and the fix is to
 *  re-pick the category, not retake the photo. */
function buildCategoryMismatchPlaceholder(type: BillType): BillData {
  return {
    id: `scanned-${Date.now()}`,
    type,
    state: 'national',
    billerName: 'Wrong Category Selected?',
    categoryLabel: getBestMatchingSample(type).categoryLabel,
    billNumber: '-',
    billingCycle: '-',
    billDate: '-',
    dueDate: '-',
    totalAmount: 0,
    summaryPlain: `This doesn't look like a "${getBestMatchingSample(type).categoryLabel}" bill. Please double-check the category and try again.`,
    lineItems: [],
    flags: [{
      id: 'category-mismatch',
      severity: 'warning',
      title: "⚠ This Doesn't Look Like the Selected Category",
      description: `We read the photo/file, but its contents don't match "${getBestMatchingSample(type).categoryLabel}". Tap "Category" below to pick the correct bill type — no need to retake the photo.`,
      lawCitation: ''
    }]
  };
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
  imageDataUrl: string | undefined,
  fileName: string,
  hintedType: BillType | null,
  onProgress: (p: ScanProgressCallback) => void,
  pdfText?: string
): Promise<ScanResult> {

  // Prefer the LLM path when it's configured and supports this bill type. Two modes:
  //  - Text-based types (credit_card): need a real PDF with extractable text — a
  //    photo can't capture a multi-page statement, so this path requires pdfText
  //    up front and shows a clear "upload the PDF" message rather than attempting
  //    (and failing on) a single-page photo scan.
  //  - Image-based types (restaurant/grocery/electricity): read the photo directly.
  // Either way, falls straight through to the existing OCR pipeline below on any
  // failure (network error, endpoint not deployed, model couldn't read it, etc.)
  // so nothing regresses if the backend isn't configured or is temporarily down.
  if (hintedType && isLLMScanSupported(hintedType)) {
    if (requiresPdfText(hintedType)) {
      if (!pdfText || pdfText.trim().length < 50) {
        return { bill: buildPdfRequiredPlaceholder(hintedType) };
      }
      onProgress({ stepIndex: 1, totalSteps: 4, statusText: 'Reading statement with AI…', subText: `Analysing "${fileName}" (all pages)` });
      try {
        const llmBill = await scanBillTextWithLLM(pdfText, hintedType, imageDataUrl);
        onProgress({ stepIndex: 2, totalSteps: 4, statusText: 'Verifying rates & statutory rules…', subText: 'Cross-checking against RBI guidelines' });
        await delay(200);
        onProgress({ stepIndex: 3, totalSteps: 4, statusText: 'Auditing against Indian consumer law…', subText: 'Checking for hidden charges' });
        await delay(200);
        onProgress({ stepIndex: 4, totalSteps: 4, statusText: 'Generating plain-language breakdown…', subText: 'Almost done' });
        await delay(200);
        return { bill: llmBill };
      } catch (err) {
        if (err instanceof CategoryMismatchError) {
          // Retrying the same wrong category via regex would be equally pointless —
          // surface the mismatch immediately instead of falling through to OCR.
          return { bill: buildCategoryMismatchPlaceholder(hintedType) };
        }
        console.warn('LLM text scan failed, falling back to regex parsing of the same PDF text:', err);
        // ocrText below is seeded from this same pdfText, so the regex-based
        // buildCreditCard() fallback still has real extracted text to work with.
      }
    } else if (imageDataUrl) {
      onProgress({ stepIndex: 1, totalSteps: 4, statusText: 'Reading bill with AI…', subText: `Analysing "${fileName}"` });
      try {
        const llmBill = await scanBillWithLLM(imageDataUrl, hintedType);
        onProgress({ stepIndex: 2, totalSteps: 4, statusText: 'Verifying GST & statutory rules…', subText: 'Cross-checking against Indian consumer law' });
        await delay(200);
        onProgress({ stepIndex: 3, totalSteps: 4, statusText: 'Auditing against Indian consumer law…', subText: 'Checking for overcharges & illegal fees' });
        await delay(200);
        onProgress({ stepIndex: 4, totalSteps: 4, statusText: 'Generating plain-language breakdown…', subText: 'Almost done' });
        await delay(200);
        return { bill: llmBill };
      } catch (err) {
        if (err instanceof CategoryMismatchError) {
          // Retrying the same wrong category via OCR/regex would be equally
          // pointless — surface the mismatch immediately instead.
          return { bill: buildCategoryMismatchPlaceholder(hintedType) };
        }
        console.warn('LLM scan failed, falling back to OCR pipeline:', err);
      }
    }
  }

  let ocrText = pdfText || '';
  let ocrConfidence: number | undefined;

  // Step 1 — OCR (only if pdfText not already extracted)
  if (!ocrText && imageDataUrl) {
    onProgress({ stepIndex: 1, totalSteps: 4, statusText: 'Scanning bill with OCR engine…', subText: `Reading "${fileName}"` });
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
  } else if (pdfText) {
    onProgress({ stepIndex: 1, totalSteps: 4, statusText: 'Extracting text from PDF invoice…', subText: `Reading "${fileName}"` });
    await delay(300);
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
  // Always attempt real parsing as long as we have meaningful text.
  // Low OCR confidence often still gives usable text for bill parsing —
  // only treat it as unreadable below a very low bar (empirically, legible
  // thermal-paper receipts still often score ~60-70% due to print texture).
  const veryLowConfidence = ocrConfidence !== undefined && ocrConfidence < 25;

  if (ocrText && ocrText.trim().length > 20 && !veryLowConfidence) {
    parsedBill = parseBillFromOCR(ocrText, detectedType);

    // If parsing extracted totalAmount = 0, this bill genuinely couldn't be read —
    // show that honestly instead of a different bill's real numbers.
    if (!parsedBill.totalAmount || parsedBill.totalAmount === 0) {
      parsedBill = buildUnreadablePlaceholder(
        detectedType,
        '⚠ Image Quality Too Low for Full Extraction',
        'The uploaded image was not clear enough to reliably extract the total or line items. Try a higher-resolution photo in good lighting, or edit the amounts in manually.'
      );
    }
  } else {
    // No usable OCR text — genuinely unreadable, say so rather than showing a stand-in bill's numbers
    parsedBill = buildUnreadablePlaceholder(
      detectedType,
      '⚠ Photo / Document Blurry or Unreadable',
      'The uploaded file/photo was too blurry or dark to extract text. Please re-take a clear photo in good light or re-upload the original document.'
    );
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

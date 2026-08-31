import { BillData, BillType } from '../types/bill';
import { SAMPLE_BILLS } from '../data/sampleBills';

export interface ScanProgressCallback {
  stepIndex: number;
  totalSteps: number;
  statusText: string;
  subText: string;
}

/**
 * Maps filename keywords to a bill type.
 * Uses PREFIX matches to catch common misspellings:
 *   restaur → restaurant / restaurent / restauran
 *   electricit → electricity / electrical
 *   grocer → grocery / groceries
 */
export function detectBillTypeFromFilename(fileName: string): BillType | null {
  const name = fileName.toLowerCase();

  // Electricity — DISCOM names or power-related keywords
  if (/electricit|\beb\b|tnpdcl|kseb|tangedco|tsspdcl|tsnpdcl|bescom|msedcl|torrent|wesco|cesu|power.?bill|energy.?bill|unit.*kwh|kwh/.test(name)) {
    return 'electricity';
  }
  // Restaurant — broad prefix 'restaur' catches restaurant / restaurent / restauran
  if (/restaur|cafe|dining|zomato|swiggy|saravana|sangeetha|bhavan|biryani|\bdosa\b|idly|thali|eatery|\bmess\b|canteen|bakery|\bfood\b|hotel.*food|receipt.*food/.test(name)) {
    return 'restaurant';
  }
  // Credit Card & EMI
  if (/credit.?card|hdfc.*card|icici.*card|axis.*card|sbi.*card|kotak.*card|\bemi\b|card.*stmt|card.*statement/.test(name)) {
    return 'credit_card';
  }
  // Grocery / Supermarket
  if (/grocer|supermarket|dmart|bigbasket|reliance.*fresh|spencer|star.?bazar|kirana|vegetables/.test(name)) {
    return 'grocery';
  }
  // Hotel Stay
  if (/\bhotel\b|resort|\binn\b|lodge|taj.*hotel|marriott|oberoi|radisson|hyatt|hilton|folio|accommodation/.test(name)) {
    return 'hotel';
  }
  // Gas
  if (/\bgas\b|\blpg\b|indane|\bigl\b|\bmgl\b|\bpng\b|cylinder|bharat.*gas|piped.*gas/.test(name)) {
    return 'gas';
  }
  return null;
}

/** Returns the best matching sample bill for a given type */
export function getBestMatchingSample(type: BillType): BillData {
  const match = SAMPLE_BILLS.find(b => b.type === type);
  return match || SAMPLE_BILLS[0];
}

export async function simulateBillScan(
  billId: string | null,
  fileName: string,
  onProgress: (progress: ScanProgressCallback) => void,
  billType?: BillType
): Promise<BillData> {

  // Determine which sample to use
  const resolvedType = billType ?? (billId ? null : detectBillTypeFromFilename(fileName));

  const steps: ScanProgressCallback[] = [
    {
      stepIndex: 1,
      totalSteps: 4,
      statusText: 'Extracting text and line items…',
      subText: `Reading "${fileName.length > 28 ? fileName.substring(0, 25) + '…' : fileName}"`
    },
    {
      stepIndex: 2,
      totalSteps: 4,
      statusText: 'Matching statutory tariff slabs…',
      subText: resolvedType === 'electricity'
        ? 'Verifying against state electricity schedules (TN / Kerala / Telangana)'
        : resolvedType === 'restaurant'
        ? 'Checking CCPA 2022 service charge rules & 5% GST compliance'
        : resolvedType === 'credit_card'
        ? 'Auditing "No-Cost EMI" true APR and hidden processing charges'
        : resolvedType === 'grocery'
        ? 'Cross-checking MRP vs GST slabs (0%, 5%, 12%, 18%)'
        : resolvedType === 'hotel'
        ? 'Verifying hotel GST slab (12% vs 18% based on room tariff)'
        : resolvedType === 'gas'
        ? 'Checking domestic PNG / LPG 5% GST compliance'
        : 'Verifying against applicable GST Council & SERC schedules'
    },
    {
      stepIndex: 3,
      totalSteps: 4,
      statusText: 'Checking compliance & "Is this normal?" flags…',
      subText: 'Auditing statutory charges, hidden fees, and overcharges'
    },
    {
      stepIndex: 4,
      totalSteps: 4,
      statusText: 'Generating plain-language breakdown…',
      subText: 'Translating jargon into actionable savings insights'
    }
  ];

  for (let i = 0; i < steps.length; i++) {
    onProgress(steps[i]);
    await new Promise((resolve) => setTimeout(resolve, 650));
  }

  // If a specific sample bill ID was requested, return it directly
  if (billId) {
    const found = SAMPLE_BILLS.find((b) => b.id === billId);
    if (found) return found;
  }

  // If we detected or were given a bill type, return the best matching sample
  if (resolvedType) {
    return getBestMatchingSample(resolvedType);
  }

  // Fallback: return the restaurant sample as a sensible default for unrecognised uploads
  // (picker should have been shown before reaching here, but just in case)
  return getBestMatchingSample('restaurant');
}

import { BillData, BillType } from '../types/bill';
import { SAMPLE_BILLS } from '../data/sampleBills';

export interface ScanProgressCallback {
  stepIndex: number;
  totalSteps: number;
  statusText: string;
  subText: string;
}

/** Maps filename / content keywords to a bill type */
export function detectBillTypeFromFilename(fileName: string): BillType | null {
  const name = fileName.toLowerCase();

  if (/electricity|eb|tnpdcl|kseb|tangedco|tsspdcl|tsnpdcl|bescom|msedcl|torrent|wesco|cesu|bill.*unit|unit.*kwh|power|energy/.test(name)) {
    return 'electricity';
  }
  if (/restaurant|cafe|hotel.*food|dining|zomato|swiggy|saravana|bhavan|biryani|dosa|idly|thali|eatery|mess|canteen|bakery|food/.test(name)) {
    return 'restaurant';
  }
  if (/credit.?card|hdfc.*card|icici.*card|axis.*card|sbi.*card|kotak.*card|emi|statement|card.*stmt/.test(name)) {
    return 'credit_card';
  }
  if (/grocery|supermarket|dmart|bigbasket|reliance.*fresh|spencer|more.*retail|star.?bazar|vegetables|kirana/.test(name)) {
    return 'grocery';
  }
  if (/hotel|resort|inn|lodge|taj|marriott|oberoi|itc|radisson|hyatt|hilton|stay|accommodation|folio/.test(name)) {
    return 'hotel';
  }
  if (/gas|lpg|indane|igl|mgl|png|cylinder|bharat.*gas|hp.*gas|piped.*gas|fuel/.test(name)) {
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

  // Fallback default
  return SAMPLE_BILLS[0];
}

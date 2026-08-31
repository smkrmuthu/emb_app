import { BillData } from '../types/bill';
import { SAMPLE_BILLS } from '../data/sampleBills';

export interface ScanProgressCallback {
  stepIndex: number;
  totalSteps: number;
  statusText: string;
  subText: string;
}

export async function simulateBillScan(
  billId: string | null,
  fileName: string,
  onProgress: (progress: ScanProgressCallback) => void
): Promise<BillData> {
  const steps: ScanProgressCallback[] = [
    { stepIndex: 1, totalSteps: 4, statusText: 'Extracting text and line items…', subText: `Processing ${fileName} via Indian OCR engine` },
    { stepIndex: 2, totalSteps: 4, statusText: 'Matching statutory tariff slabs…', subText: 'Verifying against state electricity / GST Council schedules' },
    { stepIndex: 3, totalSteps: 4, statusText: 'Checking compliance & "is this normal?" flags…', subText: 'Auditing service charge, True APR, and hidden processing fees' },
    { stepIndex: 4, totalSteps: 4, statusText: 'Generating plain Indian language breakdown…', subText: 'Translating jargon into actionable savings insights' }
  ];

  for (let i = 0; i < steps.length; i++) {
    onProgress(steps[i]);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  if (billId) {
    const found = SAMPLE_BILLS.find((b) => b.id === billId);
    if (found) return found;
  }

  // Fallback default bill if custom uploaded
  return SAMPLE_BILLS[0];
}

export type BillType = 
  | 'electricity' 
  | 'restaurant' 
  | 'grocery' 
  | 'hotel' 
  | 'credit_card' 
  | 'gas';

export type IndianState = 'tamil_nadu' | 'kerala' | 'telangana' | 'national';

export type Language = 'en' | 'hi' | 'ta' | 'te' | 'ml';

export type FlagSeverity = 'good' | 'warning' | 'danger' | 'info';

export type DisputeType = 
  | 'service_charge' 
  | 'emi_misleading' 
  | 'eb_wrong_slab' 
  | 'credit_card_hidden_fee' 
  | 'mrp_violation' 
  | 'hotel_illegal_tax';

export interface LineItem {
  id: string;
  label: string;
  amount: number;
  rate?: number;
  units?: number | string;
  unitLabel?: string;
  isSubItem?: boolean;
  isFree?: boolean;
  gstRate?: number; // e.g. 0, 5, 12, 18, 28
  flagSeverity?: FlagSeverity;
  flagMessage?: string;
  explanation?: string;
}

export interface BillFlag {
  id: string;
  severity: FlagSeverity;
  title: string;
  description: string;
  savingsPotential?: number;
  actionable?: boolean;
  actionText?: string;
  disputeType?: DisputeType;
  lawCitation?: string; // e.g., "CCPA Guidelines July 2022", "TNERC Tariff Order 2024", "RBI Circular on Processing Fees"
}

export interface EBSlabItem {
  slabRange: string;
  unitsCharged: number;
  ratePerUnit: number;
  totalCost: number;
  isFree?: boolean;
  colorHex?: string;
}

export interface EBDetails {
  state: IndianState;
  discomName: string;
  meterNumber: string;
  consumedUnits: number;
  slabBreakdown: EBSlabItem[];
  fixedCharges: number;
  electricityDuty: number; // usually 5%
  fuelSurcharge: number; // FPPCA
  nextSlabThreshold?: {
    limit: number;
    excessUnits: number;
    excessCost: number;
    potentialSavings: number;
    tip: string;
  };
}

export interface EMIDetails {
  productName: string;
  retailer: string;
  cashPrice: number;
  tenureMonths: number;
  monthlyInstallment: number;
  advertisedRate: number; // 0%
  trueAPR: number; // e.g. 13.8%
  processingFee: number;
  processingFeeGST: number; // 18% of processing fee
  gstOnInterestMonthly: number; // 18% of monthly interest component
  totalGstOnInterest: number;
  totalPaid: number;
  netExtraCostOverCash: number;
  isZeroCostReal: boolean;
  bankName: string;
  verdictStamp: string; // "NOT ZERO COST"
}

export interface GSTDetails {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst?: number;
  effectiveRate: number;
  isCorrectSlab: boolean;
  serviceChargePresent?: boolean;
  serviceChargeAmount?: number;
  serviceChargeGSTAmount?: number;
}

export interface BillData {
  id: string;
  type: BillType;
  state?: IndianState;
  billerName: string;
  billerLogo?: string;
  categoryLabel: string;
  billNumber: string;
  billingCycle: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  summaryPlain: string;
  lineItems: LineItem[];
  flags: BillFlag[];
  ebDetails?: EBDetails;
  emiDetails?: EMIDetails;
  gstDetails?: GSTDetails;
  translations?: Record<Language, {
    summary: string;
    keyPoints: string[];
    actionAdvice: string;
  }>;
}

export interface ReminderItem {
  id: string;
  billId: string;
  billerName: string;
  billType: BillType;
  amount: number;
  dueDate: string;
  daysRemaining: number;
  isPaid: boolean;
  autoPayActive: boolean;
}

export interface DisputeLetterDraft {
  subject: string;
  recipient: string;
  bodyText: string;
  legalReferences: string[];
  recommendedAction: string;
}

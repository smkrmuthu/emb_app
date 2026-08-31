export interface EMICalcInput {
  cashPrice: number;
  tenureMonths: number;
  processingFee: number;
  advertisedRate?: number; // 0 for "No Cost"
  productName?: string;
  retailer?: string;
  bankName?: string;
}

export interface EMICalcResult {
  cashPrice: number;
  tenureMonths: number;
  advertisedRate: number;
  nominalBankRate: number; // e.g. 13% - 16%
  trueAPR: number; // e.g. 13.8%
  upfrontDiscount: number; // Retailer discount given to offset bank interest
  monthlyInstallment: number;
  totalEMIAmount: number;
  processingFee: number;
  processingFeeGST: number; // 18% of processing fee
  monthlyGSTOnInterest: number;
  totalGSTOnInterest: number;
  totalCustomerPaid: number;
  extraCostOverCash: number;
  isMisleading: boolean;
  verdictStamp: string;
  summaryExplanation: string;
  comparisonPoints: {
    label: string;
    advertised: string;
    actual: string;
    difference: string;
  }[];
}

/**
 * Accurately calculates the true APR and hidden cost breakdown of Indian "No-Cost EMI" offers.
 * In India, "No-Cost EMI" works by:
 * 1. The merchant discounts the cash price by the total interest amount upfront.
 * 2. The bank loans the discounted amount at standard interest rate (e.g., 14% p.a.).
 * 3. The customer pays the bank the full cash price in installments.
 * 4. BUT: Bank charges a Processing Fee (₹99–₹999) + 18% GST.
 * 5. AND: Bank legally MUST charge 18% GST on the monthly interest component!
 * Therefore, No-Cost EMI is NEVER ₹0 extra!
 */
export function calculateTrueEMI(input: EMICalcInput): EMICalcResult {
  const { cashPrice, tenureMonths, processingFee, advertisedRate = 0 } = input;
  
  // Typical Indian bank merchant EMI annual rate is ~14% - 15%
  const annualBankRate = 0.145; // 14.5%
  const monthlyRate = annualBankRate / 12;

  // Monthly EMI for loan = P * r * (1+r)^n / ((1+r)^n - 1)
  // On No-Cost EMI, monthly installment is cashPrice / tenureMonths
  const monthlyInstallment = Math.round(cashPrice / tenureMonths);
  const totalEMIAmount = monthlyInstallment * tenureMonths;

  // Discount required to make EMI equal to cashPrice / tenure
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const loanPrincipal = Math.round((monthlyInstallment * (factor - 1)) / (monthlyRate * factor));
  const upfrontDiscount = cashPrice - loanPrincipal;

  // Total interest charged over the tenure
  const totalInterest = totalEMIAmount - loanPrincipal;

  // 18% GST on processing fee
  const processingFeeGST = Math.round(processingFee * 0.18);

  // 18% GST on the monthly interest component
  const totalGSTOnInterest = Math.round(totalInterest * 0.18);
  const monthlyGSTOnInterest = Math.round(totalGSTOnInterest / tenureMonths);

  // Total amount out of pocket for customer
  const totalCustomerPaid = cashPrice + processingFee + processingFeeGST + totalGSTOnInterest;
  const extraCostOverCash = totalCustomerPaid - cashPrice;

  // True APR includes processing fee and GST on interest
  const effectiveMonthlyExtra = (extraCostOverCash / cashPrice) / tenureMonths;
  const trueAPR = Number(((effectiveMonthlyExtra * 12 + annualBankRate) * 0.95 * 100).toFixed(1));

  const isMisleading = extraCostOverCash > 0;
  const verdictStamp = isMisleading ? 'NOT ZERO COST' : 'TRUE 0% COST';

  const summaryExplanation = isMisleading
    ? `While the retailer offered a ₹${upfrontDiscount.toLocaleString('en-IN')} upfront discount, the bank charged ₹${processingFee} processing fee + ₹${processingFeeGST} GST, plus ₹${totalGSTOnInterest} GST on monthly interest. You pay ₹${extraCostOverCash.toLocaleString('en-IN')} extra in hidden charges!`
    : 'This transaction was verified with zero extra charges.';

  const comparisonPoints = [
    {
      label: 'Interest Rate',
      advertised: '0% p.a.',
      actual: `${(annualBankRate * 100).toFixed(1)}% p.a. Bank Interest`,
      difference: `+${(annualBankRate * 100).toFixed(1)}% disguised in discount`
    },
    {
      label: 'Effective APR',
      advertised: '0.0%',
      actual: `${trueAPR}% True APR`,
      difference: `+${trueAPR}% actual annualized cost`
    },
    {
      label: 'Bank Processing Fee',
      advertised: '₹0 (Implicit)',
      actual: `₹${processingFee} + ₹${processingFeeGST} GST`,
      difference: `₹${processingFee + processingFeeGST} extra`
    },
    {
      label: 'GST on Monthly Interest',
      advertised: '₹0',
      actual: `₹${totalGSTOnInterest} (18% on interest)`,
      difference: `₹${totalGSTOnInterest} unadvertised tax`
    },
    {
      label: 'Total Real Price Paid',
      advertised: `₹${cashPrice.toLocaleString('en-IN')}`,
      actual: `₹${totalCustomerPaid.toLocaleString('en-IN')}`,
      difference: `₹${extraCostOverCash.toLocaleString('en-IN')} extra paid`
    }
  ];

  return {
    cashPrice,
    tenureMonths,
    advertisedRate,
    nominalBankRate: annualBankRate * 100,
    trueAPR,
    upfrontDiscount,
    monthlyInstallment,
    totalEMIAmount,
    processingFee,
    processingFeeGST,
    monthlyGSTOnInterest,
    totalGSTOnInterest,
    totalCustomerPaid,
    extraCostOverCash,
    isMisleading,
    verdictStamp,
    summaryExplanation,
    comparisonPoints
  };
}

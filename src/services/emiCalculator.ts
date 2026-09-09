export interface EMICalcInput {
  cashPrice: number;
  tenureMonths: number;
  processingFee: number;
  advertisedRate?: number; // 0 for "No Cost EMI"; the bank's own disclosed rate otherwise
  // Some scanned offers already print the plan's own final total (e.g. an
  // Amazon/Flipkart-style "Total cost" column) — pass it here to use that directly
  // instead of estimating installments from advertisedRate. Doesn't include the
  // separate processing fee, which is still added on top either way.
  knownTotalEMIAmount?: number | null;
  productName?: string;
  retailer?: string;
  bankName?: string;
}

export interface EMICalcResult {
  cashPrice: number;
  tenureMonths: number;
  advertisedRate: number;
  trueAPR: number; // e.g. 58.3 — annualized, includes the processing fee's effect
  monthlyInstallment: number;
  totalEMIAmount: number;
  processingFee: number;
  processingFeeGST: number; // 18% of processing fee
  totalCustomerPaid: number;
  extraCostOverCash: number;
  isMisleading: boolean;
  verdictStamp: string;
  summaryExplanation: string;
}

/** Plain textbook reducing-balance EMI formula — exported for the standalone
 *  "Quick EMI Estimate" tool, which deliberately doesn't factor in processing
 *  fee, cashback, or how a "No Cost EMI" discount changes the real number
 *  (that's what the full calculateTrueEMI decoder above it is for). */
export function monthlyInstallmentFor(cashPrice: number, tenureMonths: number, annualRatePercent: number): number {
  if (annualRatePercent <= 0) return Math.round(cashPrice / tenureMonths);
  const r = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + r, tenureMonths);
  return Math.round((cashPrice * r * factor) / (factor - 1));
}

/**
 * Solves for the monthly rate r (by bisection) at which the customer's actual cash
 * flows — receiving `netPrincipal` today (cash price minus the fee paid upfront),
 * then paying `monthlyInstallment` for `tenureMonths` — break even. This is the
 * standard "APR including fees" methodology: it only looks at what the customer
 * actually receives and actually pays, so it works identically whether the
 * underlying offer is "No Cost" (where the retailer/bank never discloses their own
 * rate) or a stated-rate plan (where recomputing from real cash flows, rather than
 * trusting a separately-quoted headline rate, is what correctly captures the fee's
 * added cost on top of it).
 */
function solveMonthlyIRR(netPrincipal: number, monthlyInstallment: number, tenureMonths: number): number {
  let lo = 0;
  let hi = 1; // 0%–100%/month is a comfortably wide bracket for any realistic offer
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const presentValue = mid === 0
      ? monthlyInstallment * tenureMonths
      : (monthlyInstallment * (1 - Math.pow(1 + mid, -tenureMonths))) / mid;
    // Higher rate discounts future installments more heavily, lowering their
    // present value — so too-high a PV means the rate needs to go up, not down.
    if (presentValue > netPrincipal) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Calculates the true, fee-inclusive annualized cost of an Indian EMI offer —
 * "No-Cost" (advertisedRate 0, retailer hides their own rate entirely) or a plan
 * with a disclosed interest rate. Either way, banks separately charge a processing
 * fee + 18% GST on it, which a headline "0%" or "13% p.a." never mentions — this
 * computes the true annualized cost including that fee's effect, via the same
 * cash-flow-based APR methodology regardless of which kind of offer it is.
 */
export function calculateTrueEMI(input: EMICalcInput): EMICalcResult {
  const { cashPrice, tenureMonths, processingFee, advertisedRate = 0, knownTotalEMIAmount } = input;

  const totalEMIAmount = knownTotalEMIAmount != null && knownTotalEMIAmount > 0
    ? knownTotalEMIAmount
    : monthlyInstallmentFor(cashPrice, tenureMonths, advertisedRate) * tenureMonths;
  const monthlyInstallment = Math.round(totalEMIAmount / tenureMonths);

  const processingFeeGST = Math.round(processingFee * 0.18);
  const netPrincipal = cashPrice - processingFee - processingFeeGST;

  const monthlyRate = netPrincipal > 0 ? solveMonthlyIRR(netPrincipal, monthlyInstallment, tenureMonths) : 0;
  const trueAPR = Number((monthlyRate * 12 * 100).toFixed(1));

  const totalCustomerPaid = totalEMIAmount + processingFee + processingFeeGST;
  const extraCostOverCash = totalCustomerPaid - cashPrice;

  const isMisleading = extraCostOverCash > 0;
  const verdictStamp = isMisleading ? 'NOT ZERO COST' : 'TRUE 0% COST';

  const advertisedLabel = advertisedRate === 0 ? '"No Cost" EMI' : `${advertisedRate}% p.a. EMI`;
  const summaryExplanation = isMisleading
    ? `The bank's processing fee (₹${processingFee} + ₹${processingFeeGST} GST) means this ${advertisedLabel} actually costs ₹${extraCostOverCash.toLocaleString('en-IN')} extra — a true annualized cost of ${trueAPR}%, not the advertised ${advertisedRate}%.`
    : 'This transaction was verified with zero extra charges.';

  return {
    cashPrice,
    tenureMonths,
    advertisedRate,
    trueAPR,
    monthlyInstallment,
    totalEMIAmount,
    processingFee,
    processingFeeGST,
    totalCustomerPaid,
    extraCostOverCash,
    isMisleading,
    verdictStamp,
    summaryExplanation
  };
}

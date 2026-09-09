import { IndianState, EBDetails, EBSlabItem } from '../types/bill';
import { EB_TARIFF_DATA } from '../data/tariffData';

/**
 * Dynamically computes Tamil Nadu, Kerala, or Telangana electricity bill breakdown.
 */
export function calculateEBTariff(
  state: IndianState,
  units: number,
  contractedLoadKW?: number,
  phase?: 1 | 3
): EBDetails {
  if (state === 'kerala') {
    return calculateKeralaEB(units, phase ?? 1);
  } else if (state === 'telangana') {
    return calculateTelanganaEB(units, contractedLoadKW ?? 1);
  } else {
    return calculateTamilNaduEB(units);
  }
}

function calculateTamilNaduEB(units: number): EBDetails {
  const slabBreakdown: EBSlabItem[] = [];
  let remaining = units;
  let energyTotal = 0;

  // Slab 1: 0 - 100 units (100% Free by Govt Subsidy)
  const slab1Units = Math.min(remaining, 100);
  slabBreakdown.push({
    slabRange: '0–100 units',
    unitsCharged: slab1Units,
    ratePerUnit: 0.0,
    totalCost: 0,
    isFree: true,
    colorHex: '#2E6E4E'
  });
  remaining = Math.max(0, remaining - 100);

  // Slab 2: 101 - 200 units (Subsidised ₹0 or ₹2.35 based on tier)
  if (remaining > 0) {
    const slab2Units = Math.min(remaining, 100);
    // If total units <= 200, subsidised rate applies
    const rate = units <= 200 ? 0.0 : 2.35;
    const cost = Math.round(slab2Units * rate);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: '101–200 units',
      unitsCharged: slab2Units,
      ratePerUnit: rate,
      totalCost: cost,
      isFree: rate === 0,
      colorHex: '#429367'
    });
    remaining = Math.max(0, remaining - 100);
  }

  // Slab 3: 201 - 400 units (@ ₹4.95)
  if (remaining > 0) {
    const slab3Units = Math.min(remaining, 200);
    const cost = Math.round(slab3Units * 4.95);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: '201–400 units',
      unitsCharged: slab3Units,
      ratePerUnit: 4.95,
      totalCost: cost,
      isFree: false,
      colorHex: '#A9812E'
    });
    remaining = Math.max(0, remaining - 200);
  }

  // Slab 4: 401 - 500 units (@ ₹6.80)
  if (remaining > 0) {
    const slab4Units = Math.min(remaining, 100);
    const cost = Math.round(slab4Units * 6.80);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: '401–500 units',
      unitsCharged: slab4Units,
      ratePerUnit: 6.80,
      totalCost: cost,
      isFree: false,
      colorHex: '#D97706'
    });
    remaining = Math.max(0, remaining - 100);
  }

  // Slab 5: 501+ units (@ ₹8.40)
  if (remaining > 0) {
    const slab5Units = remaining;
    const cost = Math.round(slab5Units * 8.40);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: '501+ units',
      unitsCharged: slab5Units,
      ratePerUnit: 8.40,
      totalCost: cost,
      isFree: false,
      colorHex: '#B33A2E'
    });
  }

  const electricityDuty = Math.round(energyTotal * 0.05);
  const fuelSurcharge = Math.round(units * 0.07);

  // Threshold alert check
  let nextSlabThreshold;
  if (units > 500) {
    const excessUnits = units - 500;
    const potentialSavings = Math.round(excessUnits * (8.40 - 6.80) + 400);
    nextSlabThreshold = {
      limit: 500,
      excessUnits,
      excessCost: Math.round(excessUnits * 8.40),
      potentialSavings,
      tip: `Staying under 500 units next cycle keeps you out of the top ₹8.40 slab — worth roughly ₹${potentialSavings} in savings.`
    };
  } else if (units > 400) {
    const excessUnits = units - 400;
    nextSlabThreshold = {
      limit: 400,
      excessUnits,
      excessCost: Math.round(excessUnits * 6.80),
      potentialSavings: Math.round(excessUnits * (6.80 - 4.95)),
      tip: `You are in the 401–500 tier. Reducing by ${excessUnits} units drops you into the ₹4.95 bracket.`
    };
  }

  return {
    state: 'tamil_nadu',
    discomName: EB_TARIFF_DATA.tamil_nadu.discomName,
    meterNumber: 'MTR-TN-0499281',
    consumedUnits: units,
    fixedCharges: 0,
    electricityDuty,
    fuelSurcharge,
    slabBreakdown,
    nextSlabThreshold
  };
}

// KSERC Schedule of Tariff for LT-I Domestic, effective 01.04.2025 to 31.03.2027
// (verified against the official Gazette order, cross-checked against a real KSEB
// bill's Electricity Duty figure). Telescopic up to 250 units; above that, Kerala
// switches to a single FLAT rate on every unit — which of five flat rates applies
// depends on which band the TOTAL monthly consumption falls into.
const KERALA_TELESCOPIC = [
  { upTo: 50, rate: 3.35, color: '#2E6E4E' },
  { upTo: 100, rate: 4.25, color: '#429367' },
  { upTo: 150, rate: 5.35, color: '#A9812E' },
  { upTo: 200, rate: 7.20, color: '#D97706' },
  { upTo: 250, rate: 8.50, color: '#B33A2E' }
];
const KERALA_FLAT_BANDS = [
  { upTo: 300, rate: 6.75, fixedSingle: 220, fixedThree: 240 },
  { upTo: 350, rate: 7.60, fixedSingle: 240, fixedThree: 250 },
  { upTo: 400, rate: 7.95, fixedSingle: 260, fixedThree: 260 },
  { upTo: 500, rate: 8.25, fixedSingle: 285, fixedThree: 285 },
  { upTo: Infinity, rate: 9.20, fixedSingle: 310, fixedThree: 310 }
];
const KERALA_TELESCOPIC_FIXED = [
  { upTo: 50, single: 50, three: 130 },
  { upTo: 100, single: 85, three: 175 },
  { upTo: 150, single: 105, three: 205 },
  { upTo: 200, single: 140, three: 215 },
  { upTo: 250, single: 160, three: 235 }
];

function telescopicCost(units: number, slabs: { upTo: number; rate: number }[]): number {
  let total = 0;
  let lower = 0;
  for (const slab of slabs) {
    const unitsInSlab = Math.min(units, slab.upTo) - lower;
    if (unitsInSlab > 0) total += unitsInSlab * slab.rate;
    lower = slab.upTo;
  }
  return Math.round(total);
}

function calculateKeralaEB(units: number, phase: 1 | 3 = 1): EBDetails {
  const slabBreakdown: EBSlabItem[] = [];
  let energyTotal = 0;
  let nextSlabThreshold;
  let fixedCharges: number;

  if (units <= 250) {
    let lower = 0;
    for (const slab of KERALA_TELESCOPIC) {
      if (units <= lower) break;
      const unitsInSlab = Math.min(units, slab.upTo) - lower;
      if (unitsInSlab <= 0) { lower = slab.upTo; continue; }
      const cost = Math.round(unitsInSlab * slab.rate);
      energyTotal += cost;
      slabBreakdown.push({
        slabRange: `${lower + 1}–${Math.min(units, slab.upTo)} units`,
        unitsCharged: unitsInSlab,
        ratePerUnit: slab.rate,
        totalCost: cost,
        colorHex: slab.color
      });
      lower = slab.upTo;
    }
    const bracket = KERALA_TELESCOPIC_FIXED.find(b => units <= b.upTo) ?? KERALA_TELESCOPIC_FIXED[KERALA_TELESCOPIC_FIXED.length - 1];
    fixedCharges = phase === 3 ? bracket.three : bracket.single;
  } else {
    // Non-telescopic: crossing 250 units re-rates EVERY unit at one flat rate —
    // a much sharper cliff than a normal telescopic slab jump.
    const band = KERALA_FLAT_BANDS.find(b => units <= b.upTo) ?? KERALA_FLAT_BANDS[KERALA_FLAT_BANDS.length - 1];
    energyTotal = Math.round(units * band.rate);
    slabBreakdown.push({
      slabRange: `All ${units} units @ ₹${band.rate.toFixed(2)} (Non-Telescopic)`,
      unitsCharged: units,
      ratePerUnit: band.rate,
      totalCost: energyTotal,
      colorHex: '#B33A2E'
    });
    fixedCharges = phase === 3 ? band.fixedThree : band.fixedSingle;

    const cappedCost = telescopicCost(250, KERALA_TELESCOPIC);
    const potentialSavings = energyTotal - cappedCost;
    nextSlabThreshold = {
      limit: 250,
      excessUnits: units - 250,
      excessCost: potentialSavings,
      potentialSavings,
      tip: `Once monthly usage crosses 250 units, Kerala switches from telescopic slabs to a flat ₹${band.rate.toFixed(2)}/unit on your ENTIRE consumption — not just the extra units. Staying at or under 250 units would have cost ~₹${cappedCost} in energy charges instead of ₹${energyTotal}, a difference of ~₹${potentialSavings}.`
    };
  }

  return {
    state: 'kerala',
    discomName: EB_TARIFF_DATA.kerala.discomName,
    meterNumber: 'KL-TVM-88192',
    consumedUnits: units,
    fixedCharges,
    electricityDuty: Math.round(energyTotal * 0.10), // verified: 10% of energy charges
    fuelSurcharge: Math.round(units * 0.19), // Fuel Adjustment Charge — revised periodically by KSERC, treat as approximate
    slabBreakdown,
    nextSlabThreshold
  };
}

// TGERC Retail Supply Tariff Order, Table 2-51 (FY 2025-26, rates retained unchanged
// for FY 2026-27) — verified against two real TGSPDCL domestic bills (fixed charges
// and Electricity Duty both matched exactly). LT-I Domestic is NOT one continuous
// telescopic ladder: the category (A/B/C) is chosen by TOTAL monthly consumption, and
// crossing into a higher category re-rates every unit at that category's own rates —
// not just the units above the threshold.
const TELANGANA_TIERS = [
  { name: 'LT-I(A)', maxTotal: 100, slabs: [{ upTo: 50, rate: 1.95 }, { upTo: 100, rate: 3.10 }] },
  { name: 'LT-I(B)', maxTotal: 200, slabs: [{ upTo: 100, rate: 3.40 }, { upTo: 200, rate: 4.80 }] },
  { name: 'LT-I(C)', maxTotal: Infinity, slabs: [
    { upTo: 200, rate: 5.10 }, { upTo: 300, rate: 7.70 }, { upTo: 400, rate: 9.00 },
    { upTo: 800, rate: 9.50 }, { upTo: Infinity, rate: 10.00 }
  ] }
];
const TELANGANA_COLORS = ['#2E6E4E', '#429367', '#A9812E', '#D97706', '#B33A2E', '#881337'];

function calculateTelanganaEB(units: number, contractedLoadKW: number = 1): EBDetails {
  const tierIndex = TELANGANA_TIERS.findIndex(t => units <= t.maxTotal);
  const tier = TELANGANA_TIERS[tierIndex === -1 ? TELANGANA_TIERS.length - 1 : tierIndex];

  const slabBreakdown: EBSlabItem[] = [];
  let energyTotal = 0;
  let lower = 0;
  tier.slabs.forEach((slab, i) => {
    if (units <= lower) return;
    const unitsInSlab = Math.min(units, slab.upTo) - lower;
    if (unitsInSlab <= 0) { lower = slab.upTo; return; }
    const cost = Math.round(unitsInSlab * slab.rate);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: `${lower + 1}–${Math.min(units, slab.upTo)} units (${tier.name})`,
      unitsCharged: unitsInSlab,
      ratePerUnit: slab.rate,
      totalCost: cost,
      colorHex: TELANGANA_COLORS[i % TELANGANA_COLORS.length]
    });
    lower = slab.upTo;
  });

  let nextSlabThreshold;
  if (tierIndex > 0) {
    const prevTier = TELANGANA_TIERS[tierIndex - 1];
    const boundary = prevTier.maxTotal;
    const cappedCost = telescopicCost(boundary, prevTier.slabs);
    const potentialSavings = energyTotal - cappedCost;
    nextSlabThreshold = {
      limit: boundary,
      excessUnits: units - boundary,
      excessCost: potentialSavings,
      potentialSavings,
      tip: `Because usage went past ${boundary} units, your ENTIRE bill was re-rated into the ${tier.name} category — not just the extra units. Staying at or under ${boundary} units would have cost ~₹${cappedCost} in energy charges instead of ₹${energyTotal}, a difference of ~₹${potentialSavings}.`
    };
  }

  return {
    state: 'telangana',
    discomName: EB_TARIFF_DATA.telangana.discomName,
    meterNumber: 'TS-HYD-55019',
    consumedUnits: units,
    fixedCharges: contractedLoadKW * (units > 800 ? 50 : 10), // ₹/kW of contracted load; ₹50/kW above 800 units
    electricityDuty: Math.round(units * 0.06 * 100) / 100, // ₹0.06/unit flat — verified exactly against two real bills
    fuelSurcharge: 0, // shown as a separate FSA/FCA Charges line on the bill, currently 0 on both real bills seen
    slabBreakdown,
    nextSlabThreshold
  };
}

/**
 * Calculates the compounding debt trap when paying only the minimum due on an Indian credit card.
 */
export function calculateMinimumDueTrap(outstandingBalance: number, monthlyRatePercent: number = 3.6, minDueRatePercent: number = 5) {
  const monthlyRate = monthlyRatePercent / 100;
  const annualAPR = Number((monthlyRatePercent * 12).toFixed(1));
  const minDueRate = minDueRatePercent / 100;

  let balance = outstandingBalance;
  let totalPaid = 0;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 360; // 30 years max cap

  while (balance > 100 && months < maxMonths) {
    months++;
    const monthlyInterest = balance * monthlyRate;
    const gstOnInterest = monthlyInterest * 0.18;
    const minPayment = Math.max(500, balance * minDueRate);

    totalInterest += monthlyInterest + gstOnInterest;
    totalPaid += minPayment;

    balance = balance + monthlyInterest + gstOnInterest - minPayment;
  }

  const neverPaysOff = months >= maxMonths && balance > 100;

  return {
    outstandingBalance,
    monthlyRatePercent,
    annualAPR,
    minDueRatePercent,
    monthsToPayoff: months,
    yearsToPayoff: (months / 12).toFixed(1),
    totalPaid: Math.round(totalPaid),
    totalInterestPaid: Math.round(totalInterest),
    extraMultiplier: (totalPaid / outstandingBalance).toFixed(1),
    neverPaysOff,
    warningSummary: neverPaysOff
      ? `If you pay only the ${minDueRatePercent}% minimum due, the balance never actually clears within 30 years — interest keeps outpacing what a shrinking minimum payment covers.`
      : `If you pay only the ${minDueRatePercent}% minimum due, it will take ${Math.round(months / 12)} years to pay off ₹${outstandingBalance.toLocaleString('en-IN')}, and you will pay ₹${Math.round(totalInterest).toLocaleString('en-IN')} in interest and 18% GST (${(totalPaid / outstandingBalance).toFixed(1)}x the original amount)!`
  };
}

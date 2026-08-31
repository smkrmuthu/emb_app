import { IndianState, EBDetails, EBSlabItem } from '../types/bill';
import { EB_TARIFF_DATA } from '../data/tariffData';

/**
 * Dynamically computes Tamil Nadu, Kerala, or Telangana electricity bill breakdown.
 */
export function calculateEBTariff(state: IndianState, units: number): EBDetails {
  if (state === 'kerala') {
    return calculateKeralaEB(units);
  } else if (state === 'telangana') {
    return calculateTelanganaEB(units);
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

function calculateKeralaEB(units: number): EBDetails {
  const slabBreakdown: EBSlabItem[] = [];
  let energyTotal = 0;

  if (units <= 250) {
    // Telescopic slabs up to 250 units
    let remaining = units;
    const slabs = [
      { range: '0–50 units', cap: 50, rate: 3.25, color: '#2E6E4E' },
      { range: '51–100 units', cap: 50, rate: 4.05, color: '#429367' },
      { range: '101–150 units', cap: 50, rate: 5.10, color: '#A9812E' },
      { range: '151–200 units', cap: 50, rate: 6.80, color: '#D97706' },
      { range: '201–250 units', cap: 50, rate: 8.00, color: '#B33A2E' }
    ];

    for (const slab of slabs) {
      if (remaining <= 0) break;
      const count = Math.min(remaining, slab.cap);
      const cost = Math.round(count * slab.rate);
      energyTotal += cost;
      slabBreakdown.push({
        slabRange: slab.range,
        unitsCharged: count,
        ratePerUnit: slab.rate,
        totalCost: cost,
        colorHex: slab.color
      });
      remaining -= count;
    }
  } else {
    // Non-telescopic penalty: all units billed at flat rate!
    const rate = 9.15;
    energyTotal = Math.round(units * rate);
    slabBreakdown.push({
      slabRange: `All Units (0–${units} @ ₹${rate} Non-Telescopic)`,
      unitsCharged: units,
      ratePerUnit: rate,
      totalCost: energyTotal,
      colorHex: '#B33A2E'
    });
  }

  const fixedCharges = units > 250 ? 160 : 100;
  const electricityDuty = Math.round(energyTotal * 0.10);
  const fuelSurcharge = Math.round(units * 0.19);

  let nextSlabThreshold;
  if (units > 250) {
    const excess = units - 250;
    const normalCostAt250 = 1315; // sum of 250 telescopic
    const potentialSavings = energyTotal - normalCostAt250;
    nextSlabThreshold = {
      limit: 250,
      excessUnits: excess,
      excessCost: Math.round(excess * 9.15),
      potentialSavings,
      tip: `Crossed the 250 unit threshold! In Kerala, exceeding 250 units strips away all lower telescopic tiers and bills every unit at ₹9.15. Saving ${excess} units saves ₹${potentialSavings}!`
    };
  }

  return {
    state: 'kerala',
    discomName: EB_TARIFF_DATA.kerala.discomName,
    meterNumber: 'KL-TVM-88192',
    consumedUnits: units,
    fixedCharges,
    electricityDuty,
    fuelSurcharge,
    slabBreakdown,
    nextSlabThreshold
  };
}

function calculateTelanganaEB(units: number): EBDetails {
  const slabBreakdown: EBSlabItem[] = [];
  let energyTotal = 0;
  let remaining = units;

  const slabs = [
    { range: '0–50 units (Group A)', cap: 50, rate: 1.95, color: '#2E6E4E' },
    { range: '51–100 units (Group A)', cap: 50, rate: 3.10, color: '#429367' },
    { range: '101–200 units (Group B)', cap: 100, rate: 4.80, color: '#A9812E' },
    { range: '201–300 units (Group C)', cap: 100, rate: 7.70, color: '#D97706' },
    { range: '301–400 units (Group C)', cap: 100, rate: 9.00, color: '#B33A2E' },
    { range: '401+ units (Group C)', cap: 9999, rate: 9.50, color: '#881337' }
  ];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, slab.cap);
    const cost = Math.round(count * slab.rate);
    energyTotal += cost;
    slabBreakdown.push({
      slabRange: slab.range,
      unitsCharged: count,
      ratePerUnit: slab.rate,
      totalCost: cost,
      colorHex: slab.color
    });
    remaining -= count;
  }

  const electricityDuty = Math.round(energyTotal * 0.06);
  const fixedCharges = units > 200 ? 80 : 50;

  return {
    state: 'telangana',
    discomName: EB_TARIFF_DATA.telangana.discomName,
    meterNumber: 'TS-HYD-55019',
    consumedUnits: units,
    fixedCharges,
    electricityDuty,
    fuelSurcharge: Math.round(units * 0.12),
    slabBreakdown
  };
}

/**
 * Calculates the compounding debt trap when paying only the minimum due on an Indian credit card.
 */
export function calculateMinimumDueTrap(outstandingBalance: number, monthlyRatePercent: number = 3.6) {
  const monthlyRate = monthlyRatePercent / 100;
  const annualAPR = Number((monthlyRatePercent * 12).toFixed(1));
  const minDueRate = 0.05; // 5% minimum due
  
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

  return {
    outstandingBalance,
    monthlyRatePercent,
    annualAPR,
    monthsToPayoff: months,
    yearsToPayoff: (months / 12).toFixed(1),
    totalPaid: Math.round(totalPaid),
    totalInterestPaid: Math.round(totalInterest),
    extraMultiplier: (totalPaid / outstandingBalance).toFixed(1),
    warningSummary: `If you pay only the 5% minimum due, it will take ${Math.round(months / 12)} years to pay off ₹${outstandingBalance.toLocaleString('en-IN')}, and you will pay ₹${Math.round(totalInterest).toLocaleString('en-IN')} in interest and 18% GST (${(totalPaid / outstandingBalance).toFixed(1)}x the original amount)!`
  };
}

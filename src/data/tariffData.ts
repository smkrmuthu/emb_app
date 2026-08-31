export const EB_TARIFF_DATA = {
  tamil_nadu: {
    stateName: 'Tamil Nadu',
    discomName: 'TANGEDCO (TNPDCL)',
    cycleType: 'Bi-monthly (2 months)',
    telescopic: true,
    dutyRate: 0.05,
    slabs: [
      { range: '0–100 units', maxUnits: 100, rate: 0.0, isFree: true, note: 'State Government Subsidy (100% Free)' },
      { range: '101–200 units', maxUnits: 200, rate: 2.35, isFree: false, note: 'Low consumption tier' },
      { range: '201–400 units', maxUnits: 400, rate: 4.95, isFree: false, note: 'Standard domestic tier' },
      { range: '401–500 units', maxUnits: 500, rate: 6.80, isFree: false, note: 'Upper domestic tier' },
      { range: '501+ units', maxUnits: 9999, rate: 8.40, isFree: false, note: 'High consumption penalty tier' }
    ]
  },
  kerala: {
    stateName: 'Kerala',
    discomName: 'KSEB (Kerala State Electricity Board)',
    cycleType: 'Monthly',
    telescopic: true, // until 250 units, then non-telescopic
    dutyRate: 0.10,
    slabs: [
      { range: '0–50 units', maxUnits: 50, rate: 3.25, isFree: false, note: 'Lifeline consumption' },
      { range: '51–100 units', maxUnits: 100, rate: 4.05, isFree: false, note: 'Tier 2 domestic' },
      { range: '101–150 units', maxUnits: 150, rate: 5.10, isFree: false, note: 'Tier 3 domestic' },
      { range: '151–200 units', maxUnits: 200, rate: 6.80, isFree: false, note: 'Tier 4 domestic' },
      { range: '201–250 units', maxUnits: 250, rate: 8.00, isFree: false, note: 'Max telescopic slab' },
      { range: '251+ units', maxUnits: 9999, rate: 9.15, isFree: false, note: 'Non-telescopic penalty rate on all units' }
    ]
  },
  telangana: {
    stateName: 'Telangana',
    discomName: 'TSSPDCL / TSNPDCL',
    cycleType: 'Monthly',
    telescopic: true,
    dutyRate: 0.06,
    slabs: [
      { range: '0–50 units (Group A)', maxUnits: 50, rate: 1.95, isFree: false, note: 'Group A low consumption' },
      { range: '51–100 units (Group A)', maxUnits: 100, rate: 3.10, isFree: false, note: 'Group A subsidized' },
      { range: '101–200 units (Group B)', maxUnits: 200, rate: 4.80, isFree: false, note: 'Group B standard' },
      { range: '201–300 units (Group C)', maxUnits: 300, rate: 7.70, isFree: false, note: 'Group C higher slab' },
      { range: '301–400 units (Group C)', maxUnits: 400, rate: 9.00, isFree: false, note: 'Group C high consumption' },
      { range: '401+ units (Group C)', maxUnits: 9999, rate: 9.50, isFree: false, note: 'Group C top slab' }
    ]
  }
};

export const GST_RULES = {
  restaurantStandalone: {
    rate: 5,
    name: 'Standalone Restaurant GST',
    condition: '5% total (2.5% CGST + 2.5% SGST) without Input Tax Credit',
    serviceChargeAllowed: false,
    serviceChargeNote: 'CCPA guidelines explicitly state service charge cannot be added by default.'
  },
  restaurantLuxury: {
    rate: 18,
    name: 'Hotel Restaurant (Room Tariff >= ₹7,500)',
    condition: '18% total (9% CGST + 9% SGST) with Input Tax Credit'
  },
  hotelRoom: [
    { maxRate: 1000, gst: 0, label: 'Budget Stay (<= ₹1,000/night)' },
    { maxRate: 7500, gst: 12, label: 'Standard Room (₹1,001 - ₹7,500/night)' },
    { maxRate: 999999, gst: 18, label: 'Luxury Room (> ₹7,500/night)' }
  ],
  groceries: {
    staplesLoose: 0,
    staplesPackaged: 5,
    processedFoods: 12,
    toiletriesHousehold: 18,
    aeratedDrinksLuxury: 28
  },
  gas: {
    domesticLPG: 5,
    commercialLPG: 18,
    domesticPNG: 5
  },
  creditCard: {
    financeChargeMonthlyMin: 3.5, // 3.5% per month
    financeChargeMonthlyMax: 3.75, // 3.75% per month
    gstOnFinance: 18, // 18% GST on all fees, interest and charges
    minDuePercent: 5
  }
};

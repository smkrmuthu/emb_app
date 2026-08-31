import { BillData } from '../types/bill';

export const SAMPLE_BILLS: BillData[] = [
  // ─── Restaurant: Geeraas Restaurant (from real uploaded bill) ─────────────
  {
    id: 'geeraas-restaurant',
    type: 'restaurant',
    state: 'tamil_nadu',
    billerName: 'Geeraas Restaurant – Perungudi',
    categoryLabel: 'Restaurant Bill',
    billNumber: '57833',
    billingCycle: 'Dine In (D10)',
    billDate: '12 Mar 2026',
    dueDate: 'Paid (12 Mar 2026)',
    totalAmount: 80,
    summaryPlain: "Standalone restaurant bill from Geeraas Restaurant, Perungudi, Chennai. 5% GST (2.5% CGST + 2.5% SGST) correctly applied on food items (₹76.18). Grand Total ₹80.00 is math-verified with +0.02 round-off. No illegal service charge.",
    gstDetails: {
      taxableAmount: 76.18,
      cgst: 1.90,
      sgst: 1.90,
      effectiveRate: 5,
      isCorrectSlab: true,
      serviceChargePresent: false,
      serviceChargeAmount: 0
    },
    lineItems: [
      { id: '1', label: 'Idly (2 Pcs) × 1', amount: 33.33, rate: 33.33, units: 1 },
      { id: '2', label: 'Medhu Vadai × 1', amount: 33.33, rate: 33.33, units: 1 },
      { id: '3', label: 'Gas × 1', amount: 9.52, rate: 9.52, units: 1 },
      { id: '4', label: 'Sub Total', amount: 76.18 },
      { id: '5', label: 'CGST @ 2.5%', amount: 1.90, isSubItem: true, gstRate: 2.5 },
      { id: '6', label: 'SGST @ 2.5%', amount: 1.90, isSubItem: true, gstRate: 2.5 },
      { id: '7', label: 'Round off', amount: 0.02, isSubItem: true },
      { id: '8', label: 'Grand Total', amount: 80 }
    ],
    flags: [
      {
        id: 'flag-gst-correct',
        severity: 'good',
        title: '✓ Correct 5% GST Applied (CGST 2.5% + SGST 2.5%)',
        description: 'Standalone restaurants must charge 5% composite GST — 2.5% CGST + 2.5% SGST — without Input Tax Credit. This bill applies ₹3.80 GST on ₹76.18 subtotal — exactly 5%.',
        lawCitation: 'CBIC Notification No. 46/2017 – Central Tax (Rate)'
      },
      {
        id: 'flag-no-sc',
        severity: 'good',
        title: '✓ No Illegal Service Charge Added',
        description: 'No compulsory service charge was added to this bill. Consumer rights are respected under CCPA 2022 Guidelines.',
        lawCitation: 'CCPA Guidelines July 2022'
      },
      {
        id: 'flag-gst-math',
        severity: 'info',
        title: '✓ Grand Total ₹80.00 Math Verified',
        description: 'Sub Total ₹76.18 + CGST ₹1.90 + SGST ₹1.90 + Round-off ₹0.02 = ₹80.00. Arithmetic is 100% correct.',
        lawCitation: 'GST Invoice Rules 2017'
      },
      {
        id: 'flag-tip-info',
        severity: 'info',
        title: 'Tip / Gratuity is Always Voluntary',
        description: 'Tips are entirely optional. Restaurants cannot mandate tips without your consent.',
        lawCitation: 'CCPA Guidelines July 2022'
      }
    ]
  },
  // ─── Restaurant: Sangeetha's Desi Mane (from real uploaded bill) ───────────
  {
    id: 'sangeethas-desi-mane',
    type: 'restaurant',
    state: 'tamil_nadu',
    billerName: "Sangeetha's Desi Mane – Anna Nagar",
    categoryLabel: 'Restaurant Bill',
    billNumber: '83303',
    billingCycle: 'Dine-in / Take Away',
    billDate: '05 Jul 2024',
    dueDate: 'Paid (05 Jul 2024)',
    totalAmount: 693,
    summaryPlain: "Standalone restaurant bill from Sangeetha's Desi Mane, Anna Nagar, Chennai. 5% GST (2.5% CGST + 2.5% SGST) correctly applied on food items — this is the right rate for a standalone AC restaurant. No illegal service charge detected on this bill. Grand Total ₹693 is correctly calculated.",
    gstDetails: {
      taxableAmount: 660,
      cgst: 16.50,
      sgst: 16.50,
      effectiveRate: 5,
      isCorrectSlab: true,
      serviceChargePresent: false,
      serviceChargeAmount: 0
    },
    lineItems: [
      { id: '1', label: 'Paneer Masala Dosai × 2', amount: 320, rate: 160, units: 2 },
      { id: '2', label: 'Dosa × 2', amount: 190, rate: 95, units: 2 },
      { id: '3', label: 'Vendhaya Dosa With Vadacurry × 1', amount: 150, rate: 150, units: 1 },
      { id: '4', label: 'Sub Total', amount: 660 },
      { id: '5', label: 'CGST @ 2.5%', amount: 16.50, isSubItem: true, gstRate: 2.5 },
      { id: '6', label: 'SGST @ 2.5%', amount: 16.50, isSubItem: true, gstRate: 2.5 },
      { id: '7', label: 'Grand Total', amount: 693 }
    ],
    flags: [
      {
        id: 'flag-gst-correct',
        severity: 'good',
        title: '✓ Correct 5% GST Applied (CGST 2.5% + SGST 2.5%)',
        description: 'Standalone restaurants (AC or non-AC) must charge 5% composite GST — 2.5% CGST + 2.5% SGST — without Input Tax Credit. This bill applies it exactly right on the food subtotal of ₹660.',
        lawCitation: 'CBIC Notification No. 46/2017 – Central Tax (Rate)'
      },
      {
        id: 'flag-no-sc',
        severity: 'good',
        title: '✓ No Illegal Service Charge Added',
        description: 'No mandatory service charge was levied on this bill. If any restaurant adds a compulsory service charge in the future, you can legally demand its removal under CCPA 2022 Guidelines.',
        lawCitation: 'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)'
      },
      {
        id: 'flag-gst-math',
        severity: 'info',
        title: 'GST Calculation Verified ✓',
        description: 'Sub Total ₹660.00 × 5% = ₹33.00 GST (₹16.50 CGST + ₹16.50 SGST). Grand Total ₹693.00 = ₹660.00 + ₹33.00. Math is correct.',
        lawCitation: 'GST Invoice Rules 2017'
      },
      {
        id: 'flag-tip-info',
        severity: 'info',
        title: 'Tip / Gratuity is Always Voluntary',
        description: 'If staff verbally request a tip at checkout, it is completely optional and at your discretion. Restaurants cannot mandate tips — only service charges are governed by CCPA 2022 guidelines.',
        lawCitation: 'CCPA Guidelines July 2022'
      }
    ]
  },

  {
    id: 'dinesh-tangedco-invoice',
    type: 'electricity',
    state: 'tamil_nadu',
    billerName: 'TNPDCL — TANGEDCO (DINESH.R)',
    categoryLabel: 'Electricity Bill',
    billNumber: 'Conn: 09-315-363-699',
    billingCycle: 'Month of December 2024',
    billDate: '21 Dec 2024',
    dueDate: '10/01/2025',
    totalAmount: 1307,
    summaryPlain: 'TANGEDCO Tax Invoice for DINESH.R (SITHALAPAKKAM). 421 units consumed. Energy charges ₹2,055.45 less Govt Subsidy -₹748.15 and Round-off -₹0.30 = Net Payable ₹1,307.00. Consumption is under the 500-unit high penalty threshold.',
    ebDetails: {
      state: 'tamil_nadu',
      discomName: 'TNPDCL — TANGEDCO (SITHALAPAKKAM)',
      meterNumber: '1026753',
      consumedUnits: 421,
      fixedCharges: 0,
      electricityDuty: 0,
      fuelSurcharge: 0,
      slabBreakdown: [
        { slabRange: '0–100 units (Govt Subsidy)', unitsCharged: 100, ratePerUnit: 0, totalCost: 0, isFree: true, colorHex: '#2E6E4E' },
        { slabRange: '101–200 units @ ₹2.35', unitsCharged: 100, ratePerUnit: 2.35, totalCost: 235, isFree: false, colorHex: '#429367' },
        { slabRange: '201–400 units @ ₹4.95', unitsCharged: 200, ratePerUnit: 4.95, totalCost: 990, isFree: false, colorHex: '#A9812E' },
        { slabRange: '401–421 units @ ₹6.80 (21 units)', unitsCharged: 21, ratePerUnit: 6.80, totalCost: 142.80, isFree: false, colorHex: '#D97706' }
      ]
    },
    lineItems: [
      { id: '1', label: 'Energy Charges (421.0 units consumed)', amount: 2055.45 },
      { id: '2', label: 'Govt Subsidy Exemption', amount: -748.15 },
      { id: '3', label: 'Round off', amount: -0.30, isSubItem: true },
      { id: '4', label: 'Net Amount Payable', amount: 1307 }
    ],
    flags: [
      {
        id: 'flag-normal-slab',
        severity: 'good',
        title: '✓ Consumption (421 Units) Within Subsidised Slabs',
        description: 'Total consumption of 421 units is below the 500-unit high penalty threshold. First 100 units free by TN Govt subsidy.',
        lawCitation: 'TN Govt Energy Dept G.O. Ms. No. 34'
      },
      {
        id: 'flag-govt-subsidy',
        severity: 'info',
        title: '✓ TN Govt Subsidy (-₹748.15) Applied',
        description: 'First 100 units provided at ₹0 cost + tariff subsidies as mandated by the Tamil Nadu State Electricity Subsidy scheme.',
        lawCitation: 'TN Govt Energy Dept G.O. Ms. No. 34'
      }
    ]
  },
  {
    id: 'tn-eb-612',
    type: 'electricity',
    state: 'tamil_nadu',
    billerName: 'TNPDCL — TANGEDCO',
    categoryLabel: 'Electricity',
    billNumber: 'EB-TN-2026-8849',
    billingCycle: 'Aug – Sep 2026',
    billDate: '15 Aug 2026',
    dueDate: '30 Aug 2026',
    totalAmount: 2140,
    summaryPlain: 'Telescopic bi-monthly residential bill for 612 units. First 100 units free by TN Govt subsidy. You crossed into the highest slab (501+ units) by just 12 units.',
    ebDetails: {
      state: 'tamil_nadu',
      discomName: 'TANGEDCO / TNPDCL (Chennai South)',
      meterNumber: 'MTR-0499281',
      consumedUnits: 612,
      fixedCharges: 0,
      electricityDuty: 107,
      fuelSurcharge: 42,
      slabBreakdown: [
        { slabRange: '0–100 units', unitsCharged: 100, ratePerUnit: 0.0, totalCost: 0, isFree: true, colorHex: '#2E6E4E' },
        { slabRange: '101–200 units', unitsCharged: 100, ratePerUnit: 0.0, totalCost: 0, isFree: true, colorHex: '#429367' },
        { slabRange: '201–400 units', unitsCharged: 200, ratePerUnit: 4.95, totalCost: 990, isFree: false, colorHex: '#A9812E' },
        { slabRange: '401–500 units', unitsCharged: 100, ratePerUnit: 6.80, totalCost: 680, isFree: false, colorHex: '#D97706' },
        { slabRange: '501–612 units', unitsCharged: 112, ratePerUnit: 8.40, totalCost: 941, isFree: false, colorHex: '#B33A2E' }
      ],
      nextSlabThreshold: {
        limit: 500,
        excessUnits: 12,
        excessCost: 101,
        potentialSavings: 410,
        tip: 'Keeping consumption below 500 units in the next 60-day cycle prevents high-slab multiplier penalties.'
      }
    },
    lineItems: [
      { id: '1', label: 'Free allowance (Govt Subsidy)', amount: 0, units: 100, unitLabel: 'units', isFree: true },
      { id: '2', label: '0–200 units (Subsidised Tier)', amount: 0, isSubItem: true },
      { id: '3', label: '201–400 units @ ₹4.95', amount: 990, units: 200, isSubItem: true },
      { id: '4', label: '401–500 units @ ₹6.80', amount: 680, units: 100, isSubItem: true },
      { id: '5', label: '501–612 units @ ₹8.40', amount: 941, units: 112, isSubItem: true, flagSeverity: 'danger', flagMessage: 'Highest slab penalty' },
      { id: '6', label: 'Electricity duty (5%)', amount: 107, gstRate: 5 },
      { id: '7', label: 'FPPCA Fuel Surcharge', amount: 42 }
    ],
    flags: [
      {
        id: 'flag-eb-slab',
        severity: 'good',
        title: '12 units over the 500 mark',
        description: 'Staying under 500 units next cycle keeps you out of the top slab — worth roughly ₹410 in savings across the bi-monthly cycle.',
        savingsPotential: 410,
        actionable: true,
        actionText: 'View Energy Saving Blueprint',
        lawCitation: 'TNERC Domestic Tariff Order 2024-2026'
      },
      {
        id: 'flag-eb-free',
        severity: 'info',
        title: '₹450 Tamil Nadu Subsidy Applied',
        description: 'First 100 units were provided at ₹0 cost as mandated by the Tamil Nadu State Electricity Subsidy scheme.',
        lawCitation: 'TN Govt Energy Dept G.O. Ms. No. 34'
      }
    ]
  },
  {
    id: 'hdfc-emi-card',
    type: 'credit_card',
    state: 'national',
    billerName: 'HDFC Bank Credit Card',
    categoryLabel: 'Credit Card & EMI',
    billNumber: 'CC-HDFC-991204',
    billingCycle: 'Aug 2026',
    billDate: '10 Aug 2026',
    dueDate: '28 Aug 2026',
    totalAmount: 18920,
    summaryPlain: 'HDFC Regalia statement with active "No-Cost EMI" for iPhone 15. The advertised 0% rate actually carries a True APR of 13.8% due to bank processing fees and 18% GST charged monthly on interest.',
    emiDetails: {
      productName: 'Apple iPhone 15 (128 GB, Black)',
      retailer: 'Amazon India / HDFC Merchant EMI',
      cashPrice: 54900,
      tenureMonths: 6,
      monthlyInstallment: 9570,
      advertisedRate: 0,
      trueAPR: 13.8,
      processingFee: 999,
      processingFeeGST: 180,
      gstOnInterestMonthly: 75.6,
      totalGstOnInterest: 454,
      totalPaid: 57420,
      netExtraCostOverCash: 2520,
      isZeroCostReal: false,
      bankName: 'HDFC Bank',
      verdictStamp: 'NOT ZERO COST'
    },
    lineItems: [
      { id: '1', label: 'Cash Upfront Price (Advertised)', amount: 54900 },
      { id: '2', label: 'EMI Principal Repayment (Monthly)', amount: 9150, isSubItem: true },
      { id: '3', label: 'One-time Bank Processing Fee', amount: 999, flagSeverity: 'danger', flagMessage: 'Hidden mandatory bank charge' },
      { id: '4', label: '18% GST on Processing Fee', amount: 180, isSubItem: true },
      { id: '5', label: '18% GST on Interest Component', amount: 454, flagSeverity: 'warning', flagMessage: 'Charged even on "No-Cost" EMI' },
      { id: '6', label: 'Net Extra Cost Paid by You', amount: 2520, flagSeverity: 'danger' }
    ],
    flags: [
      {
        id: 'flag-emi-truth',
        severity: 'danger',
        title: 'Advertised: 0% Interest → Real: 13.8% APR',
        description: 'The retailer discounted ₹2,520 upfront to simulate "0% interest", but HDFC charged ₹999 processing fee + ₹180 GST + ₹454 GST on monthly interest. You paid ₹2,520 above cash price.',
        savingsPotential: 2520,
        actionable: true,
        actionText: 'Dispute / Check Bank Terms',
        disputeType: 'emi_misleading',
        lawCitation: 'RBI Master Direction on Credit Card & Debit Card Issuance (Clause 10.3)'
      },
      {
        id: 'flag-min-due-trap',
        severity: 'warning',
        title: 'Minimum Due Trap Alert: 43.2% Annual Interest',
        description: 'Paying only the ₹950 minimum due on your total card balance will take 6.5 years to clear and cost ₹14,200 in interest.',
        lawCitation: 'RBI Fair Practices Code for Lenders'
      }
    ]
  },
  {
    id: 'saravana-bhavan-restaurant',
    type: 'restaurant',
    state: 'tamil_nadu',
    billerName: 'Hotel Saravana Bhavan',
    categoryLabel: 'Restaurant Bill',
    billNumber: 'INV-SB-8402',
    billingCycle: 'Dining Bill',
    billDate: '12 Aug 2026',
    dueDate: 'Paid (12 Aug)',
    totalAmount: 864,
    summaryPlain: 'Restaurant dine-in bill with ₹75.00 mandatory Service Charge illegally added by default in violation of CCPA 2022 Guidelines, plus 5% GST calculated on top of the service charge.',
    gstDetails: {
      taxableAmount: 825,
      cgst: 20.62,
      sgst: 20.62,
      effectiveRate: 5,
      isCorrectSlab: true,
      serviceChargePresent: true,
      serviceChargeAmount: 75,
      serviceChargeGSTAmount: 3.75
    },
    lineItems: [
      { id: '1', label: 'Special Ghee Roast Dosa (2x)', amount: 320, rate: 160 },
      { id: '2', label: 'Filter Coffee (2x)', amount: 130, rate: 65 },
      { id: '3', label: 'Meals (Thali)', amount: 300, rate: 300 },
      { id: '4', label: 'Service Charge @ 10% (Mandatory)', amount: 75, flagSeverity: 'danger', flagMessage: 'Illegal under CCPA Guidelines' },
      { id: '5', label: 'CGST @ 2.5%', amount: 20.62, isSubItem: true },
      { id: '6', label: 'SGST @ 2.5%', amount: 20.62, isSubItem: true },
      { id: '7', label: 'Round Off Adjustment', amount: -2.24 }
    ],
    flags: [
      {
        id: 'flag-restaurant-sc',
        severity: 'danger',
        title: 'Illegal Service Charge (₹75.00 + ₹3.75 GST)',
        description: 'Under CCPA Guidelines dated 4th July 2022, no hotel or restaurant can add service charge automatically or by default. You are legally entitled to have this ₹78.75 removed immediately.',
        savingsPotential: 78.75,
        actionable: true,
        actionText: 'Generate CCPA Removal Request',
        disputeType: 'service_charge',
        lawCitation: 'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)'
      },
      {
        id: 'flag-restaurant-gst',
        severity: 'good',
        title: 'Correct 5% GST Applied',
        description: 'Standalone AC & non-AC restaurants in India are subject to 5% composite GST (2.5% CGST + 2.5% SGST) with zero input tax credit.',
        lawCitation: 'CBIC Notification No. 46/2017 - Central Tax (Rate)'
      }
    ]
  },
  {
    id: 'kseb-kerala-280',
    type: 'electricity',
    state: 'kerala',
    billerName: 'KSEB — Kerala State Electricity Board',
    categoryLabel: 'Electricity',
    billNumber: 'KSEB-KL-50192',
    billingCycle: 'Aug 2026',
    billDate: '14 Aug 2026',
    dueDate: '29 Aug 2026',
    totalAmount: 2620,
    summaryPlain: 'Kerala residential monthly bill for 280 units. Because consumption exceeded 250 units, KSEB switched your billing from Telescopic to Non-Telescopic penalty rates across all units!',
    ebDetails: {
      state: 'kerala',
      discomName: 'Kerala State Electricity Board (KSEB)',
      meterNumber: 'KL-TVM-88192',
      consumedUnits: 280,
      fixedCharges: 160,
      electricityDuty: 220,
      fuelSurcharge: 68,
      slabBreakdown: [
        { slabRange: 'All Units (0–280 @ ₹9.15 Non-Telescopic)', unitsCharged: 280, ratePerUnit: 9.15, totalCost: 2562, isFree: false, colorHex: '#B33A2E' }
      ],
      nextSlabThreshold: {
        limit: 250,
        excessUnits: 30,
        excessCost: 740,
        potentialSavings: 740,
        tip: 'Crossing 250 units triggers the KSEB non-telescopic penalty where ALL previous units lose subsidised rates.'
      }
    },
    lineItems: [
      { id: '1', label: 'Energy Charges (280 units @ ₹9.15 flat)', amount: 2562, flagSeverity: 'danger', flagMessage: 'Non-telescopic penalty rate' },
      { id: '2', label: 'Monthly Fixed Demand Charge', amount: 160 },
      { id: '3', label: 'Electricity Duty (10% on energy charges)', amount: 256 },
      { id: '4', label: 'Thermal Fuel Surcharge (19p/unit)', amount: 53.2 }
    ],
    flags: [
      {
        id: 'flag-kseb-barrier',
        severity: 'danger',
        title: '30 units crossed the 250 barrier (₹740 penalty)',
        description: 'In Kerala, staying at or below 250 units keeps telescopic slabs (avg ₹5.20/unit). Going to 280 units made every single unit cost ₹9.15. Saving 30 units next month will save ₹740!',
        savingsPotential: 740,
        actionable: true,
        actionText: 'KSEB 250-Unit Defense Guide',
        lawCitation: 'KSERC Tariff Revision Order 2024'
      }
    ]
  },
  {
    id: 'dmart-supermarket',
    type: 'grocery',
    state: 'national',
    billerName: 'DMart Supermarket',
    categoryLabel: 'Supermarket & Grocery',
    billNumber: 'DM-MUM-44910',
    billingCycle: 'Store Purchase',
    billDate: '16 Aug 2026',
    dueDate: 'Paid (16 Aug)',
    totalAmount: 3410,
    summaryPlain: 'Itemized grocery bill with 4 distinct GST brackets (0%, 5%, 12%, 18%). Unbranded loose staples correctly billed at 0% GST while branded cleaning products carry 18% GST.',
    lineItems: [
      { id: '1', label: 'Loose Organic Moong Dal (2kg)', amount: 240, gstRate: 0, explanation: 'Unbranded staple = 0% GST' },
      { id: '2', label: 'Fortune Sunlite Sunflower Oil (5L)', amount: 620, gstRate: 5, explanation: 'Edible oil standard = 5% GST' },
      { id: '3', label: 'Aashirvaad Shudh Chakki Atta (10kg)', amount: 440, gstRate: 5 },
      { id: '4', label: 'Surf Excel Matic Liquid (2L)', amount: 430, gstRate: 18, explanation: 'Detergents & home care = 18% GST' },
      { id: '5', label: 'Cadbury Celebrations Gift Pack', amount: 350, gstRate: 18 },
      { id: '6', label: 'Total Store Promotional Savings', amount: -480, flagSeverity: 'good', flagMessage: 'Actual discount verified against MRP' }
    ],
    flags: [
      {
        id: 'flag-grocery-gst',
        severity: 'good',
        title: 'GST slabs 100% compliant',
        description: 'Loose unbranded pulses charged at 0% GST; packaged flour & edible oil at 5% GST; personal care items at 18% GST. No overcharging detected.',
        lawCitation: 'GST Council Rate Classification Schedule'
      },
      {
        id: 'flag-mrp-verified',
        severity: 'good',
        title: 'Real ₹480 MRP discount verified',
        description: 'All 6 item barcodes matched legitimate MRPs without artificial pre-inflation of base prices.',
        lawCitation: 'Legal Metrology (Packaged Commodities) Rules 2011'
      }
    ]
  },
  {
    id: 'taj-hotel-stay',
    type: 'hotel',
    state: 'national',
    billerName: 'Taj Hotels & Resorts',
    categoryLabel: 'Hotel Stay Bill',
    billNumber: 'HOTEL-TAJ-7721',
    billingCycle: '2 Nights Stay',
    billDate: '18 Aug 2026',
    dueDate: 'Paid (18 Aug)',
    totalAmount: 14890,
    summaryPlain: 'Luxury hotel folio. Room tariff of ₹5,500/night attracted 12% GST. In-room dining attracted 18% GST due to specified-premises rules, plus ₹650 mini-bar charges explained line-by-line.',
    lineItems: [
      { id: '1', label: 'Deluxe Room (2 Nights @ ₹5,500)', amount: 11000, gstRate: 12 },
      { id: '2', label: 'GST on Room (12% for tariff < ₹7,500)', amount: 1320, isSubItem: true },
      { id: '3', label: 'In-Room Breakfast Buffet', amount: 1200, gstRate: 18 },
      { id: '4', label: 'Mini-Bar (2x Almonds & Soft Drink)', amount: 650, flagSeverity: 'warning', flagMessage: '300% markup over MRP' },
      { id: '5', label: 'Airport Transfer Premium Taxi', amount: 720, gstRate: 5 }
    ],
    flags: [
      {
        id: 'flag-hotel-tariff',
        severity: 'good',
        title: 'Benefitted from Sub-₹7,500 12% GST Slab',
        description: 'Since nightly room tariff was ₹5,500 (below the ₹7,500 luxury threshold), GST was 12% instead of 18%, saving you ₹660 on room tax.',
        savingsPotential: 660,
        lawCitation: 'GST Notification No. 11/2017 - Central Tax (Rate)'
      },
      {
        id: 'flag-hotel-minibar',
        severity: 'warning',
        title: 'Mini-bar charged 3x over printed MRP',
        description: 'Packaged almonds and beverages were billed with luxury hotel surcharge. Bottled water must be supplied at printed MRP or complimentary.',
        lawCitation: 'National Consumer Disputes Redressal Commission (NCDRC)'
      }
    ]
  },
  {
    id: 'indane-gas-bill',
    type: 'gas',
    state: 'national',
    billerName: 'Indane / IGL Piped Natural Gas',
    categoryLabel: 'Gas & Fuel',
    billNumber: 'PNG-IGL-99214',
    billingCycle: 'Jul – Aug 2026',
    billDate: '05 Aug 2026',
    dueDate: '20 Aug 2026',
    totalAmount: 1340,
    summaryPlain: 'Bi-monthly Piped Natural Gas (PNG) residential invoice for 22.4 SCM (Standard Cubic Metres) at ₹48.59/SCM with 5% domestic GST and fixed pipeline maintenance fees.',
    lineItems: [
      { id: '1', label: 'PNG Consumption (22.4 SCM @ ₹48.59)', amount: 1088.4, units: 22.4, unitLabel: 'SCM' },
      { id: '2', label: 'Fixed Bi-monthly Pipeline Network Charge', amount: 120 },
      { id: '3', label: 'Domestic Meter Rent (Bi-monthly)', amount: 50 },
      { id: '4', label: 'GST on Domestic Gas (5%)', amount: 62.92, isSubItem: true },
      { id: '5', label: 'Late Payment Buffer Deposit', amount: 18.68 }
    ],
    flags: [
      {
        id: 'flag-gas-lpg-png',
        severity: 'good',
        title: '5% Domestic SCM Rate Verified',
        description: 'Domestic PNG is billed under the 5% concessional GST tier. No commercial conversion charges detected.',
        lawCitation: 'PNGRB Gas Regulatory Pricing Order'
      }
    ]
  }
];

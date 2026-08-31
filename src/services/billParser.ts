/**
 * billParser.ts
 * Parses raw OCR text into structured BillData for each bill category.
 * Applies rule-based auditing aligned with Indian consumer law.
 */

import { BillData, BillFlag, BillType, GSTDetails, LineItem } from '../types/bill';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract first matching group as a float, or undefined */
function matchNum(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  return m ? parseFloat(m[1].replace(/,/g, '')) : undefined;
}

/** Extract first matching group as string, or undefined */
function matchStr(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1]?.trim();
}

/** Check if two numbers are within tolerance */
function approxEq(a: number, b: number, tol = 1.5): boolean {
  return Math.abs(a - b) <= tol;
}

/** Get today's date as dd MMM yyyy */
function todayStr(): string {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Restaurant Bill Parser ──────────────────────────────────────────────────

interface ParsedRestaurant {
  restaurantName: string;
  gstin?: string;
  billNumber?: string;
  billDate?: string;
  items: Array<{ label: string; qty: number; rate: number; amount: number }>;
  subtotal: number;
  cgst: number;
  cgstRate: number;
  sgst: number;
  sgstRate: number;
  igst: number;
  serviceCharge: number;
  grandTotal: number;
  parseConfidence: number;
}

function parseRestaurant(rawText: string): ParsedRestaurant {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Restaurant name — first meaningful line
  const restaurantName = lines.find(l => l.length > 4 && !/^\d/.test(l)) ?? 'Restaurant';

  const gstin   = matchStr(rawText, /GSTIN\s*[:\s]\s*([0-9A-Z]{15})/i);
  const billDate = matchStr(rawText, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  const billNumber = matchStr(rawText, /bill\s*(?:no|num|number|#)\s*[.:\s]*(\w+)/i)
                  ?? matchStr(rawText, /token\s*no\s*[.:\s]*(\w+)/i);

  // ── Item parsing ────────────────────────────────────────────────────────
  const items: ParsedRestaurant['items'] = [];

  // Pattern A: "1 Paneer Masala Dosai   2   160.00  320.00"
  // Pattern B: "Paneer Masala Dosai   2   160.00  320.00"
  const LINE_ITEM = /^(?:\d+\s+)?(.+?)\s{2,}(\d+)\s+(\d+[.,]?\d*)\s+(\d+[.,]?\d*)\s*$/;

  for (const line of lines) {
    const m = line.match(LINE_ITEM);
    if (!m) continue;
    const [, label, qtyStr, rateStr, amtStr] = m;
    const qty  = parseInt(qtyStr);
    const rate = parseFloat(rateStr.replace(',', ''));
    const amt  = parseFloat(amtStr.replace(',', ''));
    // Sanity check: qty × rate ≈ amount (within ₹2)
    if (qty > 0 && rate > 0 && approxEq(qty * rate, amt, 2)) {
      items.push({ label: label.trim(), qty, rate, amount: amt });
    }
  }

  // ── GST extraction ──────────────────────────────────────────────────────
  // CGST 2.5%  16.50   or   CGST @ 2.5%   16.50
  const cgstRate = matchNum(rawText, /CGST\s*@?\s*(\d+\.?\d*)\s*%/i) ?? 2.5;
  const cgst     = matchNum(rawText, /CGST[^0-9₹]*?(\d+[.,]?\d*)\s*$/im) ?? 0;

  const sgstRate = matchNum(rawText, /SGST\s*@?\s*(\d+\.?\d*)\s*%/i) ?? 2.5;
  const sgst     = matchNum(rawText, /SGST[^0-9₹]*?(\d+[.,]?\d*)\s*$/im) ?? 0;

  const igst = matchNum(rawText, /IGST[^0-9₹]*?(\d+[.,]?\d*)\s*$/im) ?? 0;

  // ── Service charge ──────────────────────────────────────────────────────
  const serviceCharge =
    matchNum(rawText, /service\s*charge\s*@?\s*\d*\.?\d*\s*%?\s*[:\s]\s*(\d+[.,]?\d*)/i) ?? 0;

  // ── Totals ──────────────────────────────────────────────────────────────
  const computedSubtotal = items.reduce((s, i) => s + i.amount, 0);
  const subtotal = matchNum(rawText, /(?:sub\s*total|subtotal|sub-total)\s*[₹]?\s*(\d+[.,]?\d*)/i)
                ?? computedSubtotal;

  const grandTotal =
    matchNum(rawText, /grand\s*total\s*[₹]?\s*(\d+[.,]?\d*)/i) ??
    matchNum(rawText, /(?:total\s*amount|net\s*total|bill\s*total)\s*[₹]?\s*(\d+[.,]?\d*)/i) ??
    (subtotal + cgst + sgst + igst + serviceCharge);

  // Confidence
  let conf = 0.1;
  if (items.length > 0) conf += 0.5;
  if (cgst > 0 || sgst > 0) conf += 0.25;
  if (grandTotal > 50) conf += 0.15;

  return {
    restaurantName, gstin, billNumber, billDate,
    items, subtotal, cgst, cgstRate, sgst, sgstRate, igst,
    serviceCharge, grandTotal, parseConfidence: conf
  };
}

function buildRestaurantBillData(p: ParsedRestaurant): BillData {
  const totalGST = p.cgst + p.sgst + p.igst;
  const effectiveRate = p.subtotal > 0 ? Math.round((totalGST / p.subtotal) * 100 * 10) / 10 : 0;
  const expectedTotal = p.subtotal + totalGST + p.serviceCharge;
  const totalOk = p.grandTotal === 0 || approxEq(expectedTotal, p.grandTotal, 2);

  const flags: BillFlag[] = [];

  // GST rate check
  const gstOk = Math.abs(effectiveRate - 5) < 0.6;
  if (gstOk) {
    flags.push({
      id: 'gst-correct', severity: 'good',
      title: `✓ Correct ${effectiveRate}% GST Applied (CGST ${p.cgstRate}% + SGST ${p.sgstRate}%)`,
      description: `Standalone restaurants must charge 5% composite GST without ITC. This bill charges ${effectiveRate}% on ₹${p.subtotal.toFixed(2)} = ₹${totalGST.toFixed(2)} — exactly right.`,
      lawCitation: 'CBIC Notification No. 46/2017 – Central Tax (Rate)'
    });
  } else if (effectiveRate > 5.5) {
    flags.push({
      id: 'gst-high', severity: 'danger',
      title: `⚠ GST Rate ${effectiveRate}% Is Above the Legal 5% Cap`,
      description: `Standalone restaurants are capped at 5% composite GST. You were charged ${effectiveRate}%, which is ₹${(totalGST - p.subtotal * 0.05).toFixed(2)} more than legal.`,
      lawCitation: 'CBIC Notification No. 46/2017',
      actionable: true, actionText: 'Demand GST refund', disputeType: 'service_charge',
      savingsPotential: parseFloat((totalGST - p.subtotal * 0.05).toFixed(2))
    });
  } else if (effectiveRate > 0 && effectiveRate < 4.5) {
    flags.push({
      id: 'gst-low', severity: 'warning',
      title: `GST Rate ${effectiveRate}% May Be Understated`,
      description: 'If this is an AC restaurant, 5% GST applies. A lower rate could indicate GST is being under-collected, which may cause compliance issues.',
      lawCitation: 'CBIC Notification No. 46/2017'
    });
  }

  // Service charge
  if (p.serviceCharge > 0) {
    flags.push({
      id: 'service-charge', severity: 'danger',
      title: `⚠ Illegal Mandatory Service Charge ₹${p.serviceCharge.toFixed(2)} Detected!`,
      description: 'Since 4 July 2022, restaurants CANNOT levy a mandatory service charge. You can legally demand its full removal. File a complaint at consumerhelpline.gov.in if they refuse.',
      lawCitation: 'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)',
      actionable: true, actionText: 'Generate dispute letter', disputeType: 'service_charge',
      savingsPotential: p.serviceCharge
    });
  } else {
    flags.push({
      id: 'no-sc', severity: 'good',
      title: '✓ No Illegal Service Charge',
      description: 'This bill does not levy a mandatory service charge. Your consumer rights are respected.',
      lawCitation: 'CCPA Guidelines July 2022'
    });
  }

  // Grand total verification
  if (!totalOk) {
    const diff = Math.abs(expectedTotal - p.grandTotal);
    flags.push({
      id: 'total-wrong', severity: 'danger',
      title: `⚠ Grand Total Mismatch — ₹${diff.toFixed(2)} Extra Charged`,
      description: `Items (₹${p.subtotal.toFixed(2)}) + GST (₹${totalGST.toFixed(2)}) = ₹${expectedTotal.toFixed(2)}, but bill shows ₹${p.grandTotal.toFixed(2)}.`,
      lawCitation: 'Consumer Protection Act 2019',
      savingsPotential: diff
    });
  } else if (p.grandTotal > 0) {
    flags.push({
      id: 'total-ok', severity: 'info',
      title: `✓ Grand Total ₹${p.grandTotal.toFixed(2)} Math Verified`,
      description: `₹${p.subtotal.toFixed(2)} (items) + ₹${totalGST.toFixed(2)} (GST) = ₹${expectedTotal.toFixed(2)}. Calculation is correct.`,
      lawCitation: 'GST Invoice Rules 2017'
    });
  }

  flags.push({
    id: 'tip', severity: 'info',
    title: 'Tip / Gratuity is Always Voluntary',
    description: 'Tips are your choice — never mandatory. Restaurants cannot add them to the bill without your consent.',
    lawCitation: 'CCPA Guidelines July 2022'
  });

  const lineItems: LineItem[] = [
    ...p.items.map((it, i) => ({
      id: `it-${i}`, label: `${it.label} × ${it.qty}`,
      amount: it.amount, rate: it.rate, units: it.qty
    })),
    { id: 'sub', label: 'Sub Total', amount: p.subtotal },
    ...(p.cgst > 0 ? [{ id: 'cgst', label: `CGST @ ${p.cgstRate}%`, amount: p.cgst, isSubItem: true, gstRate: p.cgstRate }] : []),
    ...(p.sgst > 0 ? [{ id: 'sgst', label: `SGST @ ${p.sgstRate}%`, amount: p.sgst, isSubItem: true, gstRate: p.sgstRate }] : []),
    ...(p.igst > 0 ? [{ id: 'igst', label: 'IGST', amount: p.igst, isSubItem: true }] : []),
    ...(p.serviceCharge > 0 ? [{
      id: 'sc', label: '⚠ Service Charge (ILLEGAL)', amount: p.serviceCharge,
      isSubItem: true, flagSeverity: 'danger' as const,
      flagMessage: 'Illegal under CCPA 2022'
    }] : []),
    { id: 'total', label: 'Grand Total', amount: p.grandTotal }
  ];

  const gstDetails: GSTDetails = {
    taxableAmount: p.subtotal, cgst: p.cgst, sgst: p.sgst, igst: p.igst,
    effectiveRate, isCorrectSlab: gstOk,
    serviceChargePresent: p.serviceCharge > 0, serviceChargeAmount: p.serviceCharge
  };

  return {
    id: `scanned-${Date.now()}`,
    type: 'restaurant', state: 'national',
    billerName: p.restaurantName,
    categoryLabel: 'Restaurant Bill',
    billNumber: p.billNumber ?? `AUTO-${Date.now()}`,
    billingCycle: 'Single Visit',
    billDate: p.billDate ?? todayStr(),
    dueDate: 'Paid',
    totalAmount: p.grandTotal > 0 ? p.grandTotal : p.subtotal + totalGST,
    summaryPlain: `${p.items.length} item(s) scanned from your receipt.${gstOk ? ` Correct 5% GST applied.` : ` GST rate issue detected.`}${p.serviceCharge > 0 ? ` ALERT: Illegal service charge ₹${p.serviceCharge.toFixed(2)} found!` : ''}`,
    lineItems, flags, gstDetails
  };
}

// ─── Grocery Bill Parser ─────────────────────────────────────────────────────

function buildGroceryBillData(rawText: string): BillData {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const storeName = lines.find(l => l.length > 4) ?? 'Grocery Store';

  // Extract items with prices
  const items: LineItem[] = [];
  const PRICE_LINE = /^(.+?)\s{2,}(\d+[.,]?\d*)\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PRICE_LINE);
    if (m) {
      const amt = parseFloat(m[2].replace(',', ''));
      if (amt > 0 && amt < 10000 && !/(total|tax|gst|cgst|sgst|discount)/i.test(m[1])) {
        items.push({ id: `g-${i}`, label: m[1].trim(), amount: amt });
      }
    }
  }

  const grandTotal = matchNum(rawText, /(?:grand\s*total|net\s*amount|bill\s*total|total)\s*[₹]?\s*(\d+[.,]?\d*)/i) ?? 0;
  const discount   = matchNum(rawText, /discount\s*[₹]?\s*-?\s*(\d+[.,]?\d*)/i) ?? 0;

  return {
    id: `scanned-${Date.now()}`,
    type: 'grocery', state: 'national',
    billerName: storeName, categoryLabel: 'Grocery Bill',
    billNumber: matchStr(rawText, /bill\s*no\s*[.:\s]*(\w+)/i) ?? '-',
    billingCycle: 'Purchase',
    billDate: matchStr(rawText, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ?? todayStr(),
    dueDate: 'Paid', totalAmount: grandTotal,
    summaryPlain: `${items.length} line items extracted from your grocery receipt. Discount: ₹${discount.toFixed(2)}.`,
    lineItems: [...items, ...(discount > 0 ? [{ id: 'disc', label: 'Discount', amount: -discount }] : []), { id: 'total', label: 'Total', amount: grandTotal }],
    flags: [
      { id: 'mrp', severity: 'info', title: 'Check MRP on Each Item', description: 'Retailers cannot charge above the Maximum Retail Price printed on the package. Compare each item\'s billed price with its printed MRP.', lawCitation: 'Legal Metrology Act 2009' },
      { id: 'gst-check', severity: 'info', title: 'GST Should Already Be Included in MRP', description: 'For packaged goods, GST is already included in the MRP. If a separate GST line is added on top of MRP, that is illegal.', lawCitation: 'GST Council – Consumer Pack Exemption' }
    ]
  };
}

// ─── Electricity Bill Parser ─────────────────────────────────────────────────

function buildElectricityBillData(rawText: string): BillData {
  const units  = matchNum(rawText, /(?:units|kwh|consumption)\s*[:\s]*(\d+)/i);
  const total  = matchNum(rawText, /(?:amount\s*payable|bill\s*amount|grand\s*total|net\s*payable)\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const discom = rawText.match(/tangedco|tnpdcl|kseb|tsspdcl|tsnpdcl|bescom|msedcl/i)?.[0]?.toUpperCase() ?? 'DISCOM';

  return {
    id: `scanned-${Date.now()}`,
    type: 'electricity', state: 'national',
    billerName: `${discom} — Electricity Bill`,
    categoryLabel: 'Electricity', billNumber: '-',
    billingCycle: matchStr(rawText, /(\w+\s*\d{4}\s*[-–]\s*\w+\s*\d{4})/i) ?? 'Current Cycle',
    billDate: matchStr(rawText, /bill\s*date\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? todayStr(),
    dueDate: matchStr(rawText, /due\s*date\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? '-',
    totalAmount: total ?? 0,
    summaryPlain: units != null
      ? `Detected ${units} units consumed. Total: ₹${total?.toFixed(2) ?? '?'}`
      : 'Electricity bill detected. Key amounts extracted.',
    lineItems: [
      ...(units != null ? [{ id: 'units', label: `Units Consumed: ${units} kWh`, amount: total ?? 0 }] : []),
      { id: 'total', label: 'Amount Payable', amount: total ?? 0 }
    ],
    flags: [
      { id: 'slab', severity: 'info', title: 'Check Your Slab Consumption', description: 'Indian EB bills use telescopic slab pricing — higher units = higher rates per unit in that slab. Staying under key thresholds (100 / 200 / 400 / 500 units) can save significantly.', lawCitation: 'State Electricity Regulatory Commission Tariff Orders' },
      { id: 'fixed', severity: 'info', title: 'Fixed & Wheeling Charges Are Mandatory', description: 'Fixed charges, electricity duty, and FPPCA surcharges are mandatory statutory levies set by the State Electricity Regulatory Commission.', lawCitation: 'Electricity Act 2003' }
    ]
  };
}

// ─── Hotel Bill Parser ───────────────────────────────────────────────────────

function buildHotelBillData(rawText: string): BillData {
  const roomRate   = matchNum(rawText, /room\s*(?:rate|charge|tariff)\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const nights     = matchNum(rawText, /(\d+)\s*(?:night|nite|day)/i) ?? 1;
  const grandTotal = matchNum(rawText, /(?:grand\s*total|net\s*total|amount\s*payable)\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const cgst       = matchNum(rawText, /CGST[^0-9₹]*?(\d+[.,]?\d*)\s*$/im) ?? 0;
  const sgst       = matchNum(rawText, /SGST[^0-9₹]*?(\d+[.,]?\d*)\s*$/im) ?? 0;
  const roomTotal  = roomRate != null ? roomRate * nights : 0;
  const totalGST   = cgst + sgst;
  const gstRate    = roomTotal > 0 ? Math.round((totalGST / roomTotal) * 100) : 0;
  const correctRate = roomTotal < 7500 ? 12 : 18;

  return {
    id: `scanned-${Date.now()}`,
    type: 'hotel', state: 'national',
    billerName: rawText.split('\n').find(l => l.trim().length > 4)?.trim() ?? 'Hotel',
    categoryLabel: 'Hotel Stay', billNumber: matchStr(rawText, /folio\s*[.:\s]*(\w+)/i) ?? '-',
    billingCycle: `${nights} Night(s)`,
    billDate: matchStr(rawText, /(?:check.?in|date)\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? todayStr(),
    dueDate: matchStr(rawText, /check.?out\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? 'Paid',
    totalAmount: grandTotal ?? 0,
    summaryPlain: `Hotel folio — ${nights} night(s)${roomRate ? ` at ₹${roomRate}/night` : ''}. GST rate: ${gstRate > 0 ? gstRate + '%' : 'checking…'}`,
    lineItems: [
      ...(roomRate != null ? [{ id: 'room', label: `Room Charges × ${nights} night(s)`, amount: roomTotal, rate: roomRate, units: nights }] : []),
      ...(cgst > 0 ? [{ id: 'cgst', label: 'CGST', amount: cgst, isSubItem: true }] : []),
      ...(sgst > 0 ? [{ id: 'sgst', label: 'SGST', amount: sgst, isSubItem: true }] : []),
      { id: 'total', label: 'Grand Total', amount: grandTotal ?? 0 }
    ],
    flags: [
      gstRate > 0 && Math.abs(gstRate - correctRate) > 1
        ? { id: 'gst-wrong', severity: 'danger', title: `⚠ Hotel GST Rate Issue Detected`, description: `Room tariff ₹${roomRate?.toFixed(2)}/night → expected ${correctRate}% GST. Detected ${gstRate}%.`, lawCitation: 'GST Notification 20/2019-CT(Rate)', actionable: true }
        : { id: 'gst-ok', severity: 'good', title: `✓ Hotel GST ${gstRate > 0 ? gstRate + '%' : correctRate + '%'} Is Correct`, description: `For rooms ${roomTotal < 7500 ? 'under ₹7,500/night → 12%' : '₹7,500+/night → 18%'} GST applies.`, lawCitation: 'GST Notification 20/2019-CT(Rate)' },
      { id: 'resort-fee', severity: 'warning', title: 'Check for Hidden Resort / Facility Fees', description: 'Hotels sometimes add undisclosed "resort fees" or "convenience charges" not shown at booking. These can be disputed under Consumer Protection Act 2019.', lawCitation: 'Consumer Protection Act 2019' }
    ].filter(Boolean) as BillFlag[]
  };
}

// ─── Gas Bill Parser ─────────────────────────────────────────────────────────

function buildGasBillData(rawText: string): BillData {
  const amount    = matchNum(rawText, /(?:amount|total|net\s*payable)\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const cylinders = matchNum(rawText, /(\d+)\s*(?:cylinder|refill|booking)/i);
  const gst       = matchNum(rawText, /(?:gst|igst)\s*@?\s*\d*\.?\d*\s*%?\s*[:\s]\s*(\d+[.,]?\d*)/i);

  return {
    id: `scanned-${Date.now()}`,
    type: 'gas', state: 'national',
    billerName: rawText.match(/indane|bharat\s*gas|hpcl|igl|mgl|mahanagar\s*gas/i)?.[0] ?? 'Gas Provider',
    categoryLabel: 'Gas Bill', billNumber: matchStr(rawText, /consumer\s*no\s*[.:\s]*(\w+)/i) ?? '-',
    billingCycle: 'Delivery',
    billDate: matchStr(rawText, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ?? todayStr(),
    dueDate: 'Paid', totalAmount: amount ?? 0,
    summaryPlain: `Gas bill — ${cylinders != null ? cylinders + ' cylinder(s)' : 'delivery'}. Total ₹${amount?.toFixed(2) ?? '?'}. GST: ₹${gst?.toFixed(2) ?? '?'}`,
    lineItems: [
      ...(cylinders != null ? [{ id: 'cyl', label: `LPG Cylinders × ${cylinders}`, amount: (amount ?? 0) - (gst ?? 0) }] : []),
      ...(gst != null ? [{ id: 'gst', label: 'GST @ 5%', amount: gst, isSubItem: true, gstRate: 5 }] : []),
      { id: 'total', label: 'Total', amount: amount ?? 0 }
    ],
    flags: [
      { id: 'gst5', severity: 'good', title: '✓ LPG/PNG Attracts 5% GST', description: 'Domestic LPG and PNG connections are taxed at 5% GST. Your bill should reflect this.', lawCitation: 'GST Council Rate Schedule – Entry 165' },
      { id: 'subsidy', severity: 'info', title: 'PMUY Subsidy Transferred to Bank Account', description: 'If you are under PMUY scheme, the subsidy amount is directly transferred to your linked bank account — not deducted from the bill.', lawCitation: 'Pradhan Mantri Ujjwala Yojana Guidelines' }
    ]
  };
}

// ─── Credit Card Parser ──────────────────────────────────────────────────────

function buildCreditCardBillData(rawText: string): BillData {
  const minDue    = matchNum(rawText, /minimum\s*(?:amount\s*)?due\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const totalDue  = matchNum(rawText, /total\s*(?:amount\s*)?due\s*[₹]?\s*(\d+[.,]?\d*)/i) ?? matchNum(rawText, /outstanding\s*[₹]?\s*(\d+[.,]?\d*)/i);
  const creditLim = matchNum(rawText, /credit\s*limit\s*[₹]?\s*(\d+[.,]?\d*)/i);

  return {
    id: `scanned-${Date.now()}`,
    type: 'credit_card', state: 'national',
    billerName: rawText.match(/hdfc|icici|axis|sbi\s*card|kotak|citibank|amex/i)?.[0]?.toUpperCase() ?? 'Credit Card',
    categoryLabel: 'Credit Card Statement', billNumber: matchStr(rawText, /card\s*(?:no|number)\s*[.:\s]*(?:xx+)?(\d{4})/i) ?? '-',
    billingCycle: matchStr(rawText, /statement\s*(?:period|date)\s*[:\s]*(.+?)(?:\n|$)/i) ?? 'Monthly',
    billDate: matchStr(rawText, /statement\s*date\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? todayStr(),
    dueDate: matchStr(rawText, /payment\s*due\s*date\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ?? '-',
    totalAmount: totalDue ?? 0,
    summaryPlain: `Credit card statement. Total due: ₹${totalDue?.toFixed(2) ?? '?'}. Minimum due: ₹${minDue?.toFixed(2) ?? '?'}. Always pay full to avoid 36-42% effective annual interest.`,
    lineItems: [
      ...(creditLim != null ? [{ id: 'lim', label: 'Credit Limit', amount: creditLim }] : []),
      ...(totalDue != null ? [{ id: 'total', label: 'Total Amount Due', amount: totalDue }] : []),
      ...(minDue != null ? [{ id: 'min', label: 'Minimum Amount Due', amount: minDue, isSubItem: true, flagSeverity: 'warning' as const, flagMessage: 'Paying only minimum accrues 36-42% interest' }] : [])
    ],
    flags: [
      { id: 'min-due-trap', severity: 'danger', title: '⚠ Never Pay Only the Minimum Due', description: 'Banks charge 3–3.5% monthly (36–42% APR) on the revolving balance if you pay less than the full amount. Always clear 100% of the total due to avoid this trap.', lawCitation: 'RBI Circular – Fair Practice Code for Credit Cards' },
      { id: 'emi-check', severity: 'warning', title: 'Review Your "No-Cost EMI" Conversions', description: 'Banks add processing fees + 18% GST on processing fees on "no-cost EMIs", making the true APR 8–16%. There is no such thing as truly free EMI.', lawCitation: 'RBI Digital Lending Guidelines 2022' }
    ]
  };
}

// ─── Main Dispatcher ────────────────────────────────────────────────────────

export function parseBillFromOCR(rawText: string, billType: BillType): BillData {
  switch (billType) {
    case 'restaurant':   return buildRestaurantBillData(parseRestaurant(rawText));
    case 'grocery':      return buildGroceryBillData(rawText);
    case 'electricity':  return buildElectricityBillData(rawText);
    case 'hotel':        return buildHotelBillData(rawText);
    case 'gas':          return buildGasBillData(rawText);
    case 'credit_card':  return buildCreditCardBillData(rawText);
    default:             return buildRestaurantBillData(parseRestaurant(rawText));
  }
}

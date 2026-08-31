/**
 * billParser.ts  — Robust OCR-text → BillData parser
 * Handles OCR noise: collapsed whitespace, split lines, symbol garbling.
 */

import { BillData, BillFlag, BillType, GSTDetails, LineItem } from '../types/bill';

// ─── Generic helpers ─────────────────────────────────────────────────────────

/** All positive numbers in a string, preserving order and handling OCR spaced decimals e.g. 693. 00 */
function nums(text: string): number[] {
  const sanitized = text.replace(/(\d+)\s*\.\s*(\d{1,2})\b/g, '$1.$2');
  return (sanitized.match(/\b\d[\d,]*\.?\d*\b/g) ?? [])
    .map(s => parseFloat(s.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);
}

/** Last positive number on a line (amount column) */
function lastNum(line: string): number {
  const all = nums(line);
  return all.length ? all[all.length - 1] : 0;
}

/** Regex-based safe extractor → number */
function getNum(text: string, re: RegExp): number {
  const m = text.match(re);
  if (!m) return 0;
  const raw = (m[1] ?? '0').replace(/\s+/g, '').replace(/,/g, '');
  return parseFloat(raw) || 0;
}

/** Regex-based safe extractor → string */
function getStr(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1]?.trim();
}

function approxEq(a: number, b: number, tol = 2): boolean {
  return Math.abs(a - b) <= tol;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

interface RestaurantParsed {
  restaurantName: string;
  gstin?: string;
  billNumber?: string;
  billDate?: string;
  items: Array<{ label: string; qty: number; rate: number; amount: number }>;
  subtotal: number;
  cgst: number; cgstRate: number;
  sgst: number; sgstRate: number;
  igst: number;
  serviceCharge: number;
  grandTotal: number;
}

function parseRestaurant(raw: string): RestaurantParsed {
  // Normalise — collapse tabs/multiple spaces but keep newlines
  const text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  // Also create a single-line version for cross-line patterns
  const flat = text.replace(/\n/g, ' ');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Restaurant name ──────────────────────────────────────────────────
  const restaurantName = lines.find(l =>
    l.length > 4 &&
    !/^\d/.test(l) &&
    !/^(name|date|no\.|gstin|fssai|ph:|phone|cashier|token|bill\s*no|take\s?away|dine|check|address)/i.test(l)
  ) ?? 'Restaurant';

  // ── Header fields ────────────────────────────────────────────────────
  const gstin      = getStr(text, /GSTIN[:\s]*([0-9A-Z]{15})/i);
  const billDate   = getStr(text, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  const billNumber = getStr(text, /bill\s*no[.:\s]*\s*(\w+)/i)
                  ?? getStr(text, /token\s*no[.:\s]*\s*\n?\s*(\w+)/i);

  // ── CGST / SGST ──────────────────────────────────────────────────────
  // Strategy: find the line, extract ALL numbers.
  // Rate = first small number (≤15), Amount = last larger number
  let cgstRate = 2.5, cgst = 0, sgstRate = 2.5, sgst = 0;

  const cgstLine = lines.find(l => /\bCGST\b/i.test(l));
  if (cgstLine) {
    const allNums = nums(cgstLine);
    const rate = allNums.find(n => n <= 15);
    const amt  = [...allNums].reverse().find(n => n > 5);
    if (rate) cgstRate = rate;
    if (amt && amt !== rate) cgst = amt;
    else if (allNums.length === 1) cgst = allNums[0];
  }

  const sgstLine = lines.find(l => /\bSGST\b/i.test(l));
  if (sgstLine) {
    const allNums = nums(sgstLine);
    const rate = allNums.find(n => n <= 15);
    const amt  = [...allNums].reverse().find(n => n > 5);
    if (rate) sgstRate = rate;
    if (amt && amt !== rate) sgst = amt;
    else if (allNums.length === 1) sgst = allNums[0];
  }

  const igst = lastNum(lines.find(l => /\bIGST\b/i.test(l)) ?? '');

  // ── Grand Total ──────────────────────────────────────────────────────
  // 1. "Grand Total ₹693.00"  2. "Grand Total 693.00"  3. "Grand-Total 693"
  let grandTotal = getNum(flat, /grand\s*total\s*[₹₨Rs.]?\s*([\d,]+\.?\d*)/i);

  if (!grandTotal) {
    grandTotal = getNum(flat, /(?:total\s*amount|net\s*total|amount\s*payable|net\s*payable)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  }
  if (!grandTotal) {
    // Look for the line that says just "Total" and get its last number
    const totalLine = lines.find(l => /^\s*Total\s*[₹₨]?\s*[\d,]/i.test(l) && !/cgst|sgst|sub|qty/i.test(l));
    if (totalLine) grandTotal = lastNum(totalLine);
  }

  // ── Sub Total ────────────────────────────────────────────────────────
  // Handle multi-line: "Total Qty: 5  Sub  660.00 \n Total"  OR "Sub Total  660.00"
  let subtotal = getNum(flat, /sub\s*total\s*[₹₨]?\s*([\d,]+\.?\d*)/i);

  if (!subtotal) {
    // The "Sub" keyword followed by amount (possibly on next line with "Total")
    for (let i = 0; i < lines.length; i++) {
      if (/\bsub\b/i.test(lines[i])) {
        const combined = lines.slice(i, i + 3).join(' ');
        const n = getNum(combined, /sub\s*(?:total)?\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
        if (n) { subtotal = n; break; }
        // last number on sub line
        const ln = lastNum(lines[i]);
        if (ln > (cgst + sgst)) { subtotal = ln; break; }
      }
    }
  }

  // Infer from grand total - gst
  if (!subtotal && grandTotal > 0 && (cgst > 0 || sgst > 0)) {
    subtotal = Math.round((grandTotal - cgst - sgst) * 100) / 100;
  }

  // ── Line items ───────────────────────────────────────────────────────
  // Find table section: between header row and "Total Qty" / "Sub Total"
  let iStart = lines.findIndex(l => /no\.?\s*item|qty\.?\s*price|no\.\s*qty/i.test(l));
  let iEnd   = lines.findIndex(l => /total\s*qty|sub\s*total/i.test(l));

  if (iStart === -1) {
    // fallback: start after date/cashier block
    iStart = lines.findIndex(l => /cashier|token/i.test(l)) + 1;
  }
  if (iEnd === -1) {
    iEnd = lines.findIndex(l => /\bCGST\b/i.test(l));
  }
  if (iStart < 0) iStart = 0;
  if (iEnd <= iStart) iEnd = lines.length;

  const tableLines = lines.slice(iStart + 1, iEnd);

  const items: RestaurantParsed['items'] = [];

  let curLabel = '';
  let curNums: number[] = [];

  const flush = () => {
    if (!curLabel || curNums.length < 2) return;
    // Try all combinations of (qty, rate, amt) from the collected numbers
    for (let a = 0; a < curNums.length - 1; a++) {
      for (let b = a + 1; b < curNums.length; b++) {
        for (let c = b + 1; c < curNums.length; c++) {
          const [q, r, amt] = [curNums[a], curNums[b], curNums[c]];
          if (Number.isInteger(q) && q >= 1 && q <= 50 && r > 0 && approxEq(q * r, amt, 2)) {
            items.push({ label: curLabel.trim(), qty: q, rate: r, amount: amt });
            return;
          }
        }
      }
    }
    // 2-number fallback: qty=1, rate=amount
    if (curNums.length >= 1) {
      const amt = curNums[curNums.length - 1];
      if (amt > 0 && amt < 5000) {
        items.push({ label: curLabel.trim(), qty: 1, rate: amt, amount: amt });
      }
    }
  };

  for (const line of tableLines) {
    // Skip header rows and purely numeric/empty lines
    if (/^(no|qty|price|amount|sl|sr)\.?$/i.test(line)) continue;

    const numbered = line.match(/^(\d+)\s+(.*)/);
    if (numbered) {
      flush();
      curLabel = '';
      curNums  = [];

      const rest = numbered[2];
      const lineNums = nums(rest);
      // Label = text before the first number in rest
      const labelPart = rest.replace(/\s+[\d,.].*$/, '').trim();
      curLabel = labelPart.length > 1 ? labelPart : rest.split(/\s+\d/)[0].trim();
      curNums  = lineNums;
    } else if (curLabel) {
      // continuation line — might be label text or just numbers
      const lineNums = nums(line);
      if (lineNums.length === 0) {
        curLabel += ' ' + line.replace(/^\d+\s*/, '').trim();
      } else {
        curNums.push(...lineNums);
      }
    }
  }
  flush();

  // If no items parsed but we know totals, create a summary item
  if (items.length === 0 && subtotal > 0) {
    items.push({ label: 'Food & Beverages (total)', qty: 1, rate: subtotal, amount: subtotal });
  }

  // Recompute subtotal from items if still missing
  if (!subtotal && items.length > 0) {
    subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  }

  // Grand total last resort
  if (!grandTotal) grandTotal = subtotal + cgst + sgst + igst;

  // Service charge
  const serviceCharge = getNum(flat, /service\s*charge[^0-9]*([\d,]+\.?\d*)/i);

  return {
    restaurantName, gstin, billNumber, billDate,
    items, subtotal, cgst, cgstRate, sgst, sgstRate, igst,
    serviceCharge, grandTotal
  };
}

function buildRestaurant(p: RestaurantParsed): BillData {
  const totalGST     = p.cgst + p.sgst + p.igst;
  const effectiveRate = p.subtotal > 0
    ? Math.round((totalGST / p.subtotal) * 1000) / 10  // 1 decimal
    : 0;
  const expectedTotal = p.subtotal + totalGST + p.serviceCharge;
  const totalOk       = p.grandTotal === 0 || approxEq(expectedTotal, p.grandTotal, 3);
  const gstOk         = Math.abs(effectiveRate - 5) < 0.6;

  const flags: BillFlag[] = [];

  // GST
  if (effectiveRate > 0) {
    if (gstOk) {
      flags.push({ id: 'gst-ok', severity: 'good',
        title: `✓ Correct ${effectiveRate}% GST (CGST ${p.cgstRate}% + SGST ${p.sgstRate}%)`,
        description: `Standalone restaurants must charge 5% composite GST without ITC. This bill correctly charges ${effectiveRate}% on ₹${p.subtotal.toFixed(2)}, giving GST of ₹${totalGST.toFixed(2)}.`,
        lawCitation: 'CBIC Notification No. 46/2017 – Central Tax (Rate)' });
    } else {
      flags.push({ id: 'gst-wrong', severity: 'danger',
        title: `⚠ GST Rate ${effectiveRate}% – Expected 5% for Standalone Restaurants`,
        description: `You were charged ${effectiveRate}% GST but standalone restaurants are capped at 5%. Excess: ₹${Math.abs(totalGST - p.subtotal * 0.05).toFixed(2)}.`,
        lawCitation: 'CBIC Notification No. 46/2017',
        actionable: true, disputeType: 'service_charge',
        savingsPotential: parseFloat(Math.abs(totalGST - p.subtotal * 0.05).toFixed(2)) });
    }
  }

  // Service charge
  if (p.serviceCharge > 0) {
    flags.push({ id: 'sc-illegal', severity: 'danger',
      title: `⚠ Illegal Mandatory Service Charge ₹${p.serviceCharge.toFixed(2)} Found!`,
      description: 'Since 4 July 2022, restaurants cannot impose mandatory service charges. Demand its removal. If refused, file at consumerhelpline.gov.in (toll-free 1800-11-4000).',
      lawCitation: 'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)',
      actionable: true, actionText: 'Generate dispute letter', disputeType: 'service_charge',
      savingsPotential: p.serviceCharge });
  } else {
    flags.push({ id: 'sc-ok', severity: 'good',
      title: '✓ No Illegal Service Charge',
      description: 'No mandatory service charge levied. Your consumer rights are respected on this bill.',
      lawCitation: 'CCPA Guidelines July 2022' });
  }

  // Total verification
  if (p.grandTotal > 0) {
    if (!totalOk) {
      const diff = Math.abs(expectedTotal - p.grandTotal);
      flags.push({ id: 'total-wrong', severity: 'danger',
        title: `⚠ Grand Total Discrepancy — ₹${diff.toFixed(2)} Extra`,
        description: `Items ₹${p.subtotal.toFixed(2)} + GST ₹${totalGST.toFixed(2)} = ₹${expectedTotal.toFixed(2)}, but bill shows ₹${p.grandTotal.toFixed(2)}.`,
        lawCitation: 'Consumer Protection Act 2019',
        savingsPotential: diff });
    } else {
      flags.push({ id: 'total-ok', severity: 'info',
        title: `✓ Grand Total ₹${p.grandTotal.toFixed(2)} Verified`,
        description: `₹${p.subtotal.toFixed(2)} + ₹${totalGST.toFixed(2)} GST = ₹${expectedTotal.toFixed(2)}. Arithmetic is correct.`,
        lawCitation: 'GST Invoice Rules 2017' });
    }
  }

  flags.push({ id: 'tip', severity: 'info',
    title: 'Tip / Gratuity is Always Voluntary',
    description: 'Tips are entirely at your discretion. Restaurants cannot add them to your bill without consent.',
    lawCitation: 'CCPA Guidelines July 2022' });

  const lineItems: LineItem[] = [
    ...p.items.map((it, i) => ({
      id: `it-${i}`, label: `${it.label} × ${it.qty}`,
      amount: it.amount, rate: it.rate, units: it.qty
    })),
    { id: 'sub', label: 'Sub Total', amount: p.subtotal },
    ...(p.cgst > 0 ? [{ id: 'cgst', label: `CGST @ ${p.cgstRate}%`, amount: p.cgst, isSubItem: true, gstRate: p.cgstRate }] : []),
    ...(p.sgst > 0 ? [{ id: 'sgst', label: `SGST @ ${p.sgstRate}%`, amount: p.sgst, isSubItem: true, gstRate: p.sgstRate }] : []),
    ...(p.igst > 0 ? [{ id: 'igst', label: 'IGST', amount: p.igst, isSubItem: true }] : []),
    ...(p.serviceCharge > 0 ? [{ id: 'sc', label: '⚠ Service Charge (ILLEGAL)', amount: p.serviceCharge, isSubItem: true, flagSeverity: 'danger' as const, flagMessage: 'Illegal under CCPA 2022' }] : []),
    { id: 'total', label: 'Grand Total', amount: p.grandTotal }
  ];

  const gstDetails: GSTDetails = {
    taxableAmount: p.subtotal, cgst: p.cgst, sgst: p.sgst, igst: p.igst,
    effectiveRate, isCorrectSlab: gstOk,
    serviceChargePresent: p.serviceCharge > 0, serviceChargeAmount: p.serviceCharge
  };

  const totalAmt = p.grandTotal > 0 ? p.grandTotal : p.subtotal + totalGST;

  return {
    id: `scanned-${Date.now()}`,
    type: 'restaurant', state: 'national',
    billerName: p.restaurantName,
    categoryLabel: 'Restaurant Bill',
    billNumber: p.billNumber ?? '-',
    billingCycle: 'Single Visit',
    billDate: p.billDate ?? todayStr(),
    dueDate: 'Paid',
    totalAmount: totalAmt,
    summaryPlain: `${p.items.length > 0 ? `${p.items.length} item(s) read from your receipt. ` : ''}${gstOk ? `Correct 5% GST applied (₹${totalGST.toFixed(2)}). ` : effectiveRate > 0 ? `GST rate anomaly detected. ` : ''}${p.serviceCharge > 0 ? `ALERT: Illegal service charge ₹${p.serviceCharge.toFixed(2)} found!` : 'No service charge — rights respected.'}`,
    lineItems, flags, gstDetails
  };
}

// ─── Grocery ──────────────────────────────────────────────────────────────────

function buildGrocery(raw: string): BillData {
  const flat  = raw.replace(/\n/g, ' ');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const storeName = lines.find(l => l.length > 4 && !/^\d/.test(l)) ?? 'Grocery Store';
  const grandTotal = getNum(flat, /(?:grand\s*total|net\s*amount|bill\s*total|total)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const discount   = getNum(flat, /discount\s*[₹₨]?\s*-?\s*([\d,]+\.?\d*)/i);

  const items: LineItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.+?)\s{2,}([\d,]+\.?\d*)\s*$/);
    if (m && !/total|tax|gst|cgst|sgst|discount/i.test(m[1])) {
      const amt = parseFloat(m[2].replace(',', ''));
      if (amt > 0 && amt < grandTotal * 0.95) {
        items.push({ id: `g${i}`, label: m[1].trim(), amount: amt });
      }
    }
  }

  return {
    id: `scanned-${Date.now()}`, type: 'grocery', state: 'national',
    billerName: storeName, categoryLabel: 'Grocery Bill',
    billNumber: getStr(raw, /bill\s*no[.:\s]*(\w+)/i) ?? '-',
    billingCycle: 'Purchase',
    billDate: getStr(raw, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ?? todayStr(),
    dueDate: 'Paid', totalAmount: grandTotal,
    summaryPlain: `${items.length} items extracted. Discount: ₹${discount.toFixed(2)}.`,
    lineItems: [...items,
      ...(discount > 0 ? [{ id: 'disc', label: 'Discount', amount: -discount }] : []),
      { id: 'total', label: 'Total', amount: grandTotal }],
    flags: [
      { id: 'mrp', severity: 'info', title: 'Check MRP on Each Item', description: 'Retailers cannot charge above the Maximum Retail Price printed on the package.', lawCitation: 'Legal Metrology Act 2009' },
      { id: 'gst-incl', severity: 'info', title: 'GST Is Included in MRP', description: 'For packaged goods, GST is already included in the MRP. A separate GST line on top of MRP is illegal.', lawCitation: 'GST Council – Consumer Pack Exemption' }
    ]
  };
}

// ─── Electricity ──────────────────────────────────────────────────────────────

function buildElectricity(raw: string): BillData {
  const flat  = raw.replace(/\n/g, ' ');
  const units = getNum(flat, /(?:units?|kwh|consumption)\s*[:\s]*([\d,]+)/i);
  const total = getNum(flat, /(?:amount\s*payable|bill\s*amount|grand\s*total|net\s*payable)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const discom = raw.match(/tangedco|tnpdcl|kseb|tsspdcl|tsnpdcl|bescom|msedcl/i)?.[0]?.toUpperCase() ?? 'DISCOM';
  return {
    id: `scanned-${Date.now()}`, type: 'electricity', state: 'national',
    billerName: `${discom} — Electricity Bill`, categoryLabel: 'Electricity',
    billNumber: '-',
    billingCycle: getStr(flat, /(\w+\s*\d{4}\s*[-–]\s*\w+\s*\d{4})/i) ?? 'Current Cycle',
    billDate: getStr(raw, /bill\s*date[:\s]*([\d\/\-\.]{6,})/i) ?? todayStr(),
    dueDate: getStr(raw, /due\s*date[:\s]*([\d\/\-\.]{6,})/i) ?? '-',
    totalAmount: total,
    summaryPlain: units ? `${units} units consumed. Total ₹${total?.toFixed(2) ?? '?'}` : 'Electricity bill scanned.',
    lineItems: [
      ...(units ? [{ id: 'u', label: `Units: ${units} kWh`, amount: total }] : []),
      { id: 'total', label: 'Amount Payable', amount: total }
    ],
    flags: [
      { id: 'slab', severity: 'info', title: 'Verify Your Tariff Slab', description: 'EB bills use telescopic slab pricing. Staying under 100/200/400/500 unit thresholds saves significantly.', lawCitation: 'SERC Tariff Orders' },
      { id: 'fixed', severity: 'info', title: 'Fixed Charges Are Statutory', description: 'Fixed charges, electricity duty and FPPCA are mandatory levies set by the Electricity Regulatory Commission.', lawCitation: 'Electricity Act 2003' }
    ]
  };
}

// ─── Hotel ────────────────────────────────────────────────────────────────────

function buildHotel(raw: string): BillData {
  const flat     = raw.replace(/\n/g, ' ');
  const roomRate = getNum(flat, /room\s*(?:rate|charge|tariff)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const nights   = getNum(flat, /(\d+)\s*(?:night|nite|day)/i) || 1;
  const grandTotal = getNum(flat, /(?:grand\s*total|net\s*total|amount\s*payable)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const cgst = getNum(flat, /CGST\s*[^0-9]*([\d,]+\.?\d*)\s*$/im);
  const sgst = getNum(flat, /SGST\s*[^0-9]*([\d,]+\.?\d*)\s*$/im);
  const roomTotal = roomRate * nights;
  const gstPaid = cgst + sgst;
  const gstRate = roomTotal > 0 ? Math.round((gstPaid / roomTotal) * 100) : 0;
  const correctRate = roomRate > 0 && roomRate < 7500 ? 12 : 18;

  return {
    id: `scanned-${Date.now()}`, type: 'hotel', state: 'national',
    billerName: raw.split('\n').find(l => l.trim().length > 4)?.trim() ?? 'Hotel',
    categoryLabel: 'Hotel Stay', billNumber: getStr(raw, /folio[.:\s]*(\w+)/i) ?? '-',
    billingCycle: `${nights} Night(s)`,
    billDate: getStr(raw, /(?:check.?in|date)[:\s]*([\d\/\-\.]{6,})/i) ?? todayStr(),
    dueDate: getStr(raw, /check.?out[:\s]*([\d\/\-\.]{6,})/i) ?? 'Paid',
    totalAmount: grandTotal,
    summaryPlain: `${nights} night(s)${roomRate ? ` at ₹${roomRate}/night` : ''}. GST ${gstRate > 0 ? gstRate + '%' : 'checking…'}`,
    lineItems: [
      ...(roomRate ? [{ id: 'room', label: `Room × ${nights} night(s)`, amount: roomTotal, rate: roomRate, units: nights }] : []),
      ...(cgst ? [{ id: 'cgst', label: 'CGST', amount: cgst, isSubItem: true }] : []),
      ...(sgst ? [{ id: 'sgst', label: 'SGST', amount: sgst, isSubItem: true }] : []),
      { id: 'total', label: 'Grand Total', amount: grandTotal }
    ],
    flags: [
      gstRate > 0 && Math.abs(gstRate - correctRate) > 1
        ? { id: 'gst-wrong', severity: 'danger', title: `⚠ Hotel GST ${gstRate}% — Expected ${correctRate}%`, description: `Room ₹${roomRate}/night → ${correctRate}% GST. Detected ${gstRate}%.`, lawCitation: 'GST Notification 20/2019-CT(Rate)', actionable: true }
        : { id: 'gst-ok', severity: 'good', title: `✓ Hotel GST ${correctRate}% Correct`, description: `Rooms ${roomRate < 7500 ? 'under ₹7,500/night → 12%' : '₹7,500+/night → 18%'}.`, lawCitation: 'GST Notification 20/2019-CT(Rate)' },
      { id: 'hidden', severity: 'warning', title: 'Check for Undisclosed Resort Fees', description: '"Resort fees" or "facility charges" not shown at booking time can be disputed under Consumer Protection Act 2019.', lawCitation: 'Consumer Protection Act 2019' }
    ]
  };
}

// ─── Gas ──────────────────────────────────────────────────────────────────────

function buildGas(raw: string): BillData {
  const flat  = raw.replace(/\n/g, ' ');
  const amt   = getNum(flat, /(?:amount|total|net\s*payable)\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const cyls  = getNum(flat, /(\d+)\s*(?:cylinder|refill|booking)/i);
  const gst   = getNum(flat, /(?:gst|igst)\s*@?\s*\d*\.?\d*\s*%?\s*[:\s]\s*([\d,]+\.?\d*)/i);
  return {
    id: `scanned-${Date.now()}`, type: 'gas', state: 'national',
    billerName: raw.match(/indane|bharat\s*gas|hpcl|igl|mgl|mahanagar/i)?.[0] ?? 'Gas Provider',
    categoryLabel: 'Gas Bill',
    billNumber: getStr(raw, /consumer\s*no[.:\s]*(\w+)/i) ?? '-',
    billingCycle: 'Delivery',
    billDate: getStr(raw, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ?? todayStr(),
    dueDate: 'Paid', totalAmount: amt,
    summaryPlain: `${cyls ? cyls + ' cylinder(s)' : 'Gas delivery'}. Total ₹${amt?.toFixed(2) ?? '?'}. GST ₹${gst?.toFixed(2) ?? '?'}.`,
    lineItems: [
      ...(cyls ? [{ id: 'cyl', label: `LPG × ${cyls}`, amount: amt - gst }] : []),
      ...(gst ? [{ id: 'gst', label: 'GST @ 5%', amount: gst, isSubItem: true, gstRate: 5 }] : []),
      { id: 'total', label: 'Total', amount: amt }
    ],
    flags: [
      { id: 'gst5', severity: 'good', title: '✓ Domestic LPG/PNG attracts 5% GST', description: 'Domestic gas connections are taxed at 5% GST — confirm this matches your bill.', lawCitation: 'GST Council – Entry 165' },
      { id: 'subsidy', severity: 'info', title: 'PMUY Subsidy Goes to Your Bank Account', description: 'If enrolled in PMUY, the subsidy is directly credited to your linked bank account — not deducted on the bill.', lawCitation: 'PMUY Guidelines' }
    ]
  };
}

// ─── Credit Card ──────────────────────────────────────────────────────────────

function buildCreditCard(raw: string): BillData {
  const flat = raw.replace(/\n/g, ' ');
  const minDue   = getNum(flat, /minimum\s*(?:amount\s*)?due\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const totalDue = getNum(flat, /total\s*(?:amount\s*)?due\s*[₹₨]?\s*([\d,]+\.?\d*)/i)
                || getNum(flat, /outstanding\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const creditLim = getNum(flat, /credit\s*limit\s*[₹₨]?\s*([\d,]+\.?\d*)/i);

  return {
    id: `scanned-${Date.now()}`, type: 'credit_card', state: 'national',
    billerName: raw.match(/hdfc|icici|axis|sbi\s*card|kotak|citibank|amex/i)?.[0]?.toUpperCase() ?? 'Credit Card',
    categoryLabel: 'Credit Card Statement',
    billNumber: getStr(raw, /card\s*(?:no|number)[.:\s]*(?:xx+)?(\d{4})/i) ?? '-',
    billingCycle: getStr(flat, /statement\s*period[:\s]*(.+?)(?:\s{2,}|\n|$)/i) ?? 'Monthly',
    billDate: getStr(flat, /statement\s*date[:\s]*([\d\/\-\.]{6,})/i) ?? todayStr(),
    dueDate: getStr(flat, /payment\s*due\s*date[:\s]*([\d\/\-\.]{6,})/i) ?? '-',
    totalAmount: totalDue,
    summaryPlain: `Total due ₹${totalDue?.toFixed(2) ?? '?'}. Min due ₹${minDue?.toFixed(2) ?? '?'}. Always pay full to avoid 36-42% effective annual interest.`,
    lineItems: [
      ...(creditLim ? [{ id: 'lim', label: 'Credit Limit', amount: creditLim }] : []),
      ...(totalDue ? [{ id: 'total', label: 'Total Amount Due', amount: totalDue }] : []),
      ...(minDue ? [{ id: 'min', label: 'Minimum Amount Due', amount: minDue, isSubItem: true, flagSeverity: 'warning' as const, flagMessage: 'Paying only minimum triggers 36-42% APR' }] : [])
    ],
    flags: [
      { id: 'min', severity: 'danger', title: '⚠ Never Pay Only the Minimum Due', description: 'Banks charge 3–3.5% per month (36–42% APR) on revolving balances. Always pay the full amount due.', lawCitation: 'RBI – Fair Practice Code for Credit Cards' },
      { id: 'emi', severity: 'warning', title: '"No-Cost EMI" Is Not Free', description: 'Processing fee + 18% GST on processing fee makes true APR 8–16%. There is no truly free EMI.', lawCitation: 'RBI Digital Lending Guidelines 2022' }
    ]
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export function parseBillFromOCR(rawText: string, billType: BillType): BillData {
  switch (billType) {
    case 'restaurant':  return buildRestaurant(parseRestaurant(rawText));
    case 'grocery':     return buildGrocery(rawText);
    case 'electricity': return buildElectricity(rawText);
    case 'hotel':       return buildHotel(rawText);
    case 'gas':         return buildGas(rawText);
    case 'credit_card': return buildCreditCard(rawText);
    default:            return buildRestaurant(parseRestaurant(rawText));
  }
}

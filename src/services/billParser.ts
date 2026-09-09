/**
 * billParser.ts  — Robust OCR-text → BillData parser
 * Handles OCR noise: collapsed whitespace, split lines, symbol garbling.
 */

import { BillData, BillFlag, BillType, GSTDetails, IndianState, LineItem } from '../types/bill';
import { calculateEBTariff, calculateMinimumDueTrap } from './billAnalyzer';

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

export interface RestaurantParsed {
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
  /** Whether Grand Total was actually read off the receipt, vs. backfilled from Sub Total + GST */
  grandTotalFromOCR: boolean;
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

  // ── Grand Total ─────────  // ── Sub Total ────────────────────────────────────────────────────────
  // Handle "Total Qty: 3  Sub Total 76.18" or "Sub Total 76.18"
  let subtotal = getNum(flat, /sub\s*total\s*[₹₨Rs.]?\s*([\d,]+\.?\d*)/i);

  if (!subtotal) {
    const subLine = lines.find(l => /\bsub\s*total\b/i.test(l) || /\bsubtotal\b/i.test(l));
    if (subLine) {
      // Get numbers on the line that are NOT immediately preceded by "Qty"
      const lineWithoutQty = subLine.replace(/qty\s*[:\s]*\d+/gi, '');
      subtotal = lastNum(lineWithoutQty);
    }
  }

  // ── CGST / SGST / IGST ───────────────────────────────────────────────
  let cgstRate = 2.5, cgst = 0, sgstRate = 2.5, sgst = 0;

  const cgstLine = lines.find(l => /\bCGST\b/i.test(l));
  if (cgstLine) {
    const allNums = nums(cgstLine);
    const rate = allNums.find(n => n <= 15);
    const amt  = [...allNums].reverse().find(n => n > 0 && n !== rate);
    if (rate) cgstRate = rate;
    if (amt) cgst = amt;
  }

  const sgstLine = lines.find(l => /\bSGST\b/i.test(l));
  if (sgstLine) {
    const allNums = nums(sgstLine);
    const rate = allNums.find(n => n <= 15);
    const amt  = [...allNums].reverse().find(n => n > 0 && n !== rate);
    if (rate) sgstRate = rate;
    if (amt) sgst = amt;
  }

  const igst = lastNum(lines.find(l => /\bIGST\b/i.test(l)) ?? '');

  // ── Grand Total ──────────────────────────────────────────────────────
  // Only look at lines after the item table header, avoiding Token No in header!
  const headerCutoff = lines.findIndex(l => /token|cashier|bill\s*no/i.test(l));
  const footerLines = headerCutoff >= 0 ? lines.slice(headerCutoff + 1) : lines;
  const footerText = footerLines.join(' ');

  let grandTotal = getNum(footerText, /grand\s*total\s*[₹₨Rs.zZ2]?\s*([\d,]+\.?\d*)/i);

  if (!grandTotal) {
    const gtLine = footerLines.find(l => /grand\s*total/i.test(l));
    if (gtLine) grandTotal = lastNum(gtLine);
  }
  if (!grandTotal) {
    const netLine = footerLines.find(l => /(?:net\s*payable|amount\s*payable|bill\s*total)/i.test(l));
    if (netLine) grandTotal = lastNum(netLine);
  }

  // ── Line Items Parsing (handles both numbered & unnumbered receipt items) ──
  const items: RestaurantParsed['items'] = [];

  // Identify table boundaries
  let iStart = lines.findIndex(l => /item|description|qty|price|amount/i.test(l));
  let iEnd   = lines.findIndex(l => /total\s*qty|sub\s*total|subtotal|\bcgst\b/i.test(l));

  if (iStart === -1) iStart = lines.findIndex(l => /cashier|token|dine\s*in|take\s*away/i.test(l)) + 1;
  if (iEnd === -1) iEnd = lines.findIndex(l => /\b(cgst|sgst|grand\s*total)\b/i.test(l));
  if (iStart < 0) iStart = 0;
  if (iEnd <= iStart || iEnd > lines.length) iEnd = lines.length;

  const tableLines = lines.slice(iStart + 1, iEnd);

  for (const line of tableLines) {
    if (/^(no|qty|price|amount|sl|sr|item)\.?$/i.test(line)) continue;
    // Tax/rate rows (e.g. "CGST@2.5 2.5%", garbled OCR variants like "COST@2.525%")
    // always carry a '%' or '@' — genuine food items never do. Skip them outright so
    // they can't get miscounted as a line item.
    if (/[%@]/.test(line)) continue;

    const lineNums = nums(line);
    if (lineNums.length === 0) continue;

    // Remove leading line number if present e.g. "1 Idly 33.33 33.33"
    let cleanLine = line.replace(/^\d+\s+/, '');
    const cleanNums = nums(cleanLine);

    const cleanLabel = (raw: string) => raw
      .replace(/[()]/g, '')
      .replace(/^[^A-Za-z0-9]+/, '')   // strip leading OCR noise: ~ | " ` etc.
      .replace(/[^A-Za-z0-9\s]+$/, '') // strip trailing noise
      .trim();

    // A genuine item label needs at least 2 real letters — rejects noise like "I", "|", "95"
    const looksLikeItem = (label: string) => (label.match(/[A-Za-z]/g)?.length ?? 0) >= 2
      && !/total|qty|sub|cgst|sgst|cost@/i.test(label);

    if (cleanNums.length >= 2) {
      // Case A: "Idly ( 2 Pcs) 1 33.33 33.33" -> qty=1, rate=33.33, amt=33.33
      // Case B: "Medhu Vadai 1 33.33 33.33"
      const amt = cleanNums[cleanNums.length - 1];
      const rate = cleanNums.length >= 2 ? cleanNums[cleanNums.length - 2] : amt;
      const qty = cleanNums.length >= 3 ? cleanNums[cleanNums.length - 3] : 1;

      // Label is text before the first price number
      const label = cleanLabel(cleanLine.split(/\s+\d+[.,]?\d*/)[0]);

      if (looksLikeItem(label) && amt > 0 && amt < 10000) {
        items.push({
          label: label || 'Food Item',
          qty: qty > 0 && qty <= 50 ? qty : 1,
          rate: rate > 0 ? rate : amt,
          amount: amt
        });
      }
    } else if (cleanNums.length === 1) {
      // Single price line e.g. "Gas 9.52" or "Filter Coffee 40"
      const amt = cleanNums[0];
      const label = cleanLabel(cleanLine.replace(/\s+\d+[.,]?\d*/, ''));

      if (looksLikeItem(label) && amt > 0 && amt < 10000) {
        items.push({
          label: label || 'Item',
          qty: 1,
          rate: amt,
          amount: amt
        });
      }
    }
  }

  // Recompute subtotal from parsed items if missing or mismatched
  const itemsSum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  if (itemsSum > 0 && (!subtotal || Math.abs(subtotal - itemsSum) > 5)) {
    subtotal = itemsSum;
  }

  // Reconcile the printed Grand Total against Sub Total + GST.
  // The Grand Total is usually printed larger/bolder than the item table and is the
  // more reliable OCR read, so it takes priority — we only override it when it fits a
  // known OCR-garbling pattern (e.g. '₹80.00' misread as '280.00', the '₹' glyph
  // getting read as a stray leading digit). Otherwise, if it's missing entirely, we
  // fall back to the computed Sub Total + GST.
  const computedGrand = Math.round((subtotal + cgst + sgst) * 100) / 100;
  const grandTotalFromOCR = grandTotal > 0;

  if (grandTotal > 0 && computedGrand > 0 && Math.abs(grandTotal - computedGrand) > 3) {
    // Stray leading digit before the true amount (e.g. 280.00 vs 80.00, or 2280 vs 280)
    const strippedLeadingDigit = parseFloat(grandTotal.toString().replace(/^\d/, ''));
    if (Math.abs(strippedLeadingDigit - computedGrand) <= 3) {
      grandTotal = Math.round(computedGrand);
    }
    // Otherwise trust the printed Grand Total as read — do not silently overwrite it.
  } else if (!grandTotal && computedGrand > 0) {
    grandTotal = computedGrand;
  }

  const serviceCharge = getNum(flat, /service\s*charge[^0-9]*([\d,]+\.?\d*)/i);

  return {
    restaurantName, gstin, billNumber, billDate,
    items, subtotal, cgst, cgstRate, sgst, sgstRate, igst,
    serviceCharge, grandTotal, grandTotalFromOCR
  };
}


export function buildRestaurant(p: RestaurantParsed): BillData {
  const totalGST     = p.cgst + p.sgst + p.igst;
  const expectedTotal = p.subtotal + totalGST + p.serviceCharge;

  // The item table (and the Sub Total derived from it) is the least reliable part of
  // the OCR read — a blurry photo often garbles it while the bolder Grand Total still
  // reads fine. If the item-derived Sub Total is wildly inconsistent with the (trusted)
  // Grand Total, treat the item breakdown as unreadable rather than showing bogus
  // line items or GST/discrepancy flags computed from them.
  //
  // When the Grand Total itself was never independently read off the receipt (only
  // backfilled from Sub Total + GST), there's nothing to cross-check the items against
  // — in that case, require CGST *and* SGST to have been independently detected as a
  // substitute corroboration (every standalone-restaurant bill carries both by law).
  const itemsReliable = p.items.length > 0 && p.subtotal > 0 && (
    p.grandTotalFromOCR
      ? Math.abs(expectedTotal - p.grandTotal) <= Math.max(15, p.grandTotal * 0.5)
      : p.cgst > 0 && p.sgst > 0
  );

  // Only surface a total when we actually have grounds to trust it: either it was
  // read directly off the receipt, or it was backfilled from a Sub Total + GST we've
  // corroborated as reliable. Otherwise, show nothing rather than a number computed
  // from garbled items — the caller falls back to a clear "please retake" state.
  const trustedGrandTotal = (p.grandTotalFromOCR || itemsReliable) ? p.grandTotal : 0;

  const reliableSubtotal = itemsReliable ? p.subtotal : 0;
  const reliableItems    = itemsReliable ? p.items : [];

  const effectiveRate = reliableSubtotal > 0
    ? Math.round((totalGST / reliableSubtotal) * 1000) / 10  // 1 decimal
    : 0;
  const totalOk = p.grandTotal === 0 || approxEq(reliableSubtotal + totalGST + p.serviceCharge, p.grandTotal, 3);
  const gstOk   = Math.abs(effectiveRate - 5) < 0.6;

  const flags: BillFlag[] = [];

  // Item table unreadable/unreliable even though a total was found — surface a retake
  // prompt rather than presenting an unverified line-by-line audit as if it were reliable.
  if (!itemsReliable && p.grandTotalFromOCR) {
    flags.push({ id: 'ocr-low-quality', severity: 'warning',
      title: '⚠ Item Details Unclear — Retake for Full Breakdown',
      description: 'We could read the bill total but not the individual item lines clearly. For an accurate line-by-line audit, please retake a sharper photo in good light or re-upload the original.',
      lawCitation: '' });
  }

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
        description: `You were charged ${effectiveRate}% GST but standalone restaurants are capped at 5%. Excess: ₹${Math.abs(totalGST - reliableSubtotal * 0.05).toFixed(2)}.`,
        lawCitation: 'CBIC Notification No. 46/2017',
        actionable: true, disputeType: 'service_charge',
        savingsPotential: parseFloat(Math.abs(totalGST - reliableSubtotal * 0.05).toFixed(2)) });
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

  // Total verification — only meaningful once we trust the item breakdown
  if (p.grandTotal > 0 && itemsReliable) {
    const reliableExpectedTotal = reliableSubtotal + totalGST + p.serviceCharge;
    if (!totalOk) {
      const diff = Math.abs(reliableExpectedTotal - p.grandTotal);
      flags.push({ id: 'total-wrong', severity: 'danger',
        title: `⚠ Grand Total Discrepancy — ₹${diff.toFixed(2)} Extra`,
        description: `Items ₹${reliableSubtotal.toFixed(2)} + GST ₹${totalGST.toFixed(2)} = ₹${reliableExpectedTotal.toFixed(2)}, but bill shows ₹${p.grandTotal.toFixed(2)}.`,
        lawCitation: 'Consumer Protection Act 2019',
        savingsPotential: diff });
    } else {
      flags.push({ id: 'total-ok', severity: 'info',
        title: `✓ Grand Total ₹${p.grandTotal.toFixed(2)} Verified`,
        description: `₹${reliableSubtotal.toFixed(2)} + ₹${totalGST.toFixed(2)} GST = ₹${reliableExpectedTotal.toFixed(2)}. Arithmetic is correct.`,
        lawCitation: 'GST Invoice Rules 2017' });
    }
  }

  flags.push({ id: 'tip', severity: 'info',
    title: 'Tip / Gratuity is Always Voluntary',
    description: 'Tips are entirely at your discretion. Restaurants cannot add them to your bill without consent.',
    lawCitation: 'CCPA Guidelines July 2022' });

  const lineItems: LineItem[] = [
    ...reliableItems.map((it, i) => ({
      id: `it-${i}`, label: `${it.label} × ${it.qty}`,
      amount: it.amount, rate: it.rate, units: it.qty
    })),
    ...(itemsReliable ? [{ id: 'sub', label: 'Sub Total', amount: reliableSubtotal }] : []),
    ...(p.cgst > 0 ? [{ id: 'cgst', label: `CGST @ ${p.cgstRate}%`, amount: p.cgst, isSubItem: true, gstRate: p.cgstRate }] : []),
    ...(p.sgst > 0 ? [{ id: 'sgst', label: `SGST @ ${p.sgstRate}%`, amount: p.sgst, isSubItem: true, gstRate: p.sgstRate }] : []),
    ...(p.igst > 0 ? [{ id: 'igst', label: 'IGST', amount: p.igst, isSubItem: true }] : []),
    ...(p.serviceCharge > 0 ? [{ id: 'sc', label: '⚠ Service Charge (ILLEGAL)', amount: p.serviceCharge, isSubItem: true, flagSeverity: 'danger' as const, flagMessage: 'Illegal under CCPA 2022' }] : []),
    { id: 'total', label: 'Grand Total', amount: trustedGrandTotal }
  ];

  const gstDetails: GSTDetails = {
    taxableAmount: reliableSubtotal, cgst: p.cgst, sgst: p.sgst, igst: p.igst,
    effectiveRate, isCorrectSlab: gstOk,
    serviceChargePresent: p.serviceCharge > 0, serviceChargeAmount: p.serviceCharge
  };

  const totalAmt = trustedGrandTotal;

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
    summaryPlain: `${itemsReliable ? `${reliableItems.length} item(s) read from your receipt. ` : ''}${gstOk && itemsReliable ? `Correct 5% GST applied (₹${totalGST.toFixed(2)}). ` : effectiveRate > 0 && itemsReliable ? `GST rate anomaly detected. ` : ''}${p.serviceCharge > 0 ? `ALERT: Illegal service charge ₹${p.serviceCharge.toFixed(2)} found!` : 'No service charge — rights respected.'}`,
    lineItems, flags, gstDetails
  };
}

// ─── Grocery ──────────────────────────────────────────────────────────────────

export interface GroceryParsed {
  storeName: string;
  items: Array<{ label: string; amount: number }>;
  discount: number;
  roundOff: number;
  grandTotal: number;
  billNumber?: string;
  billDate?: string;
  /** Only present on the minority of grocery/kirana receipts that print an explicit
   *  tax breakdown ("TAX BILL" style) instead of folding GST silently into the price. */
  taxableValue?: number;
  cgst?: number;
  sgst?: number;
}

function parseGrocery(raw: string): GroceryParsed {
  const flat  = raw.replace(/\n/g, ' ');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const storeName = lines.find(l => l.length > 4 && !/^\d/.test(l)) ?? 'Grocery Store';
  const discount   = getNum(flat, /discount\s*[:\s]*[₹₨]?\s*-?\s*([\d,]+\.?\d*)/i);
  const roundOff   = getNum(flat, /round\s*off\s*[:\s]*[₹₨]?\s*(-?[\d,]+\.?\d*)/i);

  // Lines that are structural/metadata noise, never a purchased item
  const isNoiseLine = (label: string) =>
    /total|sub\s*total|tax|gst|cgst|sgst|discount|round\s*off|no\.?\s*of\s*items|t\s*wt|weight|operator|bill\s*#|mc\s*#|ph[:.]|item\s*name|wt\/qty|price|amt\b/i.test(label);

  const items: Array<{ label: string; amount: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.+?)\s{2,}([\d,]+\.?\d*)\s*$/);
    if (m && !isNoiseLine(m[1]) && (m[1].match(/[A-Za-z]/g)?.length ?? 0) >= 2) {
      const amt = parseFloat(m[2].replace(',', ''));
      if (amt > 0) items.push({ label: m[1].trim(), amount: amt });
    }
  }

  // Some tax-invoice-style POS receipts (HSN code tables) split each item across two
  // lines: "1.) Item Name" followed by "HSN MRP OurPrice Qty Value" — try that shape
  // when the single-line strategy above found nothing.
  if (items.length === 0) {
    for (let i = 0; i < lines.length - 1; i++) {
      const nameMatch = lines[i].match(/^\d+[.)]+\s*(.+)/);
      if (!nameMatch) continue;
      const cols = nums(lines[i + 1]);
      // Expect HSN, MRP, OurPrice, Qty, Value — the Value (last column) is the amount
      if (cols.length >= 4) {
        const amt = cols[cols.length - 1];
        const label = nameMatch[1].trim();
        if (label.length >= 2 && amt > 0) {
          items.push({ label, amount: amt });
        }
      }
    }
  }

  const itemsSum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  // 1. Explicit total label, if the receipt has one — covers "Grand Total"/"Net Amount"/
  //    "Bill Total"/"Net Payable"/"Amount Payable"/"PAY:" (tax-invoice style), and both
  //    ₹/₨ symbols and a plain "Rs." prefix.
  let grandTotal = getNum(flat, /(?:grand\s*total|net\s*amount|bill\s*total|net\s*payable|amount\s*payable|\bpay)\s*[:\s]*[₹₨]?\s*(?:rs\.?)?\s*([\d,]+\.?\d*)/i);

  // 2. Many compact POS receipts mark only the final payable amount with a ₹/₨ symbol and
  //    no "Total" label at all — take the last such standalone amount, skipping weight/item-count lines.
  if (!grandTotal) {
    const rupeeLines = lines.filter(l => /[₹₨]\s*[\d,]+\.?\d*/.test(l) && !isNoiseLine(l));
    if (rupeeLines.length) grandTotal = lastNum(rupeeLines[rupeeLines.length - 1]);
  }

  // 3. Fall back to items + round-off if still nothing found
  const computedTotal = Math.round((itemsSum + roundOff) * 100) / 100;
  if (!grandTotal && computedTotal > 0) {
    grandTotal = computedTotal;
  } else if (grandTotal && computedTotal > 0 && Math.abs(grandTotal - computedTotal) > 3) {
    // Correct the same '₹' → stray-leading-digit OCR artifact seen on restaurant bills
    const strippedLeadingDigit = parseFloat(grandTotal.toString().replace(/^\d/, ''));
    if (Math.abs(strippedLeadingDigit - computedTotal) <= 3) {
      grandTotal = Math.round(computedTotal);
    }
    // Otherwise trust the amount actually printed/read on the receipt.
  }

  return {
    storeName, items, discount, roundOff, grandTotal,
    billNumber: getStr(raw, /bill\s*no[.:\s]*(\w+)/i),
    billDate: getStr(raw, /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/)
  };
}

export function buildGroceryFromParsed(p: GroceryParsed): BillData {
  const taxableValue = p.taxableValue ?? 0;
  const cgst = p.cgst ?? 0;
  const sgst = p.sgst ?? 0;
  const totalGST = cgst + sgst;
  const hasTaxBreakdown = cgst > 0 && sgst > 0;

  const flags: BillFlag[] = [
    { id: 'mrp', severity: 'info', title: 'Check MRP on Each Item', description: 'Retailers cannot charge above the Maximum Retail Price printed on the package.', lawCitation: 'Legal Metrology Act 2009' }
  ];

  // Most receipts fold GST silently into the price with nothing to verify. When a
  // receipt does print an explicit breakdown (taxable value + CGST + SGST), check
  // whether it actually reconciles to the total paid — if so, that's real evidence
  // GST was included rather than stacked on top, so show the real figures instead
  // of just the generic reassurance.
  if (hasTaxBreakdown && Math.abs((taxableValue + totalGST) - p.grandTotal) <= 2) {
    flags.push({ id: 'gst-incl', severity: 'good',
      title: `✓ GST (₹${totalGST.toFixed(2)}) Verified Included in Price`,
      description: `This receipt breaks out its tax: ₹${taxableValue.toFixed(2)} taxable value + ₹${totalGST.toFixed(2)} GST = ₹${(taxableValue + totalGST).toFixed(2)}, matching the total you paid. GST is correctly folded into the price, not added on top.`,
      lawCitation: 'GST Council – Consumer Pack Exemption' });
  } else {
    flags.push({ id: 'gst-incl', severity: 'info', title: 'GST Is Included in MRP', description: 'For packaged goods, GST is already included in the MRP. A separate GST line on top of MRP is illegal.', lawCitation: 'GST Council – Consumer Pack Exemption' });
  }

  if (!p.grandTotal) {
    flags.unshift({ id: 'ocr-low-quality', severity: 'warning',
      title: '⚠ Bill Total Unclear — Retake Required',
      description: 'We could not reliably read the total amount on this receipt. Please retake a sharper photo in good light or re-upload the original.',
      lawCitation: '' });
  }

  return {
    id: `scanned-${Date.now()}`, type: 'grocery', state: 'national',
    billerName: p.storeName, categoryLabel: 'Grocery Bill',
    billNumber: p.billNumber ?? '-',
    billingCycle: 'Purchase',
    billDate: p.billDate ?? todayStr(),
    dueDate: 'Paid', totalAmount: p.grandTotal,
    summaryPlain: `${p.items.length} item(s) extracted.${p.discount > 0 ? ` Discount: ₹${p.discount.toFixed(2)}.` : ''}`,
    lineItems: [...p.items.map((it, i) => ({ id: `g${i}`, label: it.label, amount: it.amount })),
      ...(hasTaxBreakdown ? [
        { id: 'taxable', label: 'Taxable Value', amount: taxableValue },
        { id: 'cgst', label: 'CGST', amount: cgst, isSubItem: true },
        { id: 'sgst', label: 'SGST', amount: sgst, isSubItem: true }
      ] : []),
      ...(p.discount > 0 ? [{ id: 'disc', label: 'Discount', amount: -p.discount }] : []),
      ...(p.roundOff !== 0 ? [{ id: 'round', label: 'Round off', amount: p.roundOff, isSubItem: true }] : []),
      { id: 'total', label: 'Total', amount: p.grandTotal }],
    flags
  };
}

function buildGrocery(raw: string): BillData {
  return buildGroceryFromParsed(parseGrocery(raw));
}

// ─── Electricity ──────────────────────────────────────────────────────────────

export interface ElectricityParsed {
  discom: string;
  serviceConn?: string;
  consumerName?: string;
  consumedUnits: number;
  total: number;
  energyCharges: number;
  govtSubsidy: number;
  adjustments: number;
  roundOff: number;
  dueDate: string;
  billPeriod: string;
  meterNumber?: string;
  /** Printed category text, e.g. "Domestic" / "Non-Domestic" / "Cat 1A Domestic" — used to
   *  decide whether the domestic slab-savings model applies at all (commercial/industrial
   *  connections are billed on a completely different, non-slab tariff). */
  category?: string;
  contractedLoadKW?: number;
  phase?: 1 | 3;
  /** Extra flat charges seen on Telangana-style bills — read and shown as-is, never
   *  independently recomputed (no official simple formula for these ancillary items).
   *  Populated individually by the regex/OCR fallback path (no field-count limit there);
   *  the LLM path instead populates the single consolidated otherChargesAndArrears below
   *  (Anthropic's structured outputs cap a schema at 16 nullable fields). */
  customerCharges?: number;
  interestOnED?: number;
  surcharge?: number;
  acdSurcharge?: number;
  fsaFcaCharges?: number;
  interestOnSD?: number;
  lossGain?: number;
  arrears?: number;
  otherChargesAndArrears?: number;
}

/** Maps a detected discom name to the state whose tariff rules apply. Falls back to
 *  Tamil Nadu only when nothing else matches, to preserve existing behaviour for bills
 *  where the discom genuinely couldn't be read. */
function detectStateFromDiscom(discom: string): IndianState {
  const d = discom.toLowerCase();
  if (/kseb/.test(d)) return 'kerala';
  if (/tgspdcl|tgnpdcl|tsspdcl|tsnpdcl/.test(d)) return 'telangana';
  return 'tamil_nadu';
}

function parseElectricity(raw: string): ElectricityParsed {
  const flat = raw.replace(/\n/g, ' ');

  // DISCOM detection — TGSPDCL/TGNPDCL are the real current Telangana discom names
  // (older bills/documents sometimes still say TSSPDCL/TSNPDCL, kept for compatibility).
  const discom = raw.match(/tangedco|tnpdcl|kseb|tgspdcl|tgnpdcl|tsspdcl|tsnpdcl|bescom|msedcl/i)?.[0]?.toUpperCase() ?? 'TNPDCL — TANGEDCO';

  // Consumer & Connection details
  const serviceConn = getStr(raw, /(?:service\s*connection|servie\s*connection|consumer\s*no)[^0-9]*([0-9\-]+)/i)
                   ?? getStr(raw, /(09-\d{3}-\d{3}-\d{3})/);
  // Name sits immediately after the "...of the Consumer" label, right before the address
  // (PLOT/DOOR/FLAT/a house number). Bounded + anchored to that neighbourhood so it can't
  // run on into unrelated header text further down the page (there's no reliable line break
  // to stop at — PDF text extraction joins the whole page into one line).
  const consumerName = getStr(raw, /consumer\s{0,3}[:\n]?\s{0,3}([A-Z][A-Za-z.\s]{1,30}?)(?=\s+(?:PLOT|DOOR|FLAT|NO\.?|STREET|\d)|,|\n)/i);

  // 1. Units consumed — read directly off the meter-reading row, the only reliably
  // structured source for this ("Final Reading | Initial Reading | MF | Consumption ...").
  // e.g. "READING 8120.0 7490.0 1 630.0 0.00 0.0 0.0"
  let units = 0;
  const readingMatch = flat.match(/reading\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
  if (readingMatch) {
    const finalR = parseFloat(readingMatch[1]);
    const initialR = parseFloat(readingMatch[2]);
    const consumptionCol = parseFloat(readingMatch[4]);
    const diff = finalR - initialR;
    if (consumptionCol > 0 && consumptionCol < 5000) units = consumptionCol;
    else if (diff > 0 && diff < 5000) units = diff;
  }
  if (!units) {
    // Fallback: an explicit "Units: NNN" label (Telangana bills print this directly
    // rather than a combined reading row) or an "NNN units" mention elsewhere.
    const labelled = flat.match(/\bunits\s*[:\-]\s*(\d{1,4})\b/i);
    const trailing = flat.match(/\b(\d{1,4})\s*units\b/i);
    const val = parseFloat((labelled ?? trailing)?.[1] ?? '');
    if (val > 0 && val < 5000) units = val;
  }
  const consumedUnits = Math.round(units);

  // Category (Domestic vs Non-Domestic/Commercial) — determines whether the domestic
  // slab-savings model applies at all; e.g. "Cat 1A Domestic", "Cat: 2(B) Non-Domestic".
  const category = getStr(raw, /cat[.:]?\s*[\dA-Z()]*\s*(non[\s\-]?domestic|domestic)/i);
  const contractedLoadKW = getNum(flat, /contracted\s*load[^\d]*(\d+(?:\.\d+)?)/i) || undefined;
  const phase: 1 | 3 | undefined = /ph[.:]?\s*3\b/i.test(flat) ? 3 : /ph[.:]?\s*1\b/i.test(flat) ? 1 : undefined;

  // 2. Bill Total Amount (Net Payable) — strictly exclude year numbers (2020–2030)
  let total = 0;
  const totalMatches = [
    ...flat.matchAll(/(?:net\s*payable|bill\s*amount|grand\s*total|rs\.?)\s*[a-z0-9\s()+\-*\/]*?([\d,]+\.?\d*)/gi)
  ];
  for (const m of totalMatches) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 100 && (val < 2020 || val > 2030) && val < 50000) {
      total = val;
      break;
    }
  }

  // 3. Line Item charges — tax-invoice-style EB bills print an HSN/SAC code (a bare
  // integer, e.g. "2716 0000") between the label and the actual amount, so grabbing the
  // first number after the label picks up the code instead. Money on these bills is
  // always printed with two decimals, so look for the first "X.XX"-shaped number in a
  // bounded window after the label instead — that skips the code and lands on the amount.
  const moneyAfter = (labelRe: RegExp, window = 100): number => {
    const idx = flat.search(labelRe);
    if (idx < 0) return 0;
    const m = flat.slice(idx, idx + window).match(/([\d,]+\.\d{2})/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };
  const energyCharges = moneyAfter(/energy\s*charges/i);
  const govtSubsidy   = moneyAfter(/govt\s*subsidy/i);
  const adjustments   = moneyAfter(/adjustments/i);
  const roundOff       = getNum(flat, /round\s*off[^\d]*(-?[\d,]+\.?\d*)/i);

  // Telangana-style flat charges — read and shown as-is, never independently recomputed.
  const customerCharges = moneyAfter(/customer\s*charges/i) || undefined;
  const interestOnED    = moneyAfter(/interest\s*on\s*ed\b/i) || undefined;
  const surcharge       = moneyAfter(/\bsurcharge\b(?!\s*charges)/i) || undefined;
  const acdSurcharge    = moneyAfter(/acd\s*surcharge/i) || undefined;
  const fsaFcaCharges   = moneyAfter(/fsa\s*\/?\s*fca\s*charges/i) || undefined;
  const interestOnSD    = moneyAfter(/interest\s*on\s*sd\b/i) || undefined;
  const lossGain        = getNum(flat, /loss\s*\/\s*gain[^\d\-]*(-?[\d,]+\.?\d*)/i) || undefined;
  const arrears         = moneyAfter(/total\s*due/i) > total ? moneyAfter(/total\s*due/i) - total : undefined;

  // Fallback total computation from energy charges - subsidy if the total label wasn't found.
  // If neither this nor the label search above found anything, leave total at 0 — the
  // caller's low-quality fallback handles an unreadable bill rather than us guessing a number.
  if (!total && energyCharges > 0) {
    total = Math.round((energyCharges - govtSubsidy - adjustments) * 100) / 100;
  }

  // Dates & Month
  const dueDate = getStr(raw, /due\s*date[^\d]*([\d\/\-\.]{6,})/i) ?? '-';
  const monthStr = getStr(flat, /month\s*of\s*([A-Za-z0-9\s]+?)(?:\s+Bill|\s+Due|\n|$)/i);
  const billPeriod = monthStr ? `Month of ${monthStr.trim()}` : (getStr(flat, /bill\s*period[^\d]*([\d\/\-\.]{6,}\s*[-–]\s*[\d\/\-\.]{6,})/i) ?? 'LT Consumption Bill');

  return {
    discom, serviceConn, consumerName, consumedUnits, total,
    energyCharges, govtSubsidy, adjustments, roundOff, dueDate, billPeriod,
    meterNumber: getStr(raw, /meter\s*no[^\d]*(\d+)/i),
    category, contractedLoadKW, phase,
    customerCharges, interestOnED, surcharge, acdSurcharge, fsaFcaCharges, interestOnSD, lossGain, arrears
  };
}

function isNonDomestic(category?: string): boolean {
  return !!category && /non/i.test(category);
}

/** Shared line-item builder — every extra field is only shown if actually present,
 *  so this renders identically to before for bills that don't have them (e.g. TN). */
function buildElectricityLineItems(p: ElectricityParsed): LineItem[] {
  const { energyCharges, govtSubsidy, adjustments, roundOff, consumedUnits, total,
    customerCharges, interestOnED, surcharge, acdSurcharge, fsaFcaCharges, interestOnSD, lossGain, arrears,
    otherChargesAndArrears } = p;
  let idx = 0;
  const next = () => String(++idx);
  const items: LineItem[] = [];
  items.push(energyCharges > 0
    ? { id: next(), label: `Energy Charges (${consumedUnits} units consumed)`, amount: energyCharges }
    : { id: next(), label: `Consumed Units: ${consumedUnits} kWh`, amount: total });
  if (customerCharges) items.push({ id: next(), label: 'Customer Charges', amount: customerCharges, isSubItem: true });
  if (govtSubsidy > 0) items.push({ id: next(), label: 'Govt Subsidy Exemption', amount: -govtSubsidy });
  if (interestOnED) items.push({ id: next(), label: 'Interest on Electricity Duty', amount: interestOnED, isSubItem: true });
  if (surcharge) items.push({ id: next(), label: 'Surcharge', amount: surcharge, isSubItem: true });
  if (acdSurcharge) items.push({ id: next(), label: 'ACD Surcharge', amount: acdSurcharge, isSubItem: true });
  if (fsaFcaCharges) items.push({ id: next(), label: 'FSA/FCA Charges', amount: fsaFcaCharges, isSubItem: true });
  if (interestOnSD) items.push({ id: next(), label: 'Interest on Security Deposit', amount: interestOnSD, isSubItem: true });
  if (adjustments > 0) items.push({ id: next(), label: 'Prior Adjustments / SD', amount: -adjustments });
  if (lossGain) items.push({ id: next(), label: 'Loss/Gain', amount: lossGain, isSubItem: true });
  // LLM-sourced scans report these consolidated into one figure instead of the
  // granular fields above (see ElectricityParsed) — shown as a single line.
  if (otherChargesAndArrears) items.push({ id: next(), label: 'Other Charges & Arrears', amount: otherChargesAndArrears, isSubItem: true });
  if (roundOff !== 0) items.push({ id: next(), label: 'Round off', amount: roundOff, isSubItem: true });
  if (arrears) items.push({ id: next(), label: 'Arrears', amount: arrears });
  items.push({ id: 'total', label: 'Net Amount Payable', amount: total });
  return items;
}

function buildTamilNaduElectricity(p: ElectricityParsed): BillData {
  const { discom, serviceConn, consumerName, consumedUnits, total, govtSubsidy, dueDate, billPeriod, meterNumber } = p;

  // TANGEDCO Telescopic Slabs for consumedUnits
  // Slabs: 0-100 (Free), 101-200 (@ ₹2.35), 201-400 (@ ₹4.95), 401-500 (@ ₹6.80), 501+ (@ ₹8.40)
  const slabBreakdown = [
    { slabRange: '0–100 units (Govt Subsidy)', unitsCharged: Math.min(consumedUnits, 100), ratePerUnit: 0, totalCost: 0, isFree: true },
    ...(consumedUnits > 100 ? [{ slabRange: '101–200 units @ ₹2.35', unitsCharged: Math.min(consumedUnits - 100, 100), ratePerUnit: 2.35, totalCost: Math.min(consumedUnits - 100, 100) * 2.35 }] : []),
    ...(consumedUnits > 200 ? [{ slabRange: '201–400 units @ ₹4.95', unitsCharged: Math.min(consumedUnits - 200, 200), ratePerUnit: 4.95, totalCost: Math.min(consumedUnits - 200, 200) * 4.95 }] : []),
    ...(consumedUnits > 400 ? [{ slabRange: '401–500 units @ ₹6.80', unitsCharged: Math.min(consumedUnits - 400, 100), ratePerUnit: 6.80, totalCost: Math.min(consumedUnits - 400, 100) * 6.80 }] : []),
    ...(consumedUnits > 500 ? [{ slabRange: `501+ units @ ₹8.40 (${consumedUnits - 500} excess units)`, unitsCharged: consumedUnits - 500, ratePerUnit: 8.40, totalCost: (consumedUnits - 500) * 8.40, colorHex: '#DC2626' }] : [])
  ];

  const excessUnits = Math.max(0, consumedUnits - 500);
  const displayName = consumerName ? `${discom} (${consumerName.trim()})` : `${discom} — Electricity Bill`;

  return {
    id: `scanned-${Date.now()}`,
    type: 'electricity',
    state: 'tamil_nadu',
    billerName: displayName,
    categoryLabel: 'Electricity Bill',
    billNumber: serviceConn ? `Conn: ${serviceConn}` : 'LT Consumption Bill',
    billingCycle: billPeriod,
    billDate: todayStr(),
    dueDate,
    totalAmount: total,
    summaryPlain: consumedUnits > 0
      ? `TANGEDCO bi-monthly residential bill for ${consumedUnits} units. ${excessUnits > 0 ? `You crossed into the highest slab (501+ units) by ${excessUnits} units.` : 'Within subsidised slab limits (under 500 units).'}${govtSubsidy > 0 ? ` Govt subsidy applied: -₹${govtSubsidy.toFixed(2)}.` : ''} Net payable: ₹${total.toLocaleString('en-IN')}.`
      : `TANGEDCO bi-monthly residential bill. Units consumed could not be read clearly.${govtSubsidy > 0 ? ` Govt subsidy applied: -₹${govtSubsidy.toFixed(2)}.` : ''} Net payable: ₹${total.toLocaleString('en-IN')}.`,
    lineItems: buildElectricityLineItems(p),
    ebDetails: {
      state: 'tamil_nadu',
      discomName: discom,
      meterNumber: meterNumber ?? '1026753',
      consumedUnits,
      slabBreakdown,
      fixedCharges: 0,
      electricityDuty: 0,
      fuelSurcharge: 0,
      nextSlabThreshold: excessUnits > 0 ? {
        limit: 500,
        excessUnits,
        excessCost: excessUnits * 8.40,
        potentialSavings: Math.round(excessUnits * 8.40),
        tip: `Staying under 500 units next cycle keeps you out of the top ₹8.40 slab — saves ~₹${Math.round(excessUnits * 8.40)}.`
      } : undefined
    },
    flags: [
      ...(consumedUnits === 0 ? [{
        id: 'ocr-low-quality' as const,
        severity: 'warning' as const,
        title: '⚠ Units Consumed Unclear — Retake for Full Breakdown',
        description: 'We could read the bill amount but not the meter-reading row clearly. For an accurate slab-by-slab breakdown, please retake a sharper photo/scan in good light or re-upload the original.',
        lawCitation: ''
      }] : []),
      ...(consumedUnits === 0 ? [] : [excessUnits > 0
        ? {
            id: 'flag-eb-slab-jump',
            severity: 'danger' as const,
            title: `⚠ High Slab Warning — ${excessUnits} Units Over 500 Threshold`,
            description: `You consumed ${consumedUnits} units. The ${excessUnits} units above 500 are billed at the maximum ₹8.40/unit tier. Reducing usage below 500 units saves ~₹${Math.round(excessUnits * 8.40)} per cycle.`,
            savingsPotential: Math.round(excessUnits * 8.40),
            actionable: true,
            actionText: 'View Energy Saving Blueprint',
            lawCitation: 'TNERC Domestic Tariff Order 2024-2026'
          }
        : {
            id: 'flag-eb-normal',
            severity: 'good' as const,
            title: `✓ Consumption (${consumedUnits} Units) Within Subsidised Slabs`,
            description: `Total consumption of ${consumedUnits} units is under the 500-unit high penalty threshold. First 100 units free by TN Govt subsidy.`,
            lawCitation: 'TN Govt Energy Dept G.O. Ms. No. 34'
          }]),
      {
        id: 'flag-eb-no-gst',
        severity: 'good',
        title: '✓ Electricity Supply is Exempt from GST (0% GST)',
        description: 'Under Indian tax law, domestic electricity consumption is exempt from GST. Bills are governed by State Electricity Regulatory Commission (SERC) tariff slabs, not restaurant GST.',
        lawCitation: 'CBIC Notification No. 12/2017 – Central Tax (Rate)'
      },
      ...(govtSubsidy > 0 ? [{
        id: 'flag-eb-subsidy',
        severity: 'info' as const,
        title: `✓ TN Govt Subsidy (-₹${govtSubsidy.toFixed(2)}) Applied`,
        description: 'First 100 units provided at ₹0 cost + tariff subsidies as mandated by the Tamil Nadu State Electricity Subsidy scheme.',
        lawCitation: 'TN Govt Energy Dept G.O. Ms. No. 34'
      }] : [])
    ]
  };
}

/** Domestic Telangana/Kerala bills — uses the same calculateEBTariff() the interactive
 *  What-If Simulator uses, so the initial scan result and the slider agree with each
 *  other, and both are built on the same verified official tariff tables. */
function buildStateDomesticElectricity(p: ElectricityParsed, state: 'telangana' | 'kerala'): BillData {
  const { discom, serviceConn, consumerName, consumedUnits, total, dueDate, billPeriod, meterNumber, contractedLoadKW, phase } = p;
  const calculated = calculateEBTariff(state, consumedUnits, contractedLoadKW, phase);
  const displayName = consumerName ? `${discom} (${consumerName.trim()})` : `${discom} — Electricity Bill`;
  const regulator = state === 'telangana' ? 'TGERC' : 'KSERC';
  const citation = state === 'telangana'
    ? 'TGERC Retail Supply Tariff Order, Table 2-51 (FY 2025-26, retained for FY 2026-27)'
    : 'KSERC Schedule of Tariff for Retail Supply (01.04.2025–31.03.2027)';

  return {
    id: `scanned-${Date.now()}`,
    type: 'electricity',
    state,
    billerName: displayName,
    categoryLabel: 'Electricity Bill',
    billNumber: serviceConn ? `Conn: ${serviceConn}` : 'LT Consumption Bill',
    billingCycle: billPeriod,
    billDate: todayStr(),
    dueDate,
    totalAmount: total,
    summaryPlain: consumedUnits > 0
      ? `${discom} domestic bill for ${consumedUnits} units. ${calculated.nextSlabThreshold ? calculated.nextSlabThreshold.tip : 'Within the lowest tariff category for this cycle.'} Net payable: ₹${total.toLocaleString('en-IN')}.`
      : `${discom} domestic bill. Units consumed could not be read clearly. Net payable: ₹${total.toLocaleString('en-IN')}.`,
    lineItems: buildElectricityLineItems(p),
    ebDetails: { ...calculated, meterNumber: meterNumber ?? calculated.meterNumber },
    flags: [
      ...(consumedUnits === 0 ? [{
        id: 'ocr-low-quality' as const,
        severity: 'warning' as const,
        title: '⚠ Units Consumed Unclear — Retake for Full Breakdown',
        description: 'We could read the bill amount but not the units consumed clearly. For an accurate slab-by-slab breakdown, please retake a sharper photo/scan in good light or re-upload the original.',
        lawCitation: ''
      }] : []),
      ...(consumedUnits === 0 ? [] : [calculated.nextSlabThreshold
        ? {
            id: 'flag-eb-slab-jump' as const,
            severity: 'danger' as const,
            title: `⚠ Category Jump — Re-rated at ${consumedUnits} Units`,
            description: calculated.nextSlabThreshold.tip,
            savingsPotential: calculated.nextSlabThreshold.potentialSavings,
            lawCitation: citation
          }
        : {
            id: 'flag-eb-normal' as const,
            severity: 'good' as const,
            title: `✓ Consumption (${consumedUnits} Units) in the Lowest Tariff Category`,
            description: `Total consumption of ${consumedUnits} units keeps you in the cheapest ${regulator} domestic tariff category for this cycle.`,
            lawCitation: citation
          }]),
      {
        id: 'flag-eb-no-gst',
        severity: 'good',
        title: '✓ Electricity Supply is Exempt from GST (0% GST)',
        description: `Under Indian tax law, domestic electricity consumption is exempt from GST. Bills are governed by ${regulator} tariff slabs, not restaurant GST.`,
        lawCitation: 'CBIC Notification No. 12/2017 – Central Tax (Rate)'
      }
    ]
  };
}

/** Non-domestic bills (commercial/industrial) and any state we don't have a verified
 *  slab model for yet — read and show the real charges accurately without inventing
 *  a slab-savings claim we can't back with an official source. */
function buildGenericElectricity(p: ElectricityParsed, state: IndianState): BillData {
  const { discom, serviceConn, consumerName, consumedUnits, total, dueDate, billPeriod, category } = p;
  const displayName = consumerName ? `${discom} (${consumerName.trim()})` : `${discom} — Electricity Bill`;

  return {
    id: `scanned-${Date.now()}`,
    type: 'electricity',
    state,
    billerName: displayName,
    categoryLabel: category ? `Electricity Bill — ${category}` : 'Electricity Bill',
    billNumber: serviceConn ? `Conn: ${serviceConn}` : 'LT Consumption Bill',
    billingCycle: billPeriod,
    billDate: todayStr(),
    dueDate,
    totalAmount: total,
    summaryPlain: `${discom}${category ? ` (${category})` : ''} bill${consumedUnits > 0 ? ` for ${consumedUnits} units` : ''}. Net payable: ₹${total.toLocaleString('en-IN')}.`,
    lineItems: buildElectricityLineItems(p),
    flags: [
      {
        id: 'flag-eb-no-gst',
        severity: 'good',
        title: '✓ Electricity Supply is Exempt from GST (0% GST)',
        description: 'Under Indian tax law, electricity consumption is exempt from GST.',
        lawCitation: 'CBIC Notification No. 12/2017 – Central Tax (Rate)'
      }
    ]
  };
}

export function buildElectricityFromParsed(p: ElectricityParsed): BillData {
  const state = detectStateFromDiscom(p.discom);
  if (isNonDomestic(p.category)) return buildGenericElectricity(p, state);
  if (state === 'telangana' || state === 'kerala') return buildStateDomesticElectricity(p, state);
  return buildTamilNaduElectricity(p);
}

function buildElectricity(raw: string): BillData {
  return buildElectricityFromParsed(parseElectricity(raw));
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

export interface CreditCardParsed {
  bankName: string;
  cardNumbers?: string[];
  statementPeriod?: string;
  billDate?: string;
  dueDate?: string;
  totalAmountDue: number;
  minimumAmountDue?: number;
  creditLimit?: number;
  /** Actual stated APR from the statement, when available — a real, receipt-specific
   *  rate is far more useful (and honest) than the generic 36-42% range everyone quotes. */
  aprPercent?: number;
}

export function buildCreditCardFromParsed(p: CreditCardParsed): BillData {
  const hasRealAPR = p.aprPercent !== undefined && p.aprPercent > 0;
  const minDuePct = p.totalAmountDue > 0 && p.minimumAmountDue !== undefined
    ? Math.round((p.minimumAmountDue / p.totalAmountDue) * 1000) / 10
    : undefined;

  // "If you only ever pay the minimum, how long until this is actually paid off?" —
  // reuses the same declining-balance simulator as the standalone EMI calculator,
  // but personalized: the bill's own minDue/totalDue ratio (when both are known)
  // instead of a generic 5% assumption, and the bill's own APR when it's printed.
  let creditCardPayoff: BillData['creditCardPayoff'];
  if (p.totalAmountDue > 0) {
    const monthlyRatePercent = hasRealAPR ? p.aprPercent! / 12 : 3.6;
    const minDueRatePercent = minDuePct !== undefined && minDuePct > 0
      ? Math.min(Math.max(minDuePct, 1), 20) // clamp to a sane range in case of odd/garbled data
      : 5;
    const trap = calculateMinimumDueTrap(p.totalAmountDue, monthlyRatePercent, minDueRatePercent);
    creditCardPayoff = {
      monthsToPayoff: trap.monthsToPayoff,
      yearsToPayoff: trap.yearsToPayoff,
      totalInterestPaid: trap.totalInterestPaid,
      totalPaid: trap.totalPaid,
      minDueRatePercent: trap.minDueRatePercent,
      annualAPR: trap.annualAPR,
      neverPaysOff: trap.neverPaysOff,
      warningSummary: trap.warningSummary
    };
  }

  const flags: BillFlag[] = [
    hasRealAPR
      ? { id: 'min', severity: 'danger',
          title: `⚠ Never Pay Only the Minimum Due — This Card's APR Is ${p.aprPercent}%`,
          description: `Your statement states an Annual Percentage Rate of ${p.aprPercent}% on revolving balances${minDuePct !== undefined ? ` — paying just the ${minDuePct}% minimum due leaves the rest accruing interest at that rate` : ''}. Always pay the full amount due to avoid it.`,
          lawCitation: 'RBI – Fair Practice Code for Credit Cards' }
      : { id: 'min', severity: 'danger',
          title: '⚠ Never Pay Only the Minimum Due',
          description: 'Banks typically charge 3–3.5% per month (36–42% effective APR) on revolving balances — this statement doesn\'t print its exact rate, so check your card\'s T&C. Always pay the full amount due.',
          lawCitation: 'RBI – Fair Practice Code for Credit Cards' },
    { id: 'emi', severity: 'warning', title: '"No-Cost EMI" Is Not Free', description: 'Processing fee + 18% GST on processing fee makes true APR 8–16%. There is no truly free EMI.', lawCitation: 'RBI Digital Lending Guidelines 2022' }
  ];

  return {
    id: `scanned-${Date.now()}`, type: 'credit_card', state: 'national',
    billerName: p.bankName,
    categoryLabel: 'Credit Card Statement',
    billNumber: p.cardNumbers?.length ? p.cardNumbers.join(', ') : '-',
    billingCycle: p.statementPeriod ?? 'Monthly',
    billDate: p.billDate ?? todayStr(),
    dueDate: p.dueDate ?? '-',
    totalAmount: p.totalAmountDue,
    summaryPlain: `Total due ₹${p.totalAmountDue.toFixed(2)}.${p.minimumAmountDue !== undefined ? ` Min due ₹${p.minimumAmountDue.toFixed(2)}.` : ''} Always pay full to avoid ${hasRealAPR ? `${p.aprPercent}%` : '36-42%'} effective annual interest.`,
    lineItems: [
      ...(p.creditLimit ? [{ id: 'lim', label: 'Credit Limit', amount: p.creditLimit }] : []),
      { id: 'total', label: 'Total Amount Due', amount: p.totalAmountDue },
      ...(p.minimumAmountDue !== undefined ? [{ id: 'min', label: 'Minimum Amount Due', amount: p.minimumAmountDue, isSubItem: true, flagSeverity: 'warning' as const, flagMessage: hasRealAPR ? `Paying only minimum accrues interest at ${p.aprPercent}% APR` : 'Paying only minimum triggers 36-42% APR' }] : [])
    ],
    flags,
    creditCardPayoff
  };
}

function buildCreditCard(raw: string): BillData {
  const flat = raw.replace(/\n/g, ' ');
  const minDue   = getNum(flat, /minimum\s*(?:amount\s*)?due\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const totalDue = getNum(flat, /total\s*(?:amount\s*)?due\s*[₹₨]?\s*([\d,]+\.?\d*)/i)
                || getNum(flat, /outstanding\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const creditLim = getNum(flat, /credit\s*limit\s*[₹₨]?\s*([\d,]+\.?\d*)/i);
  const cardLast4 = getStr(raw, /card\s*(?:no|number)[.:\s]*(?:xx+)?\s*(\d{4})/i);
  const apr = getNum(flat, /(?:annual\s*percentage\s*rate|apr)\s*(?:\([^)]*\))?\s*(?:is|of)?\s*[:\s]*([\d.]+)\s*%/i);

  return buildCreditCardFromParsed({
    bankName: raw.match(/hdfc|icici|axis|sbi\s*card|kotak|citibank|amex|idfc\s*first/i)?.[0]?.toUpperCase() ?? 'Credit Card',
    cardNumbers: cardLast4 ? [cardLast4] : undefined,
    statementPeriod: getStr(flat, /statement\s*period[:\s]*(.+?)(?:\s{2,}|\n|$)/i),
    billDate: getStr(flat, /statement\s*date[:\s]*([\d\/\-\.]{6,})/i),
    dueDate: getStr(flat, /payment\s*due\s*date[:\s]*([\d\/\-\.]{6,})/i),
    totalAmountDue: totalDue,
    minimumAmountDue: minDue || undefined,
    creditLimit: creditLim || undefined,
    aprPercent: apr || undefined
  });
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

// ─── LLM-based extraction (vision) ─────────────────────────────────────────────
// Structured shape the backend's vision-model call is asked to return. This replaces
// the "OCR text -> regex" step only — every field below feeds into the SAME
// compliance-flag / line-item logic above (buildRestaurant, buildGroceryFromParsed,
// buildElectricityFromParsed), so GST checks, slab math, and legal citations are
// identical between the OCR path and the LLM path.
export interface LLMBillExtraction {
  /** False when the model determines the scanned content doesn't match the category
   *  the user picked (e.g. an electricity bill scanned as "grocery"). */
  matchesCategory?: boolean;
  billerName: string;
  billNumber?: string;
  billDate?: string;
  grandTotal: number;

  // Restaurant / Grocery line items
  items?: Array<{ label: string; qty?: number; rate?: number; amount: number }>;
  subtotal?: number;
  cgst?: number;
  cgstRate?: number;
  sgst?: number;
  sgstRate?: number;
  igst?: number;
  serviceCharge?: number;
  discount?: number;
  roundOff?: number;
  gstin?: string;
  /** Grocery-only: pre-tax value on the minority of receipts that print an explicit tax breakdown */
  taxableValue?: number;

  // Electricity
  discomName?: string;
  serviceConnectionNumber?: string;
  consumerName?: string;
  meterNumber?: string;
  consumedUnits?: number;
  energyCharges?: number;
  govtSubsidy?: number;
  adjustments?: number;
  dueDate?: string;
  billPeriod?: string;
  /** Printed category, e.g. "Domestic" / "Non-Domestic" — decides whether the domestic
   *  slab-savings model applies at all. */
  category?: string;
  contractedLoadKW?: number;
  /** Raw value from the worker (a plain number — see worker/src/index.ts for why this
   *  isn't typed as a 1|3 literal union) — normalized to 1|3 in buildBillFromLLMExtraction. */
  phase?: number;
  /** Sum of Customer Charges/Surcharge/ACD Surcharge/FSA-FCA/Interest on ED&SD/Loss-Gain/
   *  Arrears — consolidated into one field because Anthropic's structured outputs cap a
   *  schema at 16 nullable fields (see worker/src/index.ts). */
  otherChargesAndArrears?: number;

  // Credit Card (text-based extraction, not vision)
  bankName?: string;
  cardNumbers?: string[];
  statementPeriod?: string;
  statementDate?: string;
  paymentDueDate?: string;
  totalAmountDue?: number;
  minimumAmountDue?: number;
  creditLimit?: number;
  aprPercent?: number;
}

/**
 * Builds a BillData from a clean structured extraction (e.g. from a vision-model
 * call) instead of noisy OCR text. Only restaurant/grocery/electricity are wired up
 * today — other types throw so the caller can fall back to the OCR pipeline.
 */
export function buildBillFromLLMExtraction(data: LLMBillExtraction, billType: BillType): BillData {
  switch (billType) {
    case 'restaurant': {
      const items = (data.items ?? []).map(it => ({
        label: it.label, qty: it.qty ?? 1, rate: it.rate ?? it.amount, amount: it.amount
      }));
      const subtotal = data.subtotal ?? 0;
      let cgst = data.cgst ?? 0;
      let sgst = data.sgst ?? 0;
      let serviceCharge = data.serviceCharge ?? 0;

      // Most Indian standalone restaurants have no service charge at all, and are
      // legally required to charge exactly 5% GST (2.5% CGST + 2.5% SGST) — so a
      // reported "service charge" that turns out to be a fragment of a misread tax
      // line is a real, observed failure mode, not a hypothetical one: if folding it
      // back into CGST/SGST brings their combined total much closer to the legally
      // expected 5% of the subtotal than leaving it separate does, it's almost
      // certainly a duplicated/misread tax amount, not a genuine extra charge —
      // redistribute it back rather than accusing the business of an illegal fee.
      if (serviceCharge > 0 && subtotal > 0) {
        const expectedGST = subtotal * 0.05;
        const fitWithoutServiceCharge = Math.abs((cgst + sgst) - expectedGST);
        const fitWithServiceCharge = Math.abs((cgst + sgst + serviceCharge) - expectedGST);
        if (fitWithServiceCharge < fitWithoutServiceCharge - 0.5) {
          const redistributed = Math.round(((cgst + sgst + serviceCharge) / 2) * 100) / 100;
          cgst = redistributed;
          sgst = redistributed;
          serviceCharge = 0;
        }
      }

      // The CGST/SGST percentage line is consistently the least legible field on a
      // printed receipt (small font, often faint) — far less reliable than the
      // item-derived subtotal or the bold Grand Total. If the directly-read CGST+SGST
      // disagrees substantially with what the bill's own arithmetic implies
      // (grandTotal - subtotal - serviceCharge), trust that arithmetic over the small
      // print and split the implied tax evenly. This does NOT hide a genuine
      // GST-rate violation: the compliance check runs on the resulting effective
      // rate (total tax / subtotal), which reflects the same violation either way —
      // only the unreliable CGST-vs-SGST split is being corrected, not the total.
      if (subtotal > 0 && data.grandTotal > 0) {
        const impliedTax = data.grandTotal - subtotal - serviceCharge;
        const readTax = cgst + sgst;
        if (impliedTax > 0 && Math.abs(impliedTax - readTax) > Math.max(2, impliedTax * 0.15)) {
          const half = Math.round((impliedTax / 2) * 100) / 100;
          cgst = half;
          sgst = half;
        }
      }

      return buildRestaurant({
        restaurantName: data.billerName,
        gstin: data.gstin,
        billNumber: data.billNumber,
        billDate: data.billDate,
        items,
        subtotal,
        cgst, cgstRate: data.cgstRate ?? 2.5,
        sgst, sgstRate: data.sgstRate ?? 2.5,
        igst: data.igst ?? 0,
        serviceCharge,
        grandTotal: data.grandTotal,
        grandTotalFromOCR: true
      });
    }
    case 'grocery': {
      return buildGroceryFromParsed({
        storeName: data.billerName,
        items: (data.items ?? []).map(it => ({ label: it.label, amount: it.amount })),
        discount: data.discount ?? 0,
        roundOff: data.roundOff ?? 0,
        grandTotal: data.grandTotal,
        billNumber: data.billNumber,
        billDate: data.billDate,
        taxableValue: data.taxableValue,
        cgst: data.cgst,
        sgst: data.sgst
      });
    }
    case 'electricity': {
      return buildElectricityFromParsed({
        discom: data.discomName ?? 'TNPDCL — TANGEDCO',
        serviceConn: data.serviceConnectionNumber,
        consumerName: data.consumerName,
        consumedUnits: Math.round(data.consumedUnits ?? 0),
        total: data.grandTotal,
        energyCharges: data.energyCharges ?? 0,
        govtSubsidy: data.govtSubsidy ?? 0,
        adjustments: data.adjustments ?? 0,
        roundOff: data.roundOff ?? 0,
        dueDate: data.dueDate ?? '-',
        billPeriod: data.billPeriod ?? 'LT Consumption Bill',
        meterNumber: data.meterNumber,
        category: data.category,
        contractedLoadKW: data.contractedLoadKW,
        // Worker sends a plain number (see worker/src/index.ts) — normalize to 1|3 here.
        phase: data.phase === 3 ? 3 : data.phase === 1 ? 1 : undefined,
        otherChargesAndArrears: data.otherChargesAndArrears
      });
    }
    case 'credit_card': {
      return buildCreditCardFromParsed({
        bankName: data.bankName ?? 'Credit Card',
        cardNumbers: data.cardNumbers,
        statementPeriod: data.statementPeriod,
        billDate: data.statementDate,
        dueDate: data.paymentDueDate,
        totalAmountDue: data.totalAmountDue ?? 0,
        minimumAmountDue: data.minimumAmountDue,
        creditLimit: data.creditLimit,
        aprPercent: data.aprPercent
      });
    }
    default:
      throw new Error(`LLM extraction not wired up yet for bill type "${billType}" — fall back to OCR.`);
  }
}

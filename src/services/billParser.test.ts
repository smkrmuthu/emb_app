import { describe, it, expect } from 'vitest';
import { buildRestaurant, RestaurantParsed } from './billParser';

/**
 * Regression test: reported live on a real "ADYAR ANANDA BHAVAN" bill where
 * the LLM correctly read the printed rate labels (CGST @ 2.5%, SGST @ 2.5%)
 * but the extracted rupee tax amounts didn't quite reconcile with the
 * extracted subtotal (₹8.5 + ₹8.5 against a ₹230 subtotal implies ~7.4%, not
 * 2.5%+2.5%=5%). The old effectiveRate math derived the "rate actually
 * charged" from those rupee amounts, so a restaurant charging the correct,
 * legal 5% GST got flagged with "⚠ GST Rate 7.4% – Expected 5%" — a false
 * accusation caused by rupee-amount rounding/OCR noise, not by any real
 * overcharge (the rate labels the bill actually printed were correct).
 */
function baseInput(overrides: Partial<RestaurantParsed> = {}): RestaurantParsed {
  return {
    restaurantName: 'ADYAR ANANDA BHAVAN SWEETS',
    items: [
      { label: 'PLAIN DOSAI', qty: 1, rate: 70, amount: 70 },
      { label: 'POORI [2 NOS]', qty: 1, rate: 75, amount: 75 },
      { label: 'SAMBAR VADAI [1 PC]', qty: 1, rate: 55, amount: 55 },
      { label: 'TEA', qty: 1, rate: 35, amount: 35 }
    ],
    subtotal: 230,
    cgst: 8.5, cgstRate: 2.5,
    sgst: 8.5, sgstRate: 2.5,
    igst: 0,
    serviceCharge: 0,
    grandTotal: 247,
    grandTotalFromOCR: true,
    ...overrides
  };
}

describe('buildRestaurant — GST rate flag uses the printed rate, not a rupee-amount ratio', () => {
  it('does not flag a real 2.5%+2.5% bill as an anomalous rate just because the rupee amounts do not reconcile exactly', () => {
    const bill = buildRestaurant(baseInput());

    const gstFlag = bill.flags.find((f) => f.id === 'gst-ok' || f.id === 'gst-wrong');
    expect(gstFlag?.id).toBe('gst-ok');
    expect(gstFlag?.title).toContain('5%');
    expect(gstFlag?.title).not.toContain('7.4%');
  });

  it('still flags a genuinely wrong printed rate (e.g. 9%+9%) as an anomaly', () => {
    const bill = buildRestaurant(baseInput({ cgstRate: 9, sgstRate: 9, cgst: 20.7, sgst: 20.7, grandTotal: 271.4 }));

    const gstFlag = bill.flags.find((f) => f.id === 'gst-ok' || f.id === 'gst-wrong');
    expect(gstFlag?.id).toBe('gst-wrong');
    expect(gstFlag?.title).toContain('18%');
  });
});

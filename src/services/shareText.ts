import { BillData } from '../types/bill';

export function buildWhatsAppShareText(bill: BillData): string {
  return `📋 *Bill Summary: ${bill.billerName}*\n💰 Total: ₹${bill.totalAmount.toLocaleString('en-IN')}\n📅 Period: ${bill.billingCycle}\n💡 *Plain English Decode:* ${bill.summaryPlain}\n\nExplained clearly via Explain My Bill (explainmybill.in)`;
}

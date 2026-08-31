import { DisputeLetterDraft, DisputeType, BillData } from '../types/bill';

export function generateDisputeLetter(type: DisputeType, bill: BillData): DisputeLetterDraft {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  switch (type) {
    case 'service_charge':
      return {
        subject: `URGENT: Request to remove mandatory service charge on Invoice #${bill.billNumber}`,
        recipient: `Management / Billing Desk, ${bill.billerName}`,
        bodyText: `Date: ${today}

To,
The Manager / Billing Team,
${bill.billerName}

Subject: Objection to levy of Service Charge on Bill #${bill.billNumber} (Amount: ₹${bill.totalAmount})

Dear Sir / Madam,

I recently dined at your establishment on ${bill.billDate} and was presented with Invoice #${bill.billNumber} totaling ₹${bill.totalAmount}. 

Upon reviewing the itemized breakdown, I noticed an automatic levy of Service Charge amounting to ₹${bill.gstDetails?.serviceChargeAmount || 75.00} (plus associated GST).

I would like to draw your immediate attention to the guidelines issued by the Central Consumer Protection Authority (CCPA) under File No. J-25/4/2020-CCPA dated 4th July 2022:

1. No hotel or restaurant shall add service charge automatically or by default in the bill.
2. Service charge cannot be collected from consumers by any other name.
3. No hotel or restaurant shall force a consumer to pay service charge and shall clearly inform the consumer that service charge is voluntary, optional and at the consumer's discretion.

In light of the statutory CCPA directives and National Consumer Helpline guidelines, I request you to kindly revise the invoice by removing the service charge component immediately and refund the excess amount of ₹${bill.gstDetails?.serviceChargeAmount || 75.00} charged to my payment mode.

Looking forward to your prompt response.

Yours sincerely,
A Concerned Consumer
Contact / Payment Reference: Ref-${bill.billNumber}`,
        legalReferences: [
          'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)',
          'Section 18(2)(l) of Consumer Protection Act 2019',
          'National Consumer Helpline (NCH) Portal Docket standard'
        ],
        recommendedAction: 'Hand this letter to the restaurant manager or email their customer support desk.'
      };

    case 'emi_misleading':
      return {
        subject: `Dispute regarding hidden processing fee and GST on advertised "0% No-Cost EMI" - Ref #${bill.billNumber}`,
        recipient: `Grievance Redressal Officer, ${bill.billerName}`,
        bodyText: `Date: ${today}

To,
The Nodal / Grievance Officer,
${bill.billerName}

Subject: Misleading representation of 0% No Cost EMI on transaction Ref #${bill.billNumber}

Dear Grievance Officer,

I am writing regarding transaction #${bill.billNumber} initiated for ${bill.emiDetails?.productName || 'product purchase'} under the marketed "0% No-Cost EMI" scheme.

The transaction was advertised at an effective interest rate of 0.0%. However, upon inspecting my monthly credit card statement, I have been debited:
1. One-time processing fee of ₹${bill.emiDetails?.processingFee || 999} + 18% GST (₹${bill.emiDetails?.processingFeeGST || 180})
2. Monthly 18% GST on the interest component amounting to ₹${bill.emiDetails?.totalGstOnInterest || 454} across the tenure.

This represents an effective True APR of ${bill.emiDetails?.trueAPR || 13.8}% and a net extra burden of ₹${bill.emiDetails?.netExtraCostOverCash || 2520} over the cash price of ₹${bill.emiDetails?.cashPrice || 54900}.

As per RBI Master Direction on Credit Card and Debit Card Issuance (2022) and RBI guidelines on Fair Lending Practices, all financial institutions are mandated to provide Key Fact Statements (KFS) showing the True Annual Percentage Rate (APR) and prohibit zero-percent schemes with concealed financing fees.

I request a full waiver of the ₹${(bill.emiDetails?.processingFee || 999) + (bill.emiDetails?.processingFeeGST || 180)} processing charges and an itemized adjustment on my statement.

Sincerely,
Cardholder Account Holder`,
        legalReferences: [
          'RBI Master Direction – Credit Card and Debit Card – Issuance and Conduct Directions, 2022',
          'RBI Circular on Digital Lending and Key Fact Statements (KFS)',
          'Consumer Protection (Unfair Trade Practices) Rules 2020'
        ],
        recommendedAction: 'Email to bank grievance desk or file complaint on RBI CMS (cms.rbi.org.in) if unresolved in 30 days.'
      };

    case 'eb_wrong_slab':
      return {
        subject: `Representation against wrong slab multiplier on Electricity Service No. ${bill.billNumber}`,
        recipient: `Assistant Executive Engineer (Revenue), ${bill.billerName}`,
        bodyText: `Date: ${today}

To,
The Assistant Engineer / Revenue Officer,
${bill.billerName}

Subject: Grievance regarding tariff slab assessment on LT Service Connection #${bill.billNumber}

Respected Sir / Madam,

I have received the electricity bill for the billing cycle ${bill.billingCycle} amounting to ₹${bill.totalAmount} for ${bill.ebDetails?.consumedUnits || 612} units.

Upon verifying the meter reading log against State Electricity Regulatory Commission (SERC) domestic tariff schedule, there appears to be an anomalous slab jump / reading cycle delay that artificially pushed consumption into the top penalty tier.

I request an on-site physical meter verification and recalibration of the bi-monthly telescopic slabs as per standard tariff orders.

Thanking you,
Consumer Name / Service Connection #${bill.billNumber}`,
        legalReferences: [
          'State Electricity Regulatory Commission Domestic Tariff Order',
          'Consumer Grievance Redressal Forum (CGRF) Regulations'
        ],
        recommendedAction: 'Submit online at the DISCOM consumer portal or hand over at the local section office.'
      };

    default:
      return {
        subject: `Discrepancy notice regarding invoice charges #${bill.billNumber}`,
        recipient: `Customer Support, ${bill.billerName}`,
        bodyText: `Date: ${today}\n\nTo ${bill.billerName},\n\nI am writing to dispute unexplained charges amounting to ₹${bill.totalAmount} on Bill #${bill.billNumber} dated ${bill.billDate}.\n\nPlease provide a clear line-item clarification and refund excess collected amounts.`,
        legalReferences: ['Consumer Protection Act 2019'],
        recommendedAction: 'Forward to customer relations.'
      };
  }
}

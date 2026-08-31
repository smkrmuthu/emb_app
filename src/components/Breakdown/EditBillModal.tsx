import React, { useState } from 'react';
import { BillData, BillFlag, GSTDetails, LineItem } from '../../types/bill';
import { X, Check, Edit3 } from 'lucide-react';

interface EditBillModalProps {
  bill: BillData;
  onSave: (updatedBill: BillData) => void;
  onClose: () => void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({ bill, onSave, onClose }) => {
  const [billerName, setBillerName] = useState(bill.billerName);
  const [totalAmount, setTotalAmount] = useState(bill.totalAmount.toString());
  const [subtotal, setSubtotal] = useState((bill.gstDetails?.taxableAmount || (bill.totalAmount * 0.95)).toFixed(2));
  const [gstRate, setGstRate] = useState((bill.gstDetails?.effectiveRate || 5).toString());
  const [serviceCharge, setServiceCharge] = useState((bill.gstDetails?.serviceChargeAmount || 0).toString());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const newTotal = parseFloat(totalAmount) || 0;
    const newSubtotal = parseFloat(subtotal) || 0;
    const newGstRate = parseFloat(gstRate) || 0;
    const newSC = parseFloat(serviceCharge) || 0;

    const totalGST = Math.round((newSubtotal * (newGstRate / 100)) * 100) / 100;
    const cgst = Math.round((totalGST / 2) * 100) / 100;
    const sgst = Math.round((totalGST / 2) * 100) / 100;

    const expectedTotal = newSubtotal + totalGST + newSC;
    const totalOk = Math.abs(expectedTotal - newTotal) <= 2;
    const gstOk = Math.abs(newGstRate - 5) <= 0.5;

    // Recalculate flags
    const newFlags: BillFlag[] = [];

    if (newGstRate > 0) {
      if (gstOk) {
        newFlags.push({
          id: 'gst-ok', severity: 'good',
          title: `✓ Correct ${newGstRate}% GST Applied (CGST ${(newGstRate / 2).toFixed(1)}% + SGST ${(newGstRate / 2).toFixed(1)}%)`,
          description: `Standalone restaurants must charge 5% composite GST without ITC. Charged ${newGstRate}% on ₹${newSubtotal.toFixed(2)} = ₹${totalGST.toFixed(2)}.`,
          lawCitation: 'CBIC Notification No. 46/2017 – Central Tax (Rate)'
        });
      } else {
        newFlags.push({
          id: 'gst-wrong', severity: 'danger',
          title: `⚠ GST Rate ${newGstRate}% Above Legal 5% Cap`,
          description: `Standalone restaurants are capped at 5% GST. Excess GST charged: ₹${Math.abs(totalGST - newSubtotal * 0.05).toFixed(2)}.`,
          lawCitation: 'CBIC Notification No. 46/2017',
          actionable: true, disputeType: 'service_charge',
          savingsPotential: parseFloat(Math.abs(totalGST - newSubtotal * 0.05).toFixed(2))
        });
      }
    }

    if (newSC > 0) {
      newFlags.push({
        id: 'sc-illegal', severity: 'danger',
        title: `⚠ Illegal Mandatory Service Charge ₹${newSC.toFixed(2)} Found!`,
        description: 'Since 4 July 2022, restaurants cannot impose mandatory service charges. Demand its removal.',
        lawCitation: 'CCPA Guidelines F. No. J-25/4/2020-CCPA (4 July 2022)',
        actionable: true, actionText: 'Draft Dispute Letter', disputeType: 'service_charge',
        savingsPotential: newSC
      });
    } else {
      newFlags.push({
        id: 'sc-ok', severity: 'good',
        title: '✓ No Illegal Service Charge',
        description: 'No mandatory service charge levied. Your consumer rights are respected on this bill.',
        lawCitation: 'CCPA Guidelines July 2022'
      });
    }

    if (newTotal > 0) {
      if (!totalOk) {
        newFlags.push({
          id: 'total-wrong', severity: 'danger',
          title: `⚠ Grand Total Discrepancy — ₹${Math.abs(expectedTotal - newTotal).toFixed(2)} Extra`,
          description: `Items ₹${newSubtotal.toFixed(2)} + GST ₹${totalGST.toFixed(2)} = ₹${expectedTotal.toFixed(2)}, but bill shows ₹${newTotal.toFixed(2)}.`,
          lawCitation: 'Consumer Protection Act 2019',
          savingsPotential: Math.abs(expectedTotal - newTotal)
        });
      } else {
        newFlags.push({
          id: 'total-ok', severity: 'info',
          title: `✓ Grand Total ₹${newTotal.toFixed(2)} Math Verified`,
          description: `₹${newSubtotal.toFixed(2)} + ₹${totalGST.toFixed(2)} GST = ₹${expectedTotal.toFixed(2)}. Arithmetic is correct.`,
          lawCitation: 'GST Invoice Rules 2017'
        });
      }
    }

    newFlags.push({
      id: 'tip', severity: 'info',
      title: 'Tip / Gratuity is Always Voluntary',
      description: 'Tips are entirely optional. Restaurants cannot mandate them without your consent.',
      lawCitation: 'CCPA Guidelines July 2022'
    });

    const newItems: LineItem[] = [
      ...bill.lineItems.filter(i => !i.isSubItem && i.id !== 'sub' && i.id !== 'total' && i.id !== 'cgst' && i.id !== 'sgst' && i.id !== 'sc'),
      { id: 'sub', label: 'Sub Total', amount: newSubtotal },
      ...(cgst > 0 ? [{ id: 'cgst', label: `CGST @ ${(newGstRate / 2).toFixed(1)}%`, amount: cgst, isSubItem: true, gstRate: newGstRate / 2 }] : []),
      ...(sgst > 0 ? [{ id: 'sgst', label: `SGST @ ${(newGstRate / 2).toFixed(1)}%`, amount: sgst, isSubItem: true, gstRate: newGstRate / 2 }] : []),
      ...(newSC > 0 ? [{ id: 'sc', label: '⚠ Service Charge (ILLEGAL)', amount: newSC, isSubItem: true, flagSeverity: 'danger' as const }] : []),
      { id: 'total', label: 'Grand Total', amount: newTotal }
    ];

    const updatedGstDetails: GSTDetails = {
      taxableAmount: newSubtotal,
      cgst,
      sgst,
      effectiveRate: newGstRate,
      isCorrectSlab: gstOk,
      serviceChargePresent: newSC > 0,
      serviceChargeAmount: newSC
    };

    onSave({
      ...bill,
      billerName,
      totalAmount: newTotal,
      summaryPlain: `Updated breakdown for ${billerName}. Total: ₹${newTotal}. Subtotal: ₹${newSubtotal}. GST: ${newGstRate}%.${newSC > 0 ? ` Service Charge: ₹${newSC}.` : ''}`,
      lineItems: newItems,
      flags: newFlags,
      gstDetails: updatedGstDetails
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} style={{ color: 'var(--gold)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>
                Edit / Correct Billed Amounts
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                Adjust numbers if photo OCR was blurry
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
              Merchant / Biller Name
            </label>
            <input
              type="text"
              value={billerName}
              onChange={(e) => setBillerName(e.target.value)}
              className="dispute-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                Grand Total (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="dispute-input"
                style={{ width: '100%', fontWeight: 700, color: 'var(--paper)' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                Subtotal / Taxable (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                className="dispute-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                GST Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="dispute-input"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                Service Charge (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="dispute-input"
                style={{ width: '100%' }}
                placeholder="0"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" className="btn-outline" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" style={{ flex: 1.5, justifyContent: 'center' }}>
              <Check size={14} />
              <span>Save & Recalculate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

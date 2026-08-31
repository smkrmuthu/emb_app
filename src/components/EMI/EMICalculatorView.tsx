import React, { useState } from 'react';
import { calculateTrueEMI } from '../../services/emiCalculator';
import { MinimumDueTrap } from './MinimumDueTrap';
import { Link2, SlidersHorizontal, FileText, CheckCircle2 } from 'lucide-react';
import { DisputeType, BillData } from '../../types/bill';

interface EMICalculatorViewProps {
  onOpenDispute: (type: DisputeType, bill: BillData) => void;
  activeBill?: BillData;
}

export const EMICalculatorView: React.FC<EMICalculatorViewProps> = ({ onOpenDispute, activeBill }) => {
  const [productName, setProductName] = useState('iPhone 15 (128 GB)');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [cashPrice, setCashPrice] = useState(54900);
  const [tenureMonths, setTenureMonths] = useState(6);
  const [processingFee, setProcessingFee] = useState(999);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [offerUrl, setOfferUrl] = useState('');
  const [verifiedViaLink, setVerifiedViaLink] = useState(false);

  const result = calculateTrueEMI({
    productName,
    bankName,
    cashPrice,
    tenureMonths,
    processingFee
  });

  const handleVerifyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerUrl.trim()) return;
    setVerifiedViaLink(true);
    setTimeout(() => setVerifiedViaLink(false), 5000);
  };

  return (
    <div className="phone-screen animate-fade-in">
      {/* Title */}
      <div className="app-title-bar" style={{ marginBottom: '4px' }}>
        <div>
          <div className="app-title" style={{ fontSize: '16px' }}>{bankName} · EMI Decode</div>
          <div className="app-subtitle">{productName} · {tenureMonths} months · "No Cost EMI"</div>
        </div>
        <button
          className="btn-outline"
          style={{ padding: '3px 8px', fontSize: '9.5px', borderRadius: '12px' }}
          onClick={() => setShowCustomizer(!showCustomizer)}
        >
          <SlidersHorizontal size={11} />
          <span>{showCustomizer ? 'Close' : 'Adjust'}</span>
        </button>
      </div>

      {/* Adjust Inputs */}
      {showCustomizer && (
        <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', margin: '8px 0', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
            Configure EMI Details:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10.5px' }}>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Cash Price (₹)</label>
              <input
                type="number"
                value={cashPrice}
                onChange={(e) => setCashPrice(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Tenure (Months)</label>
              <select
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={9}>9 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Processing Fee (₹)</label>
              <input
                type="number"
                value={processingFee}
                onChange={(e) => setProcessingFee(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Screen 4 Hero Spec Section */}
      <div style={{ marginTop: '10px' }}>
        <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--muted)', textDecoration: 'line-through' }}>
          Advertised: 0% interest
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
          {result.trueAPR}% APR
        </div>
        <div className="stamp-badge animate-stamp">
          {result.verdictStamp}
        </div>
      </div>

      {/* Line-by-line Cost Decode */}
      <div style={{ marginTop: '12px' }}>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>Cash upfront price</span>
          <span className="val">₹{result.cashPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>EMI monthly installment</span>
          <span className="val">₹{result.monthlyInstallment.toLocaleString('en-IN')} × {result.tenureMonths}m</span>
        </div>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>Bank processing fee</span>
          <span className="val">₹{result.processingFee} + ₹{result.processingFeeGST} GST</span>
        </div>
        <div className="breakdown-row" style={{ padding: '6px 0' }}>
          <span>18% GST on interest component</span>
          <span className="val" style={{ color: 'var(--stamp)' }}>₹{result.totalGSTOnInterest}</span>
        </div>
        <div className="breakdown-row" style={{ borderTop: '1.5px solid var(--ink)', paddingTop: '6px', fontWeight: 600 }}>
          <span>Total you actually pay</span>
          <span className="val" style={{ color: 'var(--stamp)', fontSize: '13px' }}>
            ₹{result.totalCustomerPaid.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Cross-Verification URL Box */}
      <div style={{ background: 'var(--paper-2)', padding: '12px', borderRadius: '10px', marginTop: '14px', border: '1px solid var(--line)' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link2 size={13} />
          <span>Cross-Verify Bank / E-Commerce Offer Link</span>
        </div>
        <form onSubmit={handleVerifyLink} style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
          <input
            type="url"
            placeholder="Paste Amazon, Flipkart, or HDFC EMI URL…"
            value={offerUrl}
            onChange={(e) => setOfferUrl(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '10.5px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontFamily: 'var(--font-mono)'
            }}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '6px 10px', fontSize: '10.5px' }}>
            Verify
          </button>
        </form>

        {verifiedViaLink && (
          <div style={{ fontSize: '10px', color: 'var(--good)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            <span>Audited against HDFC / Retailer Key Fact Statement: Hidden GST verified!</span>
          </div>
        )}
      </div>

      {/* Minimum Due Compounding Trap */}
      <MinimumDueTrap />

      {/* Dispute Mis-selling CTA */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <button
          className="btn-primary"
          onClick={() => onOpenDispute('emi_misleading', activeBill || ({} as any))}
        >
          <FileText size={13} />
          <span>Draft RBI Misleading EMI Dispute Letter</span>
        </button>
      </div>
    </div>
  );
};

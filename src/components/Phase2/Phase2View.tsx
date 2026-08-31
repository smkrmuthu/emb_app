import React, { useState } from 'react';
import { BillData } from '../../types/bill';
import { Calendar, CreditCard, Share2, Copy, Check, Bell } from 'lucide-react';

interface Phase2ViewProps {
  activeBill?: BillData;
}

export const Phase2View: React.FC<Phase2ViewProps> = ({ activeBill }) => {
  const [copiedShare, setCopiedShare] = useState(false);

  const mockActiveEMIs = [
    { product: 'iPhone 15 (128GB)', bank: 'HDFC Regalia', emi: '₹9,570/mo', remaining: '4 of 6 months', trueAPR: '13.8%' },
    { product: 'Daikin 1.5T Inverter AC', bank: 'ICICI Amazon Pay', emi: '₹3,450/mo', remaining: '7 of 12 months', trueAPR: '14.2%' },
    { product: 'MacBook Air M2', bank: 'SBI Card Elite', emi: '₹8,900/mo', remaining: '2 of 9 months', trueAPR: '15.1%' }
  ];

  const shareText = activeBill
    ? `📋 *Bill Summary: ${activeBill.billerName}*\n💰 Total: ₹${activeBill.totalAmount.toLocaleString('en-IN')}\n📅 Period: ${activeBill.billingCycle}\n💡 *Plain English Decode:* ${activeBill.summaryPlain}\n\nExplained clearly via Explain My Bill (explainmybill.in)`
    : 'Select a bill to generate a shareable family summary.';

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="phone-screen animate-fade-in">
      <div className="app-title-bar" style={{ marginBottom: '8px' }}>
        <div>
          <div className="app-title" style={{ fontSize: '16px' }}>Reminders & Tracker</div>
          <div className="app-subtitle">Phase 2 Features Preview</div>
        </div>
        <span className="tab-badge">PREVIEW</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Teaser Card 1: EMI Pending Tracker */}
        <div className="teaser-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="t" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={13} style={{ color: 'var(--gold)' }} />
              <span>EMI pending tracker</span>
            </div>
            <div className="soon">PHASE 2</div>
          </div>
          <div className="d">
            All active EMIs across cards in one running view — amount left, tenure, next due date, and true APR.
          </div>

          <div style={{ marginTop: '8px', borderTop: '1px dotted var(--line)', paddingTop: '6px' }}>
            {mockActiveEMIs.map((emi, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{emi.product}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '9px' }}>{emi.bank} · {emi.remaining}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{emi.emi}</div>
                  <div style={{ color: 'var(--stamp)', fontSize: '9px' }}>{emi.trueAPR} APR</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teaser Card 2: Due-date Alerts */}
        <div className="teaser-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="t" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} style={{ color: 'var(--good)' }} />
              <span>Due-date alerts</span>
            </div>
            <div className="soon">PHASE 2</div>
          </div>
          <div className="d">
            Pulled straight from your uploaded bills — no more late fees from a missed date.
          </div>

          <div style={{ marginTop: '8px', background: 'var(--paper)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={12} style={{ color: 'var(--gold)' }} />
              <span>TNPDCL EB Due in 4 Days</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--stamp)' }}>₹2,140</span>
          </div>
        </div>

        {/* Teaser Card 3: Forward to Family */}
        <div className="teaser-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="t" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Share2 size={13} style={{ color: 'var(--info)' }} />
              <span>Forward to family</span>
            </div>
            <div className="soon">PHASE 2</div>
          </div>
          <div className="d">
            Share a bill and its plain-language explanation directly via WhatsApp or Email.
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ background: '#FAF8F2', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', maxHeight: '70px', overflowY: 'auto' }}>
              {shareText}
            </div>
            <button
              className="btn-outline"
              style={{ width: '100%', marginTop: '6px', padding: '5px', fontSize: '10.5px' }}
              onClick={handleCopyShare}
            >
              {copiedShare ? <Check size={12} style={{ color: 'var(--good)' }} /> : <Copy size={12} />}
              <span>{copiedShare ? 'Copied WhatsApp Message!' : 'Copy Formatted WhatsApp Message'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

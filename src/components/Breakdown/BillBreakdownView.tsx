import React from 'react';
import { BillData, BillFlag, DisputeType } from '../../types/bill';
import { EBVisualizer } from './EBVisualizer';
import { Volume2, FileText, CheckCircle2, AlertTriangle, AlertOctagon, Info, Share2, Percent, Camera, Tag } from 'lucide-react';

interface BillBreakdownViewProps {
  bill: BillData;
  onOpenDispute: (type: DisputeType, bill: BillData) => void;
  onOpenEMI: () => void;
  onOpenShare: (bill: BillData) => void;
  onRetakePhoto?: () => void;
  onChangeBillType?: () => void;
}

export const BillBreakdownView: React.FC<BillBreakdownViewProps> = ({
  bill,
  onOpenDispute,
  onOpenEMI,
  onOpenShare,
  onRetakePhoto,
  onChangeBillType
}) => {
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const isLowQuality = bill.flags.some(f => f.id === 'ocr-low-quality') || (bill.totalAmount === 0 && bill.lineItems.length <= 1);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `${bill.billerName}. Total amount is ₹${bill.totalAmount}. ${bill.summaryPlain}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const getFlagIcon = (severity: BillFlag['severity']) => {
    switch (severity) {
      case 'good': return <CheckCircle2 size={13} style={{ color: 'var(--good)' }} />;
      case 'warning': return <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />;
      case 'danger': return <AlertOctagon size={13} style={{ color: 'var(--stamp)' }} />;
      case 'info': return <Info size={13} style={{ color: 'var(--info)' }} />;
    }
  };

  return (
    <div className="phone-screen animate-fade-in">
      {/* Title & Cycle */}
      <div className="app-title-bar" style={{ marginBottom: '8px' }}>
        <div>
          <div className="app-title" style={{ fontSize: '16px' }}>{bill.billerName}</div>
          <div className="app-subtitle">{bill.billingCycle} · {bill.categoryLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleSpeak}
            className="btn-outline"
            style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '12px' }}
            title="Read summary aloud"
          >
            <Volume2 size={12} />
            <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
          </button>
        </div>
      </div>

      {/* Top Quick Actions Bar (Re-take / Change Type) */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button
          onClick={onRetakePhoto}
          className="btn-outline"
          style={{ flex: 1, padding: '5px 8px', fontSize: '10px', borderRadius: '8px', justifyContent: 'center' }}
        >
          <Camera size={12} />
          <span>Re-take / Upload Photo</span>
        </button>

        <button
          onClick={onChangeBillType}
          className="btn-outline"
          style={{ flex: 1, padding: '5px 8px', fontSize: '10px', borderRadius: '8px', justifyContent: 'center' }}
        >
          <Tag size={12} />
          <span>Change Bill Type</span>
        </button>
      </div>

      {/* Unreadable / Low Quality Alert Callout */}
      {isLowQuality && (
        <div className="callout-box warning" style={{ marginBottom: '12px', borderLeftWidth: '4px' }}>
          <div className="callout-head">
            <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
            <span style={{ fontWeight: 700 }}>Could Not Read Photo Clearly</span>
          </div>
          <div className="callout-body" style={{ marginTop: '4px' }}>
            The uploaded image was blurry, dark, or hard to read. Please re-take a clear photo in good light or select the correct bill type manually.
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              className="btn-gold"
              style={{ padding: '6px 12px', fontSize: '10.5px' }}
              onClick={onRetakePhoto}
            >
              <Camera size={12} />
              <span>📷 Re-take / Upload Clear Photo</span>
            </button>
            <button
              className="btn-outline"
              style={{ padding: '6px 10px', fontSize: '10.5px' }}
              onClick={onChangeBillType}
            >
              <Tag size={12} />
              <span>Select Bill Type</span>
            </button>
          </div>
        </div>
      )}

      {/* Bill Total Hero */}
      <div className="bill-hero-card">
        <div className="bill-total-row">
          <div>
            <div className="bill-total-amt">₹{bill.totalAmount.toLocaleString('en-IN')}</div>
            <div className="bill-total-lbl">
              Total for this cycle {bill.ebDetails ? `· ${bill.ebDetails.consumedUnits} units` : ''}
            </div>
          </div>
          {bill.flags.some((f) => f.severity === 'danger') && (
            <span className="stamp-badge" style={{ margin: 0, fontSize: '9px', padding: '2px 6px' }}>
              FLAGGED
            </span>
          )}
        </div>
      </div>

      <div className="hr-line" />

      {/* Plain Language Summary Callout */}
      <div style={{ fontSize: '11px', color: 'var(--ink-soft)', lineHeight: 1.45, marginBottom: '10px' }}>
        {bill.summaryPlain}
      </div>

      {/* EB Slab Breakdown if Electricity */}
      {bill.ebDetails && <EBVisualizer initialDetails={bill.ebDetails} />}

      {/* Line Items List */}
      <div className="line-items-container">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>
          ITEMIZED CHARGES DECODED
        </div>
        {bill.lineItems.map((item) => (
          <div key={item.id} className={`breakdown-row ${item.isSubItem ? 'sub-row' : ''}`}>
            <span>
              {item.label}
              {item.gstRate !== undefined && (
                <span style={{ fontSize: '9px', color: 'var(--muted)', marginLeft: '4px' }}>
                  ({item.gstRate}% GST)
                </span>
              )}
            </span>
            <span className="val" style={{ color: item.flagSeverity === 'danger' ? 'var(--stamp)' : 'inherit' }}>
              {item.isFree ? '₹0' : item.amount < 0 ? `-₹${Math.abs(item.amount)}` : `₹${item.amount.toLocaleString('en-IN')}`}
            </span>
          </div>
        ))}
      </div>

      <div className="hr-line" />

      {/* Is this normal? Callout Flags */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)', marginBottom: '6px' }}>
          IS THIS NORMAL? — COMPLIANCE FLAGS
        </div>

        {bill.flags.map((flag) => (
          <div key={flag.id} className={`callout-box ${flag.severity}`}>
            <div className="callout-head">
              {getFlagIcon(flag.severity)}
              <span>{flag.title}</span>
            </div>
            <div className="callout-body">{flag.description}</div>
            {flag.lawCitation && (
              <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginTop: '4px' }}>
                Ref: {flag.lawCitation}
              </div>
            )}
            {flag.actionable && flag.disputeType && (
              <button
                className="btn-primary"
                style={{ marginTop: '8px', padding: '6px 12px', fontSize: '10.5px' }}
                onClick={() => onOpenDispute(flag.disputeType!, bill)}
              >
                <FileText size={12} />
                <span>{flag.actionText || 'Draft Legal Dispute Letter'}</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {bill.type === 'credit_card' && (
          <button className="btn-gold" onClick={onOpenEMI}>
            <Percent size={13} />
            <span>Verify "No-Cost EMI" True APR</span>
          </button>
        )}

        <button className="btn-outline" onClick={() => onOpenShare(bill)}>
          <Share2 size={13} />
          <span>Forward Plain Summary to Family</span>
        </button>
      </div>
    </div>
  );
};

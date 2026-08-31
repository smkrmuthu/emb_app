import React from 'react';
import { BillData, DisputeType } from '../../types/bill';
import { SAMPLE_BILLS } from '../../data/sampleBills';
import { BillUploader } from '../Home/BillUploader';
import { EBVisualizer } from '../Breakdown/EBVisualizer';
import { MinimumDueTrap } from '../EMI/MinimumDueTrap';
import { FileText, Percent, Share2, Sparkles, AlertOctagon, CheckCircle2, AlertTriangle, Info, Zap, CreditCard, Utensils, ShoppingCart, Hotel, Flame } from 'lucide-react';

interface DashboardViewProps {
  activeBill: BillData;
  onSelectBill: (bill: BillData) => void;
  onUploadBill: (fileName: string, sampleId?: string) => void;
  onOpenDispute: (type: DisputeType, bill: BillData) => void;
  onOpenEMI: () => void;
  onOpenShare: (bill: BillData) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeBill,
  onSelectBill,
  onUploadBill,
  onOpenDispute,
  onOpenEMI,
  onOpenShare
}) => {
  const getCategoryIcon = (type: BillData['type']) => {
    switch (type) {
      case 'electricity': return <Zap size={14} style={{ color: '#D97706' }} />;
      case 'credit_card': return <CreditCard size={14} style={{ color: '#B33A2E' }} />;
      case 'restaurant': return <Utensils size={14} style={{ color: '#2E6E4E' }} />;
      case 'grocery': return <ShoppingCart size={14} style={{ color: '#2563EB' }} />;
      case 'hotel': return <Hotel size={14} style={{ color: '#7C3AED' }} />;
      case 'gas': return <Flame size={14} style={{ color: '#DC2626' }} />;
    }
  };

  const getFlagIcon = (severity: string) => {
    switch (severity) {
      case 'good': return <CheckCircle2 size={14} style={{ color: 'var(--good)' }} />;
      case 'warning': return <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />;
      case 'danger': return <AlertOctagon size={14} style={{ color: 'var(--stamp)' }} />;
      default: return <Info size={14} style={{ color: 'var(--info)' }} />;
    }
  };

  return (
    <div className="dashboard-grid animate-fade-in">
      {/* Left Column: Intake, Upload, and Bills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="dashboard-paper-panel">
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
            Upload or Select Bill
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', marginBottom: '12px' }}>
            Supports Indian Electricity, Restaurant, Credit Card, Hotel, Grocery & Gas bills.
          </div>

          <BillUploader onFileSelected={(fileName, sampleId) => onUploadBill(fileName, sampleId || 'tn-eb-612')} />

          <div style={{ marginTop: '16px' }}>
            <div className="section-label">SAMPLE INDIAN BILLS (PHASE 1)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SAMPLE_BILLS.map((bill) => (
                <div
                  key={bill.id}
                  className={`recent-item ${activeBill.id === bill.id ? 'active-item' : ''}`}
                  onClick={() => onSelectBill(bill)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: activeBill.id === bill.id ? 'var(--paper-2)' : 'transparent'
                  }}
                >
                  <div>
                    <div className="name" style={{ fontSize: '12px' }}>
                      {getCategoryIcon(bill.type)}
                      <span>{bill.billerName}</span>
                    </div>
                    <div className="sub" style={{ fontSize: '10px' }}>
                      <span>{bill.billingCycle}</span>
                    </div>
                  </div>
                  <div className="amt" style={{ fontSize: '12.5px' }}>
                    ₹{bill.totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Minimum Due Trap Sidebar Widget */}
        <div className="dashboard-paper-panel">
          <MinimumDueTrap />
        </div>
      </div>

      {/* Right Column: Full Bill Breakdown and Insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="dashboard-paper-panel">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
            <div>
              <div className="eb-state-tag" style={{ marginBottom: '6px' }}>
                {activeBill.categoryLabel.toUpperCase()} · {activeBill.state?.toUpperCase() || 'INDIA'}
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--ink)' }}>
                {activeBill.billerName}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Invoice #{activeBill.billNumber} · Billing Period: {activeBill.billingCycle} · Issued: {activeBill.billDate}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="font-mono" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink)' }}>
                ₹{activeBill.totalAmount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Total Due by {activeBill.dueDate}
              </div>
            </div>
          </div>

          {/* Plain Summary Banner */}
          <div style={{ background: 'var(--paper-2)', borderLeft: '4px solid var(--gold)', padding: '12px 14px', borderRadius: '4px', margin: '16px 0' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={13} />
              <span>PLAIN LANGUAGE DECODE</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px', lineHeight: 1.5 }}>
              {activeBill.summaryPlain}
            </div>
          </div>

          {/* EB Visualizer if Electricity */}
          {activeBill.ebDetails && (
            <div style={{ margin: '18px 0' }}>
              <EBVisualizer initialDetails={activeBill.ebDetails} />
            </div>
          )}

          {/* Itemized Grid */}
          <div style={{ margin: '18px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Itemized Line Items & Tariff Audit
            </div>
            <div style={{ background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden' }}>
              {activeBill.lineItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: idx < activeBill.lineItems.length - 1 ? '1px solid var(--line)' : 'none',
                    fontSize: '12px',
                    color: item.flagSeverity === 'danger' ? 'var(--stamp)' : 'var(--ink-soft)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: item.isSubItem ? 400 : 500 }}>{item.label}</span>
                    {item.explanation && (
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{item.explanation}</div>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontWeight: 600 }}>
                    {item.isFree ? '₹0' : `₹${item.amount.toLocaleString('en-IN')}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance & Is this normal? Flags */}
          <div style={{ margin: '18px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              "Is This Normal?" Compliance & Savings Audit
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              {activeBill.flags.map((flag) => (
                <div key={flag.id} className={`callout-box ${flag.severity}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="callout-head" style={{ fontSize: '13px' }}>
                      {getFlagIcon(flag.severity)}
                      <span>{flag.title}</span>
                    </div>
                    {flag.savingsPotential && (
                      <span className="stamp-badge" style={{ margin: 0, fontSize: '9.5px', padding: '2px 6px' }}>
                        SAVE ₹{flag.savingsPotential}
                      </span>
                    )}
                  </div>
                  <div className="callout-body" style={{ fontSize: '12px' }}>{flag.description}</div>
                  {flag.lawCitation && (
                    <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginTop: '6px' }}>
                      Legal Citation: {flag.lawCitation}
                    </div>
                  )}
                  {flag.actionable && flag.disputeType && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        className="btn-primary"
                        style={{ width: 'auto', padding: '6px 14px', fontSize: '11px' }}
                        onClick={() => onOpenDispute(flag.disputeType!, activeBill)}
                      >
                        <FileText size={13} />
                        <span>{flag.actionText || 'Draft Legal Dispute Letter'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Strip */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
            {activeBill.type === 'credit_card' && (
              <button className="btn-gold" onClick={onOpenEMI}>
                <Percent size={14} />
                <span>Open "No-Cost EMI" True APR Debunker</span>
              </button>
            )}
            <button className="btn-outline" onClick={() => onOpenShare(activeBill)}>
              <Share2 size={14} />
              <span>Forward Formatted Summary to Family</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

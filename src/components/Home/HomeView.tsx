import React, { useState } from 'react';
import { BillData, IndianState } from '../../types/bill';
import { SAMPLE_BILLS } from '../../data/sampleBills';
import { BillUploader } from './BillUploader';
import { Zap, CreditCard, Utensils, ShoppingCart, Hotel, Flame, AlertCircle, ChevronRight } from 'lucide-react';

interface HomeViewProps {
  onSelectBill: (bill: BillData) => void;
  onUploadBill: (fileName: string, sampleId?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectBill, onUploadBill }) => {
  const [selectedState, setSelectedState] = useState<IndianState | 'all'>('all');

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

  const filteredBills = SAMPLE_BILLS.filter((b) => {
    if (selectedState === 'all') return true;
    return b.state === selectedState || b.state === 'national';
  });

  return (
    <div className="phone-screen animate-fade-in">
      {/* Top Title Bar */}
      <div className="app-title-bar">
        <div>
          <div className="app-title">Explain My Bill</div>
          <div className="app-subtitle">Plain-language Indian bill decoder</div>
        </div>
        <div className="eb-state-tag">
          <span>TN · KL · TS</span>
        </div>
      </div>

      {/* State Filter Selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[
          { id: 'all', label: 'All India' },
          { id: 'tamil_nadu', label: 'Tamil Nadu' },
          { id: 'kerala', label: 'Kerala' },
          { id: 'telangana', label: 'Telangana' }
        ].map((st) => (
          <button
            key={st.id}
            onClick={() => setSelectedState(st.id as any)}
            className="btn-outline"
            style={{
              padding: '2px 6px',
              fontSize: '9.5px',
              borderRadius: '10px',
              background: selectedState === st.id ? 'var(--canvas)' : 'transparent',
              color: selectedState === st.id ? 'var(--paper)' : 'var(--ink)',
              borderColor: selectedState === st.id ? 'var(--canvas)' : 'var(--line)'
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Upload Zone */}
      <BillUploader onFileSelected={(fileName, billId) => onUploadBill(fileName, billId || 'tn-eb-612')} />

      {/* Quick Sample Selector */}
      <div className="quick-samples-section">
        <div className="section-label">
          <span>TRY REAL INDIAN SAMPLES</span>
          <span style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: 600 }}>1-CLICK DEMO</span>
        </div>
        <div className="chip-scroll">
          {filteredBills.map((bill) => (
            <button
              key={bill.id}
              className="sample-chip"
              onClick={() => onUploadBill(`Sample_${bill.billerName}.pdf`, bill.id)}
            >
              <span className="chip-icon">{getCategoryIcon(bill.type)}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                  {bill.billerName.split('—')[0].trim()}
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  ₹{bill.totalAmount.toLocaleString('en-IN')} · {bill.categoryLabel}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Bills List */}
      <div style={{ marginTop: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="section-label">
          <span>RECENT SCANNED BILLS</span>
          <span>{SAMPLE_BILLS.slice(0, 3).length} BILLS</span>
        </div>

        <div className="recent-list">
          {SAMPLE_BILLS.slice(0, 3).map((bill) => {
            const hasOverchargeFlag = bill.flags.some((f) => f.severity === 'danger');
            return (
              <div
                key={bill.id}
                className="recent-item"
                onClick={() => onSelectBill(bill)}
              >
                <div>
                  <div className="name">
                    {getCategoryIcon(bill.type)}
                    <span>{bill.billerName}</span>
                  </div>
                  <div className="sub">
                    <span>{bill.billingCycle}</span>
                    {hasOverchargeFlag && (
                      <span className="flag-pill">
                        <AlertCircle size={9} style={{ display: 'inline', marginRight: '2px' }} />
                        FLAGGED
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="amt">₹{bill.totalAmount.toLocaleString('en-IN')}</div>
                  <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

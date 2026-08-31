import React from 'react';
import { BillType } from '../../types/bill';
import { Zap, CreditCard, Utensils, ShoppingCart, Hotel, Flame, X, HelpCircle } from 'lucide-react';

interface BillTypePickerProps {
  fileName: string;
  onSelect: (type: BillType) => void;
  onCancel: () => void;
}

const BILL_TYPES: { type: BillType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    type: 'restaurant',
    label: 'Restaurant / Dining',
    icon: <Utensils size={20} />,
    desc: 'Café, hotel restaurant, takeaway, swiggy, zomato',
    color: '#2E6E4E'
  },
  {
    type: 'electricity',
    label: 'Electricity (EB) Bill',
    icon: <Zap size={20} />,
    desc: 'TNPDCL, KSEB, TSSPDCL or any state DISCOM',
    color: '#D97706'
  },
  {
    type: 'credit_card',
    label: 'Credit Card / EMI',
    icon: <CreditCard size={20} />,
    desc: 'HDFC, ICICI, Axis, SBI, Kotak or any bank card',
    color: '#B33A2E'
  },
  {
    type: 'grocery',
    label: 'Supermarket / Grocery',
    icon: <ShoppingCart size={20} />,
    desc: 'DMart, BigBasket, Reliance Fresh, kirana stores',
    color: '#2563EB'
  },
  {
    type: 'hotel',
    label: 'Hotel Stay Folio',
    icon: <Hotel size={20} />,
    desc: 'Room charges, resort fees, minibar, in-room dining',
    color: '#7C3AED'
  },
  {
    type: 'gas',
    label: 'Gas Bill (LPG / PNG)',
    icon: <Flame size={20} />,
    desc: 'Indane, HPCL, Bharat Gas, IGL, MGL piped gas',
    color: '#DC2626'
  }
];

export const BillTypePicker: React.FC<BillTypePickerProps> = ({ fileName, onSelect, onCancel }) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} style={{ color: 'var(--gold)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>
                What type of bill is this?
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                File: {fileName.length > 40 ? fileName.substring(0, 37) + '…' : fileName}
              </div>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Bill Type Grid */}
        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '14px', lineHeight: 1.4 }}>
            We couldn't auto-detect the bill type from the filename. Select the category and we'll decode it with the right rules:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {BILL_TYPES.map(({ type, label, icon, desc, color }) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                style={{
                  background: 'var(--paper-2)',
                  border: '1.5px solid var(--line)',
                  borderRadius: '10px',
                  padding: '12px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-sans)'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = color;
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-2)';
                }}
              >
                <div style={{ color, marginBottom: '6px' }}>{icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.35 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { DisputeType, BillData } from '../../types/bill';
import { generateDisputeLetter } from '../../services/disputeGenerator';
import { Copy, Check, X, Mail, Printer, ShieldAlert } from 'lucide-react';

interface DisputeModalProps {
  type: DisputeType;
  bill: BillData;
  onClose: () => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({ type, bill, onClose }) => {
  const [copied, setCopied] = useState(false);
  const letter = generateDisputeLetter(type, bill);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${letter.subject}\n\n${letter.bodyText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEmail = () => {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.bodyText)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--stamp)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px' }}>
                Legal Dispute Letter Generator
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Statutory format with Indian regulatory citations
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div style={{ marginBottom: '10px', fontSize: '11.5px' }}>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Subject:</div>
            <div style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>{letter.subject}</div>
          </div>

          <div style={{ marginBottom: '10px', fontSize: '11.5px' }}>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Recipient:</div>
            <div style={{ color: 'var(--ink-soft)' }}>{letter.recipient}</div>
          </div>

          <div className="dispute-letter-box">
            {letter.bodyText}
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Statutory Legal Grounds Cited:
            </div>
            <ul style={{ paddingLeft: '18px', fontSize: '11px', color: 'var(--ink-soft)' }}>
              {letter.legalReferences.map((ref, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{ref}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="btn-outline" onClick={handlePrint}>
            <Printer size={13} />
            <span>Print</span>
          </button>
          <button className="btn-outline" onClick={handleEmail}>
            <Mail size={13} />
            <span>Open Email</span>
          </button>
          <button className="btn-primary" onClick={handleCopy} style={{ width: 'auto' }}>
            {copied ? <Check size={13} style={{ color: 'var(--good)' }} /> : <Copy size={13} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Letter Text'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

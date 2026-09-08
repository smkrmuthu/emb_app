import React from 'react';
import { CreditCardPayoffProjection } from '../../types/bill';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';

interface CreditCardPayoffWidgetProps {
  payoff: CreditCardPayoffProjection;
}

export const CreditCardPayoffWidget: React.FC<CreditCardPayoffWidgetProps> = ({ payoff }) => {
  return (
    <div style={{ background: 'var(--paper-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontWeight: 600, fontSize: '12px' }}>
        <AlertTriangle size={14} />
        <span>IF YOU ONLY PAY THE MINIMUM…</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' }}>
        <div style={{ background: 'var(--paper)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '9.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> Time to Pay Off
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
            {payoff.neverPaysOff ? '30+ Years' : `${payoff.yearsToPayoff} Years`}
          </div>
        </div>

        <div style={{ background: 'var(--paper)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '9.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={11} /> Total Interest & GST
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
            ₹{payoff.totalInterestPaid.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '10.5px', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
        {payoff.warningSummary}
      </div>

      <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.4 }}>
        Assumes this bill's own minimum-due rate (~{payoff.minDueRatePercent}% of the balance each month) and {payoff.annualAPR}% APR, with no new spending added. Your bank's exact minimum-due formula may vary slightly.
      </div>
    </div>
  );
};

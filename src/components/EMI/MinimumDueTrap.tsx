import React, { useState } from 'react';
import { calculateMinimumDueTrap } from '../../services/billAnalyzer';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const MinimumDueTrap: React.FC = () => {
  const [balance, setBalance] = useState(50000);
  const [monthlyRate, setMonthlyRate] = useState(3.6);

  const result = calculateMinimumDueTrap(balance, monthlyRate);

  return (
    <div style={{ background: 'var(--paper-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontWeight: 600, fontSize: '12px' }}>
        <AlertTriangle size={14} />
        <span>MINIMUM DUE COMPOUNDING TRAP</span>
      </div>

      <div style={{ margin: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink)' }}>
          <span>Card Outstanding Balance:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{balance.toLocaleString('en-IN')}</span>
        </div>
        <input
          type="range"
          min={10000}
          max={200000}
          step={5000}
          value={balance}
          onChange={(e) => setBalance(Number(e.target.value))}
          style={{ width: '100%', margin: '4px 0 8px', accentColor: 'var(--stamp)' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink)' }}>
          <span>Monthly Interest Rate:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{monthlyRate}% p.m. ({result.annualAPR}% APR)</span>
        </div>
        <input
          type="range"
          min={2.5}
          max={4.2}
          step={0.1}
          value={monthlyRate}
          onChange={(e) => setMonthlyRate(Number(e.target.value))}
          style={{ width: '100%', margin: '4px 0', accentColor: 'var(--warning)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' }}>
        <div style={{ background: 'var(--paper)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '9.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> Time to Pay Off
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
            {result.yearsToPayoff} Years
          </div>
        </div>

        <div style={{ background: 'var(--paper)', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '9.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={11} /> Total Interest & GST
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
            ₹{result.totalInterestPaid.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '10.5px', color: 'var(--ink-soft)', lineHeight: 1.4, marginTop: '8px' }}>
        {result.warningSummary}
      </div>
    </div>
  );
};

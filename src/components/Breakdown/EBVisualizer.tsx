import React, { useState } from 'react';
import { EBDetails } from '../../types/bill';
import { calculateEBTariff } from '../../services/billAnalyzer';
import { Sliders, Sparkles } from 'lucide-react';

interface EBVisualizerProps {
  initialDetails: EBDetails;
}

export const EBVisualizer: React.FC<EBVisualizerProps> = ({ initialDetails }) => {
  const [units, setUnits] = useState(initialDetails.consumedUnits);
  const [showSimulator, setShowSimulator] = useState(false);

  const calculated = calculateEBTariff(initialDetails.state, units);

  const totalSlabUnits = calculated.slabBreakdown.reduce((sum, s) => sum + s.unitsCharged, 0);

  return (
    <div style={{ marginTop: '10px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)' }}>
          TELESCOPIC SLAB BREAKDOWN
        </span>
        <button
          className="btn-outline"
          style={{ padding: '2px 8px', fontSize: '9.5px', borderRadius: '12px' }}
          onClick={() => setShowSimulator(!showSimulator)}
        >
          <Sliders size={11} />
          <span>{showSimulator ? 'Close What-If' : 'What-If Simulator'}</span>
        </button>
      </div>

      {/* Interactive Unit Slider */}
      {showSimulator && (
        <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', margin: '8px 0', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--ink)' }}>
            <span>Simulate Consumption:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{units} Units</span>
          </div>
          <input
            type="range"
            min={50}
            max={800}
            step={5}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            style={{ width: '100%', margin: '6px 0', accentColor: 'var(--gold)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            <span>50 units</span>
            <span>250 (Threshold)</span>
            <span>500 (High Tier)</span>
            <span>800 units</span>
          </div>
        </div>
      )}

      {/* Visual Slab Meter Bar */}
      <div className="slab-meter">
        <div className="slab-meter-bar">
          {calculated.slabBreakdown.map((slab, idx) => {
            const widthPct = totalSlabUnits > 0 ? (slab.unitsCharged / totalSlabUnits) * 100 : 0;
            return (
              <div
                key={idx}
                className="slab-meter-segment"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: slab.colorHex || 'var(--ink)'
                }}
                title={`${slab.slabRange}: ${slab.unitsCharged} units (₹${slab.totalCost})`}
              />
            );
          })}
        </div>
        <div className="slab-meter-labels">
          <span>0 units (Free Tier)</span>
          <span>{units} units Total</span>
        </div>
      </div>

      {/* Line Items for Slabs */}
      <div style={{ marginTop: '8px' }}>
        {calculated.slabBreakdown.map((slab, idx) => (
          <div key={idx} className="breakdown-row sub-row">
            <span>
              {slab.slabRange} {slab.ratePerUnit > 0 ? `@ ₹${slab.ratePerUnit.toFixed(2)}` : '(Govt Subsidy)'}
            </span>
            <span className="val">{slab.totalCost > 0 ? `₹${slab.totalCost}` : '₹0'}</span>
          </div>
        ))}
      </div>

      {/* Next Slab Threshold Alert */}
      {calculated.nextSlabThreshold && (
        <div className="callout-box warning" style={{ marginTop: '10px' }}>
          <div className="callout-head">
            <Sparkles size={13} />
            <span>{calculated.nextSlabThreshold.excessUnits} units over {calculated.nextSlabThreshold.limit} mark</span>
          </div>
          <div className="callout-body">{calculated.nextSlabThreshold.tip}</div>
        </div>
      )}
    </div>
  );
};

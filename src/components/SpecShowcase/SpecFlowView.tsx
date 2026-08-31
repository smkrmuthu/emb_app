import React, { useState } from 'react';
import { BillData, DisputeType } from '../../types/bill';
import { SAMPLE_BILLS } from '../../data/sampleBills';

interface SpecFlowViewProps {
  onOpenDispute: (type: DisputeType, bill: BillData) => void;
}

export const SpecFlowView: React.FC<SpecFlowViewProps> = ({ onOpenDispute }) => {
  const [activeBillIndex, setActiveBillIndex] = useState(0);
  const bill = SAMPLE_BILLS[activeBillIndex];

  return (
    <div className="animate-fade-in">
      <div style={{ maxWidth: '1500px', margin: '0 auto 16px', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)' }}>
          ← SCROLL HORIZONTALLY TO INSPECT ALL FIVE SCREENS →
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SAMPLE_BILLS.slice(0, 3).map((b, idx) => (
            <button
              key={b.id}
              className={`sample-chip ${activeBillIndex === idx ? 'active' : ''}`}
              onClick={() => setActiveBillIndex(idx)}
              style={{ fontSize: '10.5px', padding: '4px 8px' }}
            >
              {b.billerName.split('—')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="spec-strip">
        {/* Screen 1: Home */}
        <div className="spec-unit">
          <div className="spec-frame-col">
            <div className="spec-caption">01 — Home</div>
            <div className="spec-phone">
              <div className="phone-header-notch">
                <div className="notch-pill" />
              </div>
              <div className="spec-screen">
                <div className="app-title">Explain My Bill</div>
                <div className="eb-state-tag" style={{ marginTop: '4px', width: 'fit-content' }}>
                  TN · KERALA · TELANGANA
                </div>

                <div className="upload-card-interactive" style={{ marginTop: '16px', padding: '20px 10px' }}>
                  <div className="glyph" style={{ width: '32px', height: '32px', fontSize: '16px', margin: '0 auto 8px' }}>＋</div>
                  <div className="primary" style={{ fontSize: '12.5px' }}>Scan a bill</div>
                  <div className="secondary" style={{ fontSize: '10px' }}>Photo, PDF, or forward from email</div>
                </div>

                <div className="section-label" style={{ marginTop: '18px' }}>RECENT</div>
                <div className="recent-item" style={{ padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)' }}>TNPDCL — Electricity</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>Aug 2026</div>
                  </div>
                  <div className="font-mono" style={{ fontSize: '11.5px', fontWeight: 600 }}>₹2,140</div>
                </div>
                <div className="recent-item" style={{ padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)' }}>HDFC Credit Card</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>Aug 2026</div>
                  </div>
                  <div className="font-mono" style={{ fontSize: '11.5px', fontWeight: 600 }}>₹18,920</div>
                </div>
                <div className="recent-item" style={{ padding: '6px 0', borderBottom: 'none' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)' }}>Saravana Bhavan</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>12 Aug</div>
                  </div>
                  <div className="font-mono" style={{ fontSize: '11.5px', fontWeight: 600 }}>₹864</div>
                </div>

                <div className="app-navbar" style={{ marginTop: 'auto', padding: '8px 0 0' }}>
                  <div className="nav-item active"><div className="nav-dot" />Home</div>
                  <div className="nav-item"><div className="nav-dot" />Bills</div>
                  <div className="nav-item"><div className="nav-dot" />Reminders</div>
                  <div className="nav-item"><div className="nav-dot" />Profile</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="spec-step-mark"><span>→</span></div>

        {/* Screen 2: Reading */}
        <div className="spec-unit">
          <div className="spec-frame-col">
            <div className="spec-caption">02 — Reading</div>
            <div className="spec-phone">
              <div className="phone-header-notch">
                <div className="notch-pill" />
              </div>
              <div className="spec-screen" style={{ justifyContent: 'center' }}>
                <div className="scan-wrapper">
                  <div className="scan-document-box" style={{ width: '140px', height: '180px' }}>
                    <div className="mock-doc-line" style={{ marginTop: '12px' }} />
                    <div className="mock-doc-line short" />
                    <div className="mock-doc-line" />
                    <div className="mock-doc-line" />
                    <div className="mock-doc-line short" />
                    <div className="mock-doc-line" />
                    <div className="scan-line-anim" />
                  </div>
                  <div className="scan-status-text" style={{ fontSize: '11px' }}>Reading your bill…</div>
                  <div className="scan-sub-text" style={{ fontSize: '10px' }}>Matching against TNPDCL's telescopic slab structure</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="spec-step-mark"><span>→</span></div>

        {/* Screen 3: Breakdown */}
        <div className="spec-unit">
          <div className="spec-frame-col">
            <div className="spec-caption">03 — Breakdown</div>
            <div className="spec-phone">
              <div className="phone-header-notch">
                <div className="notch-pill" />
              </div>
              <div className="spec-screen">
                <div className="app-title" style={{ fontSize: '14px' }}>{bill.billerName.split('—')[0]} · {bill.billingCycle}</div>
                <div style={{ marginTop: '8px' }}>
                  <div className="font-mono" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)' }}>₹{bill.totalAmount.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    Total for this cycle {bill.ebDetails ? `· ${bill.ebDetails.consumedUnits} units` : `· ${bill.categoryLabel}`}
                  </div>
                </div>
                <div className="hr-line" style={{ margin: '8px 0' }} />
                
                {bill.lineItems.slice(0, 5).map((item) => (
                  <div key={item.id} className={`breakdown-row ${item.isSubItem ? 'sub-row' : ''}`} style={{ fontSize: item.isSubItem ? '10px' : '10.5px' }}>
                    <span>{item.label}</span>
                    <span className="val">{item.isFree ? '₹0' : `₹${item.amount.toLocaleString('en-IN')}`}</span>
                  </div>
                ))}

                {bill.flags[0] && (
                  <div className={`callout-box ${bill.flags[0].severity}`} style={{ marginTop: '10px', padding: '8px' }}>
                    <div className="callout-head" style={{ fontSize: '10.5px' }}>{bill.flags[0].title}</div>
                    <div className="callout-body" style={{ fontSize: '10px' }}>
                      {bill.flags[0].description}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="spec-step-mark"><span>→</span></div>

        {/* Screen 4: EMI flag */}
        <div className="spec-unit">
          <div className="spec-frame-col">
            <div className="spec-caption">04 — EMI flag</div>
            <div className="spec-phone">
              <div className="phone-header-notch">
                <div className="notch-pill" />
              </div>
              <div className="spec-screen">
                <div className="app-title" style={{ fontSize: '14px' }}>HDFC Card · EMI</div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                  iPhone 15 · 6 months · "No Cost EMI"
                </div>

                <div className="font-mono" style={{ fontSize: '10px', color: 'var(--muted)', textDecoration: 'line-through', marginTop: '10px' }}>
                  Advertised: 0% interest
                </div>
                <div className="font-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
                  13.8% APR
                </div>
                <div className="stamp-badge" style={{ fontSize: '9px', padding: '2px 6px', margin: '6px 0' }}>
                  NOT ZERO COST
                </div>

                <div style={{ marginTop: '10px' }}>
                  <div className="breakdown-row" style={{ fontSize: '10.5px', borderBottom: '1px dotted var(--line)', padding: '4px 0' }}>
                    <span>Cash price</span><span className="val">₹54,900</span>
                  </div>
                  <div className="breakdown-row" style={{ fontSize: '10.5px', borderBottom: '1px dotted var(--line)', padding: '4px 0' }}>
                    <span>EMI total price</span><span className="val">₹57,420</span>
                  </div>
                  <div className="breakdown-row" style={{ fontSize: '10.5px', borderBottom: '1px dotted var(--line)', padding: '4px 0' }}>
                    <span>Processing fee</span><span className="val">₹999</span>
                  </div>
                  <div className="breakdown-row" style={{ fontSize: '10.5px', padding: '4px 0' }}>
                    <span>GST on interest</span><span className="val">₹454</span>
                  </div>
                </div>

                <div
                  className="btn-outline"
                  style={{ marginTop: 'auto', textAlign: 'center', padding: '7px', fontSize: '10.5px' }}
                  onClick={() => onOpenDispute('emi_misleading', SAMPLE_BILLS[1])}
                >
                  Verify against bank's offer page
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="spec-step-mark"><span>→</span></div>

        {/* Screen 5: Phase 2 teaser */}
        <div className="spec-unit">
          <div className="spec-frame-col">
            <div className="spec-caption">05 — Phase 2 (teaser)</div>
            <div className="spec-phone">
              <div className="phone-header-notch">
                <div className="notch-pill" />
              </div>
              <div className="spec-screen">
                <div className="app-title" style={{ fontSize: '14px' }}>Reminders</div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="teaser-card" style={{ padding: '8px 10px' }}>
                    <div className="t" style={{ fontSize: '11px' }}>EMI pending tracker</div>
                    <div className="d" style={{ fontSize: '9.5px' }}>All active EMIs across cards in one running view — amount left, tenure, next due date.</div>
                    <div className="soon">PHASE 2</div>
                  </div>
                  <div className="teaser-card" style={{ padding: '8px 10px' }}>
                    <div className="t" style={{ fontSize: '11px' }}>Due-date alerts</div>
                    <div className="d" style={{ fontSize: '9.5px' }}>Pulled straight from your uploaded bills — no more late fees from a missed date.</div>
                    <div className="soon">PHASE 2</div>
                  </div>
                  <div className="teaser-card" style={{ padding: '8px 10px' }}>
                    <div className="t" style={{ fontSize: '11px' }}>Forward to family</div>
                    <div className="d" style={{ fontSize: '9.5px' }}>Share a bill and its plain-language explanation directly from the app.</div>
                    <div className="soon">PHASE 2</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

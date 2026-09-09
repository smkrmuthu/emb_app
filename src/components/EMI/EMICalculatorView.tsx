import React, { useRef, useState } from 'react';
import { calculateTrueEMI } from '../../services/emiCalculator';
import { scanEMIOfferWithLLM, scanEMIOfferTextWithLLM, EMIOfferExtraction } from '../../services/llmScanService';
import { processPDFFile } from '../../services/pdfService';
import { MinimumDueTrap } from './MinimumDueTrap';
import { Link2, SlidersHorizontal, FileText, Camera, AlertTriangle } from 'lucide-react';
import { DisputeType, BillData } from '../../types/bill';

interface EMICalculatorViewProps {
  onOpenDispute: (type: DisputeType, bill: BillData) => void;
  activeBill?: BillData;
}

export const EMICalculatorView: React.FC<EMICalculatorViewProps> = ({ onOpenDispute, activeBill }) => {
  const [productName, setProductName] = useState('iPhone 15 (128 GB)');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [cashPrice, setCashPrice] = useState(54900);
  const [tenureMonths, setTenureMonths] = useState(6);
  const [processingFee, setProcessingFee] = useState(999);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Auto-fill from an offer — Apple/Amazon/Flipkart/bank EMI popups usually list
  // several bank/tenure combinations at once, and often don't show the cash price
  // at all (only the per-month amount), so both are handled explicitly below.
  // Link-based checking is deferred to a later update (real fetch/parse of an
  // arbitrary retailer page is unreliable — many are JS-rendered SPAs) — the field
  // stays visible but honestly says so rather than faking a result.
  const [verifyMode, setVerifyMode] = useState<'upload' | 'link'>('upload');
  const [offerUrl, setOfferUrl] = useState('');
  const offerFileInputRef = useRef<HTMLInputElement>(null);
  const [isScanningOffer, setIsScanningOffer] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedOffer, setScannedOffer] = useState<EMIOfferExtraction | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const [cashPriceIsEstimated, setCashPriceIsEstimated] = useState(false);

  const result = calculateTrueEMI({
    productName,
    bankName,
    cashPrice,
    tenureMonths,
    processingFee
  });

  const applyOffer = (offer: EMIOfferExtraction, idx: number) => {
    const option = offer.options[idx];
    if (!option) return;
    if (offer.productName) setProductName(offer.productName);
    setBankName(option.bankName);
    setTenureMonths(option.tenureMonths);
    if (option.processingFee != null) setProcessingFee(option.processingFee);
    if (offer.cashPrice != null) {
      setCashPrice(offer.cashPrice);
      setCashPriceIsEstimated(false);
    } else if (option.monthlyEMI != null) {
      // Cash price is often just not shown on these screens — under the standard
      // "No-Cost EMI" assumption (installments sum to the cash price with the
      // interest hidden in the discount), monthly × tenure is a reasonable stand-in
      // until the user confirms/edits it.
      setCashPrice(Math.round(option.monthlyEMI * option.tenureMonths));
      setCashPriceIsEstimated(true);
    } else {
      setCashPriceIsEstimated(false);
    }
  };

  const handleOfferFile = async (file: File) => {
    setIsScanningOffer(true);
    setScanError(null);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const offer = isPdf
        ? await scanEMIOfferTextWithLLM((await processPDFFile(file)).text)
        : await scanEMIOfferWithLLM(await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Could not read that file'));
            reader.readAsDataURL(file);
          }));
      if (!offer.options.length) {
        setScanError(`Couldn't find any EMI options in that ${isPdf ? 'PDF' : 'screenshot'} — try a clearer ${isPdf ? 'file' : 'photo'}, or adjust the details manually below.`);
        return;
      }
      setScannedOffer(offer);
      const noCostIdx = offer.options.findIndex((o) => o.isNoCost);
      const idx = noCostIdx >= 0 ? noCostIdx : 0;
      setSelectedOptionIdx(idx);
      applyOffer(offer, idx);
      setShowCustomizer(true);
    } catch {
      // Never surface a raw technical error (e.g. a bare "Failed to fetch") — a
      // network/scan hiccup should read the same as a genuinely unclear upload.
      setScanError("Couldn't read that file — try a clearer photo or PDF, or adjust the details manually below.");
    } finally {
      setIsScanningOffer(false);
    }
  };

  const handleOfferFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOfferFile(file);
  };

  return (
    <div className="phone-screen animate-fade-in">
      {/* Title */}
      <div className="app-title-bar" style={{ marginBottom: '4px' }}>
        <div>
          <div className="app-title" style={{ fontSize: '16px' }}>{bankName} · EMI Decode</div>
          <div className="app-subtitle">{productName} · {tenureMonths} months · "No Cost EMI"</div>
        </div>
        <button
          className="btn-outline"
          style={{ padding: '3px 8px', fontSize: '9.5px', borderRadius: '12px' }}
          onClick={() => setShowCustomizer(!showCustomizer)}
        >
          <SlidersHorizontal size={11} />
          <span>{showCustomizer ? 'Close' : 'Adjust'}</span>
        </button>
      </div>

      {/* Auto-Fill From an Offer — upload/photo works now; link checking is coming later */}
      <div style={{ marginTop: '6px', background: 'var(--paper-2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--line)' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
          Auto-Fill From an Offer
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <button
            onClick={() => setVerifyMode('upload')}
            className="btn-outline"
            style={{
              flex: 1, justifyContent: 'center', padding: '5px', fontSize: '10px',
              background: verifyMode === 'upload' ? 'var(--canvas)' : 'transparent',
              color: verifyMode === 'upload' ? 'var(--paper)' : 'var(--ink)',
              borderColor: verifyMode === 'upload' ? 'var(--canvas)' : 'var(--line)'
            }}
          >
            <Camera size={12} />
            <span>Upload / Photo</span>
          </button>
          <button
            onClick={() => setVerifyMode('link')}
            className="btn-outline"
            style={{
              flex: 1, justifyContent: 'center', padding: '5px', fontSize: '10px',
              background: verifyMode === 'link' ? 'var(--canvas)' : 'transparent',
              color: verifyMode === 'link' ? 'var(--paper)' : 'var(--ink)',
              borderColor: verifyMode === 'link' ? 'var(--canvas)' : 'var(--line)'
            }}
          >
            <Link2 size={12} />
            <span>Paste Link</span>
          </button>
        </div>

        {verifyMode === 'upload' ? (
          <>
            <input
              type="file"
              ref={offerFileInputRef}
              onChange={handleOfferFileChange}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
            />
            <button
              className="btn-outline"
              style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
              onClick={() => offerFileInputRef.current?.click()}
              disabled={isScanningOffer}
            >
              <Camera size={13} />
              <span>{isScanningOffer ? 'Reading EMI options…' : 'Upload a Screenshot or PDF'}</span>
            </button>
            <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px', textAlign: 'center' }}>
              Apple, Amazon, Flipkart, or your bank's EMI popup/PDF — we'll fill in the numbers below
            </div>
          </>
        ) : (
          <>
            <input
              type="url"
              placeholder="Paste Amazon, Flipkart, or bank EMI URL…"
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '10.5px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                fontFamily: 'var(--font-mono)'
              }}
            />
            <div style={{ fontSize: '9.5px', color: 'var(--warning)', marginTop: '6px', lineHeight: 1.4 }}>
              ⚠ Reading a pasted link automatically is coming in a future update. For now, switch to "Upload / Photo" and share a screenshot or PDF of the offer instead.
            </div>
          </>
        )}

        {scanError && (
          <div className="callout-box warning" style={{ marginTop: '8px' }}>
            <div className="callout-head">
              <AlertTriangle size={13} />
              <span>Couldn't Read That</span>
            </div>
            <div className="callout-body">{scanError}</div>
          </div>
        )}
      </div>

      {/* Multiple options found — let the user pick which one to analyze */}
      {scannedOffer && scannedOffer.options.length > 1 && (
        <div style={{ background: 'var(--paper-2)', padding: '8px', borderRadius: '8px', margin: '8px 0', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
            Found {scannedOffer.options.length} options — pick one to decode:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {scannedOffer.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedOptionIdx(idx); applyOffer(scannedOffer, idx); }}
                className="btn-outline"
                style={{
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  fontSize: '10px',
                  background: idx === selectedOptionIdx ? 'var(--canvas)' : 'transparent',
                  color: idx === selectedOptionIdx ? 'var(--paper)' : 'var(--ink)',
                  borderColor: idx === selectedOptionIdx ? 'var(--canvas)' : 'var(--line)'
                }}
              >
                <span>{opt.bankName} · {opt.tenureMonths}mo{opt.isNoCost ? ' · No Cost' : ''}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{opt.monthlyEMI ? `₹${opt.monthlyEMI.toLocaleString('en-IN')}/mo` : '—'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Adjust Inputs */}
      {showCustomizer && (
        <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', margin: '8px 0', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
            Configure EMI Details:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10.5px' }}>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Cash Price (₹)</label>
              <input
                type="number"
                value={cashPrice}
                onChange={(e) => { setCashPrice(Number(e.target.value)); setCashPriceIsEstimated(false); }}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }}
              />
              {cashPriceIsEstimated && (
                <div style={{ fontSize: '9px', color: 'var(--warning)', marginTop: '2px', lineHeight: 1.3 }}>
                  ⚠ Not shown on screenshot — estimated as monthly × tenure. Edit if you know the exact price.
                </div>
              )}
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Tenure (Months)</label>
              <select
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={9}>9 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Processing Fee (₹)</label>
              <input
                type="number"
                value={processingFee}
                onChange={(e) => setProcessingFee(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--muted)', display: 'block' }}>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--line)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Screen 4 Hero Spec Section */}
      <div style={{ marginTop: '10px' }}>
        <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--muted)', textDecoration: 'line-through' }}>
          Advertised: 0% interest
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--stamp)', marginTop: '2px' }}>
          {result.trueAPR}% APR
        </div>
        <div className="stamp-badge animate-stamp">
          {result.verdictStamp}
        </div>
      </div>

      {/* Line-by-line Cost Decode */}
      <div style={{ marginTop: '12px' }}>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>Cash upfront price</span>
          <span className="val">₹{result.cashPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>EMI monthly installment</span>
          <span className="val">₹{result.monthlyInstallment.toLocaleString('en-IN')} × {result.tenureMonths}m</span>
        </div>
        <div className="breakdown-row" style={{ borderBottom: '1px dotted var(--line)', padding: '6px 0' }}>
          <span>Bank processing fee</span>
          <span className="val">₹{result.processingFee} + ₹{result.processingFeeGST} GST</span>
        </div>
        <div className="breakdown-row" style={{ padding: '6px 0' }}>
          <span>18% GST on interest component</span>
          <span className="val" style={{ color: 'var(--stamp)' }}>₹{result.totalGSTOnInterest}</span>
        </div>
        <div className="breakdown-row" style={{ borderTop: '1.5px solid var(--ink)', paddingTop: '6px', fontWeight: 600 }}>
          <span>Total you actually pay</span>
          <span className="val" style={{ color: 'var(--stamp)', fontSize: '13px' }}>
            ₹{result.totalCustomerPaid.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Minimum Due Compounding Trap */}
      <MinimumDueTrap />

      {/* Dispute Mis-selling CTA */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <button
          className="btn-primary"
          onClick={() => onOpenDispute('emi_misleading', activeBill || ({} as any))}
        >
          <FileText size={13} />
          <span>Draft RBI Misleading EMI Dispute Letter</span>
        </button>
      </div>
    </div>
  );
};

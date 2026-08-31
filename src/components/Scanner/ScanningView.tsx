import React from 'react';
import { ScanProgressCallback } from '../../services/ocrService';
import { FileImage, CheckCircle2 } from 'lucide-react';

interface ScanningViewProps {
  progress: ScanProgressCallback;
  uploadedFileUrl?: string;      // data URL of the real uploaded file
  uploadedFileName?: string;
}

export const ScanningView: React.FC<ScanningViewProps> = ({ progress, uploadedFileUrl, uploadedFileName }) => {
  return (
    <div className="phone-screen animate-fade-in" style={{ justifyContent: 'center' }}>
      <div className="scan-wrapper">

        {/* Document Box — show real image if available */}
        <div className="scan-document-box" style={{ position: 'relative', overflow: 'hidden' }}>
          {uploadedFileUrl ? (
            <img
              src={uploadedFileUrl}
              alt="Uploaded bill"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.6,
                filter: 'grayscale(20%)'
              }}
            />
          ) : (
            <>
              <div className="mock-doc-line" style={{ marginTop: '10px' }} />
              <div className="mock-doc-line short" />
              <div className="mock-doc-line med" />
              <div className="mock-doc-line" />
              <div className="mock-doc-line short" />
              <div className="mock-doc-line" />
              <div className="mock-doc-line med" />
            </>
          )}
          <div className="scan-line-anim" />

          {/* Animated corner brackets */}
          <div style={{
            position: 'absolute', top: 6, left: 6, width: 16, height: 16,
            borderTop: '2px solid var(--gold)', borderLeft: '2px solid var(--gold)', borderRadius: '2px 0 0 0'
          }} />
          <div style={{
            position: 'absolute', top: 6, right: 6, width: 16, height: 16,
            borderTop: '2px solid var(--gold)', borderRight: '2px solid var(--gold)', borderRadius: '0 2px 0 0'
          }} />
          <div style={{
            position: 'absolute', bottom: 6, left: 6, width: 16, height: 16,
            borderBottom: '2px solid var(--gold)', borderLeft: '2px solid var(--gold)', borderRadius: '0 0 0 2px'
          }} />
          <div style={{
            position: 'absolute', bottom: 6, right: 6, width: 16, height: 16,
            borderBottom: '2px solid var(--gold)', borderRight: '2px solid var(--gold)', borderRadius: '0 0 2px 0'
          }} />
        </div>

        {/* File Name Chip */}
        {uploadedFileName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            padding: '3px 10px',
            marginBottom: '8px',
            fontSize: '10px',
            color: 'var(--muted)',
            maxWidth: '200px'
          }}>
            <FileImage size={11} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {uploadedFileName}
            </span>
          </div>
        )}

        <div className="scan-status-text">{progress.statusText}</div>
        <div className="scan-sub-text">{progress.subText}</div>

        {/* Step Progress Dots */}
        <div className="scan-steps-pill" style={{ marginTop: '14px' }}>
          {[1, 2, 3, 4].map((step) => {
            let statusClass = '';
            if (progress.stepIndex > step) statusClass = 'done';
            else if (progress.stepIndex === step) statusClass = 'current';
            return (
              <div key={step} className={`scan-step-dot ${statusClass}`} title={`Step ${step}`}>
                {progress.stepIndex > step && (
                  <CheckCircle2 size={8} style={{ color: 'var(--good)', position: 'absolute' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Labels */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
          {['Extract', 'Verify', 'Audit', 'Explain'].map((label, i) => (
            <div key={label} style={{
              fontSize: '8.5px',
              fontFamily: 'var(--font-mono)',
              color: progress.stepIndex > i + 1 ? 'var(--good)' : progress.stepIndex === i + 1 ? 'var(--gold)' : 'var(--line-strong)'
            }}>
              {label}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

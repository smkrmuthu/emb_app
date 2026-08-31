import React from 'react';
import { ScanProgressCallback } from '../../services/ocrService';

interface ScanningViewProps {
  progress: ScanProgressCallback;
}

export const ScanningView: React.FC<ScanningViewProps> = ({ progress }) => {
  return (
    <div className="phone-screen animate-fade-in" style={{ justifyContent: 'center' }}>
      <div className="scan-wrapper">
        <div className="scan-document-box">
          <div className="mock-doc-line" style={{ marginTop: '10px' }} />
          <div className="mock-doc-line short" />
          <div className="mock-doc-line med" />
          <div className="mock-doc-line" />
          <div className="mock-doc-line short" />
          <div className="mock-doc-line" />
          <div className="mock-doc-line med" />
          <div className="scan-line-anim" />
        </div>

        <div className="scan-status-text">{progress.statusText}</div>
        <div className="scan-sub-text">{progress.subText}</div>

        <div className="scan-steps-pill">
          {[1, 2, 3, 4].map((step) => {
            let statusClass = '';
            if (progress.stepIndex > step) statusClass = 'done';
            else if (progress.stepIndex === step) statusClass = 'current';
            return <div key={step} className={`scan-step-dot ${statusClass}`} />;
          })}
        </div>
      </div>
    </div>
  );
};

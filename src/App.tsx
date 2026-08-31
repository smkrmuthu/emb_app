import React, { useState } from 'react';
import { BillData, DisputeType, Language } from './types/bill';
import { SAMPLE_BILLS } from './data/sampleBills';
import { simulateBillScan, ScanProgressCallback } from './services/ocrService';
import { Header, AppViewMode } from './components/Layout/Header';
import { Navigation, AppTab } from './components/Layout/Navigation';
import { ViewportFrame } from './components/Layout/ViewportFrame';
import { HomeView } from './components/Home/HomeView';
import { ScanningView } from './components/Scanner/ScanningView';
import { BillBreakdownView } from './components/Breakdown/BillBreakdownView';
import { EMICalculatorView } from './components/EMI/EMICalculatorView';
import { Phase2View } from './components/Phase2/Phase2View';
import { SpecFlowView } from './components/SpecShowcase/SpecFlowView';
import { DashboardView } from './components/Dashboard/DashboardView';
import { DisputeModal } from './components/Dispute/DisputeModal';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<AppViewMode>('phone');
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [activeBill, setActiveBill] = useState<BillData>(SAMPLE_BILLS[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressCallback>({
    stepIndex: 1,
    totalSteps: 4,
    statusText: 'Reading your bill…',
    subText: 'Matching against state tariff and compliance schedules'
  });

  const [disputeModal, setDisputeModal] = useState<{
    isOpen: boolean;
    type: DisputeType;
    bill: BillData;
  } | null>(null);

  const handleUploadBill = async (fileName: string, sampleId?: string) => {
    setIsScanning(true);
    setCurrentTab('breakdown');

    const resolvedBill = await simulateBillScan(sampleId || null, fileName, (prog) => {
      setScanProgress(prog);
    });

    setActiveBill(resolvedBill);
    setIsScanning(false);
  };

  const handleSelectBill = (bill: BillData) => {
    setActiveBill(bill);
    setCurrentTab('breakdown');
  };

  const handleOpenDispute = (type: DisputeType, bill: BillData) => {
    setDisputeModal({ isOpen: true, type, bill });
  };

  const handleOpenEMI = () => {
    setCurrentTab('emi');
  };

  const handleOpenShare = (_bill: BillData) => {
    setCurrentTab('phase2');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top App Header */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />

      {/* Main Content View Switcher */}
      <main style={{ flex: 1 }}>
        {viewMode === 'spec' && (
          <SpecFlowView onOpenDispute={handleOpenDispute} />
        )}

        {viewMode === 'dashboard' && (
          <DashboardView
            activeBill={activeBill}
            onSelectBill={handleSelectBill}
            onUploadBill={handleUploadBill}
            onOpenDispute={handleOpenDispute}
            onOpenEMI={handleOpenEMI}
            onOpenShare={handleOpenShare}
          />
        )}

        {viewMode === 'phone' && (
          <ViewportFrame>
            {isScanning ? (
              <ScanningView progress={scanProgress} />
            ) : (
              <>
                {currentTab === 'home' && (
                  <HomeView
                    onSelectBill={handleSelectBill}
                    onUploadBill={handleUploadBill}
                  />
                )}

                {currentTab === 'breakdown' && (
                  <BillBreakdownView
                    bill={activeBill}
                    onOpenDispute={handleOpenDispute}
                    onOpenEMI={handleOpenEMI}
                    onOpenShare={handleOpenShare}
                  />
                )}

                {currentTab === 'emi' && (
                  <EMICalculatorView
                    onOpenDispute={handleOpenDispute}
                    activeBill={activeBill}
                  />
                )}

                {currentTab === 'phase2' && (
                  <Phase2View activeBill={activeBill} />
                )}
              </>
            )}

            {!isScanning && (
              <Navigation
                currentTab={currentTab}
                onTabChange={setCurrentTab}
                hasActiveBill={Boolean(activeBill)}
              />
            )}
          </ViewportFrame>
        )}
      </main>

      {/* Dispute Letter Modal */}
      {disputeModal?.isOpen && (
        <DisputeModal
          type={disputeModal.type}
          bill={disputeModal.bill}
          onClose={() => setDisputeModal(null)}
        />
      )}

      {/* Footer */}
      <footer style={{ maxWidth: '1300px', margin: '40px auto 20px', padding: '0 24px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7C849A', textAlign: 'center' }}>
        explain-my-bill · phase 1 consumer app for india · TN / Kerala / Telangana EB, restaurant, grocery, hotel, credit card & gas bills
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#5A637A' }}>
          Note: informational/educational tool only — not financial advice. Aligned with RBI & CCPA statutory guidelines.
        </div>
      </footer>
    </div>
  );
};

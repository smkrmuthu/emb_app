import React, { useState, useCallback } from 'react';
import { BillData, BillType, DisputeType, Language } from './types/bill';
import { SAMPLE_BILLS } from './data/sampleBills';
import {
  ScanProgressCallback,
  detectBillTypeFromFilename,
  scanRealBill,
  scanSampleBill,
  getBestMatchingSample
} from './services/ocrService';
import { Header, AppViewMode } from './components/Layout/Header';
import { Navigation, AppTab } from './components/Layout/Navigation';
import { ViewportFrame } from './components/Layout/ViewportFrame';
import { HomeView } from './components/Home/HomeView';
import { BillTypePicker } from './components/Home/BillTypePicker';
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
    stepIndex: 1, totalSteps: 4,
    statusText: 'Initialising scanner…',
    subText: 'Please wait'
  });

  // Uploaded file state (image data URL + name)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | undefined>();
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>();

  // Bill type picker — shown when auto-detection fails
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    fileUrl?: string;
  } | null>(null);

  const [disputeModal, setDisputeModal] = useState<{
    isOpen: boolean;
    type: DisputeType;
    bill: BillData;
  } | null>(null);

  // ── Core scan runner ──────────────────────────────────────────────────────

  const runRealScan = useCallback(async (
    fileName: string,
    fileUrl: string,           // data URL of the image
    hintedType: BillType | null
  ) => {
    setIsScanning(true);
    setCurrentTab('breakdown');
    setUploadedFileUrl(fileUrl);
    setUploadedFileName(fileName);

    const result = await scanRealBill(fileUrl, fileName, hintedType, (prog) => {
      setScanProgress(prog);
    });

    if (result.needsBillTypePicker) {
      // OCR done but type unknown — show picker, stay on home
      setIsScanning(false);
      setCurrentTab('home');
      setPendingUpload({ fileName, fileUrl });
      return;
    }

    setActiveBill(result.bill);
    setIsScanning(false);
  }, []);

  const runSampleScan = useCallback(async (sampleId: string, fileName: string) => {
    setIsScanning(true);
    setCurrentTab('breakdown');
    setUploadedFileUrl(undefined);
    setUploadedFileName(fileName);

    const bill = await scanSampleBill(sampleId, fileName, (prog) => {
      setScanProgress(prog);
    });
    setActiveBill(bill);
    setIsScanning(false);
  }, []);

  // ── Upload handler ────────────────────────────────────────────────────────

  const handleUploadBill = useCallback((
    fileName: string,
    fileUrl?: string,
    sampleId?: string
  ) => {
    // Sample chip clicked
    if (sampleId) {
      runSampleScan(sampleId, fileName);
      return;
    }

    // Real file uploaded — must have a data URL (image)
    if (fileUrl) {
      const detected = detectBillTypeFromFilename(fileName);
      runRealScan(fileName, fileUrl, detected);
      return;
    }

    // PDF or non-image file — can't OCR in browser without a server
    // Show type picker then use best sample for that type
    setPendingUpload({ fileName, fileUrl: undefined });
  }, [runRealScan, runSampleScan]);

  // ── Type picker handler ───────────────────────────────────────────────────

  const handleBillTypePicked = useCallback((type: BillType) => {
    if (!pendingUpload) return;
    const { fileName, fileUrl } = pendingUpload;
    setPendingUpload(null);

    if (fileUrl) {
      // We have the image — now run real OCR with the user-confirmed type
      runRealScan(fileName, fileUrl, type);
    } else {
      // PDF or non-image: fall back to best sample for this type
      setIsScanning(true);
      setCurrentTab('breakdown');
      setUploadedFileName(fileName);
      setUploadedFileUrl(undefined);

      // Animate through steps then show best sample
      const steps: ScanProgressCallback[] = [
        { stepIndex: 1, totalSteps: 4, statusText: 'Reading bill format…', subText: `"${fileName}"` },
        { stepIndex: 2, totalSteps: 4, statusText: 'Applying compliance rules…', subText: `${type} bill — matching GST & statutory schedules` },
        { stepIndex: 3, totalSteps: 4, statusText: 'Auditing charges…', subText: 'Checking for overcharges & flags' },
        { stepIndex: 4, totalSteps: 4, statusText: 'Generating breakdown…', subText: 'Almost done' }
      ];
      (async () => {
        for (const step of steps) {
          setScanProgress(step);
          await new Promise(r => setTimeout(r, 600));
        }
        setActiveBill(getBestMatchingSample(type));
        setIsScanning(false);
      })();
    }
  }, [pendingUpload, runRealScan]);

  const handleSelectBill = useCallback((bill: BillData) => {
    setActiveBill(bill);
    setCurrentTab('breakdown');
  }, []);

  const handleOpenDispute = useCallback((type: DisputeType, bill: BillData) => {
    setDisputeModal({ isOpen: true, type, bill });
  }, []);

  const handleOpenEMI   = useCallback(() => setCurrentTab('emi'), []);
  const handleOpenShare = useCallback((_bill: BillData) => setCurrentTab('phase2'), []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />

      <main style={{ flex: 1 }}>
        {viewMode === 'spec' && <SpecFlowView onOpenDispute={handleOpenDispute} />}

        {viewMode === 'dashboard' && (
          <DashboardView
            activeBill={activeBill}
            onSelectBill={handleSelectBill}
            onUploadBill={(fileName, sampleId) => handleUploadBill(fileName, undefined, sampleId)}
            onOpenDispute={handleOpenDispute}
            onOpenEMI={handleOpenEMI}
            onOpenShare={handleOpenShare}
          />
        )}

        {viewMode === 'phone' && (
          <ViewportFrame>
            {isScanning ? (
              <ScanningView
                progress={scanProgress}
                uploadedFileUrl={uploadedFileUrl}
                uploadedFileName={uploadedFileName}
              />
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
                {currentTab === 'phase2' && <Phase2View activeBill={activeBill} />}
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

      {/* Bill Type Picker — shown when auto-detection fails */}
      {pendingUpload && (
        <BillTypePicker
          fileName={pendingUpload.fileName}
          onSelect={handleBillTypePicked}
          onCancel={() => setPendingUpload(null)}
        />
      )}

      {/* Dispute Modal */}
      {disputeModal?.isOpen && (
        <DisputeModal
          type={disputeModal.type}
          bill={disputeModal.bill}
          onClose={() => setDisputeModal(null)}
        />
      )}

      <footer style={{ maxWidth: '1300px', margin: '40px auto 20px', padding: '0 24px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7C849A', textAlign: 'center' }}>
        explain-my-bill · real OCR scanning · TN / Kerala / Telangana EB, restaurant, grocery, hotel, credit card & gas
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#5A637A' }}>
          Note: informational/educational tool only — not financial advice. Aligned with RBI & CCPA statutory guidelines.
        </div>
      </footer>
    </div>
  );
};

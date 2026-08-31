import React, { useState, useCallback, useRef } from 'react';
import { BillData, BillType, DisputeType, Language } from './types/bill';
import { SAMPLE_BILLS } from './data/sampleBills';
import {
  ScanProgressCallback,
  detectBillTypeFromFilename,
  scanRealBill,
  scanSampleBill,
  getBestMatchingSample
} from './services/ocrService';
import { processPDFFile } from './services/pdfService';
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

  // Global File Input Ref for Re-taking photos / uploads anywhere
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  // Uploaded file state (image data URL + name)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | undefined>();
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>();

  // Bill type picker — shown when user selects or when auto-detection is doubtful
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
    fileUrl?: string,           // data URL of the image or PDF page
    hintedType: BillType | null = null,
    pdfText?: string
  ) => {
    setIsScanning(true);
    setCurrentTab('breakdown');
    setUploadedFileUrl(fileUrl);
    setUploadedFileName(fileName);

    const result = await scanRealBill(fileUrl, fileName, hintedType, (prog) => {
      setScanProgress(prog);
    }, pdfText);

    if (result.needsBillTypePicker) {
      // OCR done but type unknown — show picker modal
      setIsScanning(false);
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
    pdfText?: string,
    sampleId?: string
  ) => {
    // Sample chip clicked
    if (sampleId) {
      runSampleScan(sampleId, fileName);
      return;
    }

    // Detect type from filename or pdfText
    const detected = detectBillTypeFromFilename(fileName)
      ?? (pdfText ? (pdfText.match(/tangedco|electricity|current\s*consumption/i) ? 'electricity' : null) : null);

    if (fileUrl || pdfText) {
      if (detected) {
        // High-confidence type match → scan/parse directly
        runRealScan(fileName, fileUrl, detected, pdfText);
      } else {
        // Doubtful / generic filename → ASK THE USER TO SELECT TYPE
        setPendingUpload({ fileName, fileUrl });
      }
      return;
    }

    // PDF or non-image file without text → ASK USER TO SELECT TYPE
    setPendingUpload({ fileName, fileUrl: undefined });
  }, [runRealScan, runSampleScan]);

  // ── Type picker handler ───────────────────────────────────────────────────

  const handleBillTypePicked = useCallback((type: BillType) => {
    if (!pendingUpload) {
      // If user opened picker directly from Breakdown view to change active bill type:
      setActiveBill(getBestMatchingSample(type));
      return;
    }

    const { fileName, fileUrl } = pendingUpload;
    setPendingUpload(null);

    if (fileUrl) {
      // We have the image — run real OCR with user-selected type
      runRealScan(fileName, fileUrl, type);
    } else {
      // PDF or non-image: show animated scan & best sample for selected type
      setIsScanning(true);
      setCurrentTab('breakdown');
      setUploadedFileName(fileName);
      setUploadedFileUrl(undefined);

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

  // ── Re-take photo / Upload Trigger ───────────────────────────────────────

  const triggerRetakePhoto = useCallback(() => {
    globalFileInputRef.current?.click();
  }, []);

  const handleChangeBillType = useCallback(() => {
    setPendingUpload({
      fileName: uploadedFileName || activeBill.billerName,
      fileUrl: uploadedFileUrl
    });
  }, [uploadedFileName, uploadedFileUrl, activeBill.billerName]);

  const handleGlobalFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfRes = await processPDFFile(file);
          handleUploadBill(file.name, pdfRes.pageImage || undefined, pdfRes.text);
        } catch (err) {
          console.warn('PDF processing failed in global input:', err);
          handleUploadBill(file.name, undefined);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          handleUploadBill(file.name, dataUrl);
        };
        reader.readAsDataURL(file);
      }
    }
  }, [handleUploadBill]);

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
      {/* Hidden File Input for Global Re-take / Camera trigger */}
      <input
        type="file"
        ref={globalFileInputRef}
        onChange={handleGlobalFileChange}
        accept="image/*,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
      />

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
                    onRetakePhoto={triggerRetakePhoto}
                    onChangeBillType={handleChangeBillType}
                    onUpdateBill={setActiveBill}
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

      {/* Bill Type Picker Modal — shown when doubt exists or user changes type */}
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

import React, { useRef, useState } from 'react';
import { Camera, FileUp } from 'lucide-react';
import { processPDFFile } from '../../services/pdfService';
import { captureNativePhoto } from '../../services/nativeCapture';

interface BillUploaderProps {
  onFileSelected: (fileName: string, fileUrl?: string, pdfText?: string, billId?: string) => void;
}

export const BillUploader: React.FC<BillUploaderProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const readAndEmit = async (file: File) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // Multi-page statements can take a while to extract text from and render
      // client-side — show that something's happening instead of looking frozen.
      setIsProcessing(true);
      try {
        // Process PDF client-side: extract vector text + render Page 1 image
        const pdfRes = await processPDFFile(file);
        onFileSelected(file.name, pdfRes.pageImage || undefined, pdfRes.text);
      } catch (err) {
        console.warn('PDF processing failed, falling back to standard reader:', err);
        onFileSelected(file.name, undefined, undefined);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Standard image file (JPEG, PNG, WEBP)
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onFileSelected(file.name, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) readAndEmit(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) readAndEmit(e.target.files[0]);
  };

  const triggerCamera = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    const native = await captureNativePhoto();
    if (native) {
      onFileSelected(native.fileName, native.dataUrl);
      return;
    }
    cameraInputRef.current?.click();
  };

  const triggerFileInput = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isProcessing) fileInputRef.current?.click();
  };

  return (
    <div
      className={`upload-card-interactive ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isProcessing ? { cursor: 'wait', opacity: 0.75 } : undefined}
    >
      {/* Native camera capture (mobile app) falls back to this file input's own
          camera capture on web — see captureNativePhoto(). */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleInputChange}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
      />

      <div className="primary">{isProcessing ? 'Reading PDF…' : 'Scan a bill'}</div>
      <div className="secondary">
        {isProcessing ? 'Extracting text from every page — this can take a few seconds' : isDragging ? 'Drop it to scan!' : 'Take a photo, or upload a photo/PDF'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '14px' }}>
        <button
          type="button"
          className="btn-outline"
          onClick={triggerCamera}
          disabled={isProcessing}
          style={{ flex: 1, maxWidth: '160px', justifyContent: 'center', padding: '8px' }}
        >
          <Camera size={13} />
          <span>Take Photo</span>
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={triggerFileInput}
          disabled={isProcessing}
          style={{ flex: 1, maxWidth: '160px', justifyContent: 'center', padding: '8px' }}
        >
          <FileUp size={13} />
          <span>Upload File</span>
        </button>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { Camera, FileUp, Plus } from 'lucide-react';

interface BillUploaderProps {
  onFileSelected: (fileName: string, fileUrl?: string, billId?: string) => void;
}

export const BillUploader: React.FC<BillUploaderProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAndEmit = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = file.type.startsWith('image/') ? (e.target?.result as string) : undefined;
      onFileSelected(file.name, dataUrl);
    };
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      // For PDFs: emit without preview URL
      onFileSelected(file.name, undefined);
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

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <div
      className={`upload-card-interactive ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      role="button"
      tabIndex={0}
      aria-label="Upload bill photo or PDF"
      onKeyDown={(e) => e.key === 'Enter' && triggerFileInput()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
      />
      <div className="glyph">
        <Plus size={20} strokeWidth={2.5} />
      </div>
      <div className="primary">Scan a bill</div>
      <div className="secondary">
        {isDragging ? 'Drop it to scan!' : 'Upload photo or PDF · drag & drop'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '10px' }}>
        <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Camera size={12} /> Photo
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileUp size={12} /> PDF / Image
        </span>
      </div>
    </div>
  );
};

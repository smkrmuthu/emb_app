import React, { useRef, useState } from 'react';
import { Camera, FileUp, Plus } from 'lucide-react';

interface BillUploaderProps {
  onFileSelected: (fileName: string, billId?: string) => void;
}

export const BillUploader: React.FC<BillUploaderProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file.name);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file.name);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`upload-card-interactive ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      role="button"
      tabIndex={0}
      aria-label="Upload Bill photo or PDF"
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
      <div className="secondary">Photo, PDF, or drag & drop here</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
        <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Camera size={12} /> Camera
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileUp size={12} /> PDF / Image
        </span>
      </div>
    </div>
  );
};

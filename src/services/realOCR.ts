/**
 * realOCR.ts
 * Uses Tesseract.js to extract text from uploaded bill images in the browser.
 * Includes HTML5 Canvas preprocessing (downscaling + contrast thresholding)
 * specifically optimized for thermal paper receipts & mobile camera photos.
 */

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export type OCRProgressCallback = (step: string, pct: number) => void;

/**
 * Preprocesses image using HTML Canvas:
 * 1. Resizes large camera photos (max dimension 1600px)
 * 2. Converts to grayscale
 * 3. Increases contrast (binarization filter for thermal receipts)
 */
async function preprocessImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Draw initial resized image
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data for grayscale & contrast enhancement
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // High-contrast grayscale conversion (Otsu-like thresholding)
      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Contrast enhancement — sharpen dark text on light paper
        const v = avg < 140 ? Math.max(0, avg - 40) : Math.min(255, avg + 30);
        data[i] = v;     // R
        data[i + 1] = v; // G
        data[i + 2] = v; // B
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function extractTextFromImage(
  imageData: string,
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  onProgress?.('Enhancing photo for OCR…', 5);

  let processedImage = imageData;
  try {
    processedImage = await preprocessImage(imageData);
  } catch (e) {
    console.warn('Image preprocessing skipped:', e);
  }

  onProgress?.('Loading OCR engine…', 15);

  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'loading language traineddata') {
        onProgress?.('Loading traineddata…', 20 + Math.round(m.progress * 15));
      } else if (m.status === 'initializing api') {
        onProgress?.('Initializing OCR…', 35);
      } else if (m.status === 'recognizing text') {
        onProgress?.('Reading text from photo…', 45 + Math.round(m.progress * 45));
      }
    }
  });

  try {
    onProgress?.('Analyzing lines & prices…', 90);
    const result = await worker.recognize(processedImage);
    onProgress?.('Text extraction complete', 95);

    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } finally {
    await worker.terminate();
  }
}

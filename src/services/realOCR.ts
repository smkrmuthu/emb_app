/**
 * realOCR.ts
 * Uses Tesseract.js to extract text from uploaded bill images in the browser.
 * No backend required — runs entirely client-side.
 */

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number; // 0–100
  words: Array<{ text: string; confidence: number }>;
}

export type OCRProgressCallback = (step: string, pct: number) => void;

export async function extractTextFromImage(
  imageData: string,          // data URL (image/*)
  onProgress?: OCRProgressCallback
): Promise<OCRResult> {
  onProgress?.('Loading OCR engine…', 5);

  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'loading language traineddata') {
        onProgress?.('Loading language data…', 10 + Math.round(m.progress * 20));
      } else if (m.status === 'initializing api') {
        onProgress?.('Initializing OCR engine…', 30);
      } else if (m.status === 'recognizing text') {
        onProgress?.('Reading bill text…', 40 + Math.round(m.progress * 50));
      }
    }
  });

  try {
    onProgress?.('Scanning image…', 40);
    const result = await worker.recognize(imageData);
    onProgress?.('Text extraction complete', 95);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any;
    const words = (data.words ?? []).map((w: { text: string; confidence: number }) => ({
      text: w.text,
      confidence: w.confidence
    }));

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words
    };
  } finally {
    await worker.terminate();
  }
}

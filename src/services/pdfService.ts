/**
 * pdfService.ts
 * Extracts vector text and renders Page 1 of PDF files in the browser using pdfjs-dist.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker path from cdnjs to avoid Vite bundling worker issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFProcessResult {
  text: string;
  pageImage: string; // Data URL JPEG of Page 1
}

export async function processPDFFile(file: File): Promise<PDFProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';

  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageStrings = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageStrings + '\n';
  }

  // Render Page 1 to high-res canvas image for preview & OCR fallback
  let pageImage = '';
  try {
    const page1 = await pdf.getPage(1);
    const viewport = page1.getViewport({ scale: 2.0 }); // 2x high clarity

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport
      };
      await page1.render(renderContext).promise;
      pageImage = canvas.toDataURL('image/jpeg', 0.9);
    }
  } catch (e) {
    console.warn('PDF canvas render skipped:', e);
  }

  return {
    text: fullText,
    pageImage
  };
}

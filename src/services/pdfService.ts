/**
 * pdfService.ts
 * Extracts vector text and renders Page 1 of PDF files in the browser using pdfjs-dist.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Bundle the worker locally (matches the installed pdfjs-dist version exactly) instead
// of fetching it from a CDN on first use. A CDN fetch is a race on the very first PDF
// upload of a session: if the worker script hasn't finished loading yet, page-text
// extraction silently returns too little text, which used to trip the "PDF unreadable"
// fallback immediately — working only on a retry once the script was cached.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export interface PDFProcessResult {
  text: string;
  pageImage: string; // Data URL JPEG of Page 1
}

async function extractOnce(file: File): Promise<PDFProcessResult> {
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

// A dev-server dependency-optimization reload (or a slow first worker warm-up) can
// interrupt the very first PDF processed in a session, silently yielding little or no
// text — which then trips the "PDF unreadable" fallback even though the file is fine
// and re-uploading it immediately works. Retry once before trusting a near-empty result.
const MIN_USABLE_TEXT_LENGTH = 50;

export async function processPDFFile(file: File): Promise<PDFProcessResult> {
  const first = await extractOnce(file);
  if (first.text.trim().length >= MIN_USABLE_TEXT_LENGTH) {
    return first;
  }

  console.warn('PDF text extraction returned too little text on first attempt, retrying once…');
  await new Promise((r) => setTimeout(r, 400));
  const second = await extractOnce(file);
  return second.text.trim().length > first.text.trim().length ? second : first;
}

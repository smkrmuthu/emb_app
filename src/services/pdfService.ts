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

// Warm the browser's HTTP cache for the worker script as soon as this module loads —
// well before the user has even picked a file — instead of paying that cost on the
// first real upload. The worker script is ~1.2MB; on a slow/mobile connection
// downloading it can take several seconds, and the very first getDocument() call
// racing that download is what used to silently truncate extracted text. A plain
// fetch() (rather than routing garbage bytes through getDocument() itself) avoids
// exercising pdf.js's own xref-recovery machinery, which can run long on malformed
// input — this only needs the bytes sitting in cache, never pdf.js's own parsing.
// Capped so a slow/broken network can never block a real upload indefinitely.
function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms))
  ]);
}

const workerWarmup: Promise<void> = withTimeout(
  fetch(pdfjsLib.GlobalWorkerOptions.workerSrc as string),
  8000
);

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

// Belt-and-braces on top of the warm-up above: if extraction still comes back with
// suspiciously little text (a slow connection can outlast even the warm-up), retry
// a couple more times with a growing delay rather than trusting a near-empty result —
// this is what silently produced the "PDF unreadable" fallback on a genuinely fine
// file, working only once the worker happened to be cached from a prior attempt.
const MIN_USABLE_TEXT_LENGTH = 50;
const RETRY_DELAYS_MS = [800, 2000];
const EXTRACTION_TIMEOUT_MS = 25000;

const EMPTY_RESULT: PDFProcessResult = { text: '', pageImage: '' };

// A hard ceiling per attempt: pdf.js parsing an unusual/corrupt PDF (or a worker
// stuck for reasons outside our control) should never freeze the UI indefinitely —
// treat a timed-out attempt the same as one that returned no text, so the caller's
// normal "couldn't read this" handling takes over instead of an infinite spinner.
function extractOnceWithTimeout(file: File): Promise<PDFProcessResult> {
  return Promise.race([
    extractOnce(file),
    new Promise<PDFProcessResult>((resolve) =>
      setTimeout(() => {
        console.warn('PDF extraction attempt exceeded time limit, treating as unreadable.');
        resolve(EMPTY_RESULT);
      }, EXTRACTION_TIMEOUT_MS)
    )
  ]);
}

export async function processPDFFile(file: File): Promise<PDFProcessResult> {
  await workerWarmup;

  let best = await extractOnceWithTimeout(file);

  for (const delayMs of RETRY_DELAYS_MS) {
    if (best.text.trim().length >= MIN_USABLE_TEXT_LENGTH) break;
    console.warn(`PDF text extraction returned too little text, retrying in ${delayMs}ms…`);
    await new Promise((r) => setTimeout(r, delayMs));
    const attempt = await extractOnceWithTimeout(file);
    if (attempt.text.trim().length > best.text.trim().length) {
      best = attempt;
    }
  }

  return best;
}

/**
 * Client-side PDF → page-image conversion.
 *
 * The content backend/OCR pipeline only handles raster images (jpeg/png/heic),
 * one `page` row per image. To support single- and multi-page PDFs without
 * changing that pipeline, we render each PDF page to a JPEG in the browser with
 * pdf.js and feed those images into the existing page-upload path. A 5-page PDF
 * therefore becomes 5 page images, exactly as if they'd been uploaded directly.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed worker URL at build time.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageUploadInput } from './contentApi';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Target render width (CSS px * scale). PDF pages are typically ~600pt wide;
 * rendering at ~1.5x gives legible text for OCR without ballooning file size.
 */
const RENDER_SCALE = 1.5;
/** JPEG quality for rendered pages (0–1). 0.85 keeps text crisp, size modest. */
const JPEG_QUALITY = 0.85;

/** True when the given File is a PDF (by MIME type or extension). */
export function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/** Strips the `data:...;base64,` prefix from a data URL, returning just base64. */
function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/**
 * Renders every page of a PDF File into PageUploadInput entries (JPEG), with
 * sequential pageOrder starting at `startPageOrder` and the given
 * classification. Pages are rendered in document order.
 */
export async function pdfFileToPageUploads(
  file: File,
  startPageOrder: number,
  classification: 'content' | 'exercise'
): Promise<PageUploadInput[]> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const uploads: PageUploadInput[] = [];

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get a 2D canvas context to render the PDF');
      }
      // White background so transparent PDF regions render as white, not black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = stripDataUrlPrefix(dataUrl);
      // Byte length of the decoded base64 payload.
      const sizeBytes = Math.floor((base64.length * 3) / 4);

      uploads.push({
        imageData: base64,
        format: 'jpeg',
        sizeBytes,
        pageOrder: startPageOrder + (pageNo - 1),
        classification,
      });

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return uploads;
}

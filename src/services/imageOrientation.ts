/**
 * Bakes a photo's EXIF orientation into its actual pixel data before it's
 * sent anywhere. Many phone cameras save a photo's rotation as EXIF metadata
 * rather than physically rotating the pixels — a raw FileReader.readAsDataURL
 * preserves that metadata-only rotation as-is, and if whatever eventually
 * decodes the image (an LLM vision API included) doesn't honor the EXIF tag,
 * a portrait bill can get read sideways. Large, bold text (a grand total)
 * often still reads fine sideways; small print or a handwritten-over meter
 * reading — exactly the kind of field that's already hard to read — is far
 * more likely to come out wrong. Normalizing once here means every upload
 * path always sends an image that's actually the right way up, regardless of
 * whether the source browser/OS applied the rotation itself.
 */
export async function normalizeImageOrientation(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a 2D canvas context');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    // Fall back to a plain, unmodified read — no worse than today's existing
    // behavior, just without the fix, for the rare browser that supports
    // neither path.
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsDataURL(file);
    });
  }
}

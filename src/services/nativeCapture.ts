import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * On iOS/Android (via Capacitor), opens the device's native camera UI instead
 * of the plain HTML file input's camera capture — a real native interaction,
 * not just a wrapped website, which matters for App Store review (guideline
 * 4.2, minimum functionality) since photographing a bill is this app's core
 * interaction.
 *
 * Returns null on web (including a browser running inside a Capacitor
 * WebView in dev), signalling the caller should fall back to the existing
 * `<input type="file" capture>` flow — nothing changes there.
 */
export async function captureNativePhoto(): Promise<{ dataUrl: string; fileName: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 85
  });

  if (!photo.dataUrl) return null;
  return { dataUrl: photo.dataUrl, fileName: `bill-${Date.now()}.jpeg` };
}

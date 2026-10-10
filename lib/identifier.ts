/* ---------------------------------------------------------------
   Patient identification readers (hardware abstraction layer).

   Every reader resolves to the raw token text. A token only
   *identifies* a patient — the server still requires an OTP sent to
   the registered mobile before it issues a session.

   Not every browser or reader is supported (Web NFC is Chrome on
   Android only; BarcodeDetector is not available everywhere), so the
   manual entry reader is always available as a fallback.
---------------------------------------------------------------- */

export type ReaderKind = "qr" | "nfc";

export interface IdentifierReader {
  kind: ReaderKind;
  /** Whether this browser/device can use the reader right now. */
  available(): boolean;
  /** Resolves with the scanned token or rejects when cancelled / failed. */
  scan(signal: AbortSignal): Promise<string>;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;
interface NdefReaderLike {
  scan(opts?: { signal: AbortSignal }): Promise<void>;
  onreading: ((e: { message: { records: { recordType: string; data?: DataView }[] } }) => void) | null;
  onreadingerror: (() => void) | null;
}
type NdefReaderCtor = new () => NdefReaderLike;

const w = () => (typeof window === "undefined" ? undefined : (window as unknown as Record<string, unknown>));

export const qrCameraReader = (video: () => HTMLVideoElement | null): IdentifierReader => ({
  kind: "qr",
  available: () => !!w()?.BarcodeDetector && !!navigator.mediaDevices?.getUserMedia,
  async scan(signal) {
    const Detector = w()!.BarcodeDetector as BarcodeDetectorCtor;
    const detector = new Detector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const el = video();
    if (!el) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Camera view is not ready.");
    }
    el.srcObject = stream;
    await el.play();
    try {
      while (!signal.aborted) {
        const found = await detector.detect(el).catch(() => []);
        if (found[0]?.rawValue) return found[0].rawValue;
        await new Promise((r) => setTimeout(r, 300));
      }
      throw new DOMException("Scan cancelled", "AbortError");
    } finally {
      stream.getTracks().forEach((t) => t.stop()); // release the camera on every exit path
      el.srcObject = null;
    }
  },
});

export const nfcReader: IdentifierReader = {
  kind: "nfc",
  available: () => !!w()?.NDEFReader,
  scan(signal) {
    return new Promise<string>((resolve, reject) => {
      const reader = new (w()!.NDEFReader as NdefReaderCtor)();
      reader.onreading = (e) => {
        const record = e.message.records.find((r) => r.recordType === "text" || r.recordType === "unknown") ?? e.message.records[0];
        const text = record?.data ? new TextDecoder().decode(record.data) : "";
        // Text records start with a status byte + language code; keep the JSV1 payload only.
        const match = text.match(/JSV1\.[A-Za-z0-9_-]+/);
        if (match) resolve(match[0]);
        else reject(new Error("This card does not contain a JivSetu code."));
      };
      reader.onreadingerror = () => reject(new Error("The card could not be read. Please try again."));
      reader.scan({ signal }).catch(reject);
    });
  },
};

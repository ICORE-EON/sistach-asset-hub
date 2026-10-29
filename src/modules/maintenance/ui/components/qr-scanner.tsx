/**
 * Camera QR scanner with manual fallback (portable). Uses the native BarcodeDetector when present,
 * otherwise loads @zxing/browser in the browser only. Emits the raw scanned value.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detector = { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function QrScannerDialog({ open, onOpenChange, onResult }: {
  open: boolean; onOpenChange: (o: boolean) => void; onResult: (raw: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let stop = () => {};
    let cancelled = false;
    const done = (v: string) => { if (cancelled) return; cancelled = true; stop(); onResult(v); };
    (async () => {
      setError(null);
      try {
        const video = videoRef.current;
        if (!video || !navigator.mediaDevices?.getUserMedia) throw new Error("Cámara no disponible");
        const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.srcObject = stream; await video.play();
          const det = new Native({ formats: ["qr_code"] });
          let raf = 0;
          const tick = async () => {
            if (cancelled) return;
            try { const r = await det.detect(video); if (r[0]?.rawValue) return done(r[0].rawValue); } catch { /* keep scanning */ }
            raf = requestAnimationFrame(tick);
          };
          stop = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); };
          tick();
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader();
          const controls = await reader.decodeFromVideoDevice(undefined, video, (res) => { if (res) done(res.getText()); });
          stop = () => controls.stop();
          if (cancelled) controls.stop();
        }
      } catch {
        setError("No se pudo abrir la cámara. Introduce el código manualmente.");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [open, onResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Escanear QR del equipo</DialogTitle></DialogHeader>
        <video ref={videoRef} muted playsInline className="aspect-square w-full rounded-md bg-muted object-cover" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onResult(manual.trim()); }}>
          <Input placeholder="Código o enlace del QR" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Código manual" />
          <Button type="submit" variant="secondary">Abrir</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

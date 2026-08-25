import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { Alert } from '@/components/ui/Alert';

interface QrScannerProps {
  // Camera stays off until this flips true, so the door scanner isn't left running (and the
  // browser's camera-in-use indicator isn't lit) between customers.
  active: boolean;
  onScan: (data: string) => void;
}

// Camera-based QR scanner for door check-in (Ticket 14). Decodes frames locally via jsQR —
// nothing is uploaded anywhere, the raw QR text goes straight to onScan the same way the
// hardware-scanner text input already does.
export function QrScanner({ active, onScan }: QrScannerProps) {
  const { t } = useTranslation('employee');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read through refs inside the camera-lifecycle effect below instead of depending on onScan/t
  // directly: neither is guaranteed to be reference-stable across renders, and the effect calls
  // setError, so depending on an unstable value there would restart the whole camera stream
  // (or worse, loop forever re-requesting it) on every render instead of only on active/inactive.
  const onScanRef = useRef(onScan);
  const tRef = useRef(t);
  useEffect(() => {
    onScanRef.current = onScan;
    tRef.current = t;
  }, [onScan, t]);

  useEffect(() => {
    if (!active) return undefined;

    // Checked inside tick() itself, not just relied on via cancelAnimationFrame — a frame
    // callback already in flight when we unmount/deactivate must still see this and stop
    // rescheduling itself, rather than trusting cancellation timing.
    let stopped = false;
    setError(null);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        stop();
        onScanRef.current(code.data);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        frameRef.current = requestAnimationFrame(tick);
      } catch {
        if (!stopped) setError(tRef.current('checkIn.cameraError'));
      }
    })();

    return () => stop();
    // Intentionally only [active]: see the comment on onScanRef/tRef above.
  }, [active]);

  if (!active) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black">
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted aria-label={t('checkIn.cameraPreviewLabel')} />
      )}
      <canvas ref={canvasRef} className="hidden" data-testid="qr-scanner-canvas" />
    </div>
  );
}

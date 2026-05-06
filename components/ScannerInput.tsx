'use client';

import { useEffect, useRef, useState } from 'react';
import { Scan, Camera, Keyboard } from 'lucide-react';

type ScanResult = {
  raw: string;
  gtin?: string;
  lot?: string;
  expirationDate?: string;
  serial?: string;
  qty?: number;
};

/**
 * Décodeur GS1 Application Identifiers (AI) basique.
 * Ex: (01)03012345678900(10)LOT-A(17)241231(21)SN0001
 */
function parseGS1(input: string): ScanResult {
  const raw = input.trim();
  const result: ScanResult = { raw };
  if (!raw.includes('(')) {
    return result;
  }
  const re = /\((\d{2,4})\)([^()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const [, ai, val] = m;
    if (ai === '01') result.gtin = val;
    else if (ai === '10') result.lot = val;
    else if (ai === '17') {
      const yy = val.slice(0, 2);
      const mm = val.slice(2, 4);
      const dd = val.slice(4, 6);
      const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
      result.expirationDate = `${year}-${mm}-${dd}`;
    } else if (ai === '21') result.serial = val;
    else if (ai === '30') result.qty = Number(val);
  }
  return result;
}

export function ScannerInput({
  onScan,
  placeholder = 'Scannez un code-barres…',
}: {
  onScan: (data: ScanResult) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const [decoded, setDecoded] = useState<ScanResult | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let detector: any = null;
    let stopped = false;

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // @ts-ignore — BarcodeDetector API expérimentale
        if (typeof window.BarcodeDetector !== 'undefined') {
          // @ts-ignore
          detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const tick = async () => {
            if (stopped || !videoRef.current || !detector) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const v = barcodes[0].rawValue as string;
                handleScan(v);
                stopped = true;
                setCameraOn(false);
                stream?.getTracks().forEach((t) => t.stop());
                return;
              }
            } catch {}
            requestAnimationFrame(tick);
          };
          tick();
        }
      } catch (e) {
        console.error('Caméra inaccessible :', e);
        setCameraOn(false);
      }
    }
    init();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  function handleScan(v: string) {
    const decoded = parseGS1(v);
    setDecoded(decoded);
    setValue(v);
    onScan(decoded);
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Scan className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                handleScan(value.trim());
                setValue('');
              }
            }}
            placeholder={placeholder}
            className="input pl-9 pr-12 text-base"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">↵</kbd>
        </div>
        <button
          type="button"
          onClick={() => setCameraOn(!cameraOn)}
          className={`btn-secondary ${cameraOn ? 'bg-brand-100 dark:bg-brand-950/40' : ''}`}
        >
          <Camera className="size-4" />
        </button>
      </div>

      {cameraOn && (
        <div className="mt-3 rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full max-h-[60vh]" muted playsInline />
          <div className="text-center text-xs text-white/70 py-2">Pointez la caméra vers le code-barres…</div>
        </div>
      )}

      {decoded && (
        <div className="mt-3 card p-3 text-sm">
          <div className="font-mono text-xs text-zinc-500">Code reçu :</div>
          <div className="font-mono text-sm break-all">{decoded.raw}</div>
          {(decoded.gtin || decoded.lot || decoded.expirationDate || decoded.serial || decoded.qty) && (
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {decoded.gtin && (
                <>
                  <dt className="text-zinc-500">GTIN (01)</dt>
                  <dd className="font-mono">{decoded.gtin}</dd>
                </>
              )}
              {decoded.lot && (
                <>
                  <dt className="text-zinc-500">Lot (10)</dt>
                  <dd className="font-mono">{decoded.lot}</dd>
                </>
              )}
              {decoded.expirationDate && (
                <>
                  <dt className="text-zinc-500">Péremption (17)</dt>
                  <dd className="font-mono">{decoded.expirationDate}</dd>
                </>
              )}
              {decoded.serial && (
                <>
                  <dt className="text-zinc-500">N° série (21)</dt>
                  <dd className="font-mono">{decoded.serial}</dd>
                </>
              )}
              {decoded.qty != null && (
                <>
                  <dt className="text-zinc-500">Qté variable (30)</dt>
                  <dd className="font-mono">{decoded.qty}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

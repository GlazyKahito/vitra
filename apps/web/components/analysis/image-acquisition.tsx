"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, RotateCw, Upload, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImageSource = "upload" | "browser_camera" | "synthetic";

export interface AcquiredImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  source: ImageSource;
  rotation: 0 | 90 | 180 | 270;
}

export interface ImageAcquisitionProps {
  value: AcquiredImage | null;
  onChange: (img: AcquiredImage | null) => void;
  /** Which sources are enabled. */
  sources?: ImageSource[];
  /** Capture is blocked (e.g. timer not complete) — shows the reason. */
  blockedReason?: string | null;
  maxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  syntheticSeed?: number;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];

async function decode(file: File): Promise<{ width: number; height: number; url: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Applies the rotation on a canvas and returns a new PNG file (called before submit). */
export async function bakeRotation(img: AcquiredImage): Promise<File> {
  if (img.rotation === 0) return img.file;
  const bmp = await createImageBitmap(img.file);
  const swap = img.rotation === 90 || img.rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? bmp.height : bmp.width;
  canvas.height = swap ? bmp.width : bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((img.rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Could not encode rotated image");
  const base = img.file.name.replace(/\.[a-z0-9]+$/i, "") || "strip";
  return new File([blob], `${base}-rot${img.rotation}.png`, { type: "image/png" });
}

/**
 * Reusable image acquisition: drag-drop/upload with client-side validation,
 * browser camera (getUserMedia → canvas), or a synthetic demo strip from the CV
 * service. Browser capture is the laptop/phone webcam, not the device camera.
 */
export function ImageAcquisition({ value, onChange, sources = ["upload", "browser_camera", "synthetic"], blockedReason = null, maxBytes = 15 * 1024 * 1024, minWidth = 640, minHeight = 200, syntheticSeed }: ImageAcquisitionProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [seed, setSeed] = useState<number>(syntheticSeed ?? Math.floor(Math.random() * 1000));
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const blocked = blockedReason !== null;

  const accept = useCallback(
    async (file: File, source: ImageSource) => {
      setError(null);
      if (!ACCEPT.includes(file.type)) {
        setError(`Unsupported format ${file.type || "(unknown)"}. Use JPEG, PNG, WebP, BMP or TIFF.`);
        return;
      }
      if (file.size > maxBytes) {
        setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        return;
      }
      setBusy("Decoding image…");
      try {
        const { width, height, url } = await decode(file);
        if (width < minWidth || height < minHeight) {
          URL.revokeObjectURL(url);
          setError(`Image is ${width}×${height}px; at least ${minWidth}×${minHeight}px is required so the pads resolve.`);
          return;
        }
        if (value) URL.revokeObjectURL(value.previewUrl);
        onChange({ file, previewUrl: url, width, height, source, rotation: 0 });
      } catch {
        setError("The file could not be decoded as an image.");
      } finally {
        setBusy(null);
      }
    },
    [maxBytes, minWidth, minHeight, onChange, value],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (blocked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void accept(file, "upload");
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function openCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose a camera (getUserMedia unavailable).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera permission was denied or no camera is available.");
    }
  }

  async function captureFrame() {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    stopCamera();
    if (!blob) {
      setError("Could not read a frame from the camera.");
      return;
    }
    await accept(new File([blob], `browser-capture-${Date.now()}.png`, { type: "image/png" }), "browser_camera");
  }

  async function fetchSynthetic() {
    setError(null);
    setBusy("Rendering synthetic strip…");
    try {
      const res = await fetch(`/api/cv/synthetic-strip?seed=${encodeURIComponent(seed)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await accept(new File([blob], `synthetic-strip-seed${seed}.png`, { type: blob.type || "image/png" }), "synthetic");
    } catch (e) {
      setError(`Synthetic strip unavailable (${e instanceof Error ? e.message : "error"}). Is the CV service running?`);
    } finally {
      setBusy(null);
    }
  }

  const rotate = () => value && onChange({ ...value, rotation: (((value.rotation + 90) % 360) as 0 | 90 | 180 | 270) });
  const clear = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {blocked ? (
        <div className="rounded-[var(--radius-sm)] border border-line bg-ink-1 px-4 py-3 text-[12.5px] text-fg-3" role="status">
          {blockedReason}
        </div>
      ) : null}

      {value ? (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-8">
            <div className="panel-inset relative flex items-center justify-center overflow-hidden" style={{ minHeight: 280 }}>
              { }
              <img src={value.previewUrl} alt="Strip preview" className="max-h-[420px] max-w-full object-contain transition-transform duration-300" style={{ transform: `rotate(${value.rotation}deg)` }} />
              {value.source === "synthetic" ? <span className="absolute left-3 top-3 rounded-[2px] border border-dashed border-line-strong bg-ink-0/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-2">Synthetic</span> : null}
            </div>
          </div>
          <div className="col-span-4 flex flex-col gap-3">
            <dl className="panel-inset grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-3 text-[12px]">
              <dt className="text-fg-4">Source</dt>
              <dd className="t-mono text-fg-2">{value.source === "browser_camera" ? "browser camera" : value.source}</dd>
              <dt className="text-fg-4">Dimensions</dt>
              <dd className="t-mono text-fg-2">
                {value.width}×{value.height}
              </dd>
              <dt className="text-fg-4">Size</dt>
              <dd className="t-mono text-fg-2">{(value.file.size / 1024).toFixed(0)} KB</dd>
              <dt className="text-fg-4">Rotation</dt>
              <dd className="t-mono text-fg-2">{value.rotation}°</dd>
            </dl>
            <p className="text-[12px] leading-relaxed text-fg-4">Orientation hint: the strip should run horizontally with the handle on the left or right. Rotation is baked into the image before upload.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" leading={<RotateCw className="size-3.5" />} onClick={rotate}>
                Rotate 90°
              </Button>
              <Button type="button" variant="ghost" size="sm" leading={<X className="size-3.5" />} onClick={clear}>
                Retake / replace
              </Button>
            </div>
          </div>
        </div>
      ) : cameraOpen ? (
        <div className="flex flex-col gap-3">
          <div className="panel-inset relative overflow-hidden">
            <video ref={videoRef} muted playsInline className="block max-h-[420px] w-full object-contain" />
            <span className="absolute left-3 top-3 rounded-[2px] border border-line-strong bg-ink-0/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-notice">Browser camera — not the device camera</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={captureFrame} leading={<Camera className="size-4" />}>
              Capture frame
            </Button>
            <Button type="button" variant="ghost" onClick={stopCamera}>
              Close camera
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {sources.includes("upload") ? (
            <div
              className={cn("col-span-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed p-6 text-center transition-colors", dragging ? "border-signal bg-signal-dim" : "border-line-strong hover:border-[rgba(255,255,255,0.3)]", blocked && "pointer-events-none opacity-40")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            >
              <Upload className="size-5 text-fg-3" />
              <div className="text-[13.5px] text-fg">Drop a strip photo or click to browse</div>
              <div className="t-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4">
                jpeg · png · webp · bmp · tiff · ≤ {Math.round(maxBytes / 1024 / 1024)} MB · ≥ {minWidth}×{minHeight}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void accept(f, "upload");
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}
          <div className="col-span-6 flex flex-col gap-3">
            {sources.includes("browser_camera") ? (
              <div className="panel-inset flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-fg">Browser camera</div>
                  <span className="t-mono text-[9.5px] uppercase tracking-[0.14em] text-notice">not the device camera</span>
                </div>
                <p className="text-[12px] text-fg-4">Uses this computer&apos;s webcam through getUserMedia. It is a convenience for testing, not the prototype&apos;s controlled-illumination capture.</p>
                <Button type="button" variant="secondary" size="sm" onClick={openCamera} disabled={blocked} leading={<Camera className="size-3.5" />} className="self-start">
                  Open camera
                </Button>
              </div>
            ) : null}
            {sources.includes("synthetic") ? (
              <div className="panel-inset flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-fg">Synthetic demo strip</div>
                  <span className="t-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-3">synthetic</span>
                </div>
                <p className="text-[12px] text-fg-4">Renders a procedurally generated strip from the CV service. The run and every value derived from it are labelled SYNTHETIC.</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[12px] text-fg-3">
                    seed
                    <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="h-8 w-20 rounded-[var(--radius-xs)] border border-line-strong bg-ink-1 px-2 font-mono text-[12px] text-fg" />
                  </label>
                  <Button type="button" variant="secondary" size="sm" onClick={fetchSynthetic} disabled={blocked} leading={<Wand2 className="size-3.5" />}>
                    Use synthetic demo strip
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {busy ? <div className="t-eyebrow">{busy}</div> : null}
      {error ? (
        <div className="rounded-[var(--radius-sm)] border border-[rgba(224,108,108,0.35)] bg-fault-dim px-4 py-2.5 text-[12.5px] text-fault" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

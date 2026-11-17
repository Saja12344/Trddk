"use client";

import { useEffect, useRef } from "react";

const KEY_SOLID = 12;
const KEY_SOFT = 28;

function paintFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (video.readyState < 2) return;

  ctx.drawImage(video, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;
  const key = sampleCorner(data, width);
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    if (dist <= KEY_SOLID) data[i + 3] = 0;
    else if (dist < KEY_SOFT) data[i + 3] = ((dist - KEY_SOLID) / (KEY_SOFT - KEY_SOLID)) * 255;
  }
  ctx.putImageData(frame, 0, 0);
}

function sampleCorner(data: Uint8ClampedArray, width: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const span = Math.min(6, width);
  for (let y = 0; y < span; y += 1) {
    for (let x = 0; x < span; x += 1) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  return [r / n, g / n, b / n];
}

export default function MarketingFilm({ label }: { label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!video || !canvas || !ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const draw = () => {
      paintFrame(ctx, video, canvas);
      if (!media.matches && !video.paused) {
        frame = requestAnimationFrame(draw);
      }
    };

    const sync = () => {
      cancelAnimationFrame(frame);
      if (media.matches) {
        video.pause();
        draw();
        return;
      }
      video.muted = true;
      void video.play().catch(() => undefined);
      frame = requestAnimationFrame(draw);
    };

    sync();
    video.addEventListener("loadeddata", sync);
    video.addEventListener("play", sync);
    media.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("loadeddata", sync);
      video.removeEventListener("play", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  return (
    <figure className="mkt-hero-film">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/marketing/trddk.mp4?v=20261031c" type="video/mp4" />
      </video>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </figure>
  );
}

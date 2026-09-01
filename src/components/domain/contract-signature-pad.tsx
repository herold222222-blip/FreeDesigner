"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** 至少写出约一个姓名的笔迹，才视为完成手写签署 */
const MIN_STROKE_LENGTH = 120;

export function useContractSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pathLength = useRef(0);
  const [hasStroke, setHasStroke] = useState(false);

  const markIncomplete = () => {
    pathLength.current = 0;
    lastPoint.current = null;
    setHasStroke(false);
  };

  const paintBlank = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = parent.clientWidth;
    const height = 168;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 2.2;
  }, []);

  useEffect(() => {
    const onResize = () => {
      markIncomplete();
      paintBlank();
    };
    const id = window.requestAnimationFrame(paintBlank);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [paintBlank]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already captured */
    }
    drawing.current = true;
    const next = point(e);
    lastPoint.current = next;
    ctx.beginPath();
    ctx.moveTo(next.x, next.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const next = point(e);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    const prev = lastPoint.current;
    if (prev) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      pathLength.current += Math.hypot(dx, dy);
    }
    lastPoint.current = next;
    if (!hasStroke && pathLength.current >= MIN_STROKE_LENGTH) {
      setHasStroke(true);
    }
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const clear = () => {
    markIncomplete();
    paintBlank();
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return "";
    return canvas.toDataURL("image/png");
  };

  const canvas = (
    <div className={cn("overflow-hidden rounded-xl border border-ink-20 bg-white")}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="签名画板"
        className="block h-[168px] w-full cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />
    </div>
  );

  return { canvas, clear, exportImage, hasStroke };
}

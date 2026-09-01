"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DeliverableFile, Designer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Eye,
  FileBox,
  Hand,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import {
  inferDeliverableMime,
  isImageDeliverable,
  isOfficeDeliverable,
  isPdfDeliverable,
  officeEmbedSrc,
} from "@/lib/deliverable-files";
import { groupedDeliverables } from "@/lib/deliverable-phase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function uploaderLabel(
  file: DeliverableFile & { uploaderName?: string },
  getDesigner?: (id: string) => Designer | undefined,
) {
  if (file.uploaderName) return file.uploaderName;
  if (file.designerId && getDesigner) {
    return getDesigner(file.designerId)?.name;
  }
  return undefined;
}

function fileHref(file: DeliverableFile) {
  return file.url || file.thumbnail || "";
}

function downloadDeliverable(file: DeliverableFile) {
  const href = fileHref(file);
  if (!href) return false;
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function dataUrlToBlob(
  dataUrl: string,
  mimeHint: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("invalid data url");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime =
    header.match(/data:([^;,]+)/i)?.[1]?.trim() ||
    mimeHint ||
    "application/octet-stream";
  const isBase64 = /;base64/i.test(header);

  if (!isBase64) {
    onProgress(80);
    return new Blob([decodeURIComponent(body)], { type: mime });
  }

  const chunkChars = 256 * 1024;
  const bytes = new Uint8Array(Math.floor(body.length * 0.75));
  let writeOffset = 0;
  let offset = 0;

  while (offset < body.length) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    let end = Math.min(offset + chunkChars, body.length);
    if (end < body.length) end -= end % 4;
    if (end <= offset) end = body.length;
    const bin = atob(body.slice(offset, end));
    for (let i = 0; i < bin.length; i += 1) {
      bytes[writeOffset] = bin.charCodeAt(i);
      writeOffset += 1;
    }
    offset = end;
    onProgress(Math.min(90, Math.round((offset / body.length) * 90)));
    await yieldToUi();
  }

  return new Blob([bytes.subarray(0, writeOffset)], { type: mime });
}

async function fetchToBlob(
  href: string,
  mimeHint: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(href, { signal });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const total = Number(res.headers.get("content-length") || 0);
  if (!res.body) {
    const blob = await res.blob();
    onProgress(90);
    return blob.type && blob.type !== "application/octet-stream"
      ? blob
      : new Blob([blob], { type: mimeHint });
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      onProgress(Math.min(90, Math.round((received / total) * 90)));
    } else {
      onProgress(
        Math.min(85, Math.round(90 * (1 - Math.exp(-received / 2_000_000)))),
      );
    }
  }

  onProgress(90);
  const type = res.headers.get("content-type")?.split(";")[0]?.trim();
  return new Blob(chunks, {
    type: type && type !== "application/octet-stream" ? type : mimeHint,
  });
}

async function hrefToPreviewUrl(
  href: string,
  mime: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<{ url: string; revoke: boolean }> {
  if (href.startsWith("blob:")) {
    onProgress(90);
    return { url: href, revoke: false };
  }
  const blob = href.startsWith("data:")
    ? await dataUrlToBlob(href, mime, onProgress, signal)
    : await fetchToBlob(href, mime, onProgress, signal);
  onProgress(92);
  return { url: URL.createObjectURL(blob), revoke: true };
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  const snapped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(snapped.toFixed(2))));
}

type PreviewTool = "select" | "hand";

function PreviewZoomToolbar({
  zoom,
  onZoomChange,
  tool,
  onToolChange,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  tool: PreviewTool;
  onToolChange: (tool: PreviewTool) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="flex items-center rounded-full border border-ink-20 bg-white p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 px-0",
            tool === "select" ? "bg-ink/10 text-ink" : "text-ink-60",
          )}
          title="箭头工具 · 选择"
          aria-label="箭头工具"
          aria-pressed={tool === "select"}
          onClick={() => onToolChange("select")}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 px-0",
            tool === "hand" ? "bg-ink/10 text-ink" : "text-ink-60",
          )}
          title="手形工具 · 拖动画布（鼠标中键单击或按住也可平移）"
          aria-label="手形工具"
          aria-pressed={tool === "hand"}
          onClick={() => onToolChange("hand")}
        >
          <Hand className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-0.5 rounded-full border border-ink-20 bg-white px-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 px-0"
          title="缩小"
          aria-label="缩小"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-11 text-center text-xs tabular-nums text-ink-60">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 px-0"
          title="放大"
          aria-label="放大"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          title="适应窗口"
          aria-label="适应窗口"
          onClick={() => onZoomChange(1)}
        >
          适应
        </Button>
      </div>
    </div>
  );
}

function PreviewLoadingOverlay({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 px-6"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="text-sm text-ink-60">{label}</p>
      <div className="w-56 max-w-full">
        <Progress value={progress} indicatorClassName="bg-brand" />
      </div>
      <p className="text-xs tabular-nums text-ink-40">{Math.round(progress)}%</p>
    </div>
  );
}

function DeliverablePreviewDialog({
  file,
  open,
  onOpenChange,
}: {
  file: DeliverableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const href = file ? fileHref(file) : "";
  const officeSrc =
    href && file && isOfficeDeliverable(file) ? officeEmbedSrc(href) : null;
  const [src, setSrc] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<PreviewTool>("select");
  const [panning, setPanning] = useState(false);
  const [middleHeld, setMiddleHeld] = useState(false);
  const createdUrlRef = useRef<string | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panDragRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !file || !href) {
      setSrc("");
      setProgress(0);
      setLoading(false);
      setViewerReady(false);
      setError(null);
      return;
    }

    const unsupported =
      !isImageDeliverable(file) &&
      !isPdfDeliverable(file) &&
      !isOfficeDeliverable(file);
    const officeLocalOnly = isOfficeDeliverable(file) && !officeSrc;
    if (unsupported || officeLocalOnly) {
      setSrc("");
      setProgress(100);
      setLoading(false);
      setViewerReady(true);
      setError(null);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    createdUrlRef.current = null;
    setSrc("");
    setProgress(2);
    setLoading(true);
    setViewerReady(false);
    setError(null);

    if (officeSrc) {
      setSrc(officeSrc);
      setProgress(40);
      return () => {
        cancelled = true;
        ac.abort();
      };
    }

    void (async () => {
      try {
        const result = await hrefToPreviewUrl(
          href,
          inferDeliverableMime(file),
          (pct) => {
            if (!cancelled) setProgress(pct);
          },
          ac.signal,
        );
        if (cancelled) {
          if (result.revoke) URL.revokeObjectURL(result.url);
          return;
        }
        if (result.revoke) createdUrlRef.current = result.url;
        setSrc(result.url);
        setProgress((pct) => Math.max(pct, 94));
      } catch (cause) {
        if (cancelled || (cause as Error).name === "AbortError") return;
        setError("文件加载失败，请改用下载查看。");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      if (createdUrlRef.current) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, [open, file, href, officeSrc]);

  useEffect(() => {
    if (!open) {
      setMaximized(false);
      setZoom(1);
      setTool("select");
      setPanning(false);
      setMiddleHeld(false);
    }
  }, [open]);

  useEffect(() => {
    setZoom(1);
    setTool("select");
    setMiddleHeld(false);
  }, [file?.id]);

  useEffect(() => {
    if (!src || viewerReady || !file || !isPdfDeliverable(file)) return;
    const timer = window.setTimeout(() => {
      setViewerReady(true);
      setLoading(false);
      setProgress(100);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [src, viewerReady, file]);

  useEffect(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    if (!frame || !viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        setZoom((current) => clampZoom(current + direction * ZOOM_STEP));
        return;
      }
      if (tool !== "hand" && !middleHeld) return;
      event.preventDefault();
      viewport.scrollLeft += event.deltaX;
      viewport.scrollTop += event.deltaY;
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [src, maximized, tool, middleHeld]);

  const beginPan = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return false;
    panDragRef.current = {
      x: clientX,
      y: clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setPanning(true);
    return true;
  };

  const endPan = () => {
    panDragRef.current = null;
    setPanning(false);
    setMiddleHeld(false);
  };

  useEffect(() => {
    if (!panning) return;
    const onMove = (event: PointerEvent) => {
      const drag = panDragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    };
    const onUp = () => endPan();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panning]);

  useEffect(() => {
    if (!open) return;
    const blockAutoscroll = (event: MouseEvent) => {
      if (event.button !== 1) return;
      const frame = frameRef.current;
      if (!frame) return;
      const target = event.target;
      if (target instanceof Node && frame.contains(target)) {
        event.preventDefault();
      }
    };
    document.addEventListener("mousedown", blockAutoscroll, true);
    document.addEventListener("auxclick", blockAutoscroll, true);
    return () => {
      document.removeEventListener("mousedown", blockAutoscroll, true);
      document.removeEventListener("auxclick", blockAutoscroll, true);
    };
  }, [open]);

  const handleZoomChange = (next: number) => {
    setZoom(next);
  };

  const onPanPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const isMiddle = event.button === 1;
    const isHandDrag = tool === "hand" && event.button === 0;
    if (!isMiddle && !isHandDrag) return;
    event.preventDefault();
    if (isMiddle) setMiddleHeld(true);
    if (!beginPan(event.clientX, event.clientY)) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const markReady = () => {
    setViewerReady(true);
    setLoading(false);
    setProgress(100);
  };

  const showOverlay =
    !!file &&
    !!href &&
    !error &&
    (loading || (!viewerReady && !!src)) &&
    (isImageDeliverable(file) ||
      isPdfDeliverable(file) ||
      Boolean(officeSrc));

  const canZoom =
    !!file &&
    !!src &&
    !error &&
    (isImageDeliverable(file) ||
      isPdfDeliverable(file) ||
      Boolean(officeSrc));

  const loadingLabel =
    progress < 90 ? "正在加载文件…" : "正在打开预览…";

  const scaledFrameStyle = {
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    minWidth: "100%",
    minHeight: "100%",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3 overflow-hidden",
          maximized
            ? "left-0 top-0 h-[100dvh] w-screen max-h-[100dvh] max-w-none translate-x-0 translate-y-0 rounded-none p-4"
            : "max-h-[90vh] w-[min(960px,92vw)] max-w-4xl p-5",
        )}
      >
        <button
          type="button"
          className="absolute right-14 top-5 z-10 rounded-full p-1 text-ink-40 transition-colors hover:bg-ink-20/50 hover:text-ink"
          title={maximized ? "还原" : "最大化"}
          aria-label={maximized ? "还原窗口" : "最大化窗口"}
          onClick={() => setMaximized((value) => !value)}
        >
          {maximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <DialogHeader className="flex-row items-center gap-3 pr-20">
          <DialogTitle className="min-w-0 flex-1 truncate">
            {file?.name ?? "预览"}
          </DialogTitle>
          {canZoom ? (
            <PreviewZoomToolbar
              zoom={zoom}
              onZoomChange={handleZoomChange}
              tool={tool}
              onToolChange={setTool}
            />
          ) : null}
          <DialogDescription className="sr-only">
            在线预览成果文件，可最大化窗口并放大缩小查看图纸
          </DialogDescription>
        </DialogHeader>
        {file && href ? (
          <div
            ref={frameRef}
            className={cn(
              "relative overflow-hidden rounded-xl border border-ink-20 bg-ink-20/20",
              maximized ? "min-h-0 flex-1" : "h-[70vh] min-h-[50vh]",
              tool === "hand" || middleHeld || panning
                ? panning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default",
            )}
            onPointerDown={onPanPointerDown}
          >
            {showOverlay ? (
              <PreviewLoadingOverlay progress={progress} label={loadingLabel} />
            ) : null}
            {canZoom && (tool === "hand" || middleHeld) && !showOverlay ? (
              <div
                className={cn(
                  "absolute inset-0 z-[5] touch-none",
                  panning ? "cursor-grabbing" : "cursor-grab",
                )}
                aria-hidden
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onPanPointerDown(event);
                }}
              />
            ) : null}
            <div
              ref={viewportRef}
              data-preview-viewport="true"
              className="h-full overflow-auto"
            >
            {error ? (
              <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileBox className="h-8 w-8 text-ink-40" />
                <p className="text-sm text-ink-60">{error}</p>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => downloadDeliverable(file)}
                >
                  <Download className="h-3.5 w-3.5" />
                  下载文件
                </Button>
              </div>
            ) : isImageDeliverable(file) && src ? (
              <div className="inline-block min-h-full min-w-full" style={{ width: `${zoom * 100}%` }}>
                <img
                  src={src}
                  alt={file.name}
                  draggable={false}
                  onLoad={markReady}
                  onError={() => {
                    setError("图片无法预览，请改用下载查看。");
                    setLoading(false);
                  }}
                  className="block h-auto w-full max-w-none select-none"
                />
              </div>
            ) : isPdfDeliverable(file) && src ? (
              <div style={scaledFrameStyle}>
                <iframe
                  title={file.name}
                  src={src}
                  onLoad={markReady}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            ) : officeSrc && src ? (
              <div style={scaledFrameStyle}>
                <iframe
                  title={file.name}
                  src={src}
                  onLoad={markReady}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            ) : isImageDeliverable(file) ||
              isPdfDeliverable(file) ||
              Boolean(officeSrc) ? (
              <div className="h-full min-h-[50vh]" aria-hidden />
            ) : isOfficeDeliverable(file) ? (
              <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileBox className="h-8 w-8 text-ink-40" />
                <p className="text-sm text-ink-60">
                  Word / PPT 本地文件无法在浏览器内嵌预览，请下载后用 Office 打开。
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => downloadDeliverable(file)}
                >
                  <Download className="h-3.5 w-3.5" />
                  下载文件
                </Button>
              </div>
            ) : (
              <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileBox className="h-8 w-8 text-ink-40" />
                <p className="text-sm text-ink-60">
                  该格式不支持在线预览，请下载后查看。
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => downloadDeliverable(file)}
                >
                  <Download className="h-3.5 w-3.5" />
                  下载文件
                </Button>
              </div>
            )}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-ink-60">文件不可预览</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeliverableFileList({
  files,
  getDesigner,
  compact,
  unlocked = true,
  onRevise,
  onDelete,
}: {
  files: DeliverableFile[];
  getDesigner?: (id: string) => Designer | undefined;
  compact?: boolean;
  /** 是否已验收解锁下载（预览始终可用） */
  unlocked?: boolean;
  onRevise?: (file: DeliverableFile) => void;
  onDelete?: (file: DeliverableFile) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [preview, setPreview] = useState<DeliverableFile | null>(null);

  if (files.length === 0) return null;

  return (
    <>
      <div className={compact ? "grid gap-2" : "grid gap-2 md:grid-cols-2"}>
        {files.map((file) => {
          const uploader = uploaderLabel(file, getDesigner);
          const href = fileHref(file);
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-ink-20 bg-white p-3"
            >
              {file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className={
                    compact
                      ? "h-10 w-10 rounded-lg object-cover"
                      : "h-11 w-11 rounded-lg object-cover"
                  }
                />
              ) : (
                <div
                  className={
                    compact
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-ink-20"
                      : "flex h-11 w-11 items-center justify-center rounded-lg bg-ink-20"
                  }
                >
                  <FileBox className="h-4 w-4 text-ink-60" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {file.name}
                </div>
                <div className="text-[11px] text-ink-60">
                  {file.size} · {formatDateTime(file.uploadedAt)}
                  {uploader ? ` · 设计师 ${uploader}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  title="预览"
                  aria-label={`预览 ${file.name}`}
                  onClick={() => {
                    if (!href) {
                      push({ title: "该文件暂不可预览", description: file.name });
                      return;
                    }
                    setPreview(file);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  title="下载"
                  aria-label={`下载 ${file.name}`}
                  onClick={() => {
                    if (!href) {
                      push({
                        title: unlocked ? "暂无可下载文件" : "需先验收确认才能下载",
                        variant: unlocked ? undefined : "destructive",
                      });
                      return;
                    }
                    if (!downloadDeliverable(file)) {
                      push({ title: "下载失败", description: file.name });
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {onRevise ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onRevise(file)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    返修
                  </Button>
                ) : null}
                {onDelete && !file.locked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `确定删除「${file.name}」？删除后委托人将无法查看该文件。`,
                        )
                      ) {
                        return;
                      }
                      onDelete(file);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <DeliverablePreviewDialog
        file={preview}
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </>
  );
}

export function DeliverableHistorySections({
  files,
  getDesigner,
  compact,
  unlocked = true,
  onRevise,
  onDelete,
}: {
  files: DeliverableFile[];
  getDesigner?: (id: string) => Designer | undefined;
  compact?: boolean;
  unlocked?: boolean;
  onRevise?: (file: DeliverableFile) => void;
  onDelete?: (file: DeliverableFile) => void;
}) {
  const grouped = groupedDeliverables({ deliverables: files });
  const sections: { key: string; title: string; hint?: string; items: DeliverableFile[] }[] =
    [
      { key: "preliminary", title: "初步成果", items: grouped.preliminary },
      { key: "final", title: "最终成果 / 确认单", items: grouped.final },
      {
        key: "revision",
        title: "返修成果历史",
        hint: "含每次返修的上传时间与对应设计师",
        items: grouped.revision,
      },
    ].filter((section) => section.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          <div className="mb-2 text-xs font-medium text-ink-60">
            {section.title}
            {section.hint ? (
              <span className="ml-1 font-normal text-ink-40">· {section.hint}</span>
            ) : null}
          </div>
          <DeliverableFileList
            files={section.items}
            getDesigner={getDesigner}
            compact={compact}
            unlocked={unlocked}
            onRevise={onRevise}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}

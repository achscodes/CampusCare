import { useCallback, useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";
import CCModal from "../common/CCModal";
import "./ProfileAvatarEditorModal.css";

/** On-screen crop preview (px); export stays sharp via EXPORT_SIZE */
const PREVIEW = 220;
const EXPORT_SIZE = 400;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const PAN_STEP = 6;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} size
 * @param {number} zoom
 * @param {number} panX
 * @param {number} panY
 */
function drawCircularImage(ctx, img, size, zoom, panX, panY) {
  const R = size / 2;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;

  const coverScale = Math.max((2 * R) / iw, (2 * R) / ih);
  const scale = coverScale * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const cx = R + panX;
  const cy = R + panY;
  const dx = cx - dw / 2;
  const dy = cy - dh / 2;

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
  ctx.restore();
}

function clampPan(img, size, zoom, panX, panY) {
  const R = size / 2;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const coverScale = Math.max((2 * R) / iw, (2 * R) / ih);
  const scale = coverScale * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const halfW = dw / 2;
  const halfH = dh / 2;
  const maxPanX = Math.max(0, halfW - R);
  const maxPanY = Math.max(0, halfH - R);
  return {
    panX: Math.min(maxPanX, Math.max(-maxPanX, panX)),
    panY: Math.min(maxPanY, Math.max(-maxPanY, panY)),
  };
}

function exportCircularDataUrl(img, zoom, panX, panY) {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const s = EXPORT_SIZE / PREVIEW;
  drawCircularImage(ctx, img, EXPORT_SIZE, zoom, panX * s, panY * s);
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return canvas.toDataURL("image/png");
  }
}

/**
 * @param {{
 *   open: boolean;
 *   imageSrc: string | null;
 *   onClose: () => void;
 *   onSave: (dataUrl: string) => void;
 *   onPickAnother?: () => void;
 * }} props
 */
export default function ProfileAvatarEditorModal({ open, imageSrc, onClose, onSave, onPickAnother }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [pan, setPan] = useState(() => ({ x: 0, y: 0 }));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded || !img.naturalWidth) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCircularImage(ctx, img, PREVIEW, zoom, pan.x, pan.y);
  }, [imgLoaded, zoom, pan.x, pan.y]);

  useEffect(() => {
    if (!open || !imageSrc) {
      setImgLoaded(false);
      setLoadError(null);
      imgRef.current = null;
      return;
    }

    setZoom(ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    setLoadError(null);
    setImgLoaded(false);

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      setLoadError("Could not load this image.");
      imgRef.current = null;
      setImgLoaded(false);
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleZoomChange = (nextZoom) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
    setZoom(z);
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    setPan((prev) => {
      const c = clampPan(img, PREVIEW, z, prev.x, prev.y);
      return { x: c.panX, y: c.panY };
    });
  };

  const onPointerDown = (e) => {
    if (!imgLoaded) return;
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active || !imgLoaded) return;
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setPan((prev) => {
      const c = clampPan(img, PREVIEW, zoom, prev.x + dx, prev.y + dy);
      return { x: c.panX, y: c.panY };
    });
  };

  const onPointerUp = (e) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const img = imgRef.current;
      if (!img?.naturalWidth) return;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -PAN_STEP;
      else if (e.key === "ArrowRight") dx = PAN_STEP;
      else if (e.key === "ArrowUp") dy = -PAN_STEP;
      else if (e.key === "ArrowDown") dy = PAN_STEP;
      else return;
      e.preventDefault();
      setPan((prev) => {
        const c = clampPan(img, PREVIEW, zoom, prev.x + dx, prev.y + dy);
        return { x: c.panX, y: c.panY };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const c = clampPan(img, PREVIEW, zoom, pan.x, pan.y);
    const dataUrl = exportCircularDataUrl(img, zoom, c.panX, c.panY);
    if (dataUrl) onSave(dataUrl);
    onClose();
  };

  return (
    <CCModal
      open={open && Boolean(imageSrc)}
      title="Choose profile picture"
      onClose={onClose}
      centered
      wide
      modalClassName="profile-avatar-editor-cc-modal"
    >
      <div className="profile-avatar-editor">
        {loadError ? (
          <p className="profile-avatar-editor__error" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="profile-avatar-editor__workspace-wrap">
          <div
            className="profile-avatar-editor__workspace"
            role="application"
            aria-label="Crop preview; drag to reposition"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <canvas ref={canvasRef} width={PREVIEW} height={PREVIEW} className="profile-avatar-editor__canvas" />
          </div>
          <div className="profile-avatar-editor__hint">
            <Move size={12} strokeWidth={2} aria-hidden />
            <span>Drag or use arrow keys to reposition image</span>
          </div>
        </div>

        <div className="profile-avatar-editor__zoom">
          <span className="profile-avatar-editor__zoom-label" aria-hidden>
            −
          </span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="profile-avatar-editor__slider"
            aria-label="Zoom"
          />
          <span className="profile-avatar-editor__zoom-label" aria-hidden>
            +
          </span>
        </div>

        {typeof onPickAnother === "function" ? (
          <div className="profile-avatar-editor__replace">
            <button type="button" className="profile-avatar-editor__link" onClick={() => onPickAnother()}>
              Choose another photo
            </button>
          </div>
        ) : null}

        <div className="profile-avatar-editor__footer">
          <button type="button" className="profile-avatar-editor__cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="profile-avatar-editor__save cc-btn-primary" onClick={handleSave} disabled={!imgLoaded}>
            Save
          </button>
        </div>
      </div>
    </CCModal>
  );
}

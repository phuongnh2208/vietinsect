import L from "leaflet";

/**
 * DEFAULT_SCIENTIFIC_GRADIENT
 * Phổ màu mật độ điểm ghi nhận (Occurrence Record Density):
 * - Thấp (Low): Xanh cốm nhạt / Vàng chanh (#84CC16 -> #FACC15)
 * - Trung bình (Medium): Cam hổ phách (#F59E0B -> #EA580C)
 * - Cao (High): Đỏ tươi -> Đỏ sẫm (#DC2626 -> #7F1D1D)
 */
export const DEFAULT_SCIENTIFIC_GRADIENT = {
  0.15: "#84CC16",
  0.38: "#FACC15",
  0.62: "#F97316",
  0.84: "#DC2626",
  1.0: "#7F1D1D",
};

function buildColorPaletteLut(gradientConfig = DEFAULT_SCIENTIFIC_GRADIENT) {
  if (typeof document === "undefined") return new Uint8ClampedArray(256 * 4);
  const palCanvas = document.createElement("canvas");
  palCanvas.width = 1;
  palCanvas.height = 256;
  const ctx = palCanvas.getContext("2d");
  if (!ctx || typeof ctx.createLinearGradient !== "function") {
    return new Uint8ClampedArray(256 * 4);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(gradientConfig).forEach(([stop, color]) => {
    grad.addColorStop(Number(stop), color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 256);
  if (typeof ctx.getImageData === "function") {
    const imgData = ctx.getImageData(0, 0, 1, 256);
    if (imgData && imgData.data) return imgData.data;
  }
  return new Uint8ClampedArray(256 * 4);
}

/**
 * LeafletHeatLayer — Lớp bản đồ nhiệt mật độ không gian liên tục (tương thích chuẩn L.heatLayer / leaflet.heat).
 * Thuật toán:
 * 1. Tích lũy cường độ hạt nhân Gaussian (Radial Alpha Stamp) của từng ô lưới/điểm lên kênh Alpha của Canvas 2D.
 * 2. Ánh xạ mảng Alpha (0..255) qua bảng tra màu 256 mức (Color LUT) với độ trong suốt thích ứng để giữ rõ bản đồ nền.
 * 3. Các vùng không có bản ghi (alpha = 0) giữ nguyên độ trong suốt 100%, không bao giờ sinh điểm nóng giả.
 */
const LeafletHeatLayer = L.Layer.extend({
  options: {
    radius: 20,
    blur: 15,
    maxZoom: 18,
    minOpacity: 0.22,
    maxOpacity: 0.86,
    max: 1.0,
    gradient: DEFAULT_SCIENTIFIC_GRADIENT,
  },

  initialize(latlngs = [], options = {}) {
    this._latlngs = Array.isArray(latlngs) ? latlngs : [];
    L.setOptions(this, options);
    this._palette = buildColorPaletteLut(this.options.gradient);
  },

  setLatLngs(latlngs = []) {
    this._latlngs = Array.isArray(latlngs) ? latlngs : [];
    return this.redraw();
  },

  setOptions(options = {}) {
    L.setOptions(this, options);
    if (options.gradient) {
      this._palette = buildColorPaletteLut(this.options.gradient);
    }
    return this.redraw();
  },

  onAdd(map) {
    this._map = map;
    if (!this._canvas) {
      this._initCanvas();
    }
    const pane = this.getPane();
    if (pane && this._canvas) {
      pane.appendChild(this._canvas);
    }
    map.on("moveend zoomend resize", this._reset, this);
    this._reset();
  },

  onRemove(map) {
    const pane = this.getPane();
    if (pane && this._canvas && this._canvas.parentNode === pane) {
      pane.removeChild(this._canvas);
    }
    map.off("moveend zoomend resize", this._reset, this);
  },

  redraw() {
    if (this._map && this._canvas) {
      this._draw();
    }
    return this;
  },

  _initCanvas() {
    const canvas = L.DomUtil.create("canvas", "vi-leaflet-heat-layer leaflet-layer");
    const originProp = L.DomUtil.testProp([
      "transformOrigin",
      "WebkitTransformOrigin",
      "msTransformOrigin",
    ]);
    if (originProp) {
      canvas.style[originProp] = "50% 50%";
    }
    canvas.style.pointerEvents = "none";
    const size = this._map ? this._map.getSize() : { x: 800, y: 600 };
    canvas.width = Math.max(1, size.x);
    canvas.height = Math.max(1, size.y);
    this._canvas = canvas;
  },

  _reset() {
    if (!this._map || !this._canvas) return;
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const size = this._map.getSize();
    if (size.x > 0 && size.y > 0) {
      if (this._canvas.width !== size.x) this._canvas.width = size.x;
      if (this._canvas.height !== size.y) this._canvas.height = size.y;
    }
    this._draw();
  },

  _draw() {
    if (!this._map || !this._canvas) return;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) return;

    const width = this._canvas.width;
    const height = this._canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!this._latlngs || this._latlngs.length === 0 || width <= 0 || height <= 0) {
      return;
    }

    const r = Math.max(6, Number(this.options.radius) || 20);
    const blur = Math.max(4, Number(this.options.blur) || 15);
    const totalRadius = r + blur;
    const maxVal = Math.max(0.0001, Number(this.options.max) || 1.0);
    const minOpacity = Number(this.options.minOpacity ?? 0.22);
    const maxOpacity = Number(this.options.maxOpacity ?? 0.86);

    // 1. Vẽ hạt nhân Gaussian lên kênh Alpha cho từng điểm/ô lưới trong khung nhìn
    for (let i = 0; i < this._latlngs.length; i += 1) {
      const entry = this._latlngs[i];
      const lat = Array.isArray(entry) ? Number(entry[0]) : Number(entry?.lat);
      const lon = Array.isArray(entry) ? Number(entry[1]) : Number(entry?.lon ?? entry?.lng);
      const rawWeight = Array.isArray(entry) ? Number(entry[2] ?? 1) : Number(entry?.weight ?? 1);

      if (
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        continue;
      }

      const pt = this._map.latLngToContainerPoint([lat, lon]);
      if (
        pt.x < -totalRadius ||
        pt.y < -totalRadius ||
        pt.x > width + totalRadius ||
        pt.y > height + totalRadius
      ) {
        continue;
      }

      const alpha = Math.min(1, Math.max(minOpacity, rawWeight / maxVal));

      if (typeof ctx.createRadialGradient === "function") {
        const radGrad = ctx.createRadialGradient(pt.x, pt.y, r * 0.12, pt.x, pt.y, totalRadius);
        if (typeof radGrad.addColorStop === "function") {
          radGrad.addColorStop(0, `rgba(0,0,0,${alpha})`);
          radGrad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.55})`);
          radGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, totalRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Ánh xạ kênh Alpha (0..255) sang phổ màu liên tục (256-color LUT)
    if (
      typeof ctx.getImageData === "function" &&
      typeof ctx.putImageData === "function" &&
      this._palette &&
      this._palette.length === 1024
    ) {
      const img = ctx.getImageData(0, 0, width, height);
      if (img && img.data) {
        const pixels = img.data;
        const pal = this._palette;
        for (let idx = 0; idx < pixels.length; idx += 4) {
          const a = pixels[idx + 3];
          if (a > 4) {
            const lutOffset = a * 4;
            pixels[idx] = pal[lutOffset];
            pixels[idx + 1] = pal[lutOffset + 1];
            pixels[idx + 2] = pal[lutOffset + 2];
            // Giới hạn độ đục tối đa để bản đồ địa lý bên dưới luôn nhìn rõ
            const scaledAlpha = Math.min(
              Math.round(maxOpacity * 255),
              Math.max(Math.round(minOpacity * 180), a),
            );
            pixels[idx + 3] = scaledAlpha;
          } else {
            pixels[idx + 3] = 0;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
    }
  },
});

export function createLeafletHeatLayer(latlngs, options) {
  return new LeafletHeatLayer(latlngs, options);
}

if (typeof L !== "undefined" && !L.heatLayer) {
  L.heatLayer = createLeafletHeatLayer;
}

export default createLeafletHeatLayer;

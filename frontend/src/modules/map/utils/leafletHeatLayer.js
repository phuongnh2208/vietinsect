import L from "leaflet";

/**
 * DEFAULT_SCIENTIFIC_GRADIENT
 * Phổ màu khoa học rõ nét, độ trong suốt hợp lý để luôn đọc rõ bản đồ địa lý bên dưới:
 * - Thấp (Low): Xanh lục nhạt -> Vàng chanh (#22C55E -> #EAB308)
 * - Trung bình (Medium): Cam sáng (#F97316)
 * - Cao / Điểm nóng (High): Đỏ tươi -> Đỏ đậm (#DC2626 -> #991B1B)
 */
export const DEFAULT_SCIENTIFIC_GRADIENT = {
  0.08: "#22C55E",
  0.32: "#84CC16",
  0.55: "#FACC15",
  0.76: "#F97316",
  0.92: "#DC2626",
  1.0: "#991B1B",
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
 * LeafletHeatLayer — Bản đồ nhiệt mật độ không gian chuẩn hóa tự động (Normalized Float32 Kernel Density).
 * Khắc phục triệt để hiện tượng "bão hòa đỏ toàn quốc" khi có hàng chục nghìn bản ghi:
 * 1. Tích lũy hàm hạt nhân Gaussian của từng ô lưới PostGIS vào bộ đệm số thực Float32Array.
 * 2. Chuẩn hóa theo giá trị cực đại thực tế trên màn hình (maxAccumulated) kết hợp hàm gamma (0.72),
 *    đảm bảo chỉ những vùng tập trung cao nhất mới có màu đỏ/cam, vùng trung bình màu vàng, vùng thấp màu xanh lá nhạt.
 * 3. Giới hạn độ đục (alpha <= 0.72 ở tâm, 0.18..0.48 ở vùng thấp/trung bình) để bản đồ nền, tên tỉnh/thành luôn rõ nét.
 */
const LeafletHeatLayer = L.Layer.extend({
  options: {
    radius: 14,
    blur: 10,
    maxZoom: 18,
    minOpacity: 0.14,
    maxOpacity: 0.74,
    gamma: 0.72,
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

    const r = Math.max(5, Number(this.options.radius) || 14);
    const blur = Math.max(3, Number(this.options.blur) || 10);
    const kernelRadius = Math.round(r + blur);
    const rSq = kernelRadius * kernelRadius;
    const sigmaSq2 = 2 * Math.pow(kernelRadius * 0.44, 2);
    const minOpacity = Number(this.options.minOpacity ?? 0.14);
    const maxOpacity = Number(this.options.maxOpacity ?? 0.74);
    const gamma = Number(this.options.gamma ?? 0.72);

    // Bộ đệm Float32Array lưu cường độ thực tại từng điểm ảnh, chống tràn bão hòa kênh Alpha 8-bit
    const field = new Float32Array(width * height);
    let maxFieldVal = 0;

    for (let i = 0; i < this._latlngs.length; i += 1) {
      const entry = this._latlngs[i];
      const lat = Array.isArray(entry) ? Number(entry[0]) : Number(entry?.lat);
      const lon = Array.isArray(entry) ? Number(entry[1]) : Number(entry?.lon ?? entry?.lng);
      const weight = Array.isArray(entry) ? Number(entry[2] ?? 1) : Number(entry?.weight ?? 1);

      if (
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180 ||
        weight <= 0
      ) {
        continue;
      }

      const pt = this._map.latLngToContainerPoint([lat, lon]);
      const cx = Math.round(pt.x);
      const cy = Math.round(pt.y);

      if (
        cx < -kernelRadius ||
        cy < -kernelRadius ||
        cx >= width + kernelRadius ||
        cy >= height + kernelRadius
      ) {
        continue;
      }

      const yStart = Math.max(0, cy - kernelRadius);
      const yEnd = Math.min(height - 1, cy + kernelRadius);
      const xStart = Math.max(0, cx - kernelRadius);
      const xEnd = Math.min(width - 1, cx + kernelRadius);

      for (let y = yStart; y <= yEnd; y += 1) {
        const dy = y - cy;
        const dySq = dy * dy;
        const rowOffset = y * width;
        for (let x = xStart; x <= xEnd; x += 1) {
          const dx = x - cx;
          const distSq = dx * dx + dySq;
          if (distSq <= rSq) {
            // Hàm hạt nhân Gaussian có biên rơi mềm về 0 tại dist = kernelRadius
            const edgeTaper = 1 - distSq / rSq;
            const kVal = weight * Math.exp(-distSq / sigmaSq2) * edgeTaper;
            const idx = rowOffset + x;
            const nextVal = field[idx] + kVal;
            field[idx] = nextVal;
            if (nextVal > maxFieldVal) {
              maxFieldVal = nextVal;
            }
          }
        }
      }
    }

    if (maxFieldVal <= 0) return;

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
        const cutoff = 0.035; // Loại bỏ rìa nhiễu quá mờ để nền bản đồ sạch và sắc nét

        for (let i = 0; i < field.length; i += 1) {
          const rawRatio = field[i] / maxFieldVal;
          if (rawRatio > cutoff) {
            const norm = Math.min(1, Math.pow((rawRatio - cutoff) / (1 - cutoff), gamma));
            const colorIdx = Math.min(255, Math.max(1, Math.round(norm * 255)));
            const lutOffset = colorIdx * 4;
            const pOffset = i * 4;

            pixels[pOffset] = pal[lutOffset];
            pixels[pOffset + 1] = pal[lutOffset + 1];
            pixels[pOffset + 2] = pal[lutOffset + 2];

            // Độ đục tỷ lệ thuận với mật độ nhưng tối đa chỉ ~74% ở tâm để luôn nhìn xuyên thấy chữ & đường biên bản đồ
            const alphaNorm = minOpacity + norm * (maxOpacity - minOpacity);
            pixels[pOffset + 3] = Math.round(alphaNorm * 255);
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

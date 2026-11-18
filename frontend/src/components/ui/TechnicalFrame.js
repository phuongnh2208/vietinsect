import React from "react";

/**
 * TechnicalFrame
 * Khung hiển thị phong cách tiêu bản / bản vẽ kỹ thuật (Technical Drafting / Crop-mark frame)
 * Bao gồm các đường kẻ gióng vượt qua 4 góc và các ô vuông định vị (registration markers).
 *
 * Props:
 * - children: Nội dung hiển thị bên trong khung (ảnh, banner, bản đồ, ...)
 * - className: Class tùy biến thêm
 * - style: Inline style tùy biến
 * - markers: "diagonal" (mặc định: trên-phải + dưới-trái) | "all" (cả 4 góc) | "none"
 * - cropExtension: Độ dài đường kẻ gióng vượt ra ngoài (px, mặc định 22)
 * - aspectRatio: Tỉ lệ khung hình (ví dụ: "21/9", "16/9", "auto")
 */
export default function TechnicalFrame({
  children,
  className = "",
  style = {},
  markers = "diagonal",
  cropExtension = 22,
  aspectRatio,
  onClick,
}) {
  return (
    <div
      className={`technical-frame-wrapper ${className}`}
      style={{
        "--crop-ext": `${cropExtension}px`,
        ...style,
      }}
      onClick={onClick}
    >
      {/* 4 đường kẻ gióng vượt góc (Crop marks) */}
      <div className="crop-line crop-line-top" />
      <div className="crop-line crop-line-bottom" />
      <div className="crop-line crop-line-left" />
      <div className="crop-line crop-line-right" />

      {/* Các ô vuông định vị góc (Square registration markers) */}
      {(markers === "diagonal" || markers === "all") && (
        <>
          <div className="corner-square corner-top-right" />
          <div className="corner-square corner-bottom-left" />
        </>
      )}
      {markers === "all" && (
        <>
          <div className="corner-square corner-top-left" />
          <div className="corner-square corner-bottom-right" />
        </>
      )}

      {/* Nội dung bên trong khung */}
      <div
        className="technical-frame-inner"
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

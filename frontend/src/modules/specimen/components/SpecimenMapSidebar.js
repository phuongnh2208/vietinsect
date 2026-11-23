import React, { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../../../components/ui/Icon";
import { getOrderColor } from "../specimen.constants";

export default function SpecimenMapSidebar({
  latitude,
  longitude,
  scientificName,
  orderName,
  provinceNameVn,
  localityDetail,
  license,
  onCopyCoordinates,
}) {
  const { t } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const navigate = useNavigate();

  const hasCoords = latitude != null && longitude != null;
  const orderColor = getOrderColor(orderName);

  useEffect(() => {
    if (!hasCoords || !mapContainerRef.current) return undefined;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 9,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    // Lớp nền Esri World Topo Map sắc nét, không watermark
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; USGS, NOAA, DeLorme",
        maxZoom: 18,
      },
    ).addTo(map);

    // Marker mẫu vật
    const marker = L.circleMarker([latitude, longitude], {
      radius: 9,
      fillColor: orderColor || "#2E7D32",
      color: "#FFFFFF",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95,
    }).addTo(map);

    const pinIconHtml = renderToStaticMarkup(
      <Icon name="pin" size={12} style={{ flexShrink: 0 }} />,
    );

    marker
      .bindPopup(
        `<div style="font-family:Inter,sans-serif;padding:2px;">
          <strong style="font-style:italic;font-size:13px;display:block;margin-bottom:2px;">${scientificName}</strong>
          <span style="font-size:11px;color:#555;display:inline-flex;align-items:center;gap:4px;">${pinIconHtml}${provinceNameVn || "Việt Nam"}</span><br/>
          <span style="font-size:10px;color:#777;">WGS84: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
        </div>`,
      )
      .openPopup();

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasCoords, latitude, longitude, scientificName, orderColor, provinceNameVn]);

  return (
    <aside className="vi-specimen-sidebar-col">
      {/* Khung bản đồ không gian PostGIS */}
      <div className="card vi-specimen-map-card">
        <div className="map-card-header">
          <div className="map-header-title">
            <Icon name="map" size={16} />
            <span>{t("specimenDetail.spatialLocation")}</span>
          </div>
          <span className="map-datum-chip">WGS84 · EPSG:4326</span>
        </div>

        {hasCoords ? (
          <>
            <div ref={mapContainerRef} className="specimen-sidebar-map" />

            <div className="map-coordinates-box">
              <div className="coord-item">
                <span className="coord-label">{t("gis.latitude")}</span>
                <strong className="coord-val">{latitude.toFixed(5)}°N</strong>
              </div>
              <div className="coord-divider" />
              <div className="coord-item">
                <span className="coord-label">{t("gis.longitude")}</span>
                <strong className="coord-val">{longitude.toFixed(5)}°E</strong>
              </div>
            </div>

            <div className="map-actions-group">
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onCopyCoordinates}
              >
                <Icon name="copy" size={13} />
                {t("specimenDetail.copyCoords")}
              </button>

              <button
                type="button"
                className="button button-sm button-primary"
                onClick={() =>
                  navigate(`/map?lat=${latitude}&lon=${longitude}&radius=30`)
                }
              >
                <Icon name="globe" size={14} />
                {t("specimenDetail.exploreNearby")}
              </button>
            </div>
          </>
        ) : (
          <div className="map-no-coords-state">
            <Icon name="alert" size={24} />
            <p>{t("specimenDetail.noCoordsDesc")}</p>
          </div>
        )}
      </div>

      {/* Thẻ Quản lý & Bản quyền Mở */}
      <div className="card vi-citation-card">
        <div className="citation-header">
          <Icon name="shield" size={16} />
          <span>{t("specimenDetail.citationHeader")}</span>
        </div>
        <p className="citation-text">
          <strong>{t("specimenDetail.citationOrg")}</strong>
          <br />
          {t("specimenDetail.citationInstitute")}
        </p>
        <div className="citation-meta-list">
          <div className="citation-meta-item">
            <span>{t("specimenDetail.openDataLabel")}</span>
            <strong>{license || t("specimenDetail.notRecorded")}</strong>
          </div>
          <div className="citation-meta-item">
            <span>{t("specimenDetail.exportFormatLabel")}</span>
            <strong>Darwin Core Archive (DwC-A)</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

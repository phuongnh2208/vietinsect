import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import specimenService from "../../specimen/specimen.service";
import { formatNumber } from "../../../utils/formatters";

const GOOGLE_VN_MAP_URL =
  "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi&gl=VN";

function getDensityColor(count) {
  if (count >= 5000) return "#B0241A";
  if (count >= 1500) return "#9C7A1F";
  return "#2E7D32";
}

function getMarkerRadius(count) {
  if (count >= 8000) return 16;
  if (count >= 3000) return 13;
  if (count >= 1000) return 10;
  return 7;
}

export default function HomeMapHero({ stats = null }) {
  const { t, i18n } = useTranslation();
  const [fetchedProvinces, setFetchedProvinces] = useState([]);

  useEffect(() => {
    if (stats?.topProvinces) return;
    specimenService
      .getStats()
      .then((res) => {
        if (res?.topProvinces) setFetchedProvinces(res.topProvinces);
      })
      .catch(() => {});
  }, [stats?.topProvinces]);

  const provinces = stats?.topProvinces || fetchedProvinces;

  return (
    <div
      style={{
        width: "100%",
        height: 500,
        border: "1px solid #D1D5DB",
        borderRadius: 0,
        overflow: "hidden",
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
      }}
    >
      <MapContainer
        center={[15.8, 108.5]}
        zoom={6}
        style={{ height: "100%", width: "100%", borderRadius: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer attribution="&copy; Google Maps" url={GOOGLE_VN_MAP_URL} />
        {provinces.map((prov) =>
          prov.lat != null && prov.lon != null ? (
            <CircleMarker
              key={prov.province_id}
              center={[prov.lat, prov.lon]}
              radius={getMarkerRadius(Number(prov.count))}
              pathOptions={{
                color: "#111111",
                weight: 1.5,
                fillColor: getDensityColor(Number(prov.count)),
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div style={{ fontSize: 12.5, color: "#111111" }}>
                  <strong>{prov.province_name_vn}</strong>
                  <div>
                    {t("home.recordedSpecimens")}{" "}
                    <strong>{formatNumber(prov.count, i18n.language)}</strong>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Link to={`/specimens/search?provinceId=${prov.province_id}`}>
                      {t("home.searchAtProvince", { province: prov.province_name_vn })}
                    </Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}

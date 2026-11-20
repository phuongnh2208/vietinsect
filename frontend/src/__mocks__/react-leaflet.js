import React from "react";

const MockDiv = ({ children, ...props }) => <div {...props}>{children}</div>;

export const MapContainer = MockDiv;
export const TileLayer = MockDiv;
export const CircleMarker = MockDiv;
export const Marker = MockDiv;
export const Popup = MockDiv;
export const Tooltip = MockDiv;
export const GeoJSON = MockDiv;
export const Polygon = MockDiv;
export const Polyline = MockDiv;
export const LayersControl = Object.assign(MockDiv, {
  BaseLayer: MockDiv,
  Overlay: MockDiv,
});
export const useMap = () => ({
  setView: jest.fn(),
  fitBounds: jest.fn(),
  invalidateSize: jest.fn(),
});
export const useMapEvent = jest.fn();
export const useMapEvents = jest.fn();

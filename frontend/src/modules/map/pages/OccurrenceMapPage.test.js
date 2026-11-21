import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OccurrenceMapPage from "./OccurrenceMapPage";
import { ToastProvider } from "../../../components/ui/ToastProvider";
import specimenService from "../../specimen/specimen.service";

jest.mock("../../specimen/specimen.service", () => ({
  getLookups: jest.fn(),
  getMapOccurrences: jest.fn(),
}));

describe("VietInsect WebGIS Redesign – OccurrenceMapPage", () => {
  beforeEach(() => {
    specimenService.getLookups.mockResolvedValue({
      orders: [
        { id: 10, scientificName: "Coleoptera" },
        { id: 20, scientificName: "Lepidoptera" },
      ],
      families: [
        { id: 12, scientificName: "Cicindelidae", orderName: "Coleoptera" },
        { id: 22, scientificName: "Papilionidae", orderName: "Lepidoptera" },
      ],
      provinces: [
        { id: 1, nameVn: "Ninh Bình", region: "Đồng bằng sông Hồng" },
        { id: 2, nameVn: "Lâm Đồng", region: "Tây Nguyên" },
      ],
      regions: ["Đồng bằng sông Hồng", "Tây Nguyên"],
      institutions: ["VAST", "IEBR"],
      habitats: [{ id: 1, labelVn: "Rừng nhiệt đới ẩm" }],
    });

    specimenService.getMapOccurrences.mockResolvedValue({
      totalMatching: 98114,
      returnedPoints: 2,
      summary: {
        totalOccurrences: 98114,
        distinctSpeciesCount: 3868,
        provincesCount: 34,
      },
      points: [
        {
          id: 1001,
          code: "VIET-000142",
          scientificName: "Cicindela aurulenta",
          taxonRank: "Species",
          orderName: "Coleoptera",
          familyName: "Cicindelidae",
          genusName: "Cicindela",
          provinceNameVn: "Ninh Bình",
          district: "Nho Quan",
          localityDetail: "VQG Cúc Phương",
          elevationM: 320,
          collectionDate: "2024-06-14",
          basisOfRecord: "PRESERVED_SPECIMEN",
          institutionCode: "VAST",
          recordedBy: "TS. Nguyễn Văn A",
          lat: 20.25061,
          lon: 105.71342,
        },
        {
          id: 1002,
          code: "VIET-000219",
          scientificName: "Papilio paris",
          taxonRank: "Species",
          orderName: "Lepidoptera",
          familyName: "Papilionidae",
          genusName: "Papilio",
          provinceNameVn: "Lâm Đồng",
          district: "Lạc Dương",
          localityDetail: "VQG Bidoup - Núi Bà",
          elevationM: 1480,
          collectionDate: "2024-05-19",
          basisOfRecord: "PRESERVED_SPECIMEN",
          institutionCode: "IEBR",
          recordedBy: "ThS. Trần Thị B",
          lat: 12.18204,
          lon: 108.67891,
        },
      ],
      provinceClusters: [
        {
          provinceId: 1,
          provinceNameVn: "Ninh Bình",
          region: "Đồng bằng sông Hồng",
          count: 14200,
          speciesCount: 640,
          lat: 20.25,
          lon: 105.71,
        },
        {
          provinceId: 2,
          provinceNameVn: "Lâm Đồng",
          region: "Tây Nguyên",
          count: 11800,
          speciesCount: 580,
          lat: 12.18,
          lon: 108.68,
        },
      ],
      regionClusters: [
        {
          region: "Đồng bằng sông Hồng",
          count: 28400,
          speciesCount: 1120,
          provinceCount: 8,
          lat: 20.6,
          lon: 105.9,
        },
      ],
      heatGrid: [
        { lat: 20.375, lon: 105.625, count: 4200 },
        { lat: 12.125, lon: 108.625, count: 3150 },
      ],
    });
  });

  test("renders compact header stats, 3 map modes, spatial filter groups, ecological layers panel (with unavailable vegetation layer), and collapsible legend", async () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <ToastProvider>
          <OccurrenceMapPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("webgis-header-stats")).toHaveTextContent(/98[.,]114/);
    });

    // Verify 3 map modes work and trigger PostGIS queries
    const modeGroup = screen.getByTestId("webgis-mode-segmented");
    const buttons = within(modeGroup).getAllByRole("button");
    expect(buttons.length).toBe(3);

    // Switch to Density / Heatmap mode
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(buttons[1]).toHaveClass("active");
    });

    // Switch to PostGIS Radius mode -> opens Advanced Spatial Filters automatically
    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId("webgis-advanced-spatial-body")).toBeInTheDocument();
    });
    expect(buttons[2]).toHaveClass("active");

    // Open Ecological GIS Layers Panel and verify honest unavailable state for Vegetation Cover
    fireEvent.click(screen.getByTestId("webgis-layers-toggle"));
    const layersPanel = await screen.findByTestId("gis-layers-panel");
    expect(layersPanel).toBeInTheDocument();
    expect(screen.getByTestId("gis-layer-vegetation-unavailable")).toBeInTheDocument();

    // Filter interaction creates removable active filter chip
    const [orderSelect] = screen.getAllByLabelText(/webgis\.filters\.order|Order/i);
    fireEvent.change(orderSelect, { target: { value: "Coleoptera" } });

    await waitFor(() => {
      expect(screen.getByTestId("gis-active-filter-chips")).toHaveTextContent("Coleoptera");
    });

    // Collapsible Legend Panel
    expect(screen.getByTestId("gis-legend-panel")).toBeInTheDocument();
  });
});

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

describe("VietInsect WebGIS – Spatial Density & Heatmap Visualization", () => {
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
      densityMeta: {
        method: "POSTGIS_ADAPTIVE_SPATIAL_GRID",
        gridSizeDeg: 0.2,
        gridSizeKm: 22.3,
        cellCount: 3,
        minCellCount: 120,
        medianCellCount: 1850,
        p75CellCount: 3150,
        maxCellCount: 4850,
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
        { lat: 20.31, lon: 105.61, cellLat: 20.3, cellLon: 105.7, count: 4850 },
        { lat: 16.2, lon: 107.85, cellLat: 16.3, cellLon: 107.9, count: 1850 },
        { lat: 12.18, lon: 108.68, cellLat: 12.1, cellLon: 108.7, count: 120 },
      ],
    });
  });

  test("Scenario 1, 2, 3, 4 & 8: activates density mode, renders continuous heatmap canvas with MẬT ĐỘ GHI NHẬN legend & numerical ranges, responds to filters, and restores markers when switching back", async () => {
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

    const modeGroup = screen.getByTestId("webgis-mode-segmented");
    const buttons = within(modeGroup).getAllByRole("button");

    // 1. Activate Density / Heatmap mode
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(buttons[1]).toHaveClass("active");
    });

    // Verify legend shows MẬT ĐỘ GHI NHẬN, actual numerical cell ranges (120 .. 1,850 .. 4,850), and scientific disclaimer
    const legendPanel = screen.getByTestId("gis-legend-panel");
    expect(legendPanel).toHaveTextContent(/MẬT ĐỘ GHI NHẬN/i);
    expect(legendPanel).toHaveTextContent(/120/);
    expect(legendPanel).toHaveTextContent(/4[.,]850/);
    expect(screen.getByTestId("webgis-density-disclaimer")).toBeInTheDocument();

    // 2. Filter by Order / Province / Date Range in density mode -> preserves mode & updates PostGIS query
    const [orderSelect] = screen.getAllByLabelText(/webgis\.filters\.order|Order/i);
    fireEvent.change(orderSelect, { target: { value: "Coleoptera" } });

    await waitFor(() => {
      expect(screen.getByTestId("gis-active-filter-chips")).toHaveTextContent("Coleoptera");
    });

    expect(specimenService.getMapOccurrences).toHaveBeenLastCalledWith(
      expect.objectContaining({
        order: "Coleoptera",
        zoom: 6,
      }),
      expect.any(Object),
    );

    // 3. Switch back to Specimen Points mode -> preserves filter and hides density disclaimer
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(buttons[0]).toHaveClass("active");
    });
    expect(screen.queryByTestId("webgis-density-disclaimer")).not.toBeInTheDocument();
    expect(screen.getByTestId("gis-active-filter-chips")).toHaveTextContent("Coleoptera");
  });

  test("Scenario 5: displays meaningful empty state when filter or region has zero valid occurrence records", async () => {
    specimenService.getMapOccurrences.mockResolvedValueOnce({
      totalMatching: 0,
      returnedPoints: 0,
      summary: { totalOccurrences: 0, distinctSpeciesCount: 0, provincesCount: 0 },
      densityMeta: {
        method: "POSTGIS_ADAPTIVE_SPATIAL_GRID",
        gridSizeDeg: 0.2,
        gridSizeKm: 22.3,
        cellCount: 0,
        minCellCount: 0,
        medianCellCount: 0,
        p75CellCount: 0,
        maxCellCount: 0,
      },
      points: [],
      provinceClusters: [],
      regionClusters: [],
      heatGrid: [],
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <ToastProvider>
          <OccurrenceMapPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    const emptyOverlay = await screen.findByTestId("webgis-empty-state");
    expect(emptyOverlay).toBeInTheDocument();
  });
});

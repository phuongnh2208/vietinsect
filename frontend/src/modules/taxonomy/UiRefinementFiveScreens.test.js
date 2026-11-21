import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SpeciesProfilePage from "./pages/SpeciesProfilePage";
import TaxonomyTreePage from "./pages/TaxonomyTreePage";
import MediaGalleryPage from "../media/pages/MediaGalleryPage";
import SpecimenImageViewerModal from "../media/components/SpecimenImageViewerModal";
import { ToastProvider } from "../../components/ui/ToastProvider";
import useTaxonomyStore from "./taxonomy.store";
import taxonomyService from "./taxonomy.service";
import specimenService from "../specimen/specimen.service";
import dnaService from "../dna/dna.service";
import mediaService from "../media/media.service";

jest.mock("./taxonomy.service", () => ({
  getSpeciesProfile: jest.fn(),
  searchTaxa: jest.fn(),
  getTree: jest.fn(),
  getChildren: jest.fn(),
}));

jest.mock("../specimen/specimen.service", () => ({
  getLookups: jest.fn(),
  getSpecimens: jest.fn(),
  getMapOccurrences: jest.fn(),
}));

jest.mock("../dna/dna.service", () => ({
  getDnaList: jest.fn(),
}));

jest.mock("../media/media.service", () => ({
  ALLOWED_MEDIA_LICENSES: [{ code: "cc-by", label: "CC BY 4.0" }],
  getMediaStats: jest.fn(),
  getMediaList: jest.fn(),
}));

describe("Global UI/UX Refinement – 5 Scientific Screens", () => {
  beforeEach(() => {
    taxonomyService.getSpeciesProfile.mockResolvedValue({
      id: 101,
      scientificName: "Cobososia reducta",
      scientificNameAuthorship: "(Walker, 1854)",
      rank: "Species",
      taxonomicStatus: "accepted",
      iucnStatus: "LC",
      vernacularNameVn: "Ngài hổ đốm",
      orderName: "Lepidoptera",
      familyName: "Erebidae",
      genusName: "Cobososia",
      specimenCount: 12,
      morphologyDescription: null,
      ecologyDescription: null,
      bioactivity: [],
      externalLinks: { gbifUrl: "https://www.gbif.org/species/1" },
    });
    taxonomyService.searchTaxa.mockResolvedValue([]);
    taxonomyService.getTree.mockResolvedValue([
      {
        id: 1,
        rank: "Kingdom",
        scientificName: "Animalia",
        vernacularNameVn: "Động vật",
        childCount: 1,
        specimenCount: 129700,
        children: [
          {
            id: 2,
            rank: "Order",
            scientificName: "Lepidoptera",
            vernacularNameVn: "Bộ Cánh vảy",
            childCount: 18,
            specimenCount: 25400,
            children: [],
          },
        ],
      },
    ]);
    taxonomyService.getChildren.mockResolvedValue([]);

    specimenService.getLookups.mockResolvedValue({
      orders: [{ id: 2, scientificName: "Lepidoptera" }],
      provinces: [{ id: 1, nameVn: "Ninh Bình" }],
    });
    specimenService.getSpecimens.mockResolvedValue({
      items: [
        {
          id: 501,
          specimenCode: "GBIF-501",
          scientificName: "Cobososia reducta",
          provinceNameVn: "Ninh Bình",
          collectionDate: "2024-05-10",
          latitude: 20.3168,
          longitude: 105.6085,
          basisOfRecord: "PRESERVED_SPECIMEN",
        },
      ],
      pagination: { total: 12 },
    });
    specimenService.getMapOccurrences.mockResolvedValue({
      points: [],
      provinceClusters: [],
      totalMatching: 0,
    });

    dnaService.getDnaList.mockResolvedValue({ items: [] });

    mediaService.getMediaStats.mockResolvedValue({
      totalImages: 1450,
      specimensWithMedia: 980,
      dwcaExportable: 1200,
    });
    mediaService.getMediaList.mockResolvedValue({
      items: [
        {
          id: 901,
          specimenId: 501,
          specimenCode: "GBIF-501",
          scientificName: "Cobososia reducta",
          orderName: "Lepidoptera",
          provinceNameVn: "Ninh Bình",
          licenseCode: "cc-by",
          licenseLabel: "CC BY 4.0",
          shotType: "habitus",
          attribution: "VAST Museum",
          collectionDate: "2024-05-10",
          isDwcaExportable: true,
          url: "/api/media/901/file",
          thumbnailUrl: "/api/media/901/file",
        },
      ],
      pagination: { total: 1, page: 1, limit: 24, totalPages: 1 },
    });

    useTaxonomyStore.setState({
      tree: [],
      treeStatus: "idle",
      treeError: null,
      selectedNodeId: null,
      expandedIds: {},
      loadingNodeIds: {},
    });
  });

  test("Screens 1 & 2: SpeciesProfilePage renders 2-column Morphology & Ecology with 'Chưa cung cấp' fallbacks and 7-column Specimens table", async () => {
    render(
      <MemoryRouter initialEntries={["/species/cobososia-reducta"]}>
        <Routes>
          <Route path="/species/:slug" element={<SpeciesProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("species-profile-page")).toBeInTheDocument();
    });

    // Balanced two-column Morphology & Ecology tab with consistent "Chưa cung cấp" state
    expect(screen.getByTestId("tab-panel-morphology")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa cung cấp").length).toBeGreaterThanOrEqual(2);

    // Switch to Specimens tab -> 7-column scientific data table
    const specTab = screen.getByRole("tab", { name: /Mẫu vật/i });
    fireEvent.click(specTab);

    const table = await screen.findByTestId("species-specimens-table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("GBIF-501")).toBeInTheDocument();
    expect(screen.getByText("20.3168°N, 105.6085°E")).toBeInTheDocument();
    expect(screen.getByText("Xem chi tiết →")).toBeInTheDocument();
  });

  test("Screen 3: TaxonomyTreePage renders compact two-panel explorer with non-blank introductory guide and updates detail panel on selection", async () => {
    render(
      <MemoryRouter initialEntries={["/taxonomy"]}>
        <TaxonomyTreePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("taxonomy-tree-view")).toBeInTheDocument();
    });

    // Right panel is NEVER blank before selection (shows introductory guide)
    expect(screen.getByTestId("taxonomy-intro-guide")).toBeInTheDocument();

    // Clicking a compact tree node populates the right detail panel
    fireEvent.click(screen.getByText("Lepidoptera"));
    expect(screen.getByTestId("taxonomy-detail-panel")).toHaveTextContent("Bộ Cánh vảy");
    expect(screen.getByTestId("taxonomy-detail-panel")).toHaveTextContent("25.400 mẫu vật");
  });

  test("Screens 4 & 5: MediaGalleryPage renders compact inline stats + immediate gallery grid and opens SpecimenImageViewerModal with zoom controls", async () => {
    render(
      <MemoryRouter initialEntries={["/media"]}>
        <ToastProvider>
          <MediaGalleryPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("media-gallery-grid")).toBeInTheDocument();
    });

    expect(screen.getByTestId("media-compact-stats")).toBeInTheDocument();
    expect(screen.getByText("Cobososia reducta")).toBeInTheDocument();

    // Open Screen 4 SpecimenImageViewerModal by clicking the photo
    const photo = screen.getByAltText("Cobososia reducta");
    fireEvent.click(photo);

    const modal = await screen.findByTestId("specimen-image-viewer-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Phóng to"));
    expect(screen.getByText("125%")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Vừa khung hình"));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  test("Screen 4 standalone: SpecimenImageViewerModal supports keyboard navigation and metadata display", () => {
    const onIndexChange = jest.fn();
    const onClose = jest.fn();
    render(
      <MemoryRouter>
        <SpecimenImageViewerModal
          open
          items={[
            { id: 1, scientificName: "Papilio xuthus", specimenId: 10, specimenCode: "VAST-10", url: "/a.jpg" },
            { id: 2, scientificName: "Papilio machaon", specimenId: 11, specimenCode: "VAST-11", url: "/b.jpg" },
          ]}
          currentIndex={0}
          onIndexChange={onIndexChange}
          onClose={onClose}
        />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

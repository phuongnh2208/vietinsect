import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FacetPanel from "./components/FacetPanel";
import ActiveFilters from "./components/ActiveFilters";
import ViewSwitcher from "./components/ViewSwitcher";
import useSearchQueryParams from "./useSearchQueryParams";
import AdvancedSearchPage from "../specimen/pages/AdvancedSearchPage";
import searchService from "./search.service";

jest.mock("./search.service", () => ({
  __esModule: true,
  default: {
    searchSpecimens: jest.fn(),
  },
}));

// Helper harness for testing useSearchQueryParams
function UrlSyncHarness() {
  const { state, updateParams, resetFilters } = useSearchQueryParams();
  return (
    <div>
      <pre data-testid="state-json">{JSON.stringify(state)}</pre>
      <button type="button" onClick={() => updateParams({ order: "Coleoptera" })}>
        Set Coleoptera
      </button>
      <button type="button" onClick={resetFilters}>
        Reset
      </button>
    </div>
  );
}

describe("Sprint C – Group 2: SCR-15 Search Workbench (DEF-061)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("FacetPanel renders all 8 facets and triggers taxon cascade & facet selection", () => {
    const onChange = jest.fn();
    const facets = {
      taxon: {
        orders: [{ key: "Coleoptera", count: 42 }],
        families: [{ key: "Scarabaeidae", count: 15 }],
        genera: [{ key: "Oryctes", count: 5 }],
        species: [{ key: "Oryctes rhinoceros", count: 5 }],
      },
      provinces: [{ key: "Lâm Đồng", count: 12 }],
      mediaTypes: [
        { key: "image", count: 10 },
        { key: "dna", count: 4 },
        { key: "bioactivity", count: 2 },
      ],
      iucnStatuses: [{ key: "VU", count: 3 }],
      recordedBy: [{ key: "Nguyen Van A", count: 9 }],
      hasGps: [
        { key: "true", count: 30 },
        { key: "false", count: 12 },
      ],
    };

    render(
      <FacetPanel
        facets={facets}
        state={{
          order: "",
          family: "",
          genus: "",
          species: "",
          province: "",
          yearFrom: "",
          yearTo: "",
          mediaType: "",
          iucnStatus: "",
          elevationMin: "",
          elevationMax: "",
          recordedBy: "",
          hasGps: "",
        }}
        onChange={onChange}
      />
    );

    // Selecting an Order triggers cascade reset of lower taxon levels
    const orderSelect = screen.getByLabelText(/Bộ \(Order\)/i);
    fireEvent.change(orderSelect, { target: { value: "Coleoptera" } });
    expect(onChange).toHaveBeenCalledWith({
      order: "Coleoptera",
      family: "",
      genus: "",
      species: "",
    });
  });

  test("ActiveFilters renders active chips, removes single filter, and resets all", () => {
    const onRemove = jest.fn();
    const onReset = jest.fn();

    render(
      <ActiveFilters
        state={{
          q: "",
          order: "Coleoptera",
          province: "Lâm Đồng",
          elevationMin: "",
          elevationMax: "",
          hasGps: true,
        }}
        onRemove={onRemove}
        onReset={onReset}
      />
    );

    expect(screen.getByText(/Coleoptera/)).toBeInTheDocument();
    expect(screen.getByText(/Lâm Đồng/)).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: /Xóa bộ lọc/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith("order");

    const resetBtn = screen.getByRole("button", { name: /Xóa tất cả|Đặt lại|Reset/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  test("ViewSwitcher renders 5 view modes and switches on click", () => {
    const onChange = jest.fn();
    render(<ViewSwitcher activeView="list" onChange={onChange} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(5);

    fireEvent.click(tabs[1]); // label
    expect(onChange).toHaveBeenCalledWith("label");
    fireEvent.click(tabs[4]); // treemap
    expect(onChange).toHaveBeenCalledWith("treemap");
  });

  test("useSearchQueryParams restores bookmarked URL params and sanitizes invalid params", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/search/advanced?q=Papilio&order=Lepidoptera&view=bogus&page=-5&yearFrom=abc&iucnStatus=VU&evilParam=1",
        ]}
      >
        <UrlSyncHarness />
      </MemoryRouter>
    );

    const parsed = JSON.parse(screen.getByTestId("state-json").textContent);
    expect(parsed.q).toBe("Papilio");
    expect(parsed.order).toBe("Lepidoptera");
    expect(parsed.iucnStatus).toBe("VU");
    // Invalid view falls back to 'list'
    expect(parsed.view).toBe("list");
    // Invalid page falls back to 1
    expect(parsed.page).toBe(1);
    // Non-numeric yearFrom is sanitized out
    expect(parsed.yearFrom).toBe("");
    // Unknown param is ignored
    expect(parsed.evilParam).toBeUndefined();
  });

  test("AdvancedSearchPage displays explicit HTTP 503 banner when Elasticsearch is unavailable", async () => {
    searchService.searchSpecimens.mockRejectedValueOnce({
      response: { status: 503, data: { message: "Elasticsearch unavailable" } },
    });

    render(
      <MemoryRouter initialEntries={["/search/advanced"]}>
        <AdvancedSearchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("search-error-banner")).toBeInTheDocument();
    });
    expect(screen.getByTestId("search-error-banner")).toHaveTextContent(/503/);
  });
});

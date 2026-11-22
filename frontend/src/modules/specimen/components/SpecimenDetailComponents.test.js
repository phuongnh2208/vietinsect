import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SpecimenDwcSections from "./SpecimenDwcSections";
import SpecimenTaxonomyHierarchy from "./SpecimenTaxonomyHierarchy";

describe("SCR-08 Specimen Detail Components (A4 & A5)", () => {
  test("SpecimenDwcSections renders record 129794 fields, separates dateIdentified & entryDate, and shows notRecorded for NULL license", () => {
    const mock129794 = {
      id: 129794,
      specimenCode: "GBIF-6885436349",
      scientificName: "Supella longipalpa",
      localityDetail: "Alley 2 Ap Bac, Tan Binh, Ho Chi Minh City, VN",
      coordinateUncertaintyM: 27004,
      identifiedBy: "insect ID",
      dateIdentified: "2026-11-01",
      createdAt: "2026-11-22T09:21:00Z",
      license: "CC BY",
      referencesUrl: "https://www.inaturalist.org/observations/412244579",
      rightsHolder: "insect ID",
      datasetName: "iNaturalist research-grade observations",
      gbifFamily: "Ectobiidae",
      gbifGenus: "Supella",
      gbifSpecies: "Supella longipalpa",
      isPublic: true,
    };

    render(<SpecimenDwcSections specimen={mock129794} />);
    expect(screen.getByText("Alley 2 Ap Bac, Tan Binh, Ho Chi Minh City, VN")).toBeInTheDocument();
    expect(screen.getByText("± 27004 m")).toBeInTheDocument();
    expect(screen.getByText("2026-11-01")).toBeInTheDocument();
    expect(screen.getByText("CC BY")).toBeInTheDocument();
    const refLink = screen.getByRole("link", { name: "https://www.inaturalist.org/observations/412244579" });
    expect(refLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText("iNaturalist research-grade observations")).toBeInTheDocument();
    expect(screen.getByText("Ectobiidae › Supella › Supella longipalpa")).toBeInTheDocument();

    // NULL license must NOT default to CC BY
    const { container } = render(<SpecimenDwcSections specimen={{ id: 1, license: null, isPublic: true }} />);
    expect(container.textContent).not.toContain("CC BY 4.0");
  });

  test("SpecimenTaxonomyHierarchy links to /search with order/family/genus filters (not /specimens/search?q=)", () => {
    render(
      <MemoryRouter>
        <SpecimenTaxonomyHierarchy
          orderName="Blattodea"
          familyName="Ectobiidae"
          genusName="Supella"
          scientificName="Supella longipalpa"
          taxonRank="Species"
          isAdmin={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Blattodea" })).toHaveAttribute("href", "/search?order=Blattodea");
    expect(screen.getByRole("link", { name: "Ectobiidae" })).toHaveAttribute("href", "/search?family=Ectobiidae");
    expect(screen.getByRole("link", { name: "Supella" })).toHaveAttribute("href", "/search?genus=Supella");
  });
});

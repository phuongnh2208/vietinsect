import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ColumnMapperModal from "./ColumnMapperModal";
import ImportPreviewTable from "./ImportPreviewTable";
import ImageUploadZone from "./ImageUploadZone";
import { BulkImportWorkbenchPage } from "../pages/SpecimenBatchPages";

describe("Sprint D Group 2 Frontend Components (F-SP-06 & F-SP-08)", () => {
  test("ColumnMapperModal maps source columns to target fields and invokes onApply", () => {
    const onApply = jest.fn();
    render(
      <ColumnMapperModal
        open
        sourceColumns={["Ten_Khoa_Hoc", "Ngay_Thu"]}
        onApply={onApply}
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId("column-mapper-modal")).toBeInTheDocument();
    const sciSelect = screen.getByLabelText("Chọn cột cho scientificName");
    fireEvent.change(sciSelect, { target: { value: "Ten_Khoa_Hoc" } });

    fireEvent.click(screen.getByText("Áp dụng ánh xạ"));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ scientificName: "Ten_Khoa_Hoc" }));
  });

  test("ImportPreviewTable renders max 20 rows with red error and yellow warning severity", () => {
    const rows = [
      { rowIndex: 1, severity: "error", errors: ["Thiếu tên khoa học"], warnings: [], data: { scientificName: "" } },
      { rowIndex: 2, severity: "warning", errors: [], warnings: ["Thiếu GPS"], data: { scientificName: "Papilio xuthus", collectionDate: "2024-05-01" } },
      { rowIndex: 3, severity: "ok", errors: [], warnings: [], data: { scientificName: "Papilio demoleus", collectionDate: "2024-05-02" } },
    ];
    render(<ImportPreviewTable previewRows={rows} totalRows={3} />);

    expect(screen.getByTestId("preview-row-1")).toHaveAttribute("data-severity", "error");
    expect(screen.getByTestId("preview-row-2")).toHaveAttribute("data-severity", "warning");
    expect(screen.getByTestId("preview-row-3")).toHaveAttribute("data-severity", "ok");
    expect(screen.getByText("LỖI (ĐỎ)")).toBeInTheDocument();
    expect(screen.getByText("CẢNH BÁO (VÀNG)")).toBeInTheDocument();
  });

  test("ImageUploadZone accepts valid JPG/PNG with shot angle and rejects invalid file types", () => {
    const onFilesSelected = jest.fn();
    render(<ImageUploadZone onFilesSelected={onFilesSelected} />);

    const angleSelect = screen.getByLabelText("Chọn góc chụp ảnh");
    fireEvent.change(angleSelect, { target: { value: "ventral" } });

    const input = screen.getByLabelText("Chọn tệp ảnh mẫu vật");
    const validFile = new File(["dummy"], "beetle.jpg", { type: "image/jpeg" });
    const badFile = new File(["<html>"], "evil.html", { type: "text/html" });

    fireEvent.change(input, { target: { files: [validFile, badFile] } });

    expect(onFilesSelected).toHaveBeenCalledWith([
      expect.objectContaining({ name: "beetle.jpg", shotType: "ventral" }),
    ]);
    expect(screen.getByRole("alert")).toHaveTextContent("evil.html: chỉ chấp nhận JPG/PNG");
    expect(screen.getByTestId("image-upload-list")).toHaveTextContent("beetle.jpg");
  });

  test("BulkImportWorkbenchPage integrates ColumnMapperModal, ImportPreviewTable, and 22-col Excel template button", () => {
    render(
      <MemoryRouter>
        <BulkImportWorkbenchPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId("import-preview-table")).toBeInTheDocument();
    expect(screen.getByTestId("download-excel-template-btn")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-column-mapper-btn"));
    expect(screen.getByTestId("column-mapper-modal")).toBeInTheDocument();
  });
});

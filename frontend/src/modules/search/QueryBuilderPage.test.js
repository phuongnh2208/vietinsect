import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QueryBuilderPage from "./pages/QueryBuilderPage";
import useAuthStore from "../../stores/auth.store";

jest.mock("../../services/http", () => ({
  get: jest.fn(() => Promise.resolve({ data: { data: [] } })),
  post: jest.fn(() =>
    Promise.resolve({
      data: {
        data: [{ id: 1, specimenCode: "VAST-01", scientificName: "Papilio xuthus" }],
        pagination: { total: 1 },
      },
    })
  ),
}));

describe("SCR-16 QueryBuilderPage (F-SR-04, C-04)", () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  test("Public User sees Visual Query Builder (AND/OR/NOT) and does NOT see Admin SQL tab", () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    render(
      <MemoryRouter initialEntries={["/search/advanced"]}>
        <QueryBuilderPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId("scr16-query-builder-page")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-sql-mode")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("+ Thêm điều kiện"));
    expect(screen.getByTestId("qb-rule-1")).toBeInTheDocument();
  });

  test("Admin sees SQL mode tab and can switch to SQL console", () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { adminId: 1, username: "admin", role: "admin" },
    });
    render(
      <MemoryRouter initialEntries={["/admin/search/advanced"]}>
        <QueryBuilderPage />
      </MemoryRouter>
    );

    const sqlTab = screen.getByTestId("tab-sql-mode");
    expect(sqlTab).toBeInTheDocument();
    fireEvent.click(sqlTab);
    expect(screen.getByTestId("sql-console-form")).toBeInTheDocument();
  });
});

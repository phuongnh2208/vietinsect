import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import i18n, {
  changeAppLanguage,
  getSavedLanguage,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "./index";
import LanguageSwitcher from "../components/ui/LanguageSwitcher";
import { formatNumber, formatDate, getIntlLocale } from "../utils/formatters";
import getApiErrorMessage from "../utils/apiError";

function collectKeys(obj, prefix = "") {
  return Object.keys(obj).flatMap((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      return collectKeys(obj[key], fullKey);
    }
    return [fullKey];
  });
}

describe("i18n foundation & LanguageSwitcher", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await act(async () => {
      await changeAppLanguage("vi");
    });
  });

  test("vi.json and en.json have identical key structures", () => {
    const localesDir = path.resolve(__dirname, "../../public/locales");
    const viJson = JSON.parse(fs.readFileSync(path.join(localesDir, "vi.json"), "utf8"));
    const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));

    const viKeys = collectKeys(viJson).sort();
    const enKeys = collectKeys(enJson).sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("normalizeLanguage and getSavedLanguage handle invalid values safely", () => {
    expect(normalizeLanguage("vi")).toBe("vi");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("fr")).toBe("vi");
    expect(normalizeLanguage(null)).toBe("vi");

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "invalid-lang");
    expect(getSavedLanguage()).toBe("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
  });

  test("LanguageSwitcher single variant shows only one rectangular flag button and toggles vi <-> en", async () => {
    render(<LanguageSwitcher variant="single" />);
    const btn = screen.getByTestId("language-switcher-btn");
    expect(btn).toHaveAttribute("data-lang", "vi");
    expect(btn.textContent).toBe("");
    expect(btn.querySelectorAll("svg")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn).toHaveAttribute("data-lang", "en");
    expect(btn.textContent).toBe("");
    expect(btn.querySelectorAll("svg")).toHaveLength(1);
    expect(i18n.language).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn).toHaveAttribute("data-lang", "vi");
    expect(i18n.language).toBe("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
  });

  test("formatters respect vi-VN and en-US locales", () => {
    expect(getIntlLocale("vi")).toBe("vi-VN");
    expect(getIntlLocale("en")).toBe("en-US");
    expect(formatNumber(12345, "en")).toBe("12,345");
    expect(formatDate("2025-05-10T00:00:00Z", "en")).toMatch(/05\/10\/2025/);
  });

  test("getApiErrorMessage maps error codes, HTTP statuses, and network errors", async () => {
    expect(
      getApiErrorMessage({ response: { status: 401, data: { code: "INVALID_CREDENTIALS" } } })
    ).toBe(i18n.t("error.codes.INVALID_CREDENTIALS"));

    expect(getApiErrorMessage({ response: { status: 404, data: {} } })).toBe(
      i18n.t("error.http.404")
    );

    expect(getApiErrorMessage({ code: "ECONNABORTED" })).toBe(i18n.t("error.timeout"));
    expect(getApiErrorMessage({})).toBe(i18n.t("error.network"));

    await act(async () => {
      await changeAppLanguage("en");
    });
    expect(getApiErrorMessage({ response: { status: 500, data: {} } })).toBe(
      "An internal server error occurred. Please try again later."
    );
  });
});

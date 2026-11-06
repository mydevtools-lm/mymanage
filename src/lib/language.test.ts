import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "./types";

const updateCategory = vi.fn();
const setLanguage = vi.fn();
let categories: Partial<Category>[] = [];

vi.mock("./store", () => ({
  useAppStore: { getState: () => ({ categories, updateCategory }) },
}));
vi.mock("./device-prefs", () => ({
  useDevicePrefs: { getState: () => ({ setLanguage }) },
}));

const { switchLanguage } = await import("./language");

describe("switchLanguage", () => {
  beforeEach(() => {
    updateCategory.mockClear();
    setLanguage.mockClear();
  });

  it("names default categories in the chosen language, from either one", () => {
    // A database created in English on a Hebrew interface (and the reverse).
    categories = [
      { id: "a", name: "Home", kind: "task" },
      { id: "b", name: "עבודה", kind: "task" },
    ];
    switchLanguage("he");
    expect(setLanguage).toHaveBeenCalledWith("he");
    expect(updateCategory).toHaveBeenCalledTimes(1);
    expect(updateCategory).toHaveBeenCalledWith("a", { name: "בית" });
  });

  it("leaves categories the person named", () => {
    categories = [{ id: "a", name: "Groceries", kind: "task" }];
    switchLanguage("he");
    expect(updateCategory).not.toHaveBeenCalled();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows a non-destructive recovery action instead of a blank screen", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const deleteDatabase = vi.spyOn(indexedDB, "deleteDatabase");
  function Broken(): never {
    throw new Error("synthetic render failure");
  }
  render(
    <AppErrorBoundary>
      <Broken />
    </AppErrorBoundary>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("不要清除应用数据");
  expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  expect(deleteDatabase).not.toHaveBeenCalled();
});

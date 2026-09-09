import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useDialogFocus } from "./useDialogFocus";
afterEach(cleanup);

it("does not steal focus already placed inside a newly opened dialog", () => {
  let focusFrame: FrameRequestCallback | undefined;
  const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    focusFrame = callback;
    return 1;
  });
  try {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "打开" }));
    const last = screen.getByRole("button", { name: "最后一个" });
    last.focus();
    focusFrame?.(0);
    expect(last).toHaveFocus();
  } finally {
    frameSpy.mockRestore();
  }
});

function Fixture() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开
      </button>
      {open && (
        <div ref={dialogRef} role="dialog" tabIndex={-1}>
          <button type="button">第一个</button>
          <button type="button">最后一个</button>
        </div>
      )}
    </>
  );
}

it("focuses the first control, wraps Tab, and restores the trigger", async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const trigger = screen.getByRole("button", { name: "打开" });
  await user.click(trigger);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "第一个" })).toHaveFocus(),
  );
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "最后一个" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "第一个" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("stops Escape before it reaches the shell listener", async () => {
  const user = userEvent.setup();
  const shellEscape = vi.fn();
  window.addEventListener("keydown", shellEscape);
  render(<Fixture />);
  await user.click(screen.getByRole("button", { name: "打开" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "第一个" })).toHaveFocus(),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "第一个" }), {
    key: "Escape",
  });
  expect(shellEscape).not.toHaveBeenCalled();
  window.removeEventListener("keydown", shellEscape);
});

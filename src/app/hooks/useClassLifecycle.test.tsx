import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTestRepository,
  disposeTestRepository,
  newTestStudent,
  type TestRepositoryFixture,
} from "../../../tests/fixtures/repository";
import { useClassLifecycle } from "./useClassLifecycle";
import { createDefaultDraft } from "../../features/drafts/createDraft";

const fixtures: TestRepositoryFixture[] = [];
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
  vi.restoreAllMocks();
  await Promise.all(fixtures.splice(0).map(disposeTestRepository));
});
async function setup() {
  const fixture = createTestRepository();
  fixtures.push(fixture);
  const { repository } = fixture;
  const a = await repository.createClass({
    name: "虚构甲班",
    grade: "",
    academicYear: "",
  });
  const b = await repository.createClass({
    name: "虚构乙班",
    grade: "",
    academicYear: "",
  });
  await repository.saveDraft(createDefaultDraft(a.id));
  await repository.saveDraft(createDefaultDraft(b.id));
  await repository.createStudent(newTestStudent(a.id, "A"));
  await repository.createStudent(newTestStudent(b.id, "B"));
  return { repository, a, b };
}

describe("class lifecycle isolation and persistence", () => {
  it("hides the old class immediately and ignores a late response from it", async () => {
    const { repository, a, b } = await setup();
    const error = vi.fn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = repository.listStudents.bind(repository);
    vi.spyOn(repository, "listStudents").mockImplementation(async (id) => {
      if (id === a.id) await gate;
      return original(id);
    });
    const { result, rerender } = renderHook(
      ({ id }) => useClassLifecycle(repository, id, error),
      { initialProps: { id: a.id } },
    );
    await waitFor(() =>
      expect(repository.listStudents).toHaveBeenCalledWith(a.id),
    );
    rerender({ id: b.id });
    expect(result.current.draft).toBeUndefined();
    expect(result.current.students).toEqual([]);
    await waitFor(() => expect(result.current.draft?.classId).toBe(b.id));
    await act(async () => {
      release();
      await gate;
    });
    expect(result.current.students.map((student) => student.studentNo)).toEqual(
      ["B"],
    );
    expect(result.current.draft?.classId).toBe(b.id);
    expect(error).not.toHaveBeenCalled();
  });

  it("flushes pending movement before rapidly returning to a class", async () => {
    const { repository, a, b } = await setup();
    const error = vi.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useClassLifecycle(repository, id, error),
      { initialProps: { id: a.id } },
    );
    await waitFor(() => expect(result.current.draft?.classId).toBe(a.id));
    act(() =>
      result.current.sessionRef.current!.update((draft) => ({
        ...draft,
        desks: draft.desks.map((desk, index) =>
          index === 0 ? { ...desk, x: 333 } : desk,
        ),
      })),
    );
    rerender({ id: b.id });
    rerender({ id: a.id });
    await waitFor(() => expect(result.current.draft?.desks[0].x).toBe(333));
    expect((await repository.getDraft(a.id))?.desks[0].x).toBe(333);
    expect(error).not.toHaveBeenCalled();
  });

  it("retains an unsaved session through storage failure and retries without losing it", async () => {
    const { repository, a, b } = await setup();
    const error = vi.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useClassLifecycle(repository, id, error),
      { initialProps: { id: a.id } },
    );
    await waitFor(() => expect(result.current.draft?.classId).toBe(a.id));
    const save = repository.saveDraft.bind(repository);
    const failure = vi
      .spyOn(repository, "saveDraft")
      .mockRejectedValue(new Error("disk full"));
    act(() =>
      result.current.sessionRef.current!.update((draft) => ({
        ...draft,
        desks: draft.desks.map((desk, index) =>
          index === 0 ? { ...desk, x: 444 } : desk,
        ),
      })),
    );
    rerender({ id: b.id });
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(result.current.draft).toBeUndefined();
    failure.mockImplementation(save);
    rerender({ id: a.id });
    await waitFor(() => expect(result.current.draft?.desks[0].x).toBe(444));
    expect((await repository.getDraft(a.id))?.desks[0].x).toBe(444);
  });
});

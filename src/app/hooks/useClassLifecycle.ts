import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClassRecord,
  ClassRepository,
  GradeRecord,
  LayoutDraft,
  StudentRecord,
} from "../../domain/types";
import { regularDeskSpec } from "../../domain/layout";
import { createDefaultDraft } from "../../features/drafts/createDraft";
import { DraftSession } from "../../features/drafts/draftSession";

export type LoadState = "loading" | "ready" | "error" | "idle";

function normalizeLegacyRegularDeskGeometry(draft: LayoutDraft): LayoutDraft {
  let changed = false;
  const desks = draft.desks.map((desk) => {
    if (desk.kind !== "regular" || desk.width !== 190 || desk.height !== 112)
      return desk;
    changed = true;
    return {
      ...desk,
      width: regularDeskSpec.width,
      height: regularDeskSpec.height,
    };
  });
  return changed
    ? { ...draft, desks, updatedAt: new Date().toISOString() }
    : draft;
}

/** Repository reads and autosave lifetimes; class switches never expose old data. */
export function useClassLifecycle(
  repository: ClassRepository,
  classId: string | undefined,
  onError: (message: string) => void,
) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [draft, setDraft] = useState<LayoutDraft>();
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loadedClassId, setLoadedClassId] = useState<string>();
  const [classListState, setClassListState] = useState<LoadState>("loading");
  const [currentClassState, setCurrentClassState] = useState<LoadState>("idle");
  const [selection, setSelection] = useState(classId);
  if (selection !== classId) {
    setSelection(classId);
    setLoadedClassId(undefined);
  }
  const sessionRef = useRef<DraftSession | undefined>(undefined);
  const cleanupQueue = useRef(Promise.resolve());
  // Retain failed saves until a later switch retries them successfully.
  const pendingSessions = useRef(new Set<DraftSession>());

  const flushPending = useCallback(() => {
    const operation = cleanupQueue.current.then(async () => {
      for (const session of pendingSessions.current) {
        await session.dispose();
        pendingSessions.current.delete(session);
      }
    });
    cleanupQueue.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const reloadClasses = useCallback(async () => {
    try {
      const items = await repository.listClasses();
      setClasses(items);
      setClassListState("ready");
      return items;
    } catch (error) {
      setClassListState("error");
      throw error;
    }
  }, [repository]);

  useEffect(() => {
    let mounted = true;
    void repository
      .listClasses()
      .then((items) => {
        if (mounted) { setClasses(items); setClassListState("ready"); }
      })
      .catch(() => {
        if (mounted) { setClassListState("error"); onError("无法读取班级列表"); }
      });
    return () => {
      mounted = false;
    };
  }, [repository, onError]);

  useEffect(() => {
    let mounted = true;
    let ownedSession: DraftSession | undefined;
    const pending = pendingSessions.current;
    let unsubscribe = () => {};
    let unsubscribeError = () => {};
    if (!classId) return;
    void (async () => {
      await flushPending();
      if (!classId || !mounted) return;
      const [classroom, roster, saved, scores] = await Promise.all([
        repository.getClass(classId),
        repository.listStudents(classId),
        repository.getDraft(classId),
        repository.listGrades(classId),
      ]);
      if (!mounted) return;
      if (!classroom) throw new Error("班级不存在");
      const next = normalizeLegacyRegularDeskGeometry(
        saved ??
          createDefaultDraft(classId, {
            rows: classroom.rows,
            desksPerRow: classroom.desksPerRow,
            capacity: classroom.deskCapacity,
          }),
      );
      if (!saved || next !== saved) await repository.saveDraft(next);
      if (!mounted) return;
      ownedSession = new DraftSession(next, repository, 180);
      sessionRef.current = ownedSession;
      unsubscribeError = ownedSession.subscribeSaveError(() =>
        onError("布局保存失败，请勿关闭应用；切换班级可重试"),
      );
      unsubscribe = ownedSession.subscribe((history) => {
        if (mounted) setDraft(history.present);
      });
      setStudents(roster);
      setGrades(scores);
      setDraft(next);
      setLoadedClassId(classId);
      setCurrentClassState("ready");
    })().catch((error: unknown) => {
      if (mounted) {
        setCurrentClassState("error");
        onError(error instanceof Error ? error.message : "无法读取班级数据");
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeError();
      if (ownedSession) {
        sessionRef.current = undefined;
        pending.add(ownedSession);
        void flushPending().catch(() =>
          onError("布局保存失败，请勿关闭应用；切换班级可重试"),
        );
      }
    };
  }, [classId, repository, onError, flushPending]);

  // Derive this gate during render, not in a later effect.
  const ready = Boolean(
    classId && selection === classId && loadedClassId === classId,
  );
  return {
    classes,
    setClasses,
    students: ready ? students : [],
    setStudents,
    draft: ready ? draft : undefined,
    setDraft,
    grades: ready ? grades : [],
    setGrades,
    sessionRef,
    reloadClasses,
    classListState,
    currentClassState: !classId ? "idle" : loadedClassId === classId ? currentClassState : currentClassState === "error" ? "error" : "loading",
  };
}

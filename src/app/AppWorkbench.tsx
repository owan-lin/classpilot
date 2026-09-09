import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, LayoutGrid, Users } from "lucide-react";
import { classroomStageFor, regularDeskSpec } from "../domain/layout";
import { studentGenderAttributes } from "../domain/studentGender";
import type { ClassRepository, StudentRecord } from "../domain/types";
import { useClassLifecycle } from "./hooks/useClassLifecycle";
import { useDeskDrag } from "./hooks/useDeskDrag";
import { useWorkbenchActions } from "./hooks/useWorkbenchActions";
import {
  SeatingPanel,
  RoomPanel,
  StudentPanel,
  GradesPanel,
} from "./components/WorkspacePanels";
import { ClassroomCanvas } from "./components/ClassroomCanvas";
import { ClassRail, ToolRail } from "./components/Rails";
import { ClassDialog, ProfileDialog } from "./components/Dialogs";
import "../App.css";

type View = "seating" | "room" | "students" | "grades";
type LayoutMode = "snap" | "free";

function sessionFlag(key: string, fallback: boolean): boolean {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function AppWorkbench({ repository }: { repository: ClassRepository }) {
  const [classId, setClassId] = useState<string>();
  const classIdRef = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const {
    classes,
    setClasses,
    students,
    setStudents,
    draft,
    setDraft,
    grades,
    setGrades,
    sessionRef: session,
  } = useClassLifecycle(repository, classId, setMessage);
  const [view, setView] = useState<View>("seating");
  const [classRailOpen, setClassRailOpen] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia("(min-width: 1025px)").matches
        ? sessionFlag("classpilot:class-rail-open", true)
        : false,
  );
  const [toolRailOpen, setToolRailOpen] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia("(min-width: 1025px)").matches
        ? sessionFlag("classpilot:tool-rail-open", true)
        : false,
  );
  const [desktopViewport, setDesktopViewport] = useState(
    () =>
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(min-width: 1025px)").matches,
  );
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("snap");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [activeDeskId, setActiveDeskId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [profile, setProfile] = useState<StudentRecord>();
  const [profileTab, setProfileTab] = useState<"profile" | "grades">("profile");
  const canvasScrollRef = useRef<HTMLElement>(null);
  const classRailToggleRef = useRef<HTMLButtonElement>(null);
  const toolRailToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 1025px)");
    const syncViewport = (event: MediaQueryListEvent) => {
      setDesktopViewport(event.matches);
      if (!event.matches) {
        setClassRailOpen(false);
        setToolRailOpen(false);
      }
    };
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);
  useEffect(() => {
    queueMicrotask(() =>
      setClassId((current) =>
        current && classes.some((item) => item.id === current)
          ? current
          : classes[0]?.id,
      ),
    );
  }, [classes]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "classpilot:class-rail-open",
        String(classRailOpen),
      );
    } catch {
      /* optional */
    }
  }, [classRailOpen]);
  useEffect(() => {
    try {
      sessionStorage.setItem("classpilot:tool-rail-open", String(toolRailOpen));
    } catch {
      /* optional */
    }
  }, [toolRailOpen]);

  const active = classes.find((item) => item.id === classId);
  const stage = useMemo(
    () =>
      classroomStageFor({
        rows: active?.rows ?? 2,
        desksPerRow: active?.desksPerRow ?? 3,
        sideDeskCount:
          Math.max(
            0,
            (draft?.desks.filter((desk) => desk.kind === "regular").length ??
              0) -
              (active?.rows ?? 2) * (active?.desksPerRow ?? 3),
          ) +
          (draft?.desks.filter((desk) => desk.kind === "special").length ?? 0),
      }),
    [active?.rows, active?.desksPerRow, draft?.desks],
  );
  const mainGridWidth = active
    ? active.desksPerRow * regularDeskSpec.width +
      Math.max(0, active.desksPerRow - 1) * stage.gapX
    : 0;
  const mainGridCenter = active
    ? stage.originX + mainGridWidth / 2
    : stage.width / 2;
  const bySeat = useMemo(
    () =>
      new Map(draft?.assignments.map((item) => [item.seatId, item.studentId])),
    [draft],
  );
  const byId = useMemo(
    () => new Map(students.map((item) => [item.id, item])),
    [students],
  );
  const assigned = useMemo(
    () => new Set(draft?.assignments.map((item) => item.studentId)),
    [draft],
  );
  const pool = students.filter((student) => !assigned.has(student.id));

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => {
      const scroller = canvasScrollRef.current;
      if (!scroller) return;
      const paddingLeft = Number.parseFloat(
        window.getComputedStyle(scroller).paddingLeft,
      );
      const visibleWidth = scroller.getBoundingClientRect().width;
      scroller.scrollLeft = Math.max(
        0,
        mainGridCenter * canvasZoom + paddingLeft - visibleWidth / 2,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    active,
    canvasZoom,
    classRailOpen,
    mainGridCenter,
    stage.width,
    toolRailOpen,
  ]);
  useEffect(() => {
    if (!profile) return;
    const attributes = studentGenderAttributes(profile.gender);
    document.documentElement.dataset.profileGender = attributes["data-gender"];
    document.documentElement.dataset.profileGenderLabel =
      attributes["data-gender-label"];
    return () => {
      delete document.documentElement.dataset.profileGender;
      delete document.documentElement.dataset.profileGenderLabel;
    };
  }, [profile]);

  const closeClassRail = useCallback(() => {
    setClassRailOpen(false);
    requestAnimationFrame(() => classRailToggleRef.current?.focus());
  }, []);
  const closeToolRail = useCallback(() => {
    setToolRailOpen(false);
    requestAnimationFrame(() => toolRailToggleRef.current?.focus());
  }, []);
  const toggleClassRail = useCallback(() => {
    setClassRailOpen((open) => {
      if (!open && !desktopViewport) setToolRailOpen(false);
      return !open;
    });
  }, [desktopViewport]);
  const toggleToolRail = useCallback(() => {
    setToolRailOpen((open) => {
      if (!open && !desktopViewport) setClassRailOpen(false);
      return !open;
    });
  }, [desktopViewport]);
  const activateTool = useCallback(
    (next: View) => {
      setView(next);
      setSelectedId(undefined);
      setProfile(undefined);
      setToolRailOpen(true);
      if (!desktopViewport) setClassRailOpen(false);
    },
    [desktopViewport],
  );
  const selectClass = useCallback(
    (nextClassId: string) => {
      if (nextClassId === classId) return;
      setStudents([]);
      setGrades([]);
      setDraft(undefined);
      setClassId(nextClassId);
      setSelectedId(undefined);
      setProfile(undefined);
    },
    [classId, setDraft, setGrades, setStudents],
  );
  const actions = useWorkbenchActions({
    repository,
    classId,
    isCurrent: () => classIdRef.current === classId,
    active,
    draft,
    stage,
    bySeat,
    byId,
    selectedId,
    setSelectedId,
    profile,
    setProfile,
    setProfileTab,
    setClasses,
    setStudents,
    setGrades,
    session,
    setMessage,
    selectClass,
    activateTool,
    activeDeskId,
    setActiveDeskId,
  });
  const activateFromRail = (next: View) => {
    activateTool(next);
    if (next !== "students") actions.resetStudentEditor();
    if (next !== "grades") actions.clearGradePreview();
  };
  const drag = useDeskDrag({
    draft,
    stage,
    layoutMode,
    view,
    onChange: actions.change,
    onMessage: setMessage,
    activeDeskId,
    setActiveDeskId,
  });
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drag.isDragging()) {
        drag.cancelMove();
        setMessage("已取消移动");
        return;
      }
      if (profile) {
        setProfile(undefined);
        return;
      }
      if (toolRailOpen) {
        closeToolRail();
        return;
      }
      if (classRailOpen) closeClassRail();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [
    classRailOpen,
    closeClassRail,
    closeToolRail,
    drag,
    profile,
    toolRailOpen,
  ]);
  const fitCanvas = () => {
    const scroller = canvasScrollRef.current;
    if (!scroller) return;
    const styles = window.getComputedStyle(scroller);
    const availableWidth =
      scroller.clientWidth -
      Number.parseFloat(styles.paddingLeft) -
      Number.parseFloat(styles.paddingRight);
    const availableHeight =
      scroller.clientHeight -
      Number.parseFloat(styles.paddingTop) -
      Number.parseFloat(styles.paddingBottom);
    setCanvasZoom(
      Math.min(
        1.5,
        Math.max(
          0.5,
          Math.round(
            Math.min(
              availableWidth / stage.width,
              availableHeight / stage.height,
            ) * 100,
          ) / 100,
        ),
      ),
    );
  };
  const setZoom = (next: number) =>
    setCanvasZoom(Math.min(1.5, Math.max(0.5, Math.round(next * 100) / 100)));
  const toolTitle =
    view === "seating"
      ? "排座 / 移位"
      : view === "room"
        ? "编辑教室"
        : view === "students"
          ? "录入学生"
          : "成绩";
  const panel =
    view === "seating" ? (
      <SeatingPanel
        students={students}
        pool={pool}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        openProfile={actions.openProfile}
      />
    ) : view === "room" ? (
      <RoomPanel
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        align={actions.align}
        addDesk={actions.addDesk}
      />
    ) : view === "students" ? (
      <StudentPanel
        students={students}
        form={actions.studentForm}
        editingStudent={actions.editingStudent}
        error={actions.studentError}
        setForm={actions.setStudentForm}
        saveStudent={actions.saveStudent}
        openProfile={actions.openProfile}
        editStudent={actions.editStudent}
      />
    ) : (
      <GradesPanel
        students={students}
        grades={grades}
        gradeCsv={actions.gradeCsv}
        gradePreview={actions.gradePreview}
        setGradeCsv={actions.setGradeCsv}
        setGradePreview={actions.setGradePreview}
        importGrades={actions.importGrades}
        openProfile={actions.openProfile}
      />
    );

  return (
    <main className="pilot" data-testid="classroom-workbench">
      <div
        data-testid="class-rail-band"
        className="rail-band class-rail-band"
        aria-hidden="true"
      />
      <div
        data-testid="tool-rail-band"
        className="rail-band tool-rail-band"
        aria-hidden="true"
      />
      <div
        data-testid="drawer-backdrop"
        className={
          classRailOpen || toolRailOpen
            ? "drawer-backdrop visible"
            : "drawer-backdrop"
        }
        aria-hidden="true"
        onClick={() => {
          closeClassRail();
          closeToolRail();
        }}
      />
      <ClassRail
        open={classRailOpen}
        desktopViewport={desktopViewport}
        toggle={toggleClassRail}
        close={closeClassRail}
        toggleRef={classRailToggleRef}
        classes={classes}
        activeId={classId}
        selectClass={selectClass}
        newClass={actions.openNewClass}
      />
      <section className="workbench-canvas">
        {active ? (
          <>
            <header className="canvas-title">
              <Users aria-hidden="true" />
              <b>{active.name}</b>
              <span>{active.grade || active.academicYear}</span>
            </header>
            <ClassroomCanvas
              active={active}
              draft={draft}
              stage={stage}
              mainGridCenter={mainGridCenter}
              view={view}
              layoutMode={layoutMode}
              canvasZoom={canvasZoom}
              canvasScrollRef={canvasScrollRef}
              canvasRef={drag.canvasRef}
              activeDeskId={drag.activeDeskId}
              transient={drag.transient}
              bySeat={bySeat}
              byId={byId}
              selectedId={selectedId}
              setZoom={setZoom}
              setCanvasZoom={setCanvasZoom}
              fitCanvas={fitCanvas}
              beginMove={drag.beginMove}
              previewMove={drag.previewMove}
              commitMove={drag.commitMove}
              cancelMove={drag.cancelMove}
              deleteDesk={actions.deleteDesk}
              drop={actions.drop}
              openProfile={actions.openProfile}
              seat={actions.seat}
            />
          </>
        ) : (
          <section className="starting">
            <LayoutGrid />
            <h2>{classes.length ? "正在加载班级…" : "先创建一个班级"}</h2>
            {!classes.length && (
              <button
                type="button"
                className="primary"
                onClick={actions.openNewClass}
              >
                新建班级
              </button>
            )}
          </section>
        )}
      </section>
      <ToolRail
        open={toolRailOpen}
        desktopViewport={desktopViewport}
        toggle={toggleToolRail}
        close={closeToolRail}
        toggleRef={toolRailToggleRef}
        view={view}
        activate={activateFromRail}
        openSettings={actions.openSettings}
        title={toolTitle}
      >
        {active && panel}
      </ToolRail>
      <div className="status" role="status" aria-live="polite">
        {message && <Check aria-hidden="true" />}
        {message}
      </div>
      {profile && (
        <ProfileDialog
          profile={profile}
          profileTab={profileTab}
          setProfileTab={setProfileTab}
          grades={grades}
          gradeForm={actions.gradeForm}
          setGradeForm={actions.setGradeForm}
          saveGrade={actions.saveGrade}
          close={() => setProfile(undefined)}
          editStudent={actions.editStudent}
          deleteStudent={actions.deleteStudent}
        />
      )}
      {(actions.newOpen || actions.settingsOpen) && (
        <ClassDialog
          settingsOpen={actions.settingsOpen}
          form={actions.classForm}
          error={actions.classError}
          capacity={actions.capacity}
          rebuildPreview={actions.rebuildPreview}
          setForm={actions.setClassForm}
          close={actions.closeClassDialog}
          submit={
            actions.settingsOpen ? actions.saveSettings : actions.createClass
          }
        />
      )}
    </main>
  );
}

export default AppWorkbench;

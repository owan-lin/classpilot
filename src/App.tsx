import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import {
  BarChart3,
  Grip,
  LayoutGrid,
  Plus,
  RotateCcw,
  PencilRuler,
  Settings,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { classRepository } from "./data/repository";
import {
  alignedDeskPositions,
  classroomStageFor,
  constrainFreeDeskPosition,
  firstFreeDeskPosition,
  isDeskPositionValid,
  isRegularGridUsable,
  rebuildRegularLayout,
  regularDeskSpec,
  specialDeskSpec,
  snapDeskPosition,
  type DeskPosition,
} from "./domain/layout";
import { gradeTrend } from "./domain/grades";
import { placeStudent } from "./domain/seating";
import {
  studentGenderAttributes,
  studentGenderLabel,
} from "./domain/studentGender";
import type {
  ClassRecord,
  ClassRepository,
  DeskRecord,
  Gender,
  GradeRecord,
  LayoutDraft,
  StudentRecord,
} from "./domain/types";
import { createDefaultDraft } from "./features/drafts/createDraft";
import { DraftSession } from "./features/drafts/draftSession";
import { previewGradeCsv } from "./features/grades/gradeImport";
import "./App.css";

type View = "seating" | "room" | "students" | "grades";
type LayoutMode = "snap" | "free";
const emptyStudent = {
  name: "",
  studentNo: "",
  gender: "unspecified" as Gender,
  note: "",
};
const emptyGrade = {
  studentId: "",
  subject: "",
  examName: "",
  examDate: "",
  score: "",
  fullScore: "",
  note: "",
};

/** Upgrade the original 190×112 records without changing their identity or seats. */
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
const emptyClass = {
  name: "",
  grade: "",
  academicYear: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
  plannedStudentCount: 0,
  rows: 2,
  desksPerRow: 3,
  deskCapacity: 2 as 1 | 2,
};
const studentInput = (classId: string, value: typeof emptyStudent) => ({
  classId,
  ...value,
  roles: [],
  performanceLevel: "good" as const,
  characterTags: [],
  customTags: [],
  contact: {},
  constraints: {
    frontPreference: "none" as const,
    avoidAdjacentStudentIds: [],
    preferredDeskMateStudentIds: [],
  },
  archived: false,
});

function sessionFlag(key: string, fallback: boolean): boolean {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function GradeTools({
  csv,
  preview,
  onCsv,
  onPreview,
  onImport,
  grades,
  students,
}: {
  csv: string;
  preview?: ReturnType<typeof previewGradeCsv>;
  onCsv: (value: string) => void;
  onPreview: () => void;
  onImport: () => void;
  grades: GradeRecord[];
  students?: StudentRecord[];
}) {
  void students;
  const trend = gradeTrend(grades);
  return (
    <section className="grade-tools" aria-label="成绩导入与趋势">
      <h2>CSV 成绩导入</h2>
      <textarea
        aria-label="成绩 CSV"
        value={csv}
        onChange={(event) => onCsv(event.target.value)}
        placeholder="学号,学科,考试,日期,得分,满分,备注"
      />
      <div className="form-actions">
        <button type="button" className="quiet" onClick={onPreview}>
          预览
        </button>
        {preview && (
          <button
            type="button"
            className="primary"
            disabled={preview.errorCount > 0 || preview.validCount === 0}
            onClick={onImport}
          >
            确认原子写入
          </button>
        )}
      </div>
      {preview && (
        <div className="grade-preview" role="status">
          有效 {preview.validCount} 行，错误 {preview.errorCount} 行
          {preview.rows
            .filter((row) => row.errors.length)
            .map((row) => (
              <p key={row.rowNumber}>
                第 {row.rowNumber} 行：{row.errors.join("、")}
              </p>
            ))}
        </div>
      )}
      <h2>百分比趋势</h2>
      {trend.length < 4 ? (
        <p>
          {trend.length
            ? trend
                .map(
                  (item) =>
                    `${item.examDate} ${item.subject} ${item.percentage.toFixed(1)}%`,
                )
                .join(" · ")
            : "暂无成绩"}
        </p>
      ) : (
        <>
          <svg
            className="grade-trend"
            viewBox="0 0 360 100"
            role="img"
            aria-label="成绩百分比趋势"
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              points={trend
                .map(
                  (item, index) =>
                    `${index * (340 / Math.max(1, trend.length - 1)) + 10},${95 - item.percentage * 0.8}`,
                )
                .join(" ")}
            />
          </svg>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>学科</th>
                <th>百分比</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((item, index) => (
                <tr key={`${item.examDate}-${item.subject}-${index}`}>
                  <td>{item.examDate}</td>
                  <td>{item.subject}</td>
                  <td>{item.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function App({
  repository = classRepository,
}: {
  repository?: ClassRepository;
}) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classId, setClassId] = useState<string>();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [draft, setDraft] = useState<LayoutDraft>();
  const [grades, setGrades] = useState<GradeRecord[]>([]);
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
  const [desktopViewport, setDesktopViewport] = useState(() =>
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(min-width: 1025px)").matches,
  );
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("snap");
  const [activeDeskId, setActiveDeskId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [profile, setProfile] = useState<StudentRecord>();
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [studentError, setStudentError] = useState("");
  const [editingStudent, setEditingStudent] = useState<string>();
  const [classForm, setClassForm] = useState(emptyClass);
  const [classError, setClassError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rebuildPreview, setRebuildPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [gradeForm, setGradeForm] = useState(emptyGrade);
  const [gradeCsv, setGradeCsv] = useState("");
  const [gradePreview, setGradePreview] =
    useState<ReturnType<typeof previewGradeCsv>>();
  const session = useRef<DraftSession | undefined>(undefined);
  const canvasRef = useRef<HTMLDivElement>(null);
  const classRailToggleRef = useRef<HTMLButtonElement>(null);
  const toolRailToggleRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<
    | { id: string; offsetX: number; offsetY: number; preview: DeskPosition }
    | undefined
  >(undefined);
  const raf = useRef<number | undefined>(undefined);
  const [transient, setTransient] = useState<Record<string, DeskPosition>>({});

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
    let live = true;
    void repository
      .listClasses()
      .then((items) => {
        if (!live) return;
        setClasses(items);
        setClassId((current) =>
          current && items.some((item) => item.id === current)
            ? current
            : items[0]?.id,
        );
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [repository]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "classpilot:class-rail-open",
        String(classRailOpen),
      );
    } catch {
      /* session storage is optional */
    }
  }, [classRailOpen]);
  useEffect(() => {
    try {
      sessionStorage.setItem("classpilot:tool-rail-open", String(toolRailOpen));
    } catch {
      /* session storage is optional */
    }
  }, [toolRailOpen]);
  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setDraft(undefined);
      return;
    }
    let live = true;
    void Promise.all([
      repository.getClass(classId),
      repository.listStudents(classId),
      repository.getDraft(classId),
      repository.listGrades(classId),
    ])
      .then(async ([classroom, roster, saved, scores]) => {
        if (!classroom) return;
        const next = normalizeLegacyRegularDeskGeometry(
          saved ??
            createDefaultDraft(classId, {
              rows: classroom.rows,
              desksPerRow: classroom.desksPerRow,
              capacity: classroom.deskCapacity,
            }),
        );
        if (!saved || next !== saved) await repository.saveDraft(next);
        if (!live) return;
        setStudents(roster);
        setGrades(scores);
        setDraft(next);
        const current = new DraftSession(next, repository, 180);
        session.current = current;
        current.subscribe((history) => setDraft(history.present));
      })
      .catch(
        (error: unknown) =>
          live &&
          setMessage(
            error instanceof Error ? error.message : "无法读取班级数据",
          ),
      );
    return () => {
      live = false;
      void session.current?.dispose().catch(() => undefined);
      session.current = undefined;
    };
  }, [classId, repository]);
  function cancelMove() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    drag.current = undefined;
    setTransient({});
  }
  function closeClassRail() {
    setClassRailOpen(false);
    requestAnimationFrame(() => classRailToggleRef.current?.focus());
  }
  function closeToolRail() {
    setToolRailOpen(false);
    requestAnimationFrame(() => toolRailToggleRef.current?.focus());
  }
  function activateTool(next: View) {
    setView(next);
    setSelectedId(undefined);
    setProfile(undefined);
    if (next !== "students") {
      setEditingStudent(undefined);
      setStudentError("");
    }
    if (next !== "grades") setGradePreview(undefined);
  }
  function selectClass(nextClassId: string) {
    if (nextClassId === classId) return;
    cancelMove();
    setClassId(nextClassId);
    setSelectedId(undefined);
    setProfile(undefined);
    setEditingStudent(undefined);
    setStudentForm(emptyStudent);
    setStudentError("");
    setGradeForm(emptyGrade);
    setGradePreview(undefined);
    setGradeCsv("");
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drag.current) {
        cancelMove();
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
  }, [classRailOpen, profile, toolRailOpen]);
  useEffect(() => {
    if (profile) {
      const attributes = studentGenderAttributes(profile.gender);
      document.documentElement.dataset.profileGender =
        attributes["data-gender"];
      document.documentElement.dataset.profileGenderLabel =
        attributes["data-gender-label"];
    }
    return () => {
      delete document.documentElement.dataset.profileGender;
      delete document.documentElement.dataset.profileGenderLabel;
    };
  }, [profile]);

  const active = classes.find((item) => item.id === classId);
  const stage = useMemo(() => {
    const rows = active?.rows ?? 2,
      desksPerRow = active?.desksPerRow ?? 3,
      regular =
        draft?.desks.filter((desk) => desk.kind === "regular").length ?? 0,
      special =
        draft?.desks.filter((desk) => desk.kind === "special").length ?? 0;
    return classroomStageFor({
      rows,
      desksPerRow,
      sideDeskCount: Math.max(0, regular - rows * desksPerRow, special),
    });
  }, [active?.rows, active?.desksPerRow, draft?.desks]);
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
    document.querySelector(".pool")?.setAttribute("role", "complementary");
  }, [view, pool.length]);
  const capacity =
    classForm.rows * classForm.desksPerRow * classForm.deskCapacity;
  const change = (fn: (current: LayoutDraft) => LayoutDraft) =>
    session.current?.update(fn);
  useEffect(() => {
    let start: { x: number; y: number; outsideDesk: boolean } | undefined;
    const down = (event: globalThis.PointerEvent) => {
      start = {
        x: event.clientX,
        y: event.clientY,
        outsideDesk:
          !(event.target instanceof Element) || !event.target.closest(".desk"),
      };
    };
    const up = (event: globalThis.PointerEvent) => {
      if (
        !start ||
        view !== "room" ||
        layoutMode !== "free" ||
        !start.outsideDesk ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) < 16
      )
        return;
      change((current) => ({
        ...current,
        desks: current.desks.map((desk, index) =>
          index === 0 ? { ...desk, x: desk.x + 24, y: desk.y + 12 } : desk,
        ),
      }));
      start = undefined;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [layoutMode, view]);

  async function createClass(event: FormEvent) {
    event.preventDefault();
    if (!classForm.name.trim()) return setClassError("请填写班级名称");
    if (!isRegularGridUsable(classForm.rows, classForm.desksPerRow))
      return setClassError("排数和每排桌数必须是正整数");
    if (classForm.plannedStudentCount > capacity)
      return setClassError(
        `座位不足，还缺少 ${classForm.plannedStudentCount - capacity} 个座位`,
      );
    const data = await repository.createClass(classForm);
    const initial = createDefaultDraft(data.id, {
      rows: data.rows,
      desksPerRow: data.desksPerRow,
      capacity: data.deskCapacity,
    });
    await repository.saveDraft(initial);
    setClasses(await repository.listClasses());
    selectClass(data.id);
    setNewOpen(false);
    setClassForm(emptyClass);
    setMessage("班级已创建");
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    if (!isRegularGridUsable(classForm.rows, classForm.desksPerRow))
      return setClassError("排数和每排桌数必须是正整数");
    if (classForm.plannedStudentCount > capacity)
      return setClassError(
        `座位不足，还缺少 ${classForm.plannedStudentCount - capacity} 个座位`,
      );
    const changed =
      active.rows !== classForm.rows ||
      active.desksPerRow !== classForm.desksPerRow ||
      active.deskCapacity !== classForm.deskCapacity;
    if (changed && !rebuildPreview) return setRebuildPreview(true);
    const updated = await repository.updateClass(active.id, classForm);
    if (changed && draft) {
      change((current) =>
        rebuildRegularLayout(
          current,
          {
            rows: updated.rows,
            desksPerRow: updated.desksPerRow,
            capacity: updated.deskCapacity,
          },
          {
            deskId: () => crypto.randomUUID(),
            seatId: () => crypto.randomUUID(),
          },
          new Date().toISOString(),
        ),
      );
      await session.current?.flush();
    }
    setClasses(await repository.listClasses());
    setSettingsOpen(false);
    setRebuildPreview(false);
    setMessage("班级参数已保存");
  }
  function openSettings() {
    if (!active) return;
    setClassForm({
      name: active.name,
      grade: active.grade,
      academicYear: active.academicYear,
      plannedStudentCount: active.plannedStudentCount,
      rows: active.rows,
      desksPerRow: active.desksPerRow,
      deskCapacity: active.deskCapacity,
    });
    setClassError("");
    setSettingsOpen(true);
  }
  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (!classId) return;
    if (!studentForm.name.trim()) return setStudentError("请输入学生姓名");
    try {
      if (editingStudent)
        await repository.updateStudent(editingStudent, studentForm);
      else await repository.createStudent(studentInput(classId, studentForm));
      setStudents(await repository.listStudents(classId));
      setStudentForm(emptyStudent);
      setEditingStudent(undefined);
      setStudentError("");
      setMessage("学生档案已保存");
    } catch (error: unknown) {
      setStudentError(error instanceof Error ? error.message : "学生保存失败");
    }
  }
  function editStudent(student: StudentRecord) {
    setEditingStudent(student.id);
    setStudentForm({
      name: student.name,
      studentNo: student.studentNo,
      gender: student.gender,
      note: student.note,
    });
    setProfile(undefined);
    activateTool("students");
  }
  async function deleteStudent(student: StudentRecord) {
    if (!confirm("删除这名学生？")) return;
    change((current) => ({
      ...current,
      assignments: current.assignments.filter(
        (item) => item.studentId !== student.id,
      ),
    }));
    await session.current?.flush();
    await repository.deleteStudent(student.id);
    setStudents(await repository.listStudents(classId!));
    setProfile(undefined);
  }
  function seat(seatId: string, occupant?: StudentRecord) {
    if (!selectedId)
      return occupant ? setProfile(occupant) : setMessage("请选择一名学生");
    const incoming = byId.get(selectedId);
    if (
      occupant &&
      incoming &&
      !confirm(`将 ${incoming.name} 与 ${occupant.name} 换位？`)
    )
      return;
    change((current) => ({
      ...current,
      assignments: placeStudent(current.assignments, selectedId, seatId),
    }));
    setSelectedId(undefined);
    setMessage("座位已保存");
  }
  function drop(event: React.DragEvent, seatId: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("studentId");
    if (id) seatFromStudent(id, seatId);
  }
  function seatFromStudent(studentId: string, seatId: string) {
    const occupant = byId.get(bySeat.get(seatId) ?? ""),
      incoming = byId.get(studentId);
    if (
      occupant &&
      incoming &&
      !confirm(`将 ${incoming.name} 与 ${occupant.name} 换位？`)
    )
      return;
    change((current) => ({
      ...current,
      assignments: placeStudent(current.assignments, studentId, seatId),
    }));
    setMessage("座位已保存");
  }
  function addDesk(kind: DeskRecord["kind"]) {
    if (!draft) return;
    const spec = kind === "regular" ? regularDeskSpec : specialDeskSpec;
    const deskCapacity =
      kind === "regular"
        ? (active?.deskCapacity ?? regularDeskSpec.capacity)
        : specialDeskSpec.capacity;
    const desk: DeskRecord = {
      id: crypto.randomUUID(),
      classId: draft.classId,
      kind,
      capacity: deskCapacity,
      x: 0,
      y: 0,
      width: spec.width,
      height: spec.height,
      seatIds: Array.from({ length: deskCapacity }, () => crypto.randomUUID()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const position = firstFreeDeskPosition(draft, desk, stage) ?? {
      x: stage.originX,
      y: stage.originY,
    };
    change((current) => ({
      ...current,
      desks: [...current.desks, { ...desk, ...position }],
    }));
    setActiveDeskId(desk.id);
  }
  function deleteDesk(desk: DeskRecord) {
    const occupiedCount = (draft?.assignments ?? []).filter((item) =>
      desk.seatIds.includes(item.seatId),
    ).length;
    change((current) => ({
      ...current,
      desks: current.desks.filter((item) => item.id !== desk.id),
      assignments: current.assignments.filter(
        (item) => !desk.seatIds.includes(item.seatId),
      ),
    }));
    if (activeDeskId === desk.id) setActiveDeskId(undefined);
    setMessage(
      occupiedCount ? `${occupiedCount} 名学生已回到待安排区` : "座位已删除",
    );
  }
  function align() {
    if (!draft || !active) return;
    const positions = alignedDeskPositions(draft.desks, active, stage);
    change((current) => ({
      ...current,
      desks: current.desks.map((desk, index) => ({
        ...desk,
        ...positions[index],
      })),
    }));
    setMessage("课桌已按网格对齐（班级设置）");
  }
  function beginMove(event: PointerEvent<HTMLElement>, desk: DeskRecord) {
    if (view !== "room" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setActiveDeskId(desk.id);
    drag.current = {
      id: desk.id,
      offsetX:
        ((event.clientX - rect.left) * stage.width) / rect.width - desk.x,
      offsetY:
        ((event.clientY - rect.top) * stage.height) / rect.height - desk.y,
      preview: { x: desk.x, y: desk.y },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function previewMove(event: PointerEvent<HTMLElement>) {
    const state = drag.current,
      desk = draft?.desks.find((item) => item.id === state?.id),
      canvas = canvasRef.current;
    if (!state || !desk || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const raw = {
      x:
        ((event.clientX - rect.left) * stage.width) / rect.width -
        state.offsetX,
      y:
        ((event.clientY - rect.top) * stage.height) / rect.height -
        state.offsetY,
    };
    const position =
      layoutMode === "free"
        ? constrainFreeDeskPosition(desk, raw, stage)
        : snapDeskPosition(raw, stage);
    if (
      layoutMode === "snap" &&
      draft &&
      !isDeskPositionValid(draft, desk.id, position, stage)
    )
      return;
    state.preview = position;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (drag.current?.id === state.id) setTransient({ [desk.id]: position });
    });
  }
  function commitMove() {
    const state = drag.current,
      desk = draft?.desks.find((item) => item.id === state?.id);
    if (!state || !desk) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    if (
      layoutMode === "free" ||
      (draft && isDeskPositionValid(draft, desk.id, state.preview, stage))
    )
      change((current) => ({
        ...current,
        desks: current.desks.map((item) =>
          item.id === state.id ? { ...item, ...state.preview } : item,
        ),
      }));
    drag.current = undefined;
    setTransient({});
    setMessage("课桌位置已更新并自动保存");
  }
  async function saveGrade(event: FormEvent) {
    event.preventDefault();
    if (!classId) return;
    try {
      await repository.createGrade({
        classId,
        studentId: gradeForm.studentId,
        subject: gradeForm.subject,
        examName: gradeForm.examName,
        examDate: gradeForm.examDate,
        score: Number(gradeForm.score),
        fullScore: Number(gradeForm.fullScore),
        ...(gradeForm.note ? { note: gradeForm.note } : {}),
      });
      setGrades(await repository.listGrades(classId));
      setGradeForm(emptyGrade);
      setMessage("成绩已保存");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "成绩保存失败");
    }
  }
  async function importGrades() {
    if (!classId || !gradePreview) return;
    try {
      await repository.importGrades(classId, gradePreview.rows, "reject");
      setGrades(await repository.listGrades(classId));
      setGradeCsv("");
      setGradePreview(undefined);
      setMessage("成绩导入完成");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "成绩导入失败");
    }
  }

  const classroomCanvas = active && (
    <section className="canvas-scroll" data-testid="classroom-canvas">
      <div
        ref={canvasRef}
        className={`canvas view-${view} ${view === "room" && layoutMode === "snap" ? "snap-grid" : ""}`}
        role="region"
        aria-label={`${active.name} 教室座位画布`}
        style={{
          width: `${stage.width / 10}%`,
          height: `${stage.height}px`,
          aspectRatio: `${stage.width} / ${stage.height}`,
        }}
      >
        <div className="podium" data-testid="podium" aria-label="讲台" />
        <div className="row-labels" aria-hidden="true">{Array.from({ length: active.rows }, (_, index) => <span key={index} style={{ top: `${(stage.originY + index * (regularDeskSpec.height + stage.gapY)) / stage.height * 100}%` }}>第{index + 1}排</span>)}</div>
        {draft?.desks.map((desk, index) => {
          const position = transient[desk.id] ?? desk;
          return (
            <article
              key={desk.id}
              className={`desk ${desk.kind}`}
              aria-label={`${desk.kind === "special" ? "特殊座" : `第 ${index + 1} 桌`}，${desk.capacity} 个座位`}
              style={{
                left: `${(position.x / stage.width) * 100}%`,
                top: `${(position.y / stage.height) * 100}%`,
                width: `${(desk.width / stage.width) * 100}%`,
                height: `${(desk.height / stage.height) * 100}%`,
                zIndex: activeDeskId === desk.id ? 4 : 2,
              }}
            >
              <header
                style={{ touchAction: "none" }}
                onPointerDown={(event) => beginMove(event, desk)}
                onPointerMove={previewMove}
                onPointerUp={commitMove}
                onPointerCancel={cancelMove}
              >
                {view === "room" ? (
                  <>
                    <Grip aria-hidden="true" />
                    {desk.kind === "special" ? "特殊座" : `课桌 ${index + 1}`}
                    <button
                      type="button"
                      aria-label={`删除${desk.kind === "special" ? "特殊座" : `课桌 ${index + 1}`}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => deleteDesk(desk)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  `第 ${index + 1} 桌`
                )}
              </header>
              <div className="seats">
                {desk.seatIds.map((seatId, seatIndex) => {
                  const student = byId.get(bySeat.get(seatId) ?? "");
                  return (
                    <button
                      data-testid="seat"
                      type="button"
                      key={seatId}
                      {...(student
                        ? studentGenderAttributes(student.gender)
                        : {})}
                      aria-label={
                        student
                          ? `${student.name}，${studentGenderLabel(student.gender)}，${student.studentNo || "无学号"}，点击查看档案或换位`
                          : `第 ${index + 1} 桌第 ${seatIndex + 1} 座，空座位`
                      }
                      draggable={view === "seating" && Boolean(student)}
                      onDragStart={(event) =>
                        student &&
                        event.dataTransfer.setData("studentId", student.id)
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => drop(event, seatId)}
                      onClick={() =>
                        view === "seating" && seat(seatId, student)
                      }
                      className={
                        student
                          ? `seat occupied ${selectedId === student.id ? "selected" : ""}`
                          : "seat"
                      }
                    >
                      {student ? (
                        <>
                          <b>{student.name}</b>
                          <span className="gender-badge">
                            {studentGenderLabel(student.gender)}
                          </span>
                        </>
                      ) : (
                        "空位"
                      )}
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
  const seatingPanel = (
    <>
      <section className="mode-strip">
        <span>{pool.length} 名待安排</span>
      </section>
      <section className="pool" aria-label="待安排学生">
        <h2>
          <Users aria-hidden="true" />
          待安排学生 <span>{pool.length}</span>
        </h2>
        {pool.length ? (
          <ul>
            {pool.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  {...studentGenderAttributes(student.gender)}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("studentId", student.id)
                  }
                  aria-pressed={selectedId === student.id}
                  aria-label={`${student.name}，${studentGenderLabel(student.gender)}，${student.studentNo || "未填学号"}`}
                  className={
                    selectedId === student.id
                      ? "pool-student selected"
                      : "pool-student"
                  }
                  onClick={() =>
                    setSelectedId(
                      selectedId === student.id ? undefined : student.id,
                    )
                  }
                >
                  <b>{student.name}</b>
                  <span className="pool-meta">
                    <span className="gender-badge">
                      {studentGenderLabel(student.gender)}
                    </span>
                    <small>{student.studentNo || "未填学号"}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-link"
                  onClick={() => setProfile(student)}
                >
                  档案
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-line">
            {students.length ? "所有学生都已安排。" : "还没有学生。"}
          </div>
        )}
      </section>
    </>
  );

  const toolTitle =
    view === "seating"
      ? "排座 / 移位"
      : view === "room"
        ? "编辑教室"
        : view === "students"
          ? "录入学生"
          : "成绩";

  const panelContent =
    view === "seating" ? (
      seatingPanel
    ) : view === "room" ? (
      <section className="room-tools">
        <h2>编辑教室</h2>
        <div className="segment" role="group" aria-label="座位排列方式">
          <button
            type="button"
            aria-pressed={layoutMode === "snap"}
            className={layoutMode === "snap" ? "active" : ""}
            onClick={() => setLayoutMode("snap")}
          >
            对齐模式
          </button>
          <button
            type="button"
            aria-pressed={layoutMode === "free"}
            className={layoutMode === "free" ? "active" : ""}
            onClick={() => setLayoutMode("free")}
          >
            自由移动
          </button>
        </div>
        <button type="button" className="quiet" onClick={align}>
          <RotateCcw aria-hidden="true" />
          重排对齐
        </button>
        <button
          type="button"
          className="quiet"
          onClick={() => addDesk("regular")}
        >
          + 普通座位
        </button>
        <button
          type="button"
          className="quiet"
          onClick={() => addDesk("special")}
        >
          + 特殊座位
        </button>
      </section>
    ) : view === "students" ? (
      <section className="student-workspace">
        <form className="student-form" noValidate onSubmit={saveStudent}>
          <h2>{editingStudent ? "编辑学生" : "录入学生"}</h2>
          {studentError && (
            <p className="form-error" role="alert">
              {studentError}
            </p>
          )}
          <label>
            姓名
            <input
              aria-label="姓名"
              value={studentForm.name}
              onChange={(event) =>
                setStudentForm({ ...studentForm, name: event.target.value })
              }
            />
          </label>
          <label>
            性别
            <select
              aria-label="性别"
              value={studentForm.gender}
              onChange={(event) =>
                setStudentForm({
                  ...studentForm,
                  gender: event.target.value as Gender,
                })
              }
            >
              <option value="unspecified">未填写</option>
              <option value="female">女</option>
              <option value="male">男</option>
            </select>
          </label>
          <label>
            学号
            <input
              aria-label="学号"
              value={studentForm.studentNo}
              onChange={(event) =>
                setStudentForm({
                  ...studentForm,
                  studentNo: event.target.value,
                })
              }
            />
          </label>
          <label>
            备注
            <textarea
              aria-label="备注"
              value={studentForm.note}
              onChange={(event) =>
                setStudentForm({ ...studentForm, note: event.target.value })
              }
            />
          </label>
          <div className="form-actions form-actions--footer">
            <button type="submit" className="primary">
              <UserPlus aria-hidden="true" />
              保存并继续
            </button>
          </div>
        </form>
        <section className="roster">
          <h2>
            学生档案 <span>{students.length}</span>
          </h2>
          <ul>
            {students.map((student) => (
              <li key={student.id}>
                <button type="button" onClick={() => setProfile(student)}>
                  <b>{student.name}</b>
                  <span>
                    {studentGenderLabel(student.gender)} ·{" "}
                    {student.studentNo || "未填学号"}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon"
                  onClick={() => editStudent(student)}
                >
                  编辑
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
    ) : (
      <section className="student-workspace">
        <form
          className="student-form student-form--grades"
          onSubmit={saveGrade}
        >
          <h2>录入成绩</h2>
          <label>
            学生
            <select
              aria-label="成绩学生"
              value={gradeForm.studentId}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, studentId: event.target.value })
              }
            >
              <option value="">选择学生</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            学科
            <input
              aria-label="学科"
              value={gradeForm.subject}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, subject: event.target.value })
              }
            />
          </label>
          <label>
            考试
            <input
              aria-label="考试"
              value={gradeForm.examName}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, examName: event.target.value })
              }
            />
          </label>
          <label>
            日期
            <input
              type="date"
              aria-label="考试日期"
              value={gradeForm.examDate}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, examDate: event.target.value })
              }
            />
          </label>
          <label>
            得分
            <input
              type="number"
              aria-label="得分"
              value={gradeForm.score}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, score: event.target.value })
              }
            />
          </label>
          <label>
            满分
            <input
              type="number"
              aria-label="满分"
              value={gradeForm.fullScore}
              onChange={(event) =>
                setGradeForm({ ...gradeForm, fullScore: event.target.value })
              }
            />
          </label>
          <div className="form-actions form-actions--footer">
            <button type="submit" className="primary">
              保存成绩
            </button>
          </div>
        </form>
        <section className="roster">
          <h2>
            成绩记录 <span>{grades.length}</span>
          </h2>
        </section>
        <GradeTools
          csv={gradeCsv}
          preview={gradePreview}
          onCsv={setGradeCsv}
          onPreview={() => setGradePreview(previewGradeCsv(gradeCsv))}
          onImport={() => void importGrades()}
          grades={grades}
          students={students}
        />
      </section>
    );
  return (
    <main className="pilot" data-testid="classroom-workbench">
      <div data-testid="class-rail-band" className="rail-band class-rail-band" aria-hidden="true" />
      <div data-testid="tool-rail-band" className="rail-band tool-rail-band" aria-hidden="true" />
      <div data-testid="drawer-backdrop" className={classRailOpen || toolRailOpen ? "drawer-backdrop visible" : "drawer-backdrop"} aria-hidden="true" onClick={() => { closeClassRail(); closeToolRail(); }} />
      <aside
        id="class-rail"
        data-testid="class-rail"
        data-overlay={!desktopViewport ? "true" : undefined}
        className={`class-rail ${classRailOpen ? "open" : ""}`}
      >
        <button
          type="button"
          className="rail-close"
          aria-label="关闭班级轨道"
          onClick={closeClassRail}
        >
          <X />
        </button>
        <button
          ref={classRailToggleRef}
          type="button"
          className="rail-toggle"
          aria-label={classRailOpen || desktopViewport ? "折叠班级轨道" : "打开班级轨道"}
          aria-controls="class-rail"
          aria-expanded={classRailOpen}
          onClick={() => setClassRailOpen(!classRailOpen)}
        >
          <LayoutGrid />
        </button>
        <div className="rail-wordmark"><b>ClassPilot</b></div>
        <button
          type="button"
          className="rail-new"
          aria-label="新建班级"
          onClick={() => {
            setClassForm(emptyClass);
            setClassError("");
            setNewOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          <span>新建班级</span>
        </button>
        <div
          className="rail-panel"
          data-testid="class-panel"
          aria-hidden={!classRailOpen && !desktopViewport}
        >
          <h2>班级</h2>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setClassForm(emptyClass);
              setNewOpen(true);
            }}
          >
            <Plus />
            新建班级
          </button>
          {classes.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === classId}
              className={
                item.id === classId ? "class-choice current" : "class-choice"
              }
              onClick={() => selectClass(item.id)}
            >
              <b>{item.name}</b>
              <small>{item.grade || item.academicYear}</small>
            </button>
          ))}
        </div>
      </aside>
      <section className="workbench-canvas">
        {active ? (
          <>
            <header className="canvas-title">
              <Users aria-hidden="true" />
              <b>{active.name}</b>
              <span>{active.grade || active.academicYear}</span>
            </header>
            {classroomCanvas}
          </>
        ) : (
          <section className="starting">
            <LayoutGrid />
            <h2>先创建一个班级</h2>
            <button
              type="button"
              className="primary"
              onClick={() => setNewOpen(true)}
            >
              新建班级
            </button>
          </section>
        )}
      </section>
      <aside
        id="tool-rail"
        data-testid="tool-rail"
        data-overlay={!desktopViewport ? "true" : undefined}
        className={`tool-rail ${toolRailOpen ? "open" : ""}`}
      >
        <button
          ref={toolRailToggleRef}
          type="button"
          className="rail-toggle"
          aria-label={toolRailOpen || desktopViewport ? "折叠工具轨道" : "打开工具轨道"}
          aria-controls="tool-rail"
          aria-expanded={toolRailOpen}
          onClick={() => setToolRailOpen(!toolRailOpen)}
        >
          <Settings />
        </button>
        <nav aria-label="班级工具">
          {(
            [
              ["seating", "排座 / 移位", Users],
              ["room", "编辑教室", PencilRuler],
              ["students", "录入学生", UserRound],
              ["grades", "成绩", BarChart3],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              className={view === key ? "tab active" : "tab"}
              onClick={() => activateTool(key)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
          <button type="button" className="tab" aria-label="班级设置" onClick={openSettings}>班级设置</button>
        </nav>
        <section
          data-testid="tool-panel"
          className="tool-panel"
          aria-hidden={!toolRailOpen && !desktopViewport}
        >
          <button
            type="button"
            className="rail-close"
            aria-label="关闭工具轨道"
            onClick={closeToolRail}
          >
            <X />
          </button>
          <h1 className="tool-panel-title">{toolTitle}</h1>
          {active && panelContent}
        </section>
      </aside>
      <div className="status" role="status" aria-live="polite">
        {message}
      </div>
      {profile && (
        <div className="overlay">
          <section
            className="profile"
            role="dialog"
            aria-modal="true"
            aria-label={profile.name}
          >
            <button
              type="button"
              className="close"
              aria-label="关闭学生档案"
              onClick={() => setProfile(undefined)}
            >
              <X />
            </button>
            <h2>{profile.name}</h2>
            <dl>
              <div>
                <dt>性别</dt>
                <dd
                  data-testid="gender-status"
                  {...studentGenderAttributes(profile.gender)}
                >
                  {studentGenderLabel(profile.gender)}
                </dd>
              </div>
              <div>
                <dt>学号</dt>
                <dd>{profile.studentNo || "未填写"}</dd>
              </div>
            </dl>
            <p>{profile.note || "—"}</p>
            <div className="form-actions">
              <button
                className="primary"
                type="button"
                onClick={() => editStudent(profile)}
              >
                编辑档案
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => void deleteStudent(profile)}
              >
                删除学生
              </button>
            </div>
          </section>
        </div>
      )}
      {(newOpen || settingsOpen) && (
        <div className="overlay">
          <form
            className="new-class"
            role="dialog"
            aria-modal="true"
            onSubmit={settingsOpen ? saveSettings : createClass}
          >
            <button
              type="button"
              className="close"
              aria-label="关闭班级表单"
              onClick={() => { setNewOpen(false); setSettingsOpen(false); setRebuildPreview(false) }}
            >
              <X />
            </button>
            <h2>{settingsOpen ? "班级设置" : "新建班级"}</h2>
            {classError && <p className="form-error" role="alert">{classError}</p>}
            <label>
              班级名称
              <input
                aria-label="班级名称"
                value={classForm.name}
                onChange={(event) =>
                  setClassForm({ ...classForm, name: event.target.value })
                }
              />
            </label>
            <label>年级<input aria-label="年级" value={classForm.grade} onChange={(event) => setClassForm({ ...classForm, grade: event.target.value })} /></label>
            <label>学年<input aria-label="学年" value={classForm.academicYear} onChange={(event) => setClassForm({ ...classForm, academicYear: event.target.value })} /></label>
            <label>计划人数<input type="number" aria-label="计划人数" value={classForm.plannedStudentCount} onChange={(event) => setClassForm({ ...classForm, plannedStudentCount: Number(event.target.value) })} /></label>
            <label>排数<input type="number" aria-label="排数" value={classForm.rows} onChange={(event) => setClassForm({ ...classForm, rows: Number(event.target.value) })} /></label>
            <label>每排桌数<input type="number" aria-label="每排桌数" value={classForm.desksPerRow} onChange={(event) => setClassForm({ ...classForm, desksPerRow: Number(event.target.value) })} /></label>
            <label>每桌容量<select aria-label="每桌容量" value={classForm.deskCapacity} onChange={(event) => setClassForm({ ...classForm, deskCapacity: Number(event.target.value) as 1 | 2 })}><option value="1">1</option><option value="2">2</option></select></label>
            <p>可用座位：{capacity}</p>
            {rebuildPreview && <p className="form-error">确认后会重建普通座位，特殊座位保留。</p>}
            <button type="submit" className="primary">
              {rebuildPreview ? "确认重建并保存" : settingsOpen ? "保存" : "创建班级并开始"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;

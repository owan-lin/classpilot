import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  alignedDeskPositions,
  firstFreeDeskPosition,
  isRegularGridUsable,
  rebuildRegularLayout,
  regularDeskSpec,
  specialDeskSpec,
  type ClassroomStage,
} from "../../domain/layout";
import { placeStudent } from "../../domain/seating";
import type {
  ClassRepository,
  DeskRecord,
  Gender,
  LayoutDraft,
  StudentRecord,
} from "../../domain/types";
import { createDefaultDraft } from "../../features/drafts/createDraft";
import { previewGradeCsv } from "../../features/grades/gradeImport";
import type { ClassForm, GradeForm } from "../components/Dialogs";

export const emptyStudent = {
  name: "",
  studentNo: "",
  gender: "unspecified" as Gender,
  note: "",
};
export const emptyGrade: GradeForm = {
  studentId: "",
  subject: "",
  examName: "",
  examDate: "",
  score: "",
  fullScore: "",
  note: "",
};
export const emptyClass: ClassForm = {
  name: "",
  grade: "",
  academicYear: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
  plannedStudentCount: 0,
  rows: 2,
  desksPerRow: 3,
  deskCapacity: 2,
};

type ActiveClass = {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  plannedStudentCount: number;
  rows: number;
  desksPerRow: number;
  deskCapacity: 1 | 2;
};
type DraftSessionLike = {
  update: (fn: (current: LayoutDraft) => LayoutDraft) => void;
  flush: () => Promise<void>;
};
type WorkbenchActionsOptions = {
  repository: ClassRepository;
  classId?: string;
  isCurrent: () => boolean;
  active?: ActiveClass;
  draft?: LayoutDraft;
  stage: ClassroomStage;
  bySeat: Map<string, string>;
  byId: Map<string, StudentRecord>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  profile?: StudentRecord;
  setProfile: Dispatch<SetStateAction<StudentRecord | undefined>>;
  setProfileTab: Dispatch<SetStateAction<"profile" | "grades">>;
  setClasses: Dispatch<
    SetStateAction<Awaited<ReturnType<ClassRepository["listClasses"]>>>
  >;
  setStudents: Dispatch<SetStateAction<StudentRecord[]>>;
  setGrades: Dispatch<
    SetStateAction<Awaited<ReturnType<ClassRepository["listGrades"]>>>
  >;
  session: MutableRefObject<DraftSessionLike | undefined>;
  setMessage: (message: string) => void;
  selectClass: (id: string) => void;
  activateTool: (view: "students" | "grades" | "room" | "seating") => void;
  activeDeskId?: string;
  setActiveDeskId: Dispatch<SetStateAction<string | undefined>>;
};

function studentInput(classId: string, value: typeof emptyStudent) {
  return {
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
  };
}

function sameStudentForm(left: typeof emptyStudent, right: typeof emptyStudent) {
  return left.name === right.name && left.studentNo === right.studentNo && left.gender === right.gender && left.note === right.note;
}

export function useWorkbenchActions({
  repository,
  classId,
  isCurrent,
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
}: WorkbenchActionsOptions) {
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [studentError, setStudentError] = useState("");
  const [editingStudent, setEditingStudent] = useState<string>();
  const [studentSaving, setStudentSaving] = useState(false);
  const studentRequestRef = useRef<string | undefined>(undefined);
  const latestStudentFormRef = useRef(emptyStudent);
  const latestEditingStudentRef = useRef<string | undefined>(undefined);
  const [classForm, setClassForm] = useState(emptyClass);
  const [classError, setClassError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rebuildPreview, setRebuildPreview] = useState(false);
  const [gradeForm, setGradeForm] = useState(emptyGrade);
  const [gradeCsv, setGradeCsv] = useState("");
  const [gradePreview, setGradePreview] =
    useState<ReturnType<typeof previewGradeCsv>>();

  useEffect(() => {
    latestStudentFormRef.current = studentForm;
    latestEditingStudentRef.current = editingStudent;
  }, [editingStudent, studentForm]);

  const capacity =
    classForm.rows * classForm.desksPerRow * classForm.deskCapacity;
  const change = (fn: (current: LayoutDraft) => LayoutDraft) => {
    session.current?.update(fn);
  };
  const closeClassDialog = () => {
    setNewOpen(false);
    setSettingsOpen(false);
    setRebuildPreview(false);
  };
  const openNewClass = () => {
    setClassForm(emptyClass);
    setClassError("");
    setNewOpen(true);
  };

  async function createClass(event: FormEvent) {
    event.preventDefault();
    if (!classForm.name.trim()) return setClassError("请填写班级名称");
    if (!isRegularGridUsable(classForm.rows, classForm.desksPerRow))
      return setClassError("排数和每排桌数必须是正整数");
    if (classForm.plannedStudentCount > capacity)
      return setClassError(
        `座位不足，还缺少 ${classForm.plannedStudentCount - capacity} 个座位`,
      );
    try {
      const data = await repository.createClass(classForm);
      await repository.saveDraft(
        createDefaultDraft(data.id, {
          rows: data.rows,
          desksPerRow: data.desksPerRow,
          capacity: data.deskCapacity,
        }),
      );
      setClasses(await repository.listClasses());
      selectClass(data.id);
      closeClassDialog();
      setClassForm(emptyClass);
      setMessage("班级已创建");
    } catch (error) {
      setClassError(error instanceof Error ? error.message : "创建班级失败");
    }
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
    try {
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
      closeClassDialog();
      setMessage("班级参数已保存");
    } catch (error) {
      setClassError(
        error instanceof Error ? error.message : "保存班级设置失败",
      );
    }
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (!classId) return;
    if (!studentForm.name.trim()) return setStudentError("请输入学生姓名");
    const requestClassId = classId;
    const submittedForm = { ...studentForm };
    const submittedEditingStudent = editingStudent;
    const requestKey = JSON.stringify([
      requestClassId,
      submittedEditingStudent,
      submittedForm,
    ]);
    if (studentRequestRef.current) return;
    studentRequestRef.current = requestKey;
    setStudentSaving(true);
    try {
      if (submittedEditingStudent)
        await repository.updateStudent(submittedEditingStudent, submittedForm);
      else await repository.createStudent(studentInput(requestClassId, submittedForm));
      const roster = await repository.listStudents(requestClassId);
      if (!isCurrent()) return;
      setStudents(roster);
      if (
        sameStudentForm(latestStudentFormRef.current, submittedForm) &&
        latestEditingStudentRef.current === submittedEditingStudent
      ) {
        setStudentForm(emptyStudent);
        setEditingStudent(undefined);
        setStudentError("");
      }
      setMessage("学生档案已保存");
    } catch (error) {
      if (
        isCurrent() &&
        sameStudentForm(latestStudentFormRef.current, submittedForm) &&
        latestEditingStudentRef.current === submittedEditingStudent
      )
        setStudentError(
          error instanceof Error ? error.message : "学生保存失败",
        );
    } finally {
      studentRequestRef.current = undefined;
      setStudentSaving(false);
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
  function openProfile(student: StudentRecord) {
    setProfileTab("profile");
    setGradeForm({ ...emptyGrade, studentId: student.id });
    setProfile(student);
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
    if (classId) {
      const roster = await repository.listStudents(classId);
      if (isCurrent()) setStudents(roster);
    }
    setProfile(undefined);
  }
  function seat(seatId: string, occupant?: StudentRecord) {
    if (!selectedId)
      return occupant ? openProfile(occupant) : setMessage("请选择一名学生");
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
    const occupant = byId.get(bySeat.get(seatId) ?? "");
    const incoming = byId.get(studentId);
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
    if (!active) return;
    change((current) => {
      const positions = alignedDeskPositions(current.desks, active, stage);
      if (positions.length !== current.desks.length) return current;
      return {
        ...current,
        desks: current.desks.map((desk, index) => ({
          ...desk,
          ...positions[index],
        })),
      };
    });
    setMessage("课桌已按网格对齐（班级设置）");
  }
  async function saveGrade(event: FormEvent) {
    event.preventDefault();
    if (!classId) return;
    if (!gradeForm.score.trim() || !gradeForm.fullScore.trim()) {
      setMessage("请填写得分和满分");
      return;
    }
    const score = Number(gradeForm.score);
    const fullScore = Number(gradeForm.fullScore);
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(fullScore) ||
      score < 0 ||
      fullScore <= 0 ||
      score > fullScore
    ) {
      setMessage("得分必须在 0 到满分之间");
      return;
    }
    const requestClassId = classId;
    try {
      await repository.createGrade({
        classId: requestClassId,
        studentId: gradeForm.studentId,
        subject: gradeForm.subject,
        examName: gradeForm.examName,
        examDate: gradeForm.examDate,
        score,
        fullScore,
        ...(gradeForm.note ? { note: gradeForm.note } : {}),
      });
      const scoreList = await repository.listGrades(requestClassId);
      if (!isCurrent()) return;
      setGrades(scoreList);
      setGradeForm(
        profile ? { ...emptyGrade, studentId: profile.id } : emptyGrade,
      );
      setMessage("成绩已保存");
    } catch (error) {
      if (isCurrent())
        setMessage(error instanceof Error ? error.message : "成绩保存失败");
    }
  }
  async function importGrades() {
    if (!classId || !gradePreview) return;
    const requestClassId = classId;
    try {
      await repository.importGrades(
        requestClassId,
        gradePreview.rows,
        "reject",
      );
      const scoreList = await repository.listGrades(requestClassId);
      if (!isCurrent()) return;
      setGrades(scoreList);
      setGradeCsv("");
      setGradePreview(undefined);
      setMessage("成绩导入完成");
    } catch (error) {
      if (isCurrent())
        setMessage(error instanceof Error ? error.message : "成绩导入失败");
    }
  }

  function resetStudentEditor() {
    setEditingStudent(undefined);
    setStudentForm(emptyStudent);
    setStudentError("");
  }
  function clearGradePreview() {
    setGradePreview(undefined);
  }

  return {
    studentForm,
    setStudentForm,
    studentError,
    editingStudent,
    studentSaving,
    classForm,
    setClassForm,
    classError,
    newOpen,
    settingsOpen,
    rebuildPreview,
    gradeForm,
    setGradeForm,
    gradeCsv,
    setGradeCsv,
    gradePreview,
    setGradePreview,
    capacity,
    createClass,
    saveSettings,
    openSettings,
    openNewClass,
    closeClassDialog,
    saveStudent,
    editStudent,
    openProfile,
    deleteStudent,
    seat,
    drop,
    addDesk,
    deleteDesk,
    align,
    saveGrade,
    importGrades,
    resetStudentEditor,
    clearGradePreview,
    change,
  };
}

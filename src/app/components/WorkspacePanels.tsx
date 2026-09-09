import type { FormEvent } from "react";
import { RotateCcw, UserPlus, Users } from "lucide-react";
import { GradeTools } from "../../features/grades/GradeTools";
import { previewGradeCsv } from "../../features/grades/gradeImport";
import {
  studentGenderAttributes,
  studentGenderLabel,
} from "../../domain/studentGender";
import type {
  GradeRecord,
  GradeImportPreview,
  Gender,
  StudentRecord,
} from "../../domain/types";

type LayoutMode = "snap" | "free";
type StudentForm = {
  name: string;
  studentNo: string;
  gender: Gender;
  note: string;
};

export function SeatingPanel({
  students,
  pool,
  selectedId,
  setSelectedId,
  openProfile,
}: {
  students: StudentRecord[];
  pool: StudentRecord[];
  selectedId?: string;
  setSelectedId: (id?: string) => void;
  openProfile: (student: StudentRecord) => void;
}) {
  return (
    <>
      <section className="pool" role="complementary" aria-label="待安排学生">
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
                  onClick={() => openProfile(student)}
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
}

export function RoomPanel({
  layoutMode,
  setLayoutMode,
  align,
  addDesk,
}: {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  align: () => void;
  addDesk: (kind: "regular" | "special") => void;
}) {
  return (
    <section className="room-tools">
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
  );
}

export function StudentPanel({
  students,
  form,
  editingStudent,
  error,
  setForm,
  saveStudent,
  studentSaving,
  openProfile,
  editStudent,
}: {
  students: StudentRecord[];
  form: StudentForm;
  editingStudent?: string;
  error: string;
  setForm: (form: StudentForm) => void;
  saveStudent: (event: FormEvent) => void;
  studentSaving?: boolean;
  openProfile: (student: StudentRecord) => void;
  editStudent: (student: StudentRecord) => void;
}) {
  return (
    <section className="student-workspace">
      <form className="student-form" aria-busy={studentSaving || undefined} noValidate onSubmit={saveStudent}>
        {editingStudent && <h2>编辑学生</h2>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          姓名
          <input
            aria-label="姓名"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          性别
          <select
            aria-label="性别"
            value={form.gender}
            onChange={(event) =>
              setForm({ ...form, gender: event.target.value as Gender })
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
            value={form.studentNo}
            onChange={(event) =>
              setForm({ ...form, studentNo: event.target.value })
            }
          />
        </label>
        <label>
          备注
          <textarea
            aria-label="备注"
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <div className="form-actions form-actions--footer">
          <button type="submit" className="primary">
            <UserPlus aria-hidden="true" />
            {editingStudent ? "保存修改" : "保存并继续"}
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
              <button type="button" onClick={() => openProfile(student)}>
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
  );
}

export function GradesPanel({
  students,
  grades,
  gradeCsv,
  gradePreview,
  setGradeCsv,
  setGradePreview,
  importGrades,
  openProfile,
}: {
  students: StudentRecord[];
  grades: GradeRecord[];
  gradeCsv: string;
  gradePreview?: GradeImportPreview;
  setGradeCsv: (value: string) => void;
  setGradePreview: (value: GradeImportPreview | undefined) => void;
  importGrades: () => void;
  openProfile: (student: StudentRecord) => void;
}) {
  return (
    <section className="student-workspace">
      <section className="roster">
        <h2>
          成绩记录 <span>{grades.length}</span>
        </h2>
        <ul>
          {students.map((student) => (
            <li key={student.id}>
              <button type="button" onClick={() => openProfile(student)}>
                <b>{student.name}</b>
                <span>
                  {
                    grades.filter((grade) => grade.studentId === student.id)
                      .length
                  }{" "}
                  条成绩
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <GradeTools
        csv={gradeCsv}
        preview={gradePreview}
        onCsv={setGradeCsv}
        onPreview={() => setGradePreview(previewGradeCsv(gradeCsv))}
        onImport={importGrades}
        grades={grades}
        students={students}
      />
    </section>
  );
}

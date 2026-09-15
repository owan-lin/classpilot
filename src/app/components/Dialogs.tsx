import { useRef, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  studentGenderAttributes,
  studentGenderLabel,
} from "../../domain/studentGender";
import type { GradeRecord, StudentRecord } from "../../domain/types";
import { useDialogFocus } from "../hooks/useDialogFocus";

export type GradeForm = {
  studentId: string;
  subject: string;
  examName: string;
  examDate: string;
  score: string;
  fullScore: string;
  note: string;
};
export type ClassForm = {
  name: string;
  grade: string;
  academicYear: string;
  plannedStudentCount: number;
  rows: number;
  desksPerRow: number;
  deskCapacity: 1 | 2;
};

export function ProfileDialog({
  profile,
  profileTab,
  setProfileTab,
  grades,
  gradeForm,
  setGradeForm,
  saveGrade,
  gradeError,
  gradeSaving,
  close,
  editStudent,
  deleteStudent,
  moveStudent,
  returnToPool,
}: {
  profile: StudentRecord;
  profileTab: "profile" | "grades";
  setProfileTab: (tab: "profile" | "grades") => void;
  grades: GradeRecord[];
  gradeForm: GradeForm;
  setGradeForm: (form: GradeForm) => void;
  saveGrade: (event: FormEvent) => void;
  gradeError: string;
  gradeSaving: boolean;
  close: () => void;
  editStudent: (student: StudentRecord) => void;
  deleteStudent: (student: StudentRecord) => void;
  moveStudent: () => void;
  returnToPool: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(Boolean(profile), dialogRef, close);
  const profileGrades = grades.filter(
    (grade) => grade.studentId === profile.id,
  );

  return (
    <div className="overlay">
      <section
        ref={dialogRef}
        className="profile"
        role="dialog"
        aria-modal="true"
        aria-label={profile.name}
        tabIndex={-1}
      >
        <button
          type="button"
          className="close"
          aria-label="关闭学生档案"
          onClick={close}
        >
          <X />
        </button>
        <h2>{profile.name}</h2>
        <div role="tablist" aria-label="学生档案内容">
          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "profile"}
            onClick={() => setProfileTab("profile")}
          >
            档案
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "grades"}
            onClick={() => setProfileTab("grades")}
          >
            成绩
          </button>
        </div>
        {profileTab === "profile" ? (
          <section role="tabpanel" aria-label="学生档案">
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
              <button className="quiet" type="button" onClick={moveStudent}>移动座位</button>
              <button className="quiet" type="button" onClick={returnToPool}>移回待安排</button>
              <button
                className="danger"
                type="button"
                onClick={() => deleteStudent(profile)}
              >
                删除学生
              </button>
            </div>
          </section>
        ) : (
          <section
            className="profile-grade-card"
            role="tabpanel"
            aria-label={`${profile.name} 的成绩`}
          >
            <h3>成绩记录</h3>
            {profileGrades.length ? (
              <ul>
                {profileGrades.map((grade) => (
                  <li key={grade.id}>
                    {grade.subject} · {grade.examName} · {grade.score}/
                    {grade.fullScore}
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无成绩记录</p>
            )}
            <form onSubmit={saveGrade}>
              <h3>录入成绩</h3>
              {gradeError && <p className="form-error" role="alert">{gradeError}</p>}
              <label>
                学科
                <input
                  aria-label="档案成绩学科"
                  value={gradeForm.subject}
                  onChange={(event) =>
                    setGradeForm({ ...gradeForm, subject: event.target.value })
                  }
                />
              </label>
              <label>
                考试
                <input
                  aria-label="档案成绩考试"
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
                  aria-label="档案成绩日期"
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
                  min={0}
                  max={100000}
                  step="0.01"
                  aria-label="档案成绩得分"
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
                  min={0.01}
                  max={100000}
                  step="0.01"
                  aria-label="档案成绩满分"
                  value={gradeForm.fullScore}
                  onChange={(event) =>
                    setGradeForm({
                      ...gradeForm,
                      fullScore: event.target.value,
                    })
                  }
                />
              </label>
              <button type="submit" className="primary" disabled={gradeSaving}>
                {gradeSaving ? "正在保存…" : "保存成绩"}
              </button>
            </form>
          </section>
        )}
      </section>
    </div>
  );
}

export function ClassDialog({
  settingsOpen,
  form,
  error,
  capacity,
  rebuildPreview,
  setForm,
  close,
  submit,
}: {
  settingsOpen: boolean;
  form: ClassForm;
  error: string;
  capacity: number;
  rebuildPreview: boolean;
  setForm: (form: ClassForm) => void;
  close: () => void;
  submit: (event: FormEvent) => void;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogFocus(true, dialogRef, close);

  return (
    <div className="overlay">
      <form
        ref={dialogRef}
        className="new-class"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-dialog-title"
        onSubmit={submit}
        tabIndex={-1}
      >
        <button
          type="button"
          className="close"
          aria-label="关闭班级表单"
          onClick={close}
        >
          <X />
        </button>
        <h2 id="class-dialog-title">
          {settingsOpen ? "班级设置" : "新建班级"}
        </h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          班级名称
          <input
            aria-label="班级名称"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          年级
          <input
            aria-label="年级"
            value={form.grade}
            onChange={(event) =>
              setForm({ ...form, grade: event.target.value })
            }
          />
        </label>
        <label>
          学年
          <input
            aria-label="学年"
            value={form.academicYear}
            onChange={(event) =>
              setForm({ ...form, academicYear: event.target.value })
            }
          />
        </label>
        <label>
          计划人数
          <input
            type="number"
            min={0}
            step={1}
            aria-label="计划人数"
            value={form.plannedStudentCount}
            onChange={(event) =>
              setForm({
                ...form,
                plannedStudentCount: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          排数
          <input
            type="number"
            min={1}
            step={1}
            aria-label="排数"
            value={form.rows}
            onChange={(event) =>
              setForm({ ...form, rows: Number(event.target.value) })
            }
          />
        </label>
        <label>
          每排桌数
          <input
            type="number"
            min={1}
            step={1}
            aria-label="每排桌数"
            value={form.desksPerRow}
            onChange={(event) =>
              setForm({ ...form, desksPerRow: Number(event.target.value) })
            }
          />
        </label>
        <label>
          每桌容量
          <select
            aria-label="每桌容量"
            value={form.deskCapacity}
            onChange={(event) =>
              setForm({
                ...form,
                deskCapacity: Number(event.target.value) as 1 | 2,
              })
            }
          >
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <p>可用座位：{capacity}</p>
        {rebuildPreview && (
          <p className="form-error">确认后会重建普通座位，特殊座位保留。</p>
        )}
        <button type="submit" className="primary">
          {rebuildPreview
            ? "确认重建并保存"
            : settingsOpen
              ? "保存"
              : "创建班级并开始"}
        </button>
      </form>
    </div>
  );
}

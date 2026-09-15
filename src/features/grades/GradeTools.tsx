import type { GradeRecord, StudentRecord } from "../../domain/types";
import { previewGradeCsv } from "./gradeImport";

export function GradeTools({
  csv,
  preview,
  onCsv,
  onPreview,
  onImport,
  error,
  importing,
  grades,
  students,
}: {
  csv: string;
  preview?: ReturnType<typeof previewGradeCsv>;
  onCsv: (value: string) => void;
  onPreview: () => void;
  onImport: () => void;
  error: string;
  importing: boolean;
  grades: GradeRecord[];
  students?: StudentRecord[];
}) {
  const byId = new Map((students ?? []).map((student) => [student.id, student]));
  return (
    <section className="grade-tools" aria-label="成绩导入与趋势">
      <details className="grade-import">
        <summary>
          导入成绩 <small>CSV · 预览版</small>
        </summary>
        <textarea
          aria-label="成绩 CSV"
          value={csv}
          onChange={(event) => onCsv(event.target.value)}
          placeholder="学号,学科,考试,日期,得分,满分,备注"
        />
        <div className="form-actions">
          <button type="button" className="quiet" disabled={importing} onClick={onPreview}>
            预览
          </button>
          {preview && (
            <button
              type="button"
              className="primary"
              disabled={importing || preview.errorCount > 0 || preview.validCount === 0}
              onClick={onImport}
            >
              {importing ? "正在导入…" : "确认导入"}
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
            {preview.rows.filter((row) => !row.errors.length).slice(0, 8).map((row) => (
              <p key={`valid-${row.rowNumber}`}>
                {row.studentName || row.studentNo} · {row.studentNo} · {row.grade?.subject} · {row.grade?.examName} · {row.grade?.examDate} · {row.grade?.score}/{row.grade?.fullScore}
              </p>
            ))}
          </div>
        )}
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <h2>成绩记录</h2>
      {grades.length ? <div className="grade-table-scroll" tabIndex={0} aria-label="成绩明细表，可横向滚动"><table className="grade-table">
        <thead><tr><th>学生</th><th>学科</th><th>考试</th><th>日期</th><th>得分</th></tr></thead>
        <tbody>{grades.map((grade) => <tr key={grade.id}><td>{byId.get(grade.studentId)?.name ?? "未知学生"}</td><td>{grade.subject}</td><td>{grade.examName}</td><td>{grade.examDate}</td><td>{grade.score}/{grade.fullScore}</td></tr>)}</tbody>
      </table></div> : <p>暂无成绩。请从学生档案录入，或展开 CSV 导入。</p>}
    </section>
  );
}

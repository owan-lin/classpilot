import { gradeTrend } from "../../domain/grades";
import type { GradeRecord, StudentRecord } from "../../domain/types";
import { previewGradeCsv } from "./gradeImport";

export function GradeTools({
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
              确认导入
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
      </details>
      <h2>得分率</h2>
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

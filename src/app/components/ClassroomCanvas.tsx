import type { CSSProperties, DragEvent, PointerEvent } from "react";
import { Grip, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { regularDeskSpec, type ClassroomStage } from "../../domain/layout";
import {
  studentGenderAttributes,
  studentGenderLabel,
} from "../../domain/studentGender";
import type {
  DeskRecord,
  LayoutDraft,
  StudentRecord,
} from "../../domain/types";

type View = "seating" | "room" | "students" | "grades";
type LayoutMode = "snap" | "free";

export interface ClassroomCanvasProps {
  active: { name: string; rows: number };
  draft?: LayoutDraft;
  stage: ClassroomStage;
  mainGridCenter: number;
  view: View;
  layoutMode: LayoutMode;
  canvasZoom: number;
  canvasScrollRef: React.RefObject<HTMLElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  activeDeskId?: string;
  transient: Record<string, { x: number; y: number }>;
  bySeat: Map<string, string>;
  byId: Map<string, StudentRecord>;
  selectedId?: string;
  setZoom: (next: number) => void;
  setCanvasZoom: (next: number) => void;
  fitCanvas: () => void;
  beginMove: (event: PointerEvent<HTMLElement>, desk: DeskRecord) => void;
  previewMove: (event: PointerEvent<HTMLElement>) => void;
  commitMove: () => void;
  cancelMove: () => void;
  deleteDesk: (desk: DeskRecord) => void;
  drop: (event: DragEvent, seatId: string) => void;
  openProfile: (student: StudentRecord) => void;
  seat: (seatId: string, occupant?: StudentRecord) => void;
}

export function ClassroomCanvas({
  active,
  draft,
  stage,
  mainGridCenter,
  view,
  layoutMode,
  canvasZoom,
  canvasScrollRef,
  canvasRef,
  activeDeskId,
  transient,
  bySeat,
  byId,
  selectedId,
  setZoom,
  setCanvasZoom,
  fitCanvas,
  beginMove,
  previewMove,
  commitMove,
  cancelMove,
  deleteDesk,
  drop,
  openProfile,
  seat,
}: ClassroomCanvasProps) {
  return (
    <>
      <section
        ref={canvasScrollRef}
        className="canvas-scroll"
        data-testid="classroom-canvas"
      >
      <div
        ref={canvasRef}
        className={`canvas view-${view} ${view === "room" && layoutMode === "snap" ? "snap-grid" : ""}`}
        role="region"
        aria-label={`${active.name} 教室座位画布`}
        style={
          {
            "--canvas-stage-width": `${stage.width}px`,
            "--canvas-stage-height": `${stage.height}px`,
            width: `${stage.width}px`,
            height: `${stage.height}px`,
            aspectRatio: "auto",
            zoom: canvasZoom,
          } as CSSProperties
        }
      >
        <div
          className="podium"
          data-testid="podium"
          aria-label="教师区域与讲台"
          style={{
            position: "absolute",
            top: 12,
            left: `${(mainGridCenter / stage.width) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="podium-surface" aria-label="讲台">
            讲台
          </div>
        </div>
        <div className="row-labels" aria-hidden="true">
          {Array.from({ length: active.rows }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${((stage.originX - 36) / stage.width) * 100}%`,
                top: `${((stage.originY + index * (regularDeskSpec.height + stage.gapY)) / stage.height) * 100}%`,
              }}
            >
              第{index + 1}排
            </span>
          ))}
        </div>
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
                aria-label={view === "room" ? "拖动课桌" : undefined}
                title={view === "room" ? "拖动调整位置" : undefined}
                style={{ touchAction: "none" }}
                onPointerDown={(event) => beginMove(event, desk)}
                onPointerMove={previewMove}
                onPointerUp={commitMove}
                onPointerCancel={cancelMove}
              >
                {view === "room" ? (
                  <>
                    <Grip aria-hidden="true" />
                    <button
                      type="button"
                      aria-label={`删除${desk.kind === "special" ? "特殊座" : `课桌 ${index + 1}`}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => deleteDesk(desk)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </header>
              <div
                className="seats"
                style={{
                  gridTemplateColumns: `repeat(${desk.capacity}, minmax(0, 1fr))`,
                }}
              >
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
                      onDragOver={(event) => {
                        if (view === "seating") event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (view === "seating") drop(event, seatId);
                      }}
                      onClick={() => {
                        if (student && !(view === "seating" && selectedId)) {
                          openProfile(student);
                          return;
                        }
                        if (view === "seating") seat(seatId, student);
                      }}
                      className={
                        student
                          ? `seat occupied ${selectedId === student.id ? "selected" : ""}`
                          : "seat"
                      }
                    >
                      {student ? (
                        <>
                          <b title={student.name}>{student.name}</b>
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
      <CanvasZoomControls
        canvasZoom={canvasZoom}
        setZoom={setZoom}
        setCanvasZoom={setCanvasZoom}
        fitCanvas={fitCanvas}
      />
    </>
  );
}

function CanvasZoomControls({
  canvasZoom,
  setZoom,
  setCanvasZoom,
  fitCanvas,
}: Pick<
  ClassroomCanvasProps,
  "canvasZoom" | "setZoom" | "setCanvasZoom" | "fitCanvas"
>) {
  return (
    <div
      data-testid="canvas-zoom"
      role="group"
      aria-label="画布缩放"
      aria-valuemin={50}
      aria-valuemax={150}
      aria-valuenow={Math.round(canvasZoom * 100)}
      className="canvas-zoom"
    >
      <button type="button" aria-label="缩小画布" title="缩小画布" onClick={() => setZoom(canvasZoom - 0.1)}><ZoomOut aria-hidden="true" /></button>
      <button type="button" aria-label="重置画布缩放" title="重置为 100%" onClick={() => setCanvasZoom(1)}><RotateCcw aria-hidden="true" /><span>{Math.round(canvasZoom * 100)}%</span></button>
      <button type="button" aria-label="放大画布" title="放大画布" onClick={() => setZoom(canvasZoom + 0.1)}><ZoomIn aria-hidden="true" /></button>
      <button type="button" aria-label="适配画布" title="适配画布" onClick={fitCanvas}><Maximize2 aria-hidden="true" /><span>适配</span></button>
    </div>
  );
}

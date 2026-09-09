import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from "react";
import {
  classroomStageFor,
  constrainFreeDeskPosition,
  isDeskPositionValid,
  snapDeskPosition,
  type DeskPosition,
} from "../../domain/layout";
import type { DeskRecord, LayoutDraft } from "../../domain/types";

type LayoutMode = "snap" | "free";
type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
  preview: DeskPosition;
};

/** Owns pointer bookkeeping and frame-throttled previews for classroom desks. */
export function useDeskDrag({
  draft,
  stage,
  layoutMode,
  view,
  onChange,
  onMessage,
  activeDeskId,
  setActiveDeskId,
}: {
  draft: LayoutDraft | undefined;
  stage: ReturnType<typeof classroomStageFor>;
  layoutMode: LayoutMode;
  view: string;
  onChange: (update: (current: LayoutDraft) => LayoutDraft) => void;
  onMessage: (value: string) => void;
  activeDeskId?: string;
  setActiveDeskId: Dispatch<SetStateAction<string | undefined>>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | undefined>(undefined);
  const raf = useRef<number | undefined>(undefined);
  const [transient, setTransient] = useState<Record<string, DeskPosition>>({});

  const cancelMove = () => {
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    drag.current = undefined;
    setTransient({});
  };
  useEffect(
    () => () => {
      if (raf.current !== undefined) cancelAnimationFrame(raf.current);
      raf.current = undefined;
      drag.current = undefined;
      setTransient({});
      setActiveDeskId(undefined);
    },
    [draft?.classId, setActiveDeskId],
  );

  const beginMove = (event: PointerEvent<HTMLElement>, desk: DeskRecord) => {
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
  };
  const previewMove = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const desk = draft?.desks.find((item) => item.id === state?.id);
    const canvas = canvasRef.current;
    if (!state || !desk || !canvas || !draft) return;
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
      !isDeskPositionValid(draft, desk.id, position, stage)
    )
      return;
    state.preview = position;
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (drag.current?.id === state.id) setTransient({ [desk.id]: position });
    });
  };
  const commitMove = () => {
    const state = drag.current;
    const desk = draft?.desks.find((item) => item.id === state?.id);
    if (!state || !desk || !draft) return cancelMove();
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    if (
      layoutMode === "free" ||
      isDeskPositionValid(draft, desk.id, state.preview, stage)
    ) {
      onChange((current) => ({
        ...current,
        desks: current.desks.map((item) =>
          item.id === state.id ? { ...item, ...state.preview } : item,
        ),
      }));
    }
    setActiveDeskId(undefined);
    drag.current = undefined;
    setTransient({});
    onMessage("课桌位置已更新并自动保存");
  };
  return {
    canvasRef,
    activeDeskId,
    transient,
    cancelMove,
    beginMove,
    previewMove,
    commitMove,
    isDragging: () => Boolean(drag.current),
  };
}

import type { ComponentType, ReactNode, RefObject, SVGProps } from "react";
import {
  BarChart3,
  LayoutGrid,
  PencilRuler,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { ClassRecord } from "../../domain/types";
type View = "seating" | "room" | "students" | "grades";

export function ClassRail({
  open,
  desktopViewport,
  toggle,
  close,
  toggleRef,
  classes,
  activeId,
  selectClass,
  newClass,
}: {
  open: boolean;
  desktopViewport: boolean;
  toggle: () => void;
  close: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
  classes: ClassRecord[];
  activeId?: string;
  selectClass: (id: string) => void;
  newClass: () => void;
}) {
  return (
    <aside
      id="class-rail"
      data-testid="class-rail"
      data-overlay={!desktopViewport ? "true" : undefined}
      className={`class-rail ${open ? "open" : ""}`}
    >
      <button
        type="button"
        className="rail-close"
        aria-label="关闭班级轨道"
        onClick={close}
      >
        <X />
      </button>
      <button
        ref={toggleRef}
        type="button"
        className="rail-toggle"
        aria-label={open || desktopViewport ? "折叠班级轨道" : "打开班级轨道"}
        aria-controls="class-rail"
        aria-expanded={open}
        onClick={toggle}
      >
        <LayoutGrid />
      </button>
      <div className="rail-wordmark" aria-label="ClassPilot 班级座位助手">
        <span className="rail-logo-mark" aria-hidden="true">
          <LayoutGrid />
        </span>
        <b className="rail-logo-wordmark">ClassPilot</b>
      </div>
      <button
        type="button"
        className="rail-new"
        aria-label="新建班级"
        onClick={newClass}
      >
        <Plus aria-hidden="true" />
        <span>新建班级</span>
      </button>
      <div
        className="rail-panel"
        data-testid="class-panel"
        aria-hidden={!open && !desktopViewport}
      >
        <h2>班级</h2>
        <button type="button" className="primary" onClick={newClass}>
          <Plus />
          新建班级
        </button>
        {classes.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={item.id === activeId}
            className={
              item.id === activeId ? "class-choice current" : "class-choice"
            }
            onClick={() => selectClass(item.id)}
          >
            <b>{item.name}</b>
            <small>{item.grade || item.academicYear}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

const tools: Array<[View, string, ComponentType<SVGProps<SVGSVGElement>>]> = [
  ["seating", "排座 / 移位", Users],
  ["room", "编辑教室", PencilRuler],
  ["students", "录入学生", UserRound],
  ["grades", "成绩", BarChart3],
];
export function ToolRail({
  open,
  desktopViewport,
  toggle,
  close,
  toggleRef,
  view,
  activate,
  openSettings,
  title,
  children,
}: {
  open: boolean;
  desktopViewport: boolean;
  toggle: () => void;
  close: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
  view: View;
  activate: (view: View) => void;
  openSettings: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      id="tool-rail"
      data-testid="tool-rail"
      data-overlay={!desktopViewport ? "true" : undefined}
      className={`tool-rail ${open ? "open" : ""}`}
    >
      <button
        type="button"
        ref={toggleRef}
        className="rail-toggle"
        aria-label={open || desktopViewport ? "折叠工具轨道" : "打开工具轨道"}
        aria-controls="tool-rail"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? <PanelRightClose /> : <PanelRightOpen />}
      </button>
      <nav aria-label="班级工具">
        {tools.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            className={view === key ? "tab active" : "tab"}
            aria-label={label}
            title={label}
            onClick={() => activate(key)}
          >
            <Icon aria-hidden="true" />
            <span>
              {
                {
                  seating: "排座",
                  room: "教室",
                  students: "学生",
                  grades: "成绩",
                }[key]
              }
            </span>
          </button>
        ))}
        <button
          type="button"
          className="tab"
          aria-label="班级设置"
          title="班级设置"
          onClick={openSettings}
        >
          <Settings aria-hidden="true" />
          <span>设置</span>
        </button>
      </nav>
      <section
        data-testid="tool-panel"
        className="tool-panel"
        aria-hidden={!open && !desktopViewport}
      >
        <button
          type="button"
          className="rail-close"
          aria-label="关闭工具轨道"
          onClick={close}
        >
          <X />
        </button>
        <h1 className="tool-panel-title">{title}</h1>
        {children}
      </section>
    </aside>
  );
}

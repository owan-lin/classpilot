import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Archive,
  Check,
  ChevronDown,
  CircleHelp,
  CloudOff,
  Download,
  FileSpreadsheet,
  History,
  LayoutGrid,
  Minus,
  Plus,
  Printer,
  Redo2,
  Search,
  Settings,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react'
import { classRepository } from './data/repository'
import { generateDeskGrid, getSeatingWarnings, getStudentPool, placeStudent } from './domain/seating'
import type { ClassRecord, ClassRepository, LayoutDraft, SeatingSnapshot, StudentRecord } from './domain/types'
import { createBackupDownload, restoreBackupText } from './features/backup/backupTransfer'
import { createDefaultDraft } from './features/drafts/createDraft'
import { DraftSession } from './features/drafts/draftSession'
import { PwaUpdatePrompt } from './features/pwa/PwaUpdatePrompt'
import {
  ClassroomDesk,
  EmptyState,
  ModeSwitch,
  ProfileDrawer,
  StudentListCard,
  WarningNotice,
} from './ui/ClassroomPrimitives'
import './App.css'

const canvasWidth = 920
const canvasHeight = 610

interface NewClassSetup {
  name: string
  grade: string
  academicYear: string
  rows: number
  desksPerRow: number
  capacity: 1 | 2
}

function currentAcademicYear(): string {
  const now = new Date()
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${startYear}–${startYear + 1}`
}

function App({ repository = classRepository }: { repository?: ClassRepository }) {
  const [mode, setMode] = useState<'arrange' | 'layout'>('arrange')
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [draft, setDraft] = useState<LayoutDraft>()
  const [snapshots, setSnapshots] = useState<SeatingSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string>()
  const [openStudent, setOpenStudent] = useState<StudentRecord | null>(null)
  const [zoom, setZoom] = useState(90)
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState('学生资料仅保存在此设备')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [dataRevision, setDataRevision] = useState(0)
  const [newClassSetup, setNewClassSetup] = useState<NewClassSetup>({
    name: '',
    grade: '',
    academicYear: currentAcademicYear(),
    rows: 4,
    desksPerRow: 3,
    capacity: 2,
  })
  const sessionRef = useRef<DraftSession | undefined>(undefined)

  useEffect(() => {
    let active = true
    repository.listClasses().then((records) => {
      if (!active) return
      setClasses(records)
      setSelectedClassId((current) =>
        current && records.some(({ id }) => id === current) ? current : records[0]?.id,
      )
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof Error ? error.message : '无法读取本地班级')
    })
    return () => { active = false }
  }, [repository, dataRevision])

  useEffect(() => {
    if (!selectedClassId) return

    let active = true
    let session: DraftSession | undefined
    let unsubscribe: (() => void) | undefined
    Promise.all([
      repository.listStudents(selectedClassId),
      repository.getDraft(selectedClassId),
      repository.listSnapshots(selectedClassId),
    ]).then(async ([nextStudents, storedDraft, snapshots]) => {
      const nextDraft = storedDraft ?? createDefaultDraft(selectedClassId)
      if (!storedDraft) await repository.saveDraft(nextDraft)
      if (!active) return
      setStudents(nextStudents)
      setSnapshots(snapshots)
      session = new DraftSession(nextDraft, repository)
      sessionRef.current = session
      unsubscribe = session.subscribe((history) => {
        setDraft(structuredClone(history.present))
        setCanUndo(history.past.length > 0)
        setCanRedo(history.future.length > 0)
      })
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof Error ? error.message : '无法读取本地座位草稿')
    })

    return () => {
      active = false
      unsubscribe?.()
      if (session && sessionRef.current === session) sessionRef.current = undefined
      void session?.dispose().catch(() => undefined)
    }
  }, [repository, selectedClassId, dataRevision])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenStudent(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const selectedClass = classes.find(({ id }) => id === selectedClassId)
  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const assignmentsBySeat = useMemo(
    () => new Map(draft?.assignments.map((assignment) => [assignment.seatId, assignment.studentId]) ?? []),
    [draft],
  )
  const studentPool = useMemo(() => getStudentPool(students, draft?.assignments ?? []), [draft, students])
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('zh-CN')
    if (!query) return studentPool
    return studentPool.filter((student) =>
      `${student.name}${student.studentNo}`.toLocaleLowerCase('zh-CN').includes(query),
    )
  }, [searchQuery, studentPool])
  const seatingWarnings = useMemo(() => draft ? getSeatingWarnings(draft, students) : [], [draft, students])
  const regularDesks = draft?.desks.filter(({ kind }) => kind === 'regular') ?? []
  const specialDesks = draft?.desks.filter(({ kind }) => kind === 'special') ?? []
  const canvasScale = zoom / 100
  const scaleStyle = { '--canvas-scale': canvasScale } as CSSProperties

  async function createClass(): Promise<void> {
    try {
      const classroom = await repository.createClass({
        name: newClassSetup.name.trim() || `新班级 ${classes.length + 1}`,
        grade: newClassSetup.grade,
        academicYear: newClassSetup.academicYear,
      })
      const timestamp = new Date().toISOString()
      const nextDraft: LayoutDraft = {
        id: crypto.randomUUID(),
        classId: classroom.id,
        podium: { x: 355, y: 22, width: 185, height: 58 },
        desks: generateDeskGrid(
          {
            classId: classroom.id,
            rows: newClassSetup.rows,
            desksPerRow: newClassSetup.desksPerRow,
            capacity: newClassSetup.capacity,
            originX: 75,
            originY: 145,
            deskWidth: 190,
            deskHeight: 112,
            horizontalGap: 48,
            verticalGap: 62,
          },
          {
            deskId: () => crypto.randomUUID(),
            seatId: () => crypto.randomUUID(),
          },
          timestamp,
        ),
        assignments: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await repository.saveDraft(nextDraft)
      setClasses((current) => [...current, classroom])
      setSelectedClassId(classroom.id)
      setShowCreateDialog(false)
      setNewClassSetup((current) => ({ ...current, name: '', grade: '' }))
      setStatus('班级已创建，可继续导入学生名单')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '新建班级失败')
    }
  }

  function addSpecialDesk(): void {
    if (!draft || !sessionRef.current) return
    const timestamp = new Date().toISOString()
    const specialCount = draft.desks.filter(({ kind }) => kind === 'special').length
    sessionRef.current.update((current) => ({
      ...current,
      desks: [...current.desks, {
        id: crypto.randomUUID(),
        classId: current.classId,
        kind: 'special',
        capacity: 1,
        x: specialCount % 2 === 0 ? 18 : 812,
        y: 120 + Math.floor(specialCount / 2) * 122,
        width: 90,
        height: 88,
        seatIds: [crypto.randomUUID()],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }))
    setStatus('已添加一个特殊单人座位')
  }

  async function exportBackup(): Promise<void> {
    try {
      const download = await createBackupDownload(repository)
      const url = URL.createObjectURL(download.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = download.filename
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus(download.warning)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '备份导出失败')
    }
  }

  async function importBackup(file?: File): Promise<void> {
    if (!file) return
    try {
      const result = await restoreBackupText(repository, await file.text())
      setSelectedClassId(undefined)
      setDataRevision((value) => value + 1)
      setShowSettingsDialog(false)
      setStatus(`备份恢复完成：${result.counts.classes} 个班级，${result.counts.students} 名学生`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '备份恢复失败')
    }
  }

  async function importRoster(file?: File): Promise<void> {
    if (!file || !selectedClassId) return
    try {
      const { applyRosterImport, previewRosterWorkbook } = await import('./features/roster/rosterImport')
      const preview = await previewRosterWorkbook(await file.arrayBuffer(), students)
      const result = await applyRosterImport(repository, selectedClassId, preview, 'skip')
      setDataRevision((value) => value + 1)
      setShowSettingsDialog(false)
      setStatus(`名单导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Excel 名单导入失败')
    }
  }

  function activateSeat(seatId: string, student?: StudentRecord): void {
    if (!seatId) return
    if (selectedStudentId && sessionRef.current) {
      sessionRef.current.update((current) => ({
        ...current,
        assignments: placeStudent(current.assignments, selectedStudentId, seatId),
      }))
      setSelectedStudentId(undefined)
      setStatus('座位已调整，草稿正在本地保存')
      return
    }
    if (student) setOpenStudent(student)
    else setStatus(studentPool.length > 0 ? '请先从右侧选择一名待安排学生' : '当前没有待安排学生')
  }

  function deskStudents(seatIds: string[]): Array<StudentRecord | undefined> {
    return seatIds.map((seatId) => studentsById.get(assignmentsBySeat.get(seatId) ?? ''))
  }

  async function publishSnapshot(): Promise<void> {
    if (!selectedClassId || !draft) return
    try {
      await sessionRef.current?.flush()
      const snapshot = await repository.publishSnapshot({
        classId: selectedClassId,
        title: `${new Date().toLocaleDateString('zh-CN')} 座位表`,
      })
      setSnapshots((current) => [snapshot, ...current])
      setStatus('当前座位表已保存为不可变历史版本')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '启用座位表失败')
    }
  }

  async function restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      await repository.restoreSnapshot(snapshotId)
      setDataRevision((value) => value + 1)
      setShowHistoryDialog(false)
      setStatus('历史版本已恢复为新的座位草稿，原历史记录保持不变')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '历史版本恢复失败')
    }
  }

  function openFirstWarningStudent(): void {
    const studentId = seatingWarnings[0]?.studentIds[0]
    const student = studentId ? studentsById.get(studentId) : undefined
    if (student) setOpenStudent(student)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><LayoutGrid size={20} aria-hidden="true" /></span>
          <span className="brand-copy"><strong>ClassPilot</strong><small>班级座位助手</small></span>
        </div>

        <button type="button" className="button-primary new-class" onClick={() => setShowCreateDialog(true)}><Plus size={17} aria-hidden="true" />新建班级</button>
        <p className="section-label">我的班级</p>
        <nav className="class-list" aria-label="班级列表">
          {classes.map((classroom) => {
            const isActive = selectedClassId === classroom.id
            return (
              <button type="button" key={classroom.id} aria-current={isActive ? 'page' : undefined} className={`class-item ${isActive ? 'is-active' : ''}`} onClick={() => { setSelectedClassId(classroom.id); setSelectedStudentId(undefined); setOpenStudent(null) }}>
                <span className="class-avatar" aria-hidden="true">{classroom.grade.slice(0, 2) || '班'}</span>
                <span className="class-item__copy"><strong>{classroom.name}</strong><small>{isActive ? `${students.length} 名学生` : classroom.academicYear || '本地班级'}</small></span>
                {isActive && <Check size={15} aria-label="当前班级" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />
        <nav className="sidebar-links" aria-label="辅助导航">
          <button type="button"><Archive size={17} aria-hidden="true" />已归档班级</button>
          <button type="button" onClick={() => setShowSettingsDialog(true)}><Settings size={17} aria-hidden="true" />设置与备份</button>
          <button type="button"><CircleHelp size={17} aria-hidden="true" />使用帮助</button>
        </nav>
        <div className="privacy-note">
          <CloudOff size={17} aria-hidden="true" />
          <span><strong>本地离线</strong><small>{status}</small></span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <button type="button" className="class-title">{selectedClass?.name ?? '尚未创建班级'}<ChevronDown size={18} aria-hidden="true" /></button>
            <p><span>{selectedClass?.academicYear || '—'} 学年</span><span className="save-status"><Check size={12} aria-hidden="true" />本地自动保存</span></p>
          </div>
          <div className="toolbar" aria-label="座位表工具">
            <button type="button" className="button-secondary" title={`共 ${snapshots.length} 个历史版本`} onClick={() => setShowHistoryDialog(true)}><History size={16} aria-hidden="true" />历史版本 {snapshots.length || ''}</button>
            <button type="button" className="button-secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />打印 / PDF</button>
            <button type="button" className="button-primary publish-button" disabled={!draft} onClick={() => void publishSnapshot()}><Sparkles size={16} aria-hidden="true" />启用此座位表</button>
          </div>
        </header>

        <div className="modebar">
          <ModeSwitch mode={mode} onChange={setMode} />
          <p>{selectedStudentId ? `已选择 ${studentsById.get(selectedStudentId)?.name ?? '学生'}，请点击目标座位` : mode === 'arrange' ? '选择待安排学生，再点击目标座位；点击已入座学生可查看档案。' : '拖动桌子并添加特殊座位'}</p>
          <div className="history-controls" aria-label="编辑历史">
            {mode === 'layout' && <button type="button" className="button-secondary add-special" onClick={addSpecialDesk}><Plus size={15} aria-hidden="true" />特殊座位</button>}
            <button type="button" className="icon-button" aria-label="撤销" disabled={!canUndo} onClick={() => sessionRef.current?.undo()}><Undo2 size={17} aria-hidden="true" /></button>
            <button type="button" className="icon-button" aria-label="重做" disabled={!canRedo} onClick={() => sessionRef.current?.redo()}><Redo2 size={17} aria-hidden="true" /></button>
          </div>
          <div className="zoom-control" aria-label="画布缩放">
            <button type="button" aria-label="缩小画布" onClick={() => setZoom((value) => Math.max(70, value - 10))} disabled={zoom === 70}><Minus size={15} aria-hidden="true" /></button>
            <button type="button" className="zoom-value" aria-label="重置为 100%" onClick={() => setZoom(100)}>{zoom}%</button>
            <button type="button" aria-label="放大画布" onClick={() => setZoom((value) => Math.min(110, value + 10))} disabled={zoom === 110}><Plus size={15} aria-hidden="true" /></button>
          </div>
        </div>

        <div className="content-area">
          <section className="canvas-column" aria-label="座位画布区">
            {seatingWarnings.length > 0 && <WarningNotice count={seatingWarnings.length} onOpen={openFirstWarningStudent} />}
            <div className="canvas-viewport" tabIndex={0} aria-label={`${selectedClass?.name ?? '未选择班级'} 座位表画布，当前缩放 ${zoom}%`}>
              {!selectedClass ? (
                <EmptyState title="先创建一个班级" description="所有数据只会保存在这台设备上。" action={<button type="button" className="button-primary" onClick={() => setShowCreateDialog(true)}>新建班级</button>} />
              ) : (
                <div className="classroom-stage-sizer" style={{ width: canvasWidth * canvasScale, height: canvasHeight * canvasScale, ...scaleStyle }}>
                  <section className={`classroom-stage mode-${mode}`} aria-label={`${selectedClass.name} 座位表`}>
                    <div className="classroom-front"><span>教室前方</span></div>
                    <div className="podium" aria-label="讲台"><span>讲 台</span><small>TEACHER</small></div>

                    {specialDesks.slice(0, 2).map((desk, index) => (
                      <ClassroomDesk key={desk.id} className={`special-desk special-desk-${index === 0 ? 'left' : 'right'}`} label={`S${index + 1}`} seatIds={desk.seatIds} capacity={desk.capacity} students={deskStudents(desk.seatIds)} editing={mode === 'layout'} onSeatActivate={activateSeat} />
                    ))}
                    <div className="desk-grid">
                      {regularDesks.map((desk, index) => <ClassroomDesk key={desk.id} label={`${String.fromCharCode(65 + Math.floor(index / 3))}${(index % 3) + 1}`} seatIds={desk.seatIds} capacity={desk.capacity} students={deskStudents(desk.seatIds)} editing={mode === 'layout'} onSeatActivate={activateSeat} />)}
                    </div>
                    <div className="classroom-back"><span>教室后方</span></div>
                    <div className="canvas-legend" aria-label="学生卡图例">
                      <span><i className="legend-swatch tone-male" />男生</span>
                      <span><i className="legend-swatch tone-female" />女生</span>
                      <span><i className="legend-swatch tone-unspecified" />未填写</span>
                      <small>卡片同时显示文字标签，颜色并非唯一提示</small>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </section>

          <aside className="unassigned-panel" aria-labelledby="unassigned-title">
            <header><div><strong id="unassigned-title">待安排学生</strong><span className="count-badge">{studentPool.length}</span></div><p>先选择学生，再点击目标座位</p></header>
            <label className="search-field">
              <Search size={16} aria-hidden="true" /><span className="sr-only">搜索待安排学生</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索姓名或学号" />
            </label>
            <div className="unassigned-list">
              {filteredStudents.map((student) => <StudentListCard key={student.id} student={student} selected={selectedStudentId === student.id} onSelect={(nextStudent) => setSelectedStudentId((current) => current === nextStudent.id ? undefined : nextStudent.id)} />)}
              {filteredStudents.length === 0 && <EmptyState title={students.length === 0 ? '尚未导入学生' : '没有匹配的学生'} description={students.length === 0 ? '可从设置与备份中导入虚构或正式名单。' : '换个姓名或学号试试。'} action={searchQuery ? <button type="button" className="text-button" onClick={() => setSearchQuery('')}>清除搜索</button> : undefined} />}
            </div>
            <footer><span>本地数据</span><small>请勿将真实学生资料提交到 GitHub</small></footer>
          </aside>
        </div>

        {openStudent && <ProfileDrawer student={openStudent} onClose={() => setOpenStudent(null)} />}
      </section>
      {showCreateDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreateDialog(false)
        }}>
          <section className="setup-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <header><div><span>班级初始化</span><strong id="setup-title">建立座位表</strong></div><button type="button" className="icon-button" aria-label="关闭" onClick={() => setShowCreateDialog(false)}>×</button></header>
            <form onSubmit={(event) => { event.preventDefault(); void createClass() }}>
              <label><span>班级名称</span><input autoFocus required value={newClassSetup.name} onChange={(event) => setNewClassSetup((current) => ({ ...current, name: event.target.value }))} placeholder="例如：初二（3）班" /></label>
              <div className="form-row">
                <label><span>年级</span><input value={newClassSetup.grade} onChange={(event) => setNewClassSetup((current) => ({ ...current, grade: event.target.value }))} placeholder="例如：八年级" /></label>
                <label><span>学年</span><input value={newClassSetup.academicYear} onChange={(event) => setNewClassSetup((current) => ({ ...current, academicYear: event.target.value }))} /></label>
              </div>
              <div className="form-row form-row-three">
                <label><span>座位排数</span><input type="number" min="1" max="10" value={newClassSetup.rows} onChange={(event) => setNewClassSetup((current) => ({ ...current, rows: Number(event.target.value) }))} /></label>
                <label><span>每排桌数</span><input type="number" min="1" max="8" value={newClassSetup.desksPerRow} onChange={(event) => setNewClassSetup((current) => ({ ...current, desksPerRow: Number(event.target.value) }))} /></label>
                <label><span>每桌人数</span><select value={newClassSetup.capacity} onChange={(event) => setNewClassSetup((current) => ({ ...current, capacity: Number(event.target.value) as 1 | 2 }))}><option value="2">两人一桌</option><option value="1">一人一桌</option></select></label>
              </div>
              <p className="dialog-note">将生成 {newClassSetup.rows * newClassSetup.desksPerRow * newClassSetup.capacity} 个座位；特殊座位可稍后在“编辑教室”中添加。</p>
              <footer><button type="button" className="button-secondary" onClick={() => setShowCreateDialog(false)}>取消</button><button type="submit" className="button-primary">创建班级</button></footer>
            </form>
          </section>
        </div>
      )}
      {showSettingsDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSettingsDialog(false)
        }}>
          <section className="setup-dialog transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
            <header><div><span>本地数据工具</span><strong id="transfer-title">名单与备份</strong></div><button type="button" className="icon-button" aria-label="关闭" onClick={() => setShowSettingsDialog(false)}>×</button></header>
            <div className="transfer-grid">
              <section><FileSpreadsheet size={21} aria-hidden="true" /><strong>导入 Excel 名单</strong><p>第一张工作表需包含“学号”和“姓名”。重复或异常行会安全跳过。</p><label className={`button-secondary file-button ${!selectedClassId ? 'is-disabled' : ''}`}>选择 .xlsx<input type="file" accept=".xlsx" disabled={!selectedClassId} onChange={(event) => void importRoster(event.target.files?.[0])} /></label></section>
              <section><Download size={21} aria-hidden="true" /><strong>导出完整备份</strong><p>包含所有班级、学生、草稿和历史版本，请像校务资料一样保管。</p><button type="button" className="button-secondary" onClick={() => void exportBackup()}>下载 .classpilot.json</button></section>
              <section><Upload size={21} aria-hidden="true" /><strong>恢复完整备份</strong><p>恢复会用备份内容替换本设备当前数据。请先导出一份现有备份。</p><label className="button-secondary file-button">选择备份<input type="file" accept=".json,.classpilot.json" onChange={(event) => void importBackup(event.target.files?.[0])} /></label></section>
            </div>
            <p className="privacy-warning">完整备份可能含联系电话和住址，请勿上传到公开网盘、Issue 或 GitHub。</p>
            <footer><button type="button" className="button-primary" onClick={() => setShowSettingsDialog(false)}>完成</button></footer>
          </section>
        </div>
      )}
      {showHistoryDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowHistoryDialog(false)
        }}>
          <section className="setup-dialog history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title">
            <header><div><span>{selectedClass?.name ?? '当前班级'}</span><strong id="history-title">座位历史版本</strong></div><button type="button" className="icon-button" aria-label="关闭" onClick={() => setShowHistoryDialog(false)}>×</button></header>
            <div className="history-list">
              {snapshots.map((snapshot) => (
                <article key={snapshot.id}>
                  <div><strong>{snapshot.title}</strong><span>{new Date(snapshot.effectiveAt).toLocaleString('zh-CN')} · {snapshot.layout.assignments.length} 名学生</span></div>
                  <button type="button" className="button-secondary" onClick={() => void restoreSnapshot(snapshot.id)}>恢复为草稿</button>
                </article>
              ))}
              {snapshots.length === 0 && <EmptyState title="还没有历史版本" description="点击“启用此座位表”后，会在这里保留一份不可变快照。" />}
            </div>
            <footer><button type="button" className="button-primary" onClick={() => setShowHistoryDialog(false)}>完成</button></footer>
          </section>
        </div>
      )}
      <PwaUpdatePrompt />
    </main>
  )
}

export default App

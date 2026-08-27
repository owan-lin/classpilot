import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ChevronDown,
  History,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { classRepository } from './data/repository'
import { getStudentPool, placeStudent } from './domain/seating'
import type {
  ClassRecord,
  ClassRepository,
  LayoutDraft,
  StudentRecord,
} from './domain/types'
import { createDefaultDraft } from './features/drafts/createDraft'
import { DraftSession } from './features/drafts/draftSession'
import { PwaUpdatePrompt } from './features/pwa/PwaUpdatePrompt'
import './App.css'

function StudentSeat({
  student,
  seatId,
  onPlace,
}: {
  student?: StudentRecord
  seatId: string
  onPlace(seatId: string): void
}) {
  if (!student) {
    return (
      <button className="seat seat-empty" aria-label="空座位" onClick={() => onPlace(seatId)}>
        <Plus size={16} />
      </button>
    )
  }

  return (
    <button className={`seat seat-${student.gender}`} title={`打开 ${student.name} 的档案`}>
      <span className="student-number">{student.studentNo}</span>
      <strong>{student.name}</strong>
      <span>{student.roles[0] ?? student.characterTags[0] ?? '学生'}</span>
    </button>
  )
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
  const [selectedStudentId, setSelectedStudentId] = useState<string>()
  const [snapshotCount, setSnapshotCount] = useState(0)
  const [status, setStatus] = useState('学生资料仅保存在此设备')
  const sessionRef = useRef<DraftSession | undefined>(undefined)

  useEffect(() => {
    let active = true
    repository
      .listClasses()
      .then((records) => {
        if (!active) return
        setClasses(records)
        setSelectedClassId((current) =>
          current && records.some(({ id }) => id === current) ? current : records[0]?.id,
        )
      })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : '无法读取本地班级')
      })
    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!selectedClassId) {
      return
    }

    let active = true
    let session: DraftSession | undefined
    Promise.all([
      repository.listStudents(selectedClassId),
      repository.getDraft(selectedClassId),
      repository.listSnapshots(selectedClassId),
    ])
      .then(async ([nextStudents, storedDraft, snapshots]) => {
        const nextDraft = storedDraft ?? createDefaultDraft(selectedClassId)
        if (!storedDraft) await repository.saveDraft(nextDraft)
        if (!active) return
        setStudents(nextStudents)
        setSnapshotCount(snapshots.length)
        session = new DraftSession(nextDraft, repository)
        sessionRef.current = session
        session.subscribe((history) => setDraft(structuredClone(history.present)))
      })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : '无法读取本地座位草稿')
      })

    return () => {
      active = false
      if (session && sessionRef.current === session) sessionRef.current = undefined
      void session?.dispose().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : '草稿自动保存失败')
      })
    }
  }, [repository, selectedClassId])

  const selectedClass = classes.find(({ id }) => id === selectedClassId)
  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  )
  const assignmentsBySeat = useMemo(
    () => new Map(draft?.assignments.map((assignment) => [assignment.seatId, assignment.studentId]) ?? []),
    [draft],
  )
  const studentPool = useMemo(
    () => getStudentPool(students, draft?.assignments ?? []),
    [draft, students],
  )

  async function createClass(): Promise<void> {
    try {
      const classroom = await repository.createClass({
        name: `新班级 ${classes.length + 1}`,
        grade: '',
        academicYear: currentAcademicYear(),
      })
      setClasses((current) => [...current, classroom])
      setSelectedClassId(classroom.id)
      setStatus('班级已创建，可继续导入学生名单')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '新建班级失败')
    }
  }

  function placeSelectedStudent(seatId: string): void {
    const studentId = selectedStudentId ?? studentPool[0]?.id
    if (!studentId || !sessionRef.current) return
    sessionRef.current.update((current) => ({
      ...current,
      assignments: placeStudent(current.assignments, studentId, seatId),
    }))
    setSelectedStudentId(undefined)
    setStatus('座位草稿将在本地自动保存')
  }

  async function publishSnapshot(): Promise<void> {
    if (!selectedClassId || !draft) return
    try {
      await sessionRef.current?.flush()
      await repository.publishSnapshot({
        classId: selectedClassId,
        title: `${new Date().toLocaleDateString('zh-CN')} 座位表`,
      })
      setSnapshotCount((count) => count + 1)
      setStatus('当前座位表已保存为不可变历史版本')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '启用座位表失败')
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><LayoutGrid size={21} /></span>
          <div><strong>ClassPilot</strong><small>班级座位助手</small></div>
        </div>

        <button className="new-class" onClick={() => void createClass()}><Plus size={17} /> 新建班级</button>
        <p className="section-label">我的班级</p>
        <nav aria-label="班级列表">
          {classes.map((classroom) => (
            <button
              key={classroom.id}
              className={`class-item ${selectedClassId === classroom.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedClassId(classroom.id)
                setSelectedStudentId(undefined)
              }}
            >
              <span><Users size={17} />{classroom.name}</span>
              <small>{selectedClassId === classroom.id ? `${students.length} 名学生` : classroom.academicYear || '本地班级'}</small>
            </button>
          ))}
          {classes.length === 0 && <p className="empty-classes">尚无班级，请先新建班级</p>}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-link"><Archive size={17} /> 已归档班级</button>
        <button className="sidebar-link"><Settings size={17} /> 设置与备份</button>
        <div className="privacy-note"><span>本地离线</span><small>{status}</small></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <button className="class-title">{selectedClass?.name ?? '未选择班级'}<ChevronDown size={18} /></button>
            <p>{selectedClass?.academicYear || '—'} 学年 · 座位草稿已自动保存</p>
          </div>
          <div className="toolbar">
            <button className="secondary" title={`共 ${snapshotCount} 个历史版本`}><History size={17} /> 历史版本</button>
            <button className="publish" disabled={!draft} onClick={() => void publishSnapshot()}><Sparkles size={17} /> 启用此座位表</button>
          </div>
        </header>

        <div className="modebar">
          <div className="segmented" role="group" aria-label="编辑模式">
            <button className={mode === 'arrange' ? 'selected' : ''} onClick={() => setMode('arrange')}>安排学生</button>
            <button className={mode === 'layout' ? 'selected' : ''} onClick={() => setMode('layout')}>编辑教室</button>
          </div>
          <span>{mode === 'arrange' ? '选择待安排学生，再点击空座位' : '拖动桌子并添加特殊座位'}</span>
          <div className="zoom"><button>−</button><span>90%</span><button>＋</button></div>
        </div>

        <div className="canvas-wrap">
          <section className="classroom" aria-label={`${selectedClass?.name ?? '未选择班级'} 座位表`}>
            <div className="front-label">教室前方</div>
            <div className="podium"><span>讲 台</span><small>TEACHER</small></div>
            <div className="seat-grid">
              {draft?.desks.map((desk) => (
                <div className="desk" key={desk.id}>
                  {desk.seatIds.map((seatId) => (
                    <StudentSeat
                      key={seatId}
                      seatId={seatId}
                      student={studentsById.get(assignmentsBySeat.get(seatId) ?? '')}
                      onPlace={placeSelectedStudent}
                    />
                  ))}
                  {desk.capacity === 2 && <span className="desk-divider" />}
                </div>
              ))}
            </div>
            <button className="special-seat special-left"><Plus size={15} /> 特殊座位</button>
            <button className="special-seat special-right"><Plus size={15} /> 特殊座位</button>
          </section>

          <aside className="unassigned-panel">
            <div><strong>待安排学生</strong><span>{studentPool.length}</span></div>
            <p>先选择学生，再点击空座位</p>
            <label><span aria-hidden="true">⌕</span><input placeholder="搜索学生" /></label>
            {studentPool.map((student) => (
              <button
                className={`student-list-item ${student.gender} ${selectedStudentId === student.id ? 'selected' : ''}`}
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
              >
                <span>{student.name.slice(0, 1)}</span><strong>{student.name}</strong><small>{student.studentNo}号</small>
              </button>
            ))}
            {selectedClass && studentPool.length === 0 && <p className="student-empty">所有学生都已安排，或尚未导入名单。</p>}
          </aside>
        </div>
      </section>
      <PwaUpdatePrompt />
    </main>
  )
}

export default App

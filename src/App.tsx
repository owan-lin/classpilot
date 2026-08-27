import { useMemo, useState } from 'react'
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
import type { StudentRecord } from './domain/types'
import './App.css'

const students: StudentRecord[] = [
  { id: 'student-01', classId: 'class-01', studentNo: '01', name: '林晓雨', gender: 'female', roles: ['语文课代表'], performanceLevel: 'excellent', rank: 3, characterTags: ['细心'], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'none', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
  { id: 'student-02', classId: 'class-01', studentNo: '02', name: '周宇航', gender: 'male', roles: ['班长'], performanceLevel: 'good', rank: 8, characterTags: ['活跃'], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'none', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
  { id: 'student-03', classId: 'class-01', studentNo: '03', name: '陈思远', gender: 'male', roles: [], performanceLevel: 'average', characterTags: ['安静'], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'preferred', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
  { id: 'student-04', classId: 'class-01', studentNo: '04', name: '苏可欣', gender: 'female', roles: [], performanceLevel: 'good', characterTags: ['耐心'], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'none', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
  { id: 'student-05', classId: 'class-01', studentNo: '05', name: '许嘉乐', gender: 'unspecified', roles: [], performanceLevel: 'needs_support', characterTags: [], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'required', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
  { id: 'student-06', classId: 'class-01', studentNo: '06', name: '沈安然', gender: 'female', roles: [], performanceLevel: 'excellent', characterTags: [], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'none', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false, createdAt: '', updatedAt: '' },
]

const deskPairs = [
  [students[0], students[1]],
  [students[2], students[3]],
  [students[4], students[5]],
  [undefined, undefined],
  [undefined, undefined],
  [undefined, undefined],
]

function StudentSeat({ student }: { student?: StudentRecord }) {
  if (!student) {
    return <button className="seat seat-empty" aria-label="空座位"><Plus size={16} /></button>
  }

  return (
    <button className={`seat seat-${student.gender}`} title={`打开 ${student.name} 的档案`}>
      <span className="student-number">{student.studentNo}</span>
      <strong>{student.name}</strong>
      <span>{student.roles[0] ?? student.characterTags[0] ?? '学生'}</span>
    </button>
  )
}

function App() {
  const [mode, setMode] = useState<'arrange' | 'layout'>('arrange')
  const [selectedClass, setSelectedClass] = useState('初二（3）班')
  const classes = useMemo(() => ['初二（3）班', '初一（5）班'], [])

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><LayoutGrid size={21} /></span>
          <div><strong>ClassPilot</strong><small>班级座位助手</small></div>
        </div>

        <button className="new-class"><Plus size={17} /> 新建班级</button>
        <p className="section-label">我的班级</p>
        <nav aria-label="班级列表">
          {classes.map((className) => (
            <button
              key={className}
              className={`class-item ${selectedClass === className ? 'active' : ''}`}
              onClick={() => setSelectedClass(className)}
            >
              <span><Users size={17} />{className}</span>
              <small>{className === '初二（3）班' ? '42 名学生' : '39 名学生'}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-link"><Archive size={17} /> 已归档班级</button>
        <button className="sidebar-link"><Settings size={17} /> 设置与备份</button>
        <div className="privacy-note"><span>本地离线</span><small>学生资料仅保存在此设备</small></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <button className="class-title">{selectedClass}<ChevronDown size={18} /></button>
            <p>2026–2027 学年 · 座位草稿已自动保存</p>
          </div>
          <div className="toolbar">
            <button className="secondary"><History size={17} /> 历史版本</button>
            <button className="publish"><Sparkles size={17} /> 启用此座位表</button>
          </div>
        </header>

        <div className="modebar">
          <div className="segmented" role="group" aria-label="编辑模式">
            <button className={mode === 'arrange' ? 'selected' : ''} onClick={() => setMode('arrange')}>安排学生</button>
            <button className={mode === 'layout' ? 'selected' : ''} onClick={() => setMode('layout')}>编辑教室</button>
          </div>
          <span>{mode === 'arrange' ? '拖动学生即可换座或交换位置' : '拖动桌子并添加特殊座位'}</span>
          <div className="zoom"><button>−</button><span>90%</span><button>＋</button></div>
        </div>

        <div className="canvas-wrap">
          <section className="classroom" aria-label={`${selectedClass} 座位表`}>
            <div className="front-label">教室前方</div>
            <div className="podium"><span>讲 台</span><small>TEACHER</small></div>
            <div className="seat-grid">
              {deskPairs.map((pair, index) => (
                <div className="desk" key={index}>
                  <StudentSeat student={pair[0]} />
                  <span className="desk-divider" />
                  <StudentSeat student={pair[1]} />
                </div>
              ))}
            </div>
            <button className="special-seat special-left"><Plus size={15} /> 特殊座位</button>
            <button className="special-seat special-right"><Plus size={15} /> 特殊座位</button>
          </section>

          <aside className="unassigned-panel">
            <div><strong>待安排学生</strong><span>36</span></div>
            <p>从这里拖入座位</p>
            <label><span aria-hidden="true">⌕</span><input placeholder="搜索学生" /></label>
            {['方子墨', '宋依然', '叶星辰', '唐嘉懿'].map((name, index) => (
              <button className={`student-list-item ${index % 2 ? 'female' : 'male'}`} key={name}>
                <span>{name.slice(0, 1)}</span><strong>{name}</strong><small>{String(index + 7).padStart(2, '0')}号</small>
              </button>
            ))}
          </aside>
        </div>
      </section>
    </main>
  )
}

export default App

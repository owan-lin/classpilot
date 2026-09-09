# ClassPilot · 班级座位助手

ClassPilot 是一款离线优先的班级座位工作台，当前版本专注于四个核心流程：新建班级、编辑教室、录入学生和查看学生档案。班级数据默认只保存在当前设备。

> 本分支版本：v0.4.0。正式版本以发布页为准；仓库、测试和示例只使用虚构学生数据。

## 立即使用

- [打开网页版 PWA](https://owan-lin.github.io/classpilot/)
- [下载最新版 Windows 安装包](https://github.com/owan-lin/classpilot/releases/latest)
- [查看公开源代码](https://github.com/owan-lin/classpilot)

网页版可以安装到桌面，并在首次成功加载后离线使用。Windows 版与网页版的数据彼此独立。

## 当前核心功能

- 点击“新建班级”，立即建立一个本地班级工作区。
- 在“编辑教室”画布中添加或删除普通座位、特殊座位。
- 使用“对齐模式”快速整理座位，或使用“自由移动”拖动课桌调整布局。
- 在“录入学生”中手动连续添加学生；姓名必填，学号可留空且会校验重复学号。
- 在“排座 / 移位”中点击学生和目标座位，或直接拖动学生完成入座、移位和交换。
- 点击已入座学生或学生列表即可查看档案，并进行基础编辑或删除。
- 手动录入成绩，并查看基础百分比趋势；CSV 成绩导入仍处于预览阶段。

## 暂未开放

Excel 名单导入、历史版本、完整备份、打印 / PDF 导出等扩展功能目前暂未开放，核心流程不依赖这些功能。

## 隐私

ClassPilot 不要求云端账号，学生数据保存在当前浏览器或桌面应用的本地存储中，不会自动上传到 GitHub。请勿在 Issue、截图、测试数据或提交中使用真实学生信息；示例名称、学号和班级均为虚构数据。

## 使用方法

1. 点击“新建班级”，填写班级名称并开始。
2. 在“编辑教室”中添加或删除座位；选择“对齐模式”整理布局，或选择“自由移动”拖动课桌。
3. 在“录入学生”中手动添加学生，姓名必填，学号可留空。
4. 点击“排座 / 移位”，将待安排学生拖到座位，或先点击学生再点击目标座位。
5. 点击学生卡片查看档案，必要时编辑或删除基础信息。

## 本地开发

需要 Node.js 24+。桌面版另需 Rust、Microsoft C++ Build Tools 和 WebView2。

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run acceptance
```

Windows 桌面开发：

```bash
npm run desktop:dev
npm run desktop:build
```

## 发布

- `main` 只运行检查，不直接改变正式网页版。
- 同一个 `v*` 标签执行统一流水线：全量验收 → Windows 构建与启动检查 → 暂存安装包 → 部署网页 → 公开桌面下载。任一前置检查失败，两端都不会发布。
- 网页 `build-info.json` 与安装包旁的 `windows-build-info.json` 标明版本和提交；`SHA256SUMS.txt` 用于校验下载文件。
- 网页部署与 Release 公开是两个平台操作，无法做到原子切换。若最后一步失败，安装包保留在草稿中，由维护者恢复同次流水线；不得另发不同提交的单端版本。
- [最新版发布页](https://github.com/owan-lin/classpilot/releases/latest)始终提供当前公开桌面版本。

架构边界、数据兼容策略与验收范围见 [架构说明](docs/ARCHITECTURE.md) 和 [验收记录](docs/ACCEPTANCE-v0.4.md)。桌面版不自动替换已下载的旧 EXE；更新时请从发布页下载同版程序，无需清除本地数据。

## English

ClassPilot is an offline-first classroom workspace focused on four core flows: create a class, edit a classroom canvas, enter students manually, and view student profiles. The current release supports aligned or free-form desk movement and click-or-drag seating interactions.

The v0.4 branch separates application lifecycle, interactions, presentation, domain rules and persistence. Strict TypeScript, dependency-boundary checks, unit/property tests, browser workflows and a real offline reload test form the acceptance gate. Web and Windows releases are built from the same commit.

Excel roster import, history, full backup, and print/PDF export are not currently exposed. Browser and Windows storage remain separate; there is no cloud sync or backup exchange UI yet. Do not clear application data when updating.

No real student data belongs in this repository. Classroom records remain on the teacher's device by default.

## License

[MIT](LICENSE) © 2026 Owan Lin

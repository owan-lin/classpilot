# ClassPilot · 班级座位助手

ClassPilot 是一款离线优先的班级座位工作台，当前版本专注于四个核心流程：新建班级、编辑教室、录入学生和查看学生档案。班级数据默认只保存在当前设备。

> 当前版本：v0.2.0。仓库、测试和示例只使用虚构学生数据。

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

## 暂未开放

Excel 名单导入、历史版本、完整备份、打印 / PDF 导出等扩展功能目前暂未开放，界面不会要求用户依赖这些功能完成核心流程。

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
```

Windows 桌面开发：

```bash
npm run desktop:dev
npm run desktop:build
```

## 发布

- `main` 通过 GitHub Actions 部署网页版。
- `v*` 标签触发 Windows 构建并创建 GitHub Release。
- [最新版发布页](https://github.com/owan-lin/classpilot/releases/latest)始终提供当前公开桌面版本。

## English

ClassPilot is an offline-first classroom workspace focused on four core flows: create a class, edit a classroom canvas, enter students manually, and view student profiles. The current release supports aligned or free-form desk movement and click-or-drag seating interactions.

Excel roster import, history, full backup, and print/PDF export are not available in v0.2.0. Use the [web PWA](https://owan-lin.github.io/classpilot/), download the [latest Windows release](https://github.com/owan-lin/classpilot/releases/latest), or browse the [source repository](https://github.com/owan-lin/classpilot).

No real student data belongs in this repository. Classroom records remain on the teacher's device by default.

## License

[MIT](LICENSE) © 2026 Owan Lin

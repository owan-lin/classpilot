# ClassPilot · 班级座位助手

ClassPilot 是一款为班主任设计的离线优先班级座位管理工具。它以可拖动的俯视座位表为核心，同时提供学生基础档案、座位历史、Excel 名单导入和本地备份。

> 当前状态：v0.1 开发中。仓库内只使用虚构学生数据。

## 产品目标

- 根据排数、每排桌数以及单双人桌快速建立教室。
- 自由添加讲台两侧等特殊座位，并通过拖放调换学生。
- 管理多个班级和学生的教学相关档案。
- 将座位草稿正式启用为带日期的历史版本。
- 同一套代码同时产出离线 PWA 和 Windows 桌面应用。

## 隐私

ClassPilot v1 不设服务器。学生数据保存在当前浏览器或桌面应用的本地数据库中，不会被同步到 GitHub。完整备份可能包含联系电话和住址，必须像其他敏感校务资料一样妥善保存。

请勿在 Issue、截图、测试或提交中使用真实学生信息。

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
- `v*` 标签触发 Windows 安装包构建并创建 GitHub Release。
- 网页版和桌面版通过 `.classpilot.json` 备份文件手动迁移数据。

## English

ClassPilot is an offline-first classroom seating manager for teachers. It combines a flexible top-down seating canvas with student profiles, immutable seating history, Excel roster import, local backups, an installable PWA, and a Windows desktop build powered by the same React codebase.

No real student data belongs in this repository. Classroom records remain on the teacher's device in v1.

## License

[MIT](LICENSE) © 2026 Owan Lin

# ClassPilot · 班级座位助手

ClassPilot 是一款为班主任设计的离线优先班级座位管理工具。它以可拖动的俯视座位表为核心，同时提供学生基础档案、座位历史、Excel 名单导入和本地备份。

> 当前状态：v0.1。仓库内只使用虚构学生数据。

## 立即使用

- [打开网页版 PWA](https://owan-lin.github.io/classpilot/)
- [下载最新版 Windows 安装包](https://github.com/owan-lin/classpilot/releases/latest)
- [查看公开源代码](https://github.com/owan-lin/classpilot)

网页版可以安装到桌面并在首次成功加载后离线使用。Windows 版和网页版的数据彼此独立，需要通过 `.classpilot.json` 完整备份手动迁移。

## 产品目标

- 根据排数、每排桌数以及单双人桌快速建立教室。
- 自由添加讲台两侧等特殊座位，通过选择学生并点击目标座位完成移动或交换。
- 管理多个班级和学生的教学相关档案。
- 将座位草稿正式启用为带日期的历史版本。
- 同一套代码同时产出离线 PWA 和 Windows 桌面应用。

## 隐私

ClassPilot v1 不设服务器。学生数据保存在当前浏览器或桌面应用的本地数据库中，不会被同步到 GitHub。完整备份可能包含联系电话和住址，必须像其他敏感校务资料一样妥善保存。

请勿在 Issue、截图、测试或提交中使用真实学生信息。

## 使用方法

1. 点击“新建班级”，填写班级名称、座位排数、每排桌数以及单双人桌。
2. 在“设置与备份”中导入 `.xlsx` 名单；第一张工作表至少包含“学号”和“姓名”两列。
3. 从右侧选择待安排学生，再点击目标座位。点击已入座学生可以查看档案并发起座位调整。
4. 在“编辑教室”中添加特殊单人座位；使用撤销/重做修正操作。
5. 点击“启用此座位表”保存不可变历史版本；历史版本可恢复为新的草稿。
6. 使用“打印 / PDF”输出 A4 横向座位表。

## 备份与迁移

在“设置与备份”中点击“下载 `.classpilot.json`”获得完整备份。恢复前建议先导出当前设备的数据；恢复操作会用备份内容替换当前本地数据。备份可能包含联系电话、住址和课堂备注，请保存到受保护的位置，不要上传到公开仓库、公开网盘或 Issue。

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

Use the [PWA](https://owan-lin.github.io/classpilot/), download the [latest Windows release](https://github.com/owan-lin/classpilot/releases/latest), or browse the [source repository](https://github.com/owan-lin/classpilot).

No real student data belongs in this repository. Classroom records remain on the teacher's device in v1.

## License

[MIT](LICENSE) © 2026 Owan Lin

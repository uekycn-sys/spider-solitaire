# 蜘蛛纸牌 · Spider Solitaire

一款基于 **React + TypeScript + Vite + Tailwind CSS + Framer Motion** 打造的商业级网页版「蜘蛛纸牌（Spider Solitaire）」。纯矢量绘制扑克牌面与牌背、程序化 Web Audio 音效合成、自带多维度智能提示与 Web Worker 后台束搜索求解器，并已配置 GitHub Pages 自动化部署工作流。

## 界面预览

> 📸 *部署或本地运行后，可将牌桌实战与求解器演示截图放置于此处。*

| 桌面端经典绿绒牌桌 | 求解器演示与金色落点预览 |
| :---: | :---: |
| ![桌面端预览占位](https://placehold.co/640x360/10442a/f3c950?text=Spider+Solitaire+Desktop) | ![求解器预览占位](https://placehold.co/640x360/0a140f/f3c950?text=AI+Solver+%26+Gold+Hint) |

## 核心特性

- **经典赌场质感 UI**：经典绿绒（以及午夜深蓝、皇家酒红）径向渐变 + 噪点纹理 + 四周暗角 vignette；深黑金边顶部 HUD 与可一键折叠的半透明底部操作栏。
- **零外部图片断链**：纯代码高精度 SVG 扑克牌（大号顶部角标、A–10 点阵、复古双头 J/Q/K 人头牌）与复古雕花牌背，任意分辨率与 Retina 屏下依然锐利。
- **动态 10 列布局压缩**：通过 `ResizeObserver` 实时测量牌桌高度，牌堆过长时自动平滑压缩重叠间距，保证任何情况下都不溢出屏幕底部。
- **丝滑交互与智能单击**：支持鼠标与触屏 60fps 拖拽、磁吸列吸附、智能单击自动飞往最佳落点（同花色 > 异花色 > 空列），以及 K→A 完整顺子 13 张连贯弧线自动收牌动画。
- **智能提示 & Web Worker 求解器**：
  - `提示`：2-ply 启发式评估并高亮源牌与深色金色虚线落点轮廓。
  - `求解器`：在后台 Web Worker 中运行束搜索（Beam Search + 规范化状态哈希去重），顶部切换金色钥匙横幅并按 350ms 预览节奏自动演示，支持随时 `||` 暂停与人工接管。
- **Web Audio 合成音效 & 自动存档**：程序化合成洗牌、发牌、翻牌、落牌、提示与收牌胜利音效；`localStorage` 自动断点续玩及各难度胜率/最高分/最少步数/最佳用时统计。
- **快捷键**：`Ctrl/Cmd + Z` 撤销、`H` 提示、`Space` 发牌、`F` 全屏。

## 架构设计

```text
src/
├── core/         # 纯 TypeScript 游戏核心（状态机、规则引擎、发牌器、启发式评估与 Beam Search 求解器）
├── audio/        # Web Audio API 程序化音效合成器
├── storage/      # localStorage 牌局快照、统计数据与外观偏好持久化
└── ui/           # React 视图组件、SVG 牌面、Pointer 拖拽与 Framer Motion 动效
```

## 本地运行与测试

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 运行核心规则与求解器单元测试
npm test

# TypeScript 类型检查与生产构建
npm run build
```

## GitHub Pages 自动部署配置

项目已内置 `.github/workflows/deploy.yml` 与 `vite.config.ts`（`base: './'` 适配任意仓库子路径）：

1. 将本项目代码推送到 GitHub 仓库的 `main` 分支。
2. 打开仓库页面，进入 **Settings → Pages**。
3. 在 **Build and deployment → Source** 下拉框中选择 **GitHub Actions**。
4. 每次推送到 `main` 分支（或手动触发 `workflow_dispatch`）时，GitHub Actions 将自动运行 `npm test` 与 `npm run build`，并将 `dist/` 部署上线。

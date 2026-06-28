# EPUB 液态玻璃灵动岛 - Code Wiki

## 目录
- [项目概述](#项目概述)
- [整体架构](#整体架构)
- [主要模块职责](#主要模块职责)
- [关键变量与状态说明](#关键变量与状态说明)
- [核心函数详解](#核心函数详解)
- [CSS 样式体系](#css-样式体系)
- [交互流程](#交互流程)
- [依赖关系](#依赖关系)
- [项目运行方式](#项目运行方式)
- [预留扩展点](#预留扩展点)

---

## 项目概述

**项目名称**: EPUB - 液态玻璃灵动岛

**项目类型**: 单文件前端 Web 应用

**核心功能**:
- 具有液态玻璃拟物化设计风格的小说搜索界面
- 类 iPhone 灵动岛（Dynamic Island）交互动效
- 环境光色调实时调节（色相、深度）
- 小说搜索模拟与状态反馈
- 全响应式移动端适配

**技术栈**:
- 纯 HTML5 + 原生 JavaScript（无框架）
- Tailwind CSS（CDN 引入）
- CSS @property 高级动画属性
- CSS backdrop-filter 毛玻璃效果

---

## 整体架构

项目采用单文件架构，所有代码集中在 [index.html](file:///workspace/index.html) 中，按功能划分为三大层次：

```
index.html
├── <head> 样式层
│   ├── Tailwind CSS CDN 引入
│   ├── @property CSS 变量注册
│   ├── 全局背景样式
│   ├── 液态玻璃基础类 (.glass-element)
│   ├── 灵动岛专属样式
│   ├── 滑块自定义样式
│   └── 动画关键帧定义
│
├── <body> 结构层
│   ├── 顶部：灵动岛区域 (#island)
│   │   ├── 状态A：胶囊收缩态 (#island-collapsed)
│   │   ├── 状态B：环境光调节面板 (#island-expanded)
│   │   └── 状态C：搜索状态面板 (#island-search-status)
│   ├── 中部：大标题区域 (EPUB)
│   └── 底部：搜索框区域 (.search-glass)
│
└── <script> 逻辑层
    ├── DOM 元素引用缓存
    ├── 全局状态变量
    ├── 长按交互控制系统
    ├── 滑块事件监听
    ├── 搜索触发与进度模拟
    ├── 灵动岛状态切换
    └── 窗口 resize 适配
```

---

## 主要模块职责

### 1. 灵动岛交互模块

**核心元素**: `#island`

**职责**: 实现类似 iPhone 灵动岛的展开/折叠交互，支持多种状态面板切换。

**状态列表**:
| 状态名称 | 对应 DOM | 触发方式 | 说明 |
|---------|---------|---------|------|
| 收缩态（胶囊） | `#island-collapsed` | 默认 / 点击折叠 | 显示系统状态指示灯 |
| 环境光调节态 | `#island-expanded` | 长按展开 | 色相与深度滑块调节 |
| 搜索进度态 | `#island-search-status` | 点击搜索按钮 | 显示搜索进度与结果 |

---

### 2. 环境光调节模块

**核心元素**: `#hue-slider`, `#depth-slider`

**职责**: 通过滑块实时调节页面背景渐变光效的色相与深度。

**调节参数**:
- **色相 (Hue)**: 范围 0-360，控制背景主色调
- **深度 (Depth)**: 范围 5-80，同时控制不透明度与渐变半径

---

### 3. 小说搜索模块

**核心元素**: `#search-input`, `#search-btn`

**职责**: 模拟小说搜索全流程，与灵动岛深度联动展示搜索状态。

**搜索结果分支**:
- **成功流程**: 关键词有效 → 进度到 100% → 显示成功状态 → 3.5秒后自动折叠
- **失败流程**: 空关键词 / 含"无/没有/error" → 进度卡在 55% → 显示失败状态 → 3.5秒后自动折叠

---

### 4. 视觉动效模块

**职责**: 提供液态玻璃质感、呼吸灯、流光进度条等高级视觉效果。

**关键动效**:
- 呼吸灯动画 (`liquid-pulse`)
- 流光加载动画 (`shimmer`)
- CSS 变量过渡动画
- 微缩按压反馈

---

## 关键变量与状态说明

### 全局状态变量

| 变量名 | 类型 | 初始值 | 说明 |
|-------|------|-------|------|
| `isExpanded` | `boolean` | `false` | 灵动岛是否处于展开状态 |
| `isSearching` | `boolean` | `false` | 是否处于搜索状态（锁，防止重复触发） |
| `searchTimer` | `number/null` | `null` | 搜索进度定时器引用 |
| `pressTimer` | `number/null` | `null` | 长按检测定时器引用 |
| `hasTriggeredLongPress` | `boolean` | `false` | 是否已触发长按（区分点击与长按） |

### 常量配置

| 常量名 | 值 | 说明 |
|-------|----|------|
| `longPressDuration` | `500` | 长按触发阈值（毫秒） |
| 展开最大宽度 | `350px` | 灵动岛展开时的最大宽度 |
| 展开高度 | `115px` | 灵动岛展开时的固定高度 |

---

## 核心函数详解

### 1. `startPress(e)`

**位置**: [index.html#L298-L310](file:///workspace/index.html#L298-L310)

**功能**: 处理按压开始事件，启动长按检测计时器。

**执行流程**:
1. 若已展开则直接返回
2. 重置 `hasTriggeredLongPress` 标志
3. 岛体微缩至 0.95 倍（按压反馈）
4. 设置 500ms 定时器，超时后触发展开

**参数**:
- `e`: 鼠标/触摸事件对象

---

### 2. `cancelPress(e)`

**位置**: [index.html#L312-L320](file:///workspace/index.html#L312-L320)

**功能**: 取消按压，清除定时器，还原岛体缩放。

**触发时机**: mouseup、mouseleave、touchend、touchmove

---

### 3. `toggleIsland(event, expand)`

**位置**: [index.html#L541-L572](file:///workspace/index.html#L541-L572)

**功能**: 灵动岛展开/折叠的核心控制函数。

**参数**:
- `event`: 事件对象（可选，用于阻止冒泡）
- `expand`: `boolean`，`true` 展开，`false` 折叠

**展开逻辑**:
- 根据 `isSearching` 状态决定打开搜索面板还是环境光面板

**折叠逻辑**:
1. 所有面板淡出（180ms）
2. 隐藏面板，显示胶囊内容
3. 还原尺寸（160px × 40px，30px 圆角）
4. 500ms 后恢复呼吸动画（非搜索状态）

---

### 4. `openIslandToState(state)`

**位置**: [index.html#L503-L531](file:///workspace/index.html#L503-L531)

**功能**: 将灵动岛强制展开到指定状态面板。

**参数**:
- `state`: `'search'` 搜索态 或 `'ambient'` 调色盘态

**关键计算**:
```javascript
const targetWidth = Math.min(350, window.innerWidth - 32);
```
确保在移动端不超出屏幕宽度，两侧各留 16px 边距。

---

### 5. `triggerNovelSearch(keyword)`

**位置**: [index.html#L385-L491](file:///workspace/index.html#L385-L491)

**功能**: 小说搜索触发与进度模拟的核心函数。

**参数**:
- `keyword`: 搜索关键词字符串

**执行步骤**:
1. 搜索锁检查，防止重复触发
2. 初始化胶囊状态为 "SEARCHING..."
3. 初始化搜索面板内容与进度条
4. 展开灵动岛到搜索状态
5. 启动 300ms 间隔的进度模拟定时器
6. 根据 `hasNoBookSource` 分支走成功或失败流程

**失败判定条件**:
```javascript
const hasNoBookSource = !keyword || keyword.includes("无") || keyword.includes("没有") || keyword.includes("error");
```

**进度增长算法**:
```javascript
progress += Math.floor(Math.random() * 15) + 6;
// 每次增长 6-20 之间的随机值
```

---

### 6. `resetIslandToIdle(delay)`

**位置**: [index.html#L494-L500](file:///workspace/index.html#L494-L500)

**功能**: 延迟重置灵动岛胶囊状态为 "System Active"。

**参数**:
- `delay`: 延迟毫秒数

---

### 7. 滑块事件处理

#### 色相滑块
**位置**: [index.html#L355-L357](file:///workspace/index.html#L355-L357)
```javascript
hueSlider.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--glow-hue', e.target.value);
});
```
直接将滑块值写入 CSS 变量 `--glow-hue`。

#### 深度滑块
**位置**: [index.html#L360-L367](file:///workspace/index.html#L360-L367)
```javascript
const depthVal = rawVal / 100;           // 0.05 - 0.8
const sizeVal = 30 + (rawVal * 0.45);    // 32.25% - 66%
```
同时控制两个 CSS 变量，实现深度与范围的联动。

---

## CSS 样式体系

### 1. 自定义 CSS 属性（@property）

**位置**: [index.html#L12-L26](file:///workspace/index.html#L12-L26)

通过 `@property` 注册的 CSS 变量可直接参与 `transition` 动画：

| 变量名 | 类型 | 初始值 | 作用 |
|-------|------|-------|------|
| `--glow-hue` | `<number>` | `220` | 背景主色调色相 |
| `--glow-depth` | `<number>` | `0.25` | 背景渐变不透明度 |
| `--glow-size` | `<percentage>` | `50%` | 背景渐变半径 |

---

### 2. 液态玻璃基础类 `.glass-element`

**位置**: [index.html#L47-L58](file:///workspace/index.html#L47-L58)

核心构成：
- **半透明白底**: `rgba(255, 255, 255, 0.04)`
- **毛玻璃**: `backdrop-filter: blur(25px) saturate(190%)`
- **细边框**: `1px solid rgba(255, 255, 255, 0.12)`
- **多层阴影**: 外阴影 + 内高光 + 内阴影
- **缓动曲线**: `cubic-bezier(0.16, 1, 0.3, 1)`

---

### 3. 灵动岛专属样式 `.dynamic-island`

**位置**: [index.html#L61-L67](file:///workspace/index.html#L61-L67)

在基础玻璃效果上增加：
- 更强的外阴影（更深的投影）
- 蓝色发光外晕
- 更亮的内高光
- 文字阴影增强可读性

---

### 4. 动画关键帧

#### 呼吸灯 `liquid-pulse`
**位置**: [index.html#L70-L80](file:///workspace/index.html#L70-L80)
- 周期: 4秒
- 效果: 蓝色 ↔ 粉色 光晕呼吸

#### 流光 `shimmer`
**位置**: [index.html#L120-L136](file:///workspace/index.html#L120-L136)
- 周期: 1.5秒
- 效果: 白色高光从左扫到右
- 应用: 搜索进度条的流光效果

---

### 5. 搜索框聚焦态 `.search-glass:focus-within`

**位置**: [index.html#L83-L91](file:///workspace/index.html#L83-L91)

聚焦时的视觉增强：
- 蓝色边框高亮
- 背景透明度提升
- 蓝色发光外晕
- 轻微放大（1.015倍）

---

## 交互流程

### 1. 长按展开环境光面板

```
用户长按灵动岛 (≥500ms)
    ↓
岛体微缩 (scale 0.95)  →  视觉按压反馈
    ↓
达到 500ms 阈值
    ↓
岛体还原 + 展开到环境光调节面板
    ↓
用户拖动滑块调节色相 / 深度
    ↓
点击岛体（非滑块区域）→ 折叠回胶囊
```

### 2. 搜索交互流程

```
用户输入关键词 + 点击"検索" / 回车
    ↓
胶囊状态变为 SEARCHING (粉色)
    ↓
灵动岛展开 → 搜索进度面板
    ↓
进度条增长 (每 300ms +6~20)
    ↓
    ├─ 成功 (进度≥100%) → 绿色成功状态 → 3.5s 后折叠
    └─ 失败 (进度≥55% 且命中失败条件) → 红色失败状态 → 3.5s 后折叠
    ↓
折叠后 → 600ms 延迟 → 胶囊复位为 System Active
```

### 3. 事件冒泡拦截

为防止滑块操作触发灵动岛的点击/长按事件，以下元素的事件会被阻止冒泡：
- `.slider-control` 容器
- `input[type="range"]` 滑块

监听事件: `click`, `mousedown`, `touchstart`, `touchmove`

---

## 依赖关系

### 外部依赖

| 依赖名称 | 引入方式 | 版本 | 用途 |
|---------|---------|------|------|
| Tailwind CSS | CDN | 最新版 | 原子化 CSS 工具类，快速构建布局 |

**CDN 地址**:
```
https://cdn.tailwindcss.com
```

### 内部依赖（模块间）

```
搜索模块 → 依赖 → 灵动岛状态模块
   ↑                    ↑
   └────────────────────┘
    (搜索状态影响展开时显示哪个面板)

滑块模块 → 修改 → CSS 变量
   ↓
背景样式 → 读取 → CSS 变量
```

---

## 项目运行方式

### 环境要求
- 现代浏览器（支持 CSS `backdrop-filter` 和 `@property`）
  - Chrome/Edge 85+
  - Safari 16.4+
  - Firefox 128+

### 运行方式

**方式一：直接打开**
1. 双击 [index.html](file:///workspace/index.html) 文件
2. 在浏览器中直接查看

**方式二：本地服务器（推荐）**
```bash
# 使用 Python 内置服务器
cd /workspace
python3 -m http.server 8000

# 或使用 Node.js
npx serve /workspace
```
然后访问 `http://localhost:8000`

### 兼容性说明

| 特性 | 降级方案 |
|-----|---------|
| `@property` 动画 | 无动画，直接切换（功能不受影响） |
| `backdrop-filter` | 无模糊效果，显示半透明背景 |
| `-webkit-` 前缀 | 已添加，兼容 Safari/WebKit |

---

## 预留扩展点

### 1. 下载状态面板

**位置**: [index.html#L215-L232](file:///workspace/index.html#L215-L232)（已注释）

预留结构，用于展示小说下载进度：
- 文件名
- 下载速度
- 剩余时间
- 进度条（绿色渐变）

### 2. 小说阅读/查看面板

开发者注释中提到的预留结构，可用于展示：
- 小说简介
- 章节目录
- 阅读进度

### 3. 扩展建议

可新增的功能方向：
1. **真实搜索 API 对接**：将 `triggerNovelSearch` 中的模拟逻辑替换为真实 API 调用
2. **搜索结果列表**：展开后显示搜索到的小说卡片列表
3. **历史记录**：本地存储搜索历史
4. **主题切换**：预设多套液态玻璃主题配色
5. **下载管理**：对接预留的下载状态面板

---

## 文件索引

| 文件 | 行数 | 说明 |
|-----|------|------|
| [index.html](file:///workspace/index.html) | 577 | 项目唯一入口文件，包含全部 HTML/CSS/JS |

---

## 更新记录

| 版本 | 日期 | 说明 |
|-----|------|------|
| 1.0.0 | 2026-06-28 | 初始版本，包含液态玻璃灵动岛核心功能 |

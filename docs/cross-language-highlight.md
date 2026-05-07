# 跨语言高亮对照功能（Cross-Language Sync Highlight）

## 1. 功能概述

用户选中文本后，底部弹出横跨双语栏的提示条：
- 选中**中文**词/句 → 显示对应的**英文**句子，点击可跳转到该英文句
- 选中**英文**词/句 → 显示对应的**中文**句子，点击可跳转到该中文句

---

## 2. 内容结构分析

### 2.1 现状：`sections.json` 中的内容是**整段文本**，非句子级对齐

每个 section（如 `1.1`）的 `content_en` 和 `content_zh` 是**一个完整段落字符串**（长则上千字），不是句子数组。

因此，无法直接根据用户选中文本找到对应的另一语言句子——需要**预处理**。

---

## 3. 技术方案

### 方案对比

| 方案 | 描述 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **A：句子级对齐** | 预处理时用分句工具切分 EN/ZH，建立句子映射索引 | 用户体验最佳，选中词就能找到对应句 | 需要预处理、依赖分句库 | ⭐⭐⭐ **推荐（最终目标）** |
| B：段落级同步 | 用户选中文本 → 找到所在段落 → 整体显示另一语言段落 | 无需预处理，实现简单 | 粒度过粗，选一个词要看整段 | ⭐⭐ 可作为最小可行版本 |
| C：TF-IDF/语义相似度 | 用 embedding 相似度匹配跨语言句子 | 无需对齐预处理 | 速度慢，效果不稳定，过于复杂 | 不推荐 |

### 3.1 推荐方案：A — 句子级对齐

#### 预处理流程

```
sections.json (原始)
  → 分句
    - EN：用正则 /[.!?]+/ 切分
    - ZH：用标点 [。！？；]+ 或 segmentit 库切分
  → 句子对齐
    - 按顺序建立 index（假设译文顺序一致）
    - 可选：轻微 fuzzy match 修正顺序偏移
  → 输出新字段：alignment[]
```

**数据结构设计：**

```json
{
  "number": "1.1",
  "title_en": "What Is Analysis?",
  "title_zh": "什么是分析？",
  "pdf_page": 18,
  "content_en": "...",
  "content_zh": "...",
  "alignment": {
    "en_sentences": [
      "This text is an honors-level undergraduate introduction to real analysis.",
      "The analysis of the real numbers, sequences and series of real numbers, and real-valued functions.",
      "..."
    ],
    "zh_sentences": [
      "本书是面向荣誉学位本科生的实分析入门教材。",
      "实分析是对实数、实数序列、实数级数以及实值函数的分析。",
      "..."
    ],
    "mapping": [
      // index i = 第 i 个英文句子对应第 i 个中文句子
      { "en_idx": 0, "zh_idx": 0 },
      { "en_idx": 1, "zh_idx": 1 },
      ...
    ]
  }
}
```

**分句工具选型：**
- 中文：`segmentit`（Node.js 中文分词库，支持分句）
- 英文：直接用正则 `/[.!?]+/` + 边界处理
- 数学公式（`$$...$$` 和 `$...$`）需要先剔除再分句，避免把公式内的 `.` 当成句子边界

#### 前端交互流程

```
用户鼠标选中文本
  → mouseup 事件捕获 selection
  → 判断语言（正则：含中文 → ZH，含英文 → EN）
  → 找到该句子所在的 section
  → 在 alignment 中找到匹配的句子索引
  → 构造提示条：显示对应语言句子
  → 用户点击提示条
    → 平滑滚动到另一栏对应句子位置
    → 短暂高亮目标句子（约 1s 后淡出）
```

### 3.2 最小可行版本：段落级（无预处理）

如果预处理工作量太大，可以先做段落级版本：

```
用户选中文本
  → 找到其所在 <section class="en"> 或 <section class="zh">
  → 找到另一语言栏中相同 section 编号的元素
  → 整体显示该 section 的另一语言内容
  → 点击 → 滚动到另一栏该 section
```

**缺点：** 粒度粗，但对于“快速对照整段翻译”也有一定价值。

---

## 4. UI/UX 设计

### 4.1 提示条（Popover）

```
位置：视口底部，距底 20px，水平居中或左对齐跟随鼠标
宽度：max 80vw，约 600px
内容：
  ┌─────────────────────────────────────────────┐
  │ 🔤 对应英文：                                │
  │ "This text is an honors-level undergraduate  │
  │  introduction to real analysis."            │
  │                              [跳转到此处 →]   │
  └─────────────────────────────────────────────┘

颜色主题：
  - 深色底 (#1e1e2e) + 白字（参考 VS Code Dark+）
  - 或书本主题的深蓝底
  - 边框圆角 8px，投影
```

### 4.2 交互细节

| 行为 | 处理 |
|------|------|
| 选中后显示 Popover | 延迟 100ms，避免快速划过误触发 |
| 消失 | 点击空白处、按 Esc、选中另一个词 |
| 点击"跳转到此处" | `scrollIntoView({ behavior: 'smooth', block: 'center' })` + 1s 高亮 |
| 未找到对齐句子 | Popover 不显示，静默忽略 |
| 数学公式内选中文本 | 检测到 `$` 或 `$$` 时不触发功能 |

### 4.3 无障碍

- Popover 添加 `role="tooltip"`, `aria-live="polite"`
- 高亮目标添加临时 class `cross-lang-target`，带 CSS 动画
- Esc 键关闭 Popover（`keydown` 监听）

---

## 5. 实现计划

### 阶段 1：最小可行版本（段落级）

- [ ] 修改 `sections.json` 加载逻辑，标注每个 section 的 DOM 节点语言属性
- [ ] 写 `mouseup` 选中文本检测
- [ ] 找所在段落 → 找对应语言栏的同编号 section
- [ ] 渲染 Popover（纯 JS/CSS，底部固定定位）
- [ ] 点击跳转，平滑滚动

**预计工作量：** 约 200 行 JS/CSS

### 阶段 2：句子级对齐（完整版）

- [ ] 编写预处理脚本 `scripts/build-alignment.js`
  - 加载 `sections.json`
  - 剔除 LaTeX 数学公式
  - EN 分句（正则）
  - ZH 分句（segmentit）
  - 生成 `alignment` 字段
- [ ] 将 `alignment` 数据注入前端（或单独加载 `alignments.json`）
- [ ] 修改 Popover 逻辑：从显示段落 → 显示精确句子
- [ ] 数学公式内选中文本 → 过滤不触发

**预计工作量：** 约 400-500 行（预处理 200 + 前端 200-300）

---

## 6. 关键挑战

### 6.1 数学公式干扰分句
- LaTeX 公式中有 `.` `!` `?` 等标点
- **解决：** 预处理时用正则 `\$\$.*?\$\$|\$.*?\$` 先替换成占位符，分句后还原

### 6.2 中英文句子数不对等
- 翻译有时会合并/拆分句子
- **解决：** 不严格依赖一一对应，用 index 近似匹配；或用编辑距离做 fuzzy match
- **简化：** 数学教材翻译相对忠实，先用 index 直接映射，实测不满意再加 fuzzy

### 6.3 长句子在屏幕上被截断
- 提示条内句子可能很长
- **解决：** `max-width: 600px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`，hover 显示完整

### 6.4 Popover 遮挡底部内容
- **解决：** 固定在底部，不影响正文滚动；也可加半透明遮罩

### 6.5 移动端触摸选择
- `mouseup` 在移动端对应 `touchend`
- 两端都要监听

---

## 7. 优先级建议

**立即可做（阶段 1）：**
- 段落级版本实现简单，可以快速上线给用户试用
- 用户能快速验证"这个功能有用"，再决定是否投入做句子级

**值得投入（阶段 2）：**
- 数学教材的句子级对齐是可行的（翻译忠实）
- 对用户体验提升显著，值得预处理成本

---

## 8. 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `data/sections.json` | 新增 `alignment` 字段（阶段2）或保持不变（阶段1用段落级） |
| `js/app.js` 或新建 `js/crosslang.js` | Popover 逻辑、选中文本检测、跳转 |
| `css/` | 新增 Popover 样式 |
| `scripts/build-alignment.js`（新建） | 预处理分句对齐脚本 |
| `index.html` | 引入新 JS |

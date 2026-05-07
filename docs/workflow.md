# 分析学 (Analysis I) 翻译工作流

## 概述

本文档定义 Analysis I（陶哲轩）教材电子化翻译的完整pipeline，目标是从原始PDF提取内容，最终输出MathJax渲染无误的双语网页。

---

## Pipeline 总览

```
PDF → 提取(flash-extract) → 原文验证 → 数学表达式检测 → MathJax包装 → 存储 →
渲染验证(Playwright) → 修复循环 → 公式交叉修复 → 完成
```

---

## 阶段详解

### 阶段 0：环境准备

**输入：** PDF 文件路径  
**输出：** 可用的提取环境  
**工具：** MinerU flash-extract（免费，无需token）  
**检查项：**
- `flash-extract --help` 正常返回
- PDF 文件存在且可读
- 输出目录存在

```bash
# 验证环境
flash-extract --help
```

---

### 阶段 1：PDF 提取

**输入：** `/tmp/tao_analysis.pdf`（第1-312页，第四版）  
**输出：** 原始文本+LaTeX片段，`data/sections.json` 初始结构  
**工具：** MinerU flash-extract  
**质量要求：**
- 数学公式保留LaTeX格式（`\frac{...}{...}`、`\lim`、`\int`等）
- 文本段落保持可读性
- 标题层级识别正确（# Chapter, ## Section）

**输出格式（sections.json 初始结构）：**
```json
{
  "section_id": "1.1",
  "title_en": "...",
  "content_en": "...",
  "content_zh": "",
  "math_expressions": [],
  "page_ref": 1,
  "status": "extracted"
}
```

---

### 阶段 2：原文验证

**输入：** `content_en`  
**输出：** 质量评分（0-100）  
**评分维度：**
- **逻辑**（20分）：段落内逻辑连贯，无跳步
- **术语**（25分）：数学术语准确（convergence/divergence/limit等）
- **格式**（25分）：标点、大小写、括号配对正确
- **常识**（30分）：数学内容无事实性错误

**阈值：** 必须 ≥75 分，否则打回重提（最多3次）

```javascript
// 自动化预检（可捕获50%问题）
function preValidate(text) {
  let score = 100;
  // 括号配对检查
  if ((text.match(/[({]/g) || []).length !== (text.match(/[)}]/g) || []).length) score -= 15;
  // LaTeX命令完整性
  if (/\\\w+$/.test(text)) score -= 10;
  // 空段落
  if (text.trim().length < 10) score -= 20;
  return Math.max(0, score);
}
```

**失败处理：**
1. 提取结果评分<75 → 记录问题，重提
2. 3次重提仍<75 → 标记为"需人工审核"，继续pipeline

---

### 阶段 3：数学表达式检测

**输入：** `content_en` 和 `content_zh`  
**输出：** 数学表达式列表（含类型、位置、状态）

**检测类型：**

| 类型 | 示例 | 检测方式 |
|------|------|----------|
| Unicode符号 | ∞ ∫ ∂ ∑ ∏ ≤ ≥ ≠ ± | Unicode范围检测 |
| LaTeX命令 | `\frac{a}{b}`, `\lim_{x\to 0}` | 正则匹配 |
| 分数 | a/b, 1/2 | 上下文判断 |
| 上下标 | x^2, a_i | 上下文判断 |
| 根号 | √, \sqrt | 混合处理 |

**正则库：**
```javascript
const MATH_PATTERNS = {
  unicodeMath: /[∞∫∂∑∏≤≥≠±×÷→←↔∈∉⊂⊃∀∃∅∇]+/g,
  latexCmd: /\\(?:frac|lim|int|sum|prod|sqrt|infty|partial|rightarrow|leftarrow|infty|nabla|epsilon|delta)/gi,
  fraction: /(?:^|\s)\d+/\d+(?:\s|$|[.,;:\)\]])/g,
};
```

**关键要求：** 检测必须在任何文本处理之前完成，检测结果存入 `math_expressions` 数组。

---

### 阶段 4：MathJax 包装

**输入：** 含数学表达式的文本  
**输出：** MathJax兼容格式

**转换规则：**

```javascript
function convertToMathJax(text, mathExprList) {
  let result = text;
  
  // 1. Unicode符号 → LaTeX命令（全部转换）
  const UNICODE_TO_LATEX = {
    '∞': '\\infty',
    '∫': '\\int',
    '∂': '\\partial',
    '∑': '\\sum',
    '∏': '\\prod',
    '≤': '\\leq',
    '≥': '\\geq',
    '≠': '\\neq',
    '±': '\\pm',
    '→': '\\to',
    '←': '\\leftarrow',
    '↔': '\\leftrightarrow',
    // ... 完整映射表见 utils/unicode-math-map.js
  };
  
  for (const [sym, cmd] of Object.entries(UNICODE_TO_LATEX)) {
    result = result.split(sym).join(cmd);
  }
  
  // 2. 包围块级数学（$$...$$）
  // 使用占位符保护已包装的块
  const BLOCK_MATH_PLACEHOLDER = '__BLOCK_MATH_N__';
  // 3. 包围行内数学（$...$）
  const INLINE_MATH_PLACEHOLDER = '__INLINE_MATH_N__';
  
  return result;
}
```

**MathJax包装检查清单：**
- [ ] `$$...$$` 两侧各有独立空行（防止被`<p>`标签切割）
- [ ] `$...$` 不跨越段落边界
- [ ] LaTeX命令完整（`\frac{...}{...}` 不残缺）
- [ ] 无裸下划线（`_` 在数学上下文外）

---

### 阶段 5：内容存储

**输入：** 验证通过的 content_en + content_zh  
**输出：** 更新后的 `sections.json`

**存储结构：**
```json
{
  "section_id": "1.2",
  "title_en": "Why Do Analysis?",
  "title_zh": "为什么要学分析？",
  "content_en": "Calculus was invented in the 17th century...",
  "content_zh": "微积分诞生于17世纪...",
  "math_expressions": [
    {"type": "block", "original": "$$f(x) = \\lim_{n\\to\\infty}...$$", "converted": "..."}
  ],
  "page_ref": 15,
  "status": "stored",
  "score": 88,
  "translators_note": ""
}
```

---

### 阶段 6：渲染验证（Playwright）

**输入：** 生成的HTML页面  
**输出：** 验证报告

**自动化检查项：**

#### 检查 1：无原始LaTeX泄露

```javascript
const rawLatexCount = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node;
  while (node = walker.nextNode()) {
    // 跳过 mjx-container（MathJax已处理的）
    if (node.parentElement.closest('mjx-container')) continue;
    // 检测未包装的LaTeX片段
    if (/\\frac|\\lim|\\int|\\sum|\\infty|\\to|\\partial/.test(node.textContent)) {
      count++;
    }
  }
  return count;
});
// 必须 == 0
```

**失败症状：** 页面可见 `\frac{1}{2}` 等原始文本

#### 检查 2：MathJax容器存在

```javascript
const mjxCount = await page.evaluate(() =>
  document.querySelectorAll('mjx-container').length
);
// 必须 > 0（有数学公式）
```

#### 检查 3：列表编号正确

```javascript
const listData = await page.evaluate(() => {
  const ols = Array.from(document.querySelectorAll('ol'));
  return ols.map(ol => ({
    start: ol.start,
    items: ol.querySelectorAll('li').length
  }));
});
// 验证：第一个ol的start==1，后续ol递增（不是都=1）
```

**失败症状：** 有序列表全部显示 "1,1,1..."

#### 检查 4：无控制台错误

```javascript
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
// 必须 == 0
```

#### 检查 5：页面视觉渲染

```javascript
// 检查关键元素存在
const checks = await page.evaluate(() => ({
  propositionCards: document.querySelectorAll('.proposition-card').length,
  bilingualContainer: !!document.querySelector('.bilingual'),
  darkModeToggle: !!document.querySelector('.theme-toggle'),
  mathJaxLoaded: !!window.MathJax,
}));
```

---

### 阶段 7：修复循环

当任一验证失败时：

1. **确定失败类型**（raw LaTeX / 列表编号 / MathJax缺失）
2. **定位问题代码**（renderBody / wrap-math / CSS）
3. **实施修复**
4. **重新验证**（从阶段6开始）

**常见修复方案：**

| 失败类型 | 根因 | 修复方案 |
|----------|------|----------|
| raw LaTeX泄露 | underscore处理吃掉了math块 | 在文本处理前保护math块 |
| 列表编号1,1,1 | 多个`<ol>`被分别渲染 | 合并为一个`<ol>`，设置start属性 |
| MathJax缺失 | 块级数学未正确包装 | 确保$$两侧有空行 |
| 公式被`<p>`切割 | `$$`在行中间被段落分割 | 使用__BLOCK_MATH占位符 |

---

## 时间估算（每个Section）

| 阶段 | 耗时 |
|------|------|
| PDF提取 | 2-5分钟 |
| 原文验证 | 1-2分钟 |
| 数学检测 | 1分钟 |
| MathJax包装 | 2-3分钟 |
| 存储 | <1分钟 |
| Playwright验证 | 3-5分钟 |
| **总计** | **约10-17分钟/section** |

---

## 输出要求

每个section完成后，`data/sections.json` 状态应为：
```json
{"status": "verified"}
```

只有 `status: "verified"` 的section才能部署到生产环境。

### 问题 4：块级数学被P/EM标签切割

**症状：** `$$...$$` 在行中间被插入`</p><p>`，导致MathJax解析失败
**原因：** 渲染逻辑按句子切分，忽略了$$的块级语义
**修复：** 渲染前识别`$$...$$`，确保其两侧各有独立空行

---

## 阶段 8：公式交叉修复 — EN 版 LaTeX 校验（ZH 作基准）

**触发条件：** EN 版公式评分 < 75（疑似 PDF 提取损伤）

**输入：** `content_en`（损伤公式）+ `content_zh`（正确 LaTeX）

**评分维度：**
| 维度 | 权重 | 说明 |
|------|------|------|
| 公式完整率 | 35分 | LaTeX 命令闭合（`\frac{...}{...}`, `\lim_{...}` 等） |
| 边界正确性 | 25分 | `$...$` / `$$...$$` 分隔符正确、无跨段 |
| 特殊命令 | 25分 | `\frac`, `\lim`, `\sum`, `\int`, `\infty`, `\to` 等保留 |
| 上下文语义 | 15分 | 公式与周围文本衔接自然 |

**阈值：** ≥ 85 分视为通过；< 85 分标记为"需人工审核"

**处理流程：**

1. **定位损伤公式**
   - 扫描 `content_en` 中的异常模式：裸 `lim`、`frac{` → `frac{` 无反斜杠、`/` 被误作分数分隔符
   - 使用 `content_zh` 作为参照系，精确定位每个数学段落的起止位置

2. **边界识别**
   - 对齐 EN 和 ZH 的文本结构（段落、句子顺序），找到对应位置
   - 识别公式类型：行内 `$...$`（ZH 中常为单行）或块级 `$$...$$`（ZH 中常为空行分隔）

3. **公式修复**
   - 对每个检测到的损伤公式，从 `content_zh` 提取对应 LaTeX
   - 修复项：
     - 命令前缀：`lim` → `\lim`，`frac` → `\frac`，`int` → `\int`
     - 括号嵌套：`rac{1}{2}`（完整） vs `1/2`（损伤）
     - 上下标：`lim_{x\to 0}`（正确） vs `lim_{x->0}`（损伤）
     - 特殊符号：`\infty` → `∞`（损伤），`\to` → `→`（损伤）
   - 将修复后的 LaTeX 按正确类型包装（`$` 或 `$$`）

4. **验证**
   - 修复后再次评分，≥ 85 则输出
   - 若评分仍低，记录具体位置，标记需人工处理

**修复示例：**

```
损伤 EN：   lim_{x -> 0} f(x) = lim_{x->0} f(x)
ZH 基准：   $\lim_{x\to 0} f(x) = \lim_{x\to 0} f(x)$
修复后 EN： $\lim_{x\to 0} f(x) = \lim_{x\to 0} f(x)$
```

```
损伤 EN：   1/2 + 1/4 = ...
ZH 基准：   $\frac{1}{2} + \frac{1}{4} = ...$
修复后 EN： $\frac{1}{2} + \frac{1}{4} = ...$
```

**注意事项：**
- 优先保持 EN 文本原文风格，仅替换损伤的 LaTeX 部分
- 块级公式（`$$...$$`）的换行结构需与 ZH 一致
- 若 ZH 中对应位置无数学内容但 EN 有误判，避免过度修复

---

## 已知问题档案

### 问题 5：PDF 提取（Flash/ MinerU）损伤公式定界符

**症状：** `rac{1}{2}` → `1/2`，`\lim` → `lim`，`\to` → `->`
**原因：** PDF 文本提取时，LaTeX 反斜杠被忽略或转换为普通斜杠
**影响范围：** 英文版 content_en（中文翻译由人工完成，保留正确格式）
**当前缓解：** ZH → EN 公式交叉验证（阶段 8）
**状态：** 已知，阶段 8 已覆盖

### 问题 6：跨语言公式对齐偏移

**症状：** ZH 和 EN 段落结构不同导致公式位置对不齐
**原因：** 翻译时句子重组、空行位置差异
**缓解：** 阶段 8 使用文本相似度对齐而非位置索引
**状态：** 监控中


**症状：** `$\frac{1}{2}$` 被inlineFormat处理，变成乱码  
**原因：** `inlineFormat = text.replace(/_(.*?)_/g, '<em>$1</em>')` 在math块保护前执行  
**修复：** 在所有文本处理之前，先用占位符保护所有 `$...$` 和 `$$...$$` 块

### 问题 2：多个OL编号都从1开始

**症状：** 三个`<ol>`连续渲染，显示"1,1,1"  
**原因：** 每个ol独立计数，未合并  
**修复：** 在HTML生成时用start属性递进编号，或合并为单一ol

### 问题 3：Unicode数学符号未转换

**症状：** 页面显示"∞"而非MathJax渲染的"∞"  
**原因：** Unicode符号直接写入HTML，未被MathJax识别  
**修复：** 在包装阶段将∞转为`\infty`（LaTeX命令）

### 问题 4：块级数学被P/EM标签切割

**症状：** `$$...$$` 在行中间被插入`</p><p>`，导致MathJax解析失败  
**原因：** 渲染逻辑按句子切分，忽略了$$的块级语义  
**修复：** 渲染前识别`$$...$$`，确保其两侧各有独立空行
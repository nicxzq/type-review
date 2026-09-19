# 中文打字（全拼 + 小鹤双拼）设计文档

状态：设计（未实现）· 已过 Codex(GPT-5) + CodeBuddy 双模型审查并据此修订。

## 1. 背景与目标

type-review 当前只练英文：`TextInput.expected` 三位一体（显示 = 期望 = 输入），且 `src/io/input-handler.ts`
主动屏蔽系统 IME 合成（保护英文练习）。

目标：新增中文打字，支持**全拼**与**小鹤双拼**；练习时汉字上方显示拼音、并展示进度；提供中英语言切换。

## 2. 核心设计判断

**不走系统 IME**（会与 input-handler 冲突且无法统计键位）。改为——
**汉字仅用于显示，用户实际敲拼音字母（全拼串 / 双拼两键）**。

这样 input-handler、热循环、每键/每手指统计、持久化全部原样复用；用户练的就是拼音键位。
需要拆开的唯一一件事：**显示单元（汉字）≠ 输入序列（拉丁键）**——引入一层 cell 与键位的映射。

```
汉字串 "中国"
 -> cells: [{hanzi:"中", pinyin:"zhong"}, {hanzi:"国", pinyin:"guo"}]   (语料预标注)
    -> 按方案转键序：全拼 -> "zhong"+"guo"；小鹤 -> "vs"+"gu"
       -> flat 输入串 "zhongguo" / "vsgu" -> 照常喂给 TextInput（一行不改）
          -> 另存 keyStart[] 使 UI 把 pos/statuses 映射回每个 cell 做注音着色 + 进度
```

汉字（U+4E00–U+9FFF）都在 BMP，无代理对，TextInput 的 surrogate 校验不受影响；且 TextInput 只见拼音串，永不见汉字。

## 3. 多模型审查结论（Codex + CodeBuddy，高度收敛）

两家一致认定的**严重问题**，均已并入本设计：

1. **多音字必错**：`cell.pinyin` 单值把「字→音」当函数，但「了/重/行/长/还」读音随词而变。
   → 语料在**词级**预标注上下文读音（构建期 pinyin-pro 分词生成初稿 + 人工校对 + 数据契约测试钉死）。
   cell 可选支持多候选（P3）。
2. **双拼不能靠 `splitPinyin` 硬拆字符串**，必须基于权威音节表：
   - y/w 还原：`yi->i, you->iou, wu->u, wang->uang, yu->ü, yuan->üan`（y/w 不是声母）
   - ü/v 区分：`nv/lv` 用 `v` 键；但 `ju/qu/xu/yu` 里的 u **就是 u**（不能当 ü）
   - 整体认读：`zhi/chi/shi/ri/zi/ci/si` 的韵母不是普通 i
   - 缩写韵母 alias：`iu<->iou, ui<->uei, un<->uen`
   - 零声母：`a/o/e/ai/an/ang/ei/ou...` 各有规则，不是简单「补位 a/o/e」
   → 用「合法音节表 -> 键序」的**黄金样本 fixture**，而非 property 推断。
3. **`Passage.cjk` 会污染 engine 类型**：engine 只该认「键序列」。
   → 改成**通用分组** `segments?: {start, end, display?, hint?}[]`，engine 不认识中文，io 层填汉字/拼音；
   这个抽象还能复用到「英文按单词着色」。方案（full/xiaohe）属于 Settings，不放 Passage。
4. **WPM 口径在中文失效**：全拼 ~3.3 键/字、双拼 2 键/字，`keys/5` 不可比。
   → 中文主指标用 **CPM（字/分钟，按 keyStart 推完成字数）**，KPM 辅助且只同方案内比。
   `keyHistogram` 按 `(language, scheme)` **分桶**，不与英文字母频/跨方案混。
5. **浏览器无法真正屏蔽系统 IME**：→ 监听 `compositionstart` 拒绝输入 + 弹「请切到英文键盘」可见提示
   （在现有 `isComposing` 守卫基础上加可见反馈）。
6. **热循环性能**：预建 `cellOfPos`（Int32Array）做 O(1) 反查、`ChineseLayout` 引用仅在 passage 变更时创建一次、
   per-cell 细粒度渲染，别每帧重建整个 statuses 大数组。

一致**建议**：不加字/词间空格（边界交给 keyStart + UI 留白）；`language==="zh"` 时**强制 benchmark、隐藏自适应**；
双拼 UI 显示「汉字 + 全拼注音 + 高亮两个目标键」，而不是给全拼逐字母上色（否则用户困惑为何敲 `v`）。

**分歧与取舍**：Codex 主张 P1 只做全拼求稳；CodeBuddy 主张 v1 即上 cell 级状态机处理多音字。
本设计折中：**词级预标注**解决多音字（无需运行时多候选），P1 全拼 + 小鹤都做但小鹤配完整黄金表；
多候选 / cell 级状态机留作 P3。

## 4. 数据模型

```ts
// engine/pinyin/types.ts
type PinyinScheme = "full" | "xiaohe";
interface PinyinCell { hanzi: string; pinyin: string; } // pinyin=上下文正确的规范全拼(书写形式)，无声调
interface ChineseLayout {
  cells: PinyinCell[];
  keys: string;          // 拼接后的 flat 输入串
  keyStart: number[];    // keyStart[i]=第 i 字在 keys 中起点；末尾放 keys.length 哨兵
  cellOfPos: Int32Array; // pos -> cell 的 O(1) 反查
}

// engine/corpus/types.ts —— 通用分组，engine 不认识中文
interface InputSegment { start: number; end: number; display?: string; hint?: string; }
interface Passage { /* 现有字段... */ segments?: readonly InputSegment[]; }
```

中文 Passage：`text/keys` = 拼音键序，`segments[i] = { start:keyStart[i], end:keyStart[i+1], display:hanzi, hint:全拼 }`。

## 5. 各层改动

**engine（纯 TS，可注入、可测）**
- 新增 `src/engine/pinyin/{types,split,double-pinyin,layout,index}.ts`
  - `splitPinyin(full)`：先做 y/w 还原与 ü 归一，再拆「声母 + 韵母」；含整体认读与缩写韵母 alias。
  - `toDoublePinyin(full, scheme)`：查表得两键（含零声母、ü/v、整体认读）；`full` 恒等返回。
  - `buildChineseLayout(cells, scheme)`：逐 cell 转键序，拼 keys、填 keyStart / cellOfPos。
- `corpus/types.ts`：Passage 增通用 `segments?`；`makePassage` 透传 segments（不传即英文旧行为）。

**io**
- 新增 `src/io/corpus/data/zh.json`：词级预标注，逐条 `{ id:"zh-001", title, license, cells:[{h,p},...] }`。
  构建期用 pinyin-pro 分词生成初稿 -> 人工校对 -> 测试锁定。
- 新增 `src/io/corpus/chinese.ts`：`createChineseSource(scheme)` 读 cells、`buildChineseLayout`、
  返回带 segments 的 Passage；按 `wantedChars`（以 keys 长度计）用现有 `pickWeightedByLength` 选段。
- `channel-meta.ts`：注册 `{ name:"zh", label:"中文", idPrefix:"zh-" }`（单一事实源，Stats/分类自动跟随）。
- 新增 zh.json **数据契约测试**：每个 hanzi 单 BMP、每个 pinyin 可被 splitPinyin 拆分且能查到双拼键、
  keyStart 单调、id 前缀与通道一致。

**settings / persistence**
- `ProfileSettings` 增 `language: "en"|"zh"`、`pinyinScheme: "full"|"xiaohe"`（默认 en/full，向后兼容）。
- `validators.ts` + `SETTINGS_BOUNDS` 接纳新枚举；`bounds.ts` 的 `UI_BOUNDS` 同步（`bounds.test` 验子集）。
- `serialization.ts` 加 migrator（旧 profile 缺字段补默认）。

**App 装配**
- `language==="zh"` 时：把 Session 的 `benchmarkSource` 指向中文源，并**强制 benchmark 模式**（隐藏自适应）。
- 切换 language / pinyinScheme：`session.updateSettings` 触发 start() 重开一局；统计按 `(language,scheme)` 分桶。

**ui**
- `TypingSnapshot`/`SessionSnapshot` 透传 `segments`（引用稳定，仅 passage 变更时变）。
- `TypingArea.tsx` 增中文分支（英文分支完全不动）：每字一块「上拼音 + 下大汉字」，
  用 `segments[i]` 区间把 statuses/pos 映射到每字做着色；顶部 cell 进度（第 N / 共 M 字）。
  双拼下：显示汉字 + 全拼注音（小字）+ 高亮两个目标键，而非逐字母上色。
- 输入层：中文练习中检测 `compositionstart` -> 拒绝 + banner「请切换到英文键盘」。
- `components.css` / `tokens.css`：加中文块布局样式，全部走既有 design token，不硬编码颜色/间距。
- 指标：结果页/Stats 中文按 **CPM** 展示；直方图按 `(language,scheme)` 分桶。

## 6. 测试策略

- **黄金样本表**（手工断言键序，双拼正确性核心）：零声母 `a/o/e/ai/an/ang/er`、
  整体认读 `zhi/chi/shi/ri/zi/ci/si`、y/w 系 `you/wu/yu/yuan`、缩写 `iu/ui/un`、
  前后鼻音 `min/ming/zhen/zheng`、n/l、ü 系 `nv/lv/nue/ju/qu`。
- **zh.json 数据契约测试**（防语料腐坏）。
- **layout round-trip property**：`keyStart[0]===0`、单调、`sum===keys.length`；cells 与 keys 对齐。
- **cell 边界**：开头 typo、末尾 typo、跨 cell backspace、最后一字完成。
- 回归：`bounds.test` / `layer-purity.test` / `validators.test` 全绿；切回英文行为与改动前完全一致。

## 7. 分期

- **P1**：全拼 + 通用 segments + TypingArea 中文分支 + zh.json + 语言切换 + CPM 指标。可本地完整体验。
- **P1b**：小鹤双拼（配完整黄金样本表）。
- **P2**：Vercel 部署（见 `docs/deploy-vercel.md`）。
- **P3**：中文自适应（按「字」而非「字母」解锁）、错误分类训练（前后鼻音 in/ing、平翘舌 z/zh、边鼻音 n/l）、
  多候选 / 词组连续输入、简拼方案、声调策略。

## 8. 实现前置

当前项目未初始化 design token 目录，`ui-tokenize` 插件的 PreToolUse 钩子会拦截所有 `Write`。
实现前需先 `/tokenize:init`（或临时停用该钩子），否则写文件会被挡。

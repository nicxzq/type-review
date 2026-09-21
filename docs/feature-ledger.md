# 功能账簿 · Feature Ledger

> 本项目所有功能的动态清单。每完成一项就勾选并更新「状态 / 完成时间」。
> 维护约定：改动功能时同步改本表；日期用绝对日期（YYYY-MM-DD）。
> 最近更新：2026-09-21

图例：✅ 已完成 · 🚧 进行中 · ⬜ 未开始

---

## 1. 核心打字引擎（英文）

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 自适应字母解锁（adaptive letter-unlock） | ✅ | 小字母表起步，达标后逐个解锁；`engine/adaptive/lesson.ts` |
| 每键 / 每 bigram 计时与 EMA | ✅ | `engine/adaptive/key-stats.ts`、`histogram.ts` |
| Benchmark 模式（词数 / 计时） | ✅ | 真实语料，词数或倒计时结束 |
| 弱键 / 弱 bigram 反馈 | ✅ | 结果页 top-3 弱 bigram |
| 语料通道：quotes / code / user / difficult / drills | ✅ | `corpus/channel-meta.ts` 单一事实源 |
| 自带文本（.txt/.md 上传、粘贴 custom text） | ✅ | IndexedDB 本地存储 |
| 每键 + 每指统计仪表盘 | ✅ | 按来源 WPM 趋势、连击、里程碑 |
| 屏幕键盘热力图（Mac/Win，QWERTY/Colemak/Dvorak） | ✅ | |
| 机械键盘音效（合成 + 采样） | ✅ | Web Audio 本地生成 |
| 结果分享链接 `#/share/<payload>` | ✅ | 只读卡片 |
| 应用内长文阅读（essay） | ✅ | `public/articles/<slug>/` |
| 四主题（dark/light/sepia/high-contrast） | ✅ | |
| 本地数据（IndexedDB，导出/清除） | ✅ | 无账号、无遥测 |

## 2. 中文打字（拼音）

设计文档：`docs/chinese-typing-design.md`

| 阶段 | 功能 | 状态 | 完成时间 |
| --- | --- | --- | --- |
| P1 | 全拼输入（汉字显示 + 拼音键入） | ✅ | 2026-09-19 |
| P1 | 通用 `segments` 抽象（engine 不认识中文） | ✅ | 2026-09-19 |
| P1 | `TypingArea` 中文分支（上拼音 + 下汉字） | ✅ | 2026-09-19 |
| P1 | `zh.json` 词级预标注语料 + 数据契约测试 | ✅ | 2026-09-19 |
| P1 | 语言切换（en/zh）+ 设置持久化 + migrator | ✅ | 2026-09-19 |
| P1 | CPM 指标 + 按 `(language,scheme)` 分桶直方图 | ✅ | 2026-09-19 |
| P1b | 小鹤双拼（完整黄金样本表） | ✅ | 2026-09-19 |
| P1b | 自然码双拼（依 Rime 权威表 + 123 条黄金样本） | ✅ | 2026-09-19 |
| P2 | Vercel 部署（`vercel.json` + 安全头 + 文档） | ✅ | 2026-09-19 |

## 3. P3 · 中文进阶（本次目标）

方案：错误分类「两者都做」（被动检测 + 统计上报，以及专门 drill 通道）；顺序：先错误分类，再按字自适应。

### 3a. 错误分类训练

| 功能 | 状态 | 完成时间 | 说明 |
| --- | --- | --- | --- |
| 混淆引擎 · 变体生成 `confusableVariants` | ✅ | 2026-09-19 | 前后鼻音/平翘舌/边鼻音三族 |
| 混淆引擎 · 单字分类 `classifyConfusion` | ✅ | 2026-09-19 | 键级精确匹配变体，双拼下三族全覆盖，全拼下 n/l |
| 混淆引擎 · 整局统计 `tallyConfusions` | ✅ | 2026-09-19 | 从 keystroke steps 还原每字键入并归类 |
| 易混音 drill 语料 + 源 `createConfusionDrillSource` | ✅ | 2026-09-19 | 每族最小对，含 drill↔分类器自洽测试 |
| 合法音节表 `syllables.ts` + 变体过滤（修 Codex 误报） | ✅ | 2026-09-19 | 拒绝 miang/shong 等非音节，防误判；含语料完整性守卫 |
| 混淆统计写入 RunResult（含持久化，前向兼容） | ✅ | 2026-09-19 | Session 完成时计算；序列化容错降级 |
| 结果页呈现「易混音」分族计数 | ✅ | 2026-09-19 | Results.tsx，中文 run 才显示 |
| Stats 跨 run 聚合易混音 | ✅ | 2026-09-19 | `confusionTotals` + Stats 面板（分族条 + 最常混音节） |
| drill 选择 UI（zh 练习中选族） | ✅ | 2026-09-19 | 新增 `confusionDrill` 设置；Settings 选族→App 路由到 drill 源 |

**错误分类训练全部完成**（被动检测 + 主动 drill + 结果页 + Stats）。

多模型审查：Codex(GPT-5) 复核自然码键位表与 drill 读音（均无误），发现变体误报（已 TDD 修复）。

## 2b. 中文语料扩展

| 项 | 状态 | 完成时间 | 说明 |
| --- | --- | --- | --- |
| 语料 7 → 15 条（唐诗 + 论语/老子/王勃名句） | ✅ | 2026-09-19 | 相思/悯农/江雪/鸟鸣涧/千里之行/三人行/温故知新/海内存知己（Codex 读音复核：鹿柴「景」古读 yǐng 有争议→换鸟鸣涧） |
| 数据契约测试升级为三方案构建 | ✅ | 2026-09-19 | 任一新音节若某双拼编码不了则测试报错 |

### 3b. 中文按字自适应

| 功能 | 状态 | 完成时间 | 说明 |
| --- | --- | --- | --- |
| 中文按「字」自适应解锁 | ✅ | 2026-09-21 | 音节为解锁单位（按语料频率）：`syllable-inventory.ts` 频率排序 + `chinese-lesson.ts` 镜像英文解锁规则；每音节掌握度用 `segments`/`keyStart` 切 steps 算 EMA（`syllable-stats.ts`，复用 Target/confidence），存 `RunResult.syllableTimes?`；`chineseSource.pickAdaptive` 只用已解锁音节的段落 + 小语料兜底；`App.tsx` 放开 zh benchmark 强制（仅 drill 才强制），注入 `zhAdaptiveSource`/`zhSyllableInventory`；Settings 放开 zh adaptive + 按音节进度面板（走 token）。zh.json 增 6 条 CC0 音节 drill（读音已复核）。824 测试/typecheck/build/lint 全绿，英文零回归。Codex(gpt-5.5) 实现。 |

### 暂缓（P3+）
- 多候选 / cell 级状态机
- 词组连续输入
- 简拼方案
- 声调策略

## 4. 站点信息（非功能）

| 项 | 状态 | 完成时间 |
| --- | --- | --- |
| 页尾作者/仓库信息改为 @carlxu / wiki.carlxu.cn / 当前仓库 | ✅ | 2026-09-19 |
</content>
</invoke>

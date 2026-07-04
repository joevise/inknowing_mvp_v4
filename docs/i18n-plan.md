# InKnowing 多语言（出海英文版）技术方案

> 版本：v1.0 ｜ 作者：Tomy（大Joe 拍板）｜ 日期：2026-07-04
> 目标：中英文双版本共存，国内默认中文、海外默认英文，用户可切换；**深度英文版**（不止 UI，含内容与 AI 对话），并支持「书的语言原生度」智能提醒。

---

## 0. 核心设计原则

1. **语言是"书"的属性，不是全局开关**。每本书有"语言原生度"，决定切换英文时的行为与提醒强度。
2. **尊重用户最终选择**：提醒但不强制，用户执意切换就切。
3. **分阶段可上线**：每个 Phase 独立可部署，不追求一次到位。
4. **内容层双语字段（方案A）**：不用实时机翻，DB 存两份，体验最优、可控。

---

## 1. 「语言原生度」模型（地基）

`books` 表新增字段 `language_mode`，枚举三值：

| 值 | 含义 | 例子 | 切英文行为 |
|---|---|---|---|
| `zh_native` | 中文原生（强中国文化，英文失魂）| 《天道》丁元英 | ⚠️ 强提醒 + 弹确认框；角色**默认仍说中文** |
| `multilingual` | 多语言友好（通用/商业/工具书）| 《原则》《原子习惯》 | 💡 轻提醒（banner），跟随界面语言 |
| `en_native` | 英文原生 | 英文原版书 | ✅ 英文为正解；中文时轻提醒 |

**默认策略**：现有库所有书批量刷为 `zh_native`（保守，当前库都是中文书）。

---

## 2. 技术现状（已勘查）

- **框架**：Next.js 14.2.24 App Router，React 18，TypeScript
- **i18n 现状**：**零基建**（无 next-intl、无 middleware、无 locale 路由）
- **根布局**：`app/layout.tsx` 硬编码 `lang="zh-CN"` + 中文 metadata
- **含中文文案文件**：**91 个** tsx/ts（UI 抽取工作量）
- **DB**：`lib/db/schema.ts` 用 SQLite 语法（better-sqlite3）；⚠️**生产为 PostgreSQL**，迁移脚本需按 PG 写并与本地对齐
- **AI 对话链路**：
  `app/api/conversations/[id]/stream/route.ts`
  → `ConversationService.streamResponse()`（`lib/services/conversation-service.ts`）
  → `buildSystemPrompt({role, knowledge, constraints})`（`lib/ai/chat.ts` line 177）
  → LLM（MiniMax）
  **语言控制注入点 = `buildSystemPrompt` + streamResponse 里传 languageMode/uiLang**

---

## 3. DB 迁移设计

### 3.1 `books` 表
```sql
ALTER TABLE books ADD COLUMN language_mode TEXT NOT NULL DEFAULT 'zh_native';
-- 双语内容字段（方案A）
ALTER TABLE books ADD COLUMN title_en TEXT;
ALTER TABLE books ADD COLUMN description_en TEXT;
-- 现有书保守刷为中文原生（DEFAULT 已覆盖，无需额外 UPDATE）
```

### 3.2 `characters` 表
```sql
ALTER TABLE characters ADD COLUMN name_en TEXT;
ALTER TABLE characters ADD COLUMN description_en TEXT;
ALTER TABLE characters ADD COLUMN prompt_template_en TEXT;   -- 英文人设（可选，先留空回退中文）
ALTER TABLE characters ADD COLUMN speaking_style_en TEXT;
ALTER TABLE characters ADD COLUMN background_story_en TEXT;
```

> 读取逻辑：当前语言=en 时，优先读 `*_en`，**为空则回退中文字段**（保证不空屏）。

### 3.3 迁移执行
- 本地 SQLite/PG 与生产 PG 各出一份 idempotent 迁移脚本（`IF NOT EXISTS` 风格）
- 生产执行前**必须先 dump 备份**（沿用 `/opt/backups/inknowing/` 惯例）

---

## 4. 分阶段执行计划

### Phase 1 — DB 迁移 + 数据模型
- 加上述字段；`lib/db/schema.ts`、`lib/db/books.ts`、`lib/db/characters.ts` 增双语字段读写与回退逻辑
- 后台加书/加角色表单：`language_mode` 选择器 + 英文字段输入
- **产出可上线**：后台能录双语，前端暂不用

### Phase 2 — UI 国际化（next-intl）
- 接入 `next-intl`，建 `messages/zh.json` + `messages/en.json`
- 抽取 91 文件中文案 → key 化（分批，OpenCode 干体力活，Tomy 审 key 命名）
- 根布局动态 `lang`、metadata 双语
- **产出可上线**：界面可英文（内容仍中文，靠 Phase 1 数据）

### Phase 3 — 语言切换 + 自动探测  ✅ 已完成 (2026-07-04, commit 7863675)
- `middleware.ts`：首访按 **Accept-Language + IP 地理**判断默认语言（国内→zh，海外→en）
- **永远提供显眼切换按钮**，选择写 cookie（`NEXT_LOCALE`），覆盖自动判断
- 路由策略：`/zh/...` `/en/...`（或 cookie-only，二选一，方案里默认走 cookie + 可选前缀，Phase 3 细定）
- **产出可上线**：国内中文、海外英文自动生效

### Phase 4 — 语言原生度提醒  ✅ 已完成 (2026-07-04, commit 5a0c74e)
- 前端读 `language_mode`：
  - `zh_native` + 用户切英文 → **弹确认框**（"中文原著角色，英文会明显影响体验和神韵，确定？"）+ 进书页顶部 **banner**
  - `multilingual` → 仅轻 banner，不弹框
- 组合：banner（告知）+ 仅强中文书弹确认（不烦人）
- **产出可上线**：智能提醒生效

### Phase 5 — AI 对话语言控制
- `buildSystemPrompt` 增 `language` 参数；`streamResponse` 根据 `book.language_mode` + 用户当前 uiLang 决定：
  - `zh_native`：默认注入 `请用中文回复`（除非用户执意英文且已确认 → `Respond in English`）
  - `multilingual`/`en_native`：跟随 uiLang
  - 英文时优先用 `prompt_template_en`，为空回退中文模板 + 追加 "Respond in English"
- **⚠️ 实测关卡**：先拿 1-2 个角色跑英文对话，验证 MiniMax 英文角色扮演质量；不达标则 `zh_native` 暂不开放英文对话
- **产出可上线**：AI 按书说对语言

---

## 5. 自动探测策略（Phase 3 细节）

| 优先级 | 手段 | 说明 |
|---|---|---|
| 1 | 用户 cookie（手动选过）| 最高，永远覆盖 |
| 2 | IP 地理位置 | 国内→zh，海外→en（需 CDN/IP 库；无则跳过）|
| 3 | Accept-Language 头 | 兜底默认判断 |
| 4 | 默认 zh | 全失败时 |

---

## 6. 需大Joe后续支持

- **英文译名清单过目**：书名/角色名机翻后 Tomy 出清单，大Joe 校对（尤其人名，机翻常翻车）
- **AI 英文质量验收**：Phase 5 实测后一起看丁元英英文对话样例，决定是否开放
- **域名策略**：默认同域 `inknowing.ai` 靠 IP/语言切；如需独立海外域名（.com）另议
- **生产机确认**：67.209.182.23（inknowing.ai），本地 7083 验完再上线

---

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 91 文件抽文案漏改/串味 | OpenCode 分批 + Tomy 抽查 + 本地 playwright 回归 |
| SQLite/PG 语法差异 | 迁移脚本按 PG 写，本地对齐；先 dump 备份 |
| MiniMax 英文角色扮演差 | Phase 5 先实测，不达标不开放 zh_native 英文 |
| 双语字段空导致空屏 | 一律"英文空→回退中文"，绝不空 |
| 自动探测误判 | 永远给手动切换按钮 + cookie 记忆 |

---

## 8. 落地节奏建议

- **第一批交付**：Phase 1 + 2 + 3（UI 全英化 + 切换 + 自动探测）→ 一个能跑的英文版试水
- **第二批**：Phase 4 + 5（提醒 + AI 语言）
- **持续**：逐本书补双语内容（大Joe 校译名）

> 编码全程走 OpenCode，Tomy 负责架构/审查/方案；每 Phase 本地 7083 验证 + playwright 回归后再上生产。

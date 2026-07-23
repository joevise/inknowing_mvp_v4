# InKnowing 生产上线安全 / 鲁棒性 / 并发审计报告

> 审计对象：Next.js 14.2.24（App Router）项目 InKnowing
> 审计范围：认证授权、注入、限流并发、密钥、错误处理、Web 安全、生产配置
> 审计方式：静态代码审计（只读，未改动任何代码）
> 结论摘要：**当前状态不建议直接上线（NO-GO）**，存在 3 个高危泄密/越权问题，修复后可预上线。

---

## 0. 事实校正（与任务假设不同的点）

- **数据库不是 better-sqlite3，而是 PostgreSQL（pg 连接池）**。`lib/db/client.ts` 是一个「保留 better-sqlite3 调用面、底层走 pg Pool」的异步适配层（`lib/db/client.ts:17-32`）。因此「单文件锁高并发阻塞」的担忧**不成立**，连接池 `max=20`，参数化占位符 `?→$N` 统一转换（`client.ts:74-77`），事务基于 `AsyncLocalStorage` 绑定单连接（`client.ts:141-166`）。这一层设计质量较高。
- `package.json` 里 better-sqlite3 仍在依赖中，但运行时走 pg，属历史遗留。

---

## 1. 认证与授权

### 【高危】管理员默认密码 `admin123456` 硬编码兜底
- 证据：`lib/auth/admin.ts:14-23` — `getAdminPassword()` 在未设置 `ADMIN_PASSWORD` 时**直接返回 `'admin123456'`** 并仅打一行 warn。
- 风险：若部署时漏配环境变量，管理后台即以公开默认密码可登录，全站书籍/用户/AI 配置沦陷。
- 建议：未配置时应 **fail-closed（抛错拒绝启动或拒绝登录）**，绝不兜底默认密码。

### 【高危】两个管理员 API 完全没有鉴权
- 证据：
  - `app/api/admin/books/batch/route.ts`（PUT 批量上/下架、DELETE 批量删除）——整文件无任何 `requireAdminAuth/checkAdminAuth`，任意匿名请求可批量删除/下架所有书籍。文件头还带 `// @ts-nocheck`。
  - `app/api/admin/stats/route.ts:11` — `GET()` 无鉴权，匿名可读全站统计（书籍/角色/对话/用户总数）。
- 风险：越权数据破坏（批量删书）+ 信息泄露。
- 建议：所有 `app/api/admin/**` 路由入口统一 `const denied = await requireAdminAuth(request); if (denied) return denied;`。最好在源头用一个 admin 专用 middleware 兜底，而非逐个路由手动加。

### 【中】管理员密码为明文比较，无防爆破
- 证据：`lib/auth/admin.ts:30-35` — `password === adminPassword` 明文比较；`app/api/admin/login/route.ts` 无失败计数 / 无限流。
- 风险：可对管理后台密码在线爆破。
- 建议：登录失败次数限流 + 恒定时间比较（`crypto.timingSafeEqual`）。

### 【中】"ADMIN_SESSION_SECRET / SESSION_SECRET" 声明了但未使用
- session/admin token 都是 `randomBytes(32).hex`（`lib/auth/session.ts:24`、`lib/db/sessions.ts:17`），存 DB，用不透明随机 token（无 JWT 签名），本身是合理的 opaque session 设计。但 `.env` 里 `SESSION_SECRET` 实际未参与任何签名/校验，容易误以为有额外保护。
- 建议：删除误导性未用变量或补充实际用途说明。

### 授权（越权 / IDOR）—— 总体做得不错 ✅
- 对话资源做了归属校验：`userOwnsConversation(userId, conversationId)`（`lib/db/conversations.ts:535-543`，`WHERE id=? AND user_id=?`），在 GET/DELETE/messages GET/POST 均前置调用（`app/api/conversations/[id]/route.ts:40,132`、`.../messages/route.ts:39,162`）。
- 收藏：`getUserFavorites/addFavorite/removeFavorite(user.id, …)` 均绑定当前用户（`app/api/favorites/route.ts`）。
- 【低】`app/api/favorites/[bookId]/route.ts:104` `const favorited = isFavorited(...)` **漏了 await**（返回 Promise，恒为 truthy），是功能 bug（收藏状态判断失真），非安全越权。

### Session 机制
- 生成：32 字节 CSPRNG 随机 hex（`session.ts:24`），✅ 强度足够。
- 过期：用户 24h、admin 8h，过期即删（`sessions.ts:112-118`）。✅
- 【中】无 session 滑动续期强制、无并发会话上限、登录不清旧 session（`createSession` 每次新建），长期会积累 session 行（有 `deleteExpiredSessions` 但**未见定时任务/cron 调用**）。建议加清理调度。

---

## 2. SQL 注入与输入验证

### 参数化 —— 总体安全 ✅
- 所有 `db().prepare()` 的**值**都走 `?` 占位符 + `.run/.get/.all(...args)`，适配层转 `$N`（`client.ts:74-86`），无字符串拼接用户值进 SQL。
- 动态子句构造（`SET ${updates.join(', ')}`、`WHERE ${conditions.join(' AND ')}`，见 `lib/db/book-requests.ts:131/171/219`、`users.ts:155`、`books.ts:199/256`、`conversations.ts:161/178/295/361/602`、`messages.ts:236-260`、`user-memories.ts:111/141`）拼接的是**代码内固定的列名/常量条件字符串**，值仍走 `?`。**不构成注入**，但属"脆弱模式"（一旦有人把用户输入塞进 conditions 就中招）。

### 【低】`ORDER BY created_at ${order.toUpperCase()}` 直插
- 证据：`lib/db/messages.ts:89`。`order` 目前来自内部 options（asc/desc），未直接暴露给外部路由，但仍是**未白名单化的排序方向直插**。建议改成 `order === 'desc' ? 'DESC' : 'ASC'` 显式白名单。

### 【中】分页 limit/offset 无上限保护
- 证据：`app/api/conversations/route.ts:108-109`、`.../messages/route.ts:171-172`、`app/api/search`、`book-requests` 等，均 `parseInt(searchParams.get('limit') || 'N')`，**无 Math.min 上限、无 NaN 兜底**。攻击者可传 `limit=99999999` 触发大结果集拖库 / OOM，或 `limit=abc` 导致 NaN 进 SQL。
- 建议：统一 `const limit = Math.min(Math.max(parseInt(...)||默认, 1), 100)`。

### 【中】缺少 schema 校验层（无 zod）
- 依赖里无 zod/valibot；各路由手写零散校验。register 校验了邮箱/密码/邀请码，但 **username 未做长度/字符集校验**（`app/api/auth/register/route.ts:39`），仅 update-username 处才限制 2-20（`update-username/route.ts:44`）。入参校验不一致。
- 建议：引入 zod 统一入参 schema。

---

## 3. 限流与并发

### 【高危】全站零 rate limiting
- 事实：依赖无任何限流包，代码全局 grep 无 rate-limit 逻辑。以下敏感/昂贵接口均可被无限刷：
  - `POST /api/auth/login`、`/api/admin/login`（爆破）
  - `POST /api/auth/register`（批量注册，虽需邀请码但邀请码校验也可被枚举刷）
  - `POST /api/conversations/[id]/messages`（每次触发 LLM 调用，直接烧钱/打爆通义千问配额）
  - `POST /api/copyright-reports`（**无鉴权公开表单**，`app/api/copyright-reports/route.ts:16`，可被灌垃圾）
  - `POST /api/search`（每次调用 LLM 做意图分析，`app/api/search/route.ts:53`，可被刷爆 LLM 成本）
- 建议：上线前**必须**加接入层限流（Nginx/网关限流，或 `@upstash/ratelimit`+Redis 按 IP/用户）。LLM 类接口尤其要限。

### 【中】20 轮/天限额存在 check-then-act 竞态
- 证据：`app/api/conversations/[id]/messages/route.ts:65-83`（先 `getTodayUsage` 判断），`:104-110`（成功后 `incrementUsage`）。读与写**非原子**。
- `incrementUsage`（`lib/db/daily-usage.ts:45-76`）本身是"先 SELECT 再 UPDATE/INSERT"，**非原子 UPSERT**，高并发下同一用户并行请求会：①同时通过 20 轮检查超发；②并发 INSERT 撞唯一键或丢计数。
- 风险：用户可并发绕过每日限额（放大 LLM 成本），或计数错乱。
- 建议：改为单条原子语句 `INSERT ... ON CONFLICT (user_id, usage_date) DO UPDATE SET message_count = daily_usage.message_count + 1 RETURNING message_count`，并在返回值 > 限额时拒绝（把"检查+自增"合并成一次原子写）。

### 数据库连接/并发 ✅（已纠正原假设）
- pg 连接池 `max=20`（可 `PG_POOL_MAX` 调），`connectionTimeoutMillis=10s`，`idleTimeoutMillis=30s`（`client.ts:27-32`）。事务用 AsyncLocalStorage 绑连接，正确。
- 【低】schema 引导 `ensureSchema()` 每次查询前 await 单例 promise（`client.ts:66-69,81`），首启幂等但每请求多一次 await 检查，可接受。
- 【低】`池 max=20` 对"10 万级用户"目标偏小，需按压测调；且每个 LLM 请求期间不占 DB 连接（好），但同步 DB 写多时 20 连接可能成瓶颈。

---

## 4. 密钥与敏感信息

### 【高危 - 最严重】真实密钥被提交进 Git
- 证据：`git ls-files` 显示 **`.env.local.backup.2025-10-07T15-56-41-903Z` 已被 git 跟踪**，且内含真实值：
  - `QWEN_API_KEY=sk-89db9e...`（真实通义千问 key）
  - `ADMIN_PASSWORD=admin12...`（疑似 `admin123456`）
  - `SESSION_SECRET / ADMIN_SESSION_SECRET`
- `.gitignore` 只忽略了 `.env.bak.*`，**匹配不到 `.env.local.backup.*`** 这个文件名，导致泄露。
- 风险：**极高**。任何拿到仓库的人（含历史 commit）即可盗用 LLM key 刷账单、登录管理后台。
- 建议（立即）：①从 git 历史彻底移除该文件（`git rm --cached` + 重写历史/BFG）；②**轮换所有已泄露密钥**（QWEN key、admin 密码、session secret）；③修正 `.gitignore` 覆盖 `.env*.backup*`、`*.backup*`。

### 密钥加载方式
- LLM key、ADMIN_PASSWORD 均从 `process.env` 读取（`lib/ai/config.ts`、`admin.ts:15`），方式正确；问题在①默认兜底密码（见 §1）②备份文件泄露。
- `.env.example` 用占位符，规范 ✅。

---

## 5. 错误处理与鲁棒性

### try/catch 覆盖 ✅（总体到位）
- 抽查的路由基本都有顶层 try/catch，失败返回结构化 JSON + 500，未 crash 进程。

### 【中】错误信息把内部 message 直接透传前端
- 证据：多处 `error: error instanceof Error ? error.message : '...'`（如 `conversations/[id]/route.ts:105`、`messages/route.ts:135`、`copyright-reports/route.ts:51`、`search` 等）。DB/LLM 抛出的原始 message（可能含表名、连接串片段、内部路径）会回给客户端。
- 建议：生产环境统一返回泛化文案，详细错误只进服务端日志（可加 requestId 关联）。

### 【中】运行时 SQL 方言 bug（会 500）
- 证据：`app/api/user/update-username/route.ts:57` 使用 **SQLite 专有函数 `datetime('now')`**，但运行库是 PostgreSQL，PG 下 `datetime()` 不存在 → 该接口**必 500**。属迁移遗漏。
- 建议：改用 `NOW()` 或参数化时间戳；全库再 grep 一遍其他 sqlite-ism（已确认仅此一处 `datetime('now')`）。

### LLM 失败处理 ✅
- `lib/ai/client.ts:33-38` 客户端配置了 `timeout` + `maxRetries`；另有 `executeWithRetry`（`client.ts:70+`）自带重试。有超时与重试，鲁棒性尚可。
- 【低】未见降级策略（LLM 全挂时给用户兜底提示 vs 直接 500），建议补充。

### 【低】`batch/route.ts` 内 `updateBook(id,...)` 未 await（`:37`），且用同步 `.filter` 统计成功数——pg 适配层是 async，成功计数不可靠。

---

## 6. XSS / CSRF / CORS

### XSS —— 基本安全 ✅
- 全仓 **无 `dangerouslySetInnerHTML`**（已 grep app/components）。
- 对话内容用 `react-markdown` 渲染（`components/conversation/MarkdownMessage.tsx`），**未启用 `rehype-raw` / `allowDangerousHtml`**，react-markdown 默认转义原始 HTML → 用户/LLM 输出中的 `<script>` 不会执行。✅
- 用户名、投诉内容等作为普通文本渲染，React 默认转义。✅

### 【高危】CORS 配置为通配 `*`
- 证据：`next.config.js` `headers()` 对 `/api/:path*` 设 `Access-Control-Allow-Origin: *` + 允许 `Authorization`、全 methods。
- 风险：任意站点可跨域调你的 API。虽然认证走 httpOnly cookie（跨站默认不带且 `*` 下浏览器禁止 credentialed 请求带 cookie），直接凭证泄露被浏览器挡了一部分；但公开接口（search/copyright/stats）可被任意站点滥用，且与"未来加 token 鉴权"冲突。
- 建议：白名单具体前端域名，去掉 `*`；对需要凭证的接口设 `Allow-Credentials` + 精确 Origin。

### 【中】CSRF 防护不足
- session cookie `sameSite:'lax'`（`cookie.ts:17`、`login/route.ts:87`）提供了基础 CSRF 缓解，但**无 CSRF token**。lax 对跨站 POST 有一定防护，但 admin 的 state-changing GET（如无鉴权的 batch 若被改造）风险更高。
- 【中】`lib/auth/cookie.ts:16` `secure:false` **硬编码**——虽 login 路由单独按 NODE_ENV 设了 secure，但通过 `cookie.ts` 的 `setSessionCookie/setAdminSessionCookie` 路径（register 用的就是它，`register/route.ts:123`）会下发 **非 secure cookie**，HTTP 下可被中间人窃取。admin/login 甚至手写 Set-Cookie 明确不带 Secure（`admin/login/route.ts:64-69`，注释"bypass Secure flag"）。生产 HTTPS 下必须 Secure。

### 【中】`typescript.ignoreBuildErrors` 与 `eslint.ignoreDuringBuilds` 均为 true
- 证据：`next.config.js:5-6`。构建期忽略所有 TS 类型错误和 lint，掩盖了如上文 `datetime('now')`、漏 await、`@ts-nocheck` 等本可被发现的问题。
- 建议：上线前置为 false，修完类型错误再构建。

---

## 7. 生产配置

### Docker ✅ / ⚠️
- `Dockerfile` 用多阶段 + `output:standalone` + 非 root 用户（`nextjs:1001`），✅ 良好实践。
- 【低】builder 阶段 `apk add chromium`（Playwright 用）进了构建镜像，但 runner 未装 chromium——若运行时真需 Playwright（如 douban 封面抓取）会失败；若不需要则多余。需确认。
- `docker-compose.yml`：postgres 仅绑 `127.0.0.1:5433` 不对外 ✅；有 `healthcheck` + `depends_on: service_healthy` ✅。
- 【中】**app 服务本身无 healthcheck**、**chromadb 端口 `8002:8000` 对外暴露**（ALLOW_RESET=TRUE 且无鉴权，内网/公网可被 reset 清空向量库）。
- 【中】密钥经 `env_file: .env` 注入，配合 §4 的备份泄露问题，需确保 `.env` 本体不入库（`.gitignore` 已忽略 `.env`，✅，问题只在那个 backup 文件）。

### 优雅关闭 —— 缺失
- 【中】无 SIGTERM 处理、无 `closeDb()`（`client.ts:168` 已提供但无处调用）在关停时排空连接池。容器滚动更新时可能中断进行中的事务/请求。
- 建议：加信号处理，drain 连接池与在途请求。

---

## 结论：是否可预上线？

**当前结论：NO-GO（不可直接上线）。**

代码底层质量不差（pg 连接池 + 事务隔离设计良好、参数化彻底、对话资源归属校验完整、markdown 无 XSS、LLM 有超时重试），但存在**会直接导致密钥泄露、后台被接管、成本被刷爆**的高危问题。修复下方 Top 5 后可进入预上线（灰度）阶段，同时补齐限流与优雅关闭。

### Top 5 必须先修（P0）

1. **【泄密】清除并轮换已提交进 git 的真实密钥**
   `.env.local.backup.2025-10-07T15-56-41-903Z` 含真实 QWEN_API_KEY / ADMIN_PASSWORD / SESSION_SECRET。→ 从 git 历史移除（BFG/filter-repo）+ **轮换全部密钥** + 修 `.gitignore`（加 `.env*backup*`）。

2. **【越权】给无鉴权的 admin 接口加鉴权**
   `app/api/admin/books/batch/route.ts`、`app/api/admin/stats/route.ts` 目前匿名可调（可批量删书/读统计）。→ 统一 `requireAdminAuth`，并在 admin 路由源头加兜底。

3. **【弱口令】移除 admin 默认密码兜底 + 上限流**
   `lib/auth/admin.ts:19` 的 `'admin123456'` 兜底改为未配置即拒绝启动/拒绝登录；admin/user 登录加失败限流与恒定时间比较。

4. **【成本/滥用】给敏感与 LLM 接口加 rate limiting**
   全站零限流。至少对 login/register/messages(LLM)/search(LLM)/copyright-reports 按 IP+用户限流（网关或 Redis 令牌桶）。

5. **【竞态+运行 bug】修每日限额原子性 + update-username 的 PG 方言 bug**
   `messages/route.ts` 的 check-then-act 改为原子 `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`（`daily-usage.ts`）；`update-username/route.ts:57` 的 `datetime('now')` 改 `NOW()`（当前该接口必 500）。

### 次优先（P1，预上线并行修）
- CORS 去 `*` 改白名单；cookie `secure` 生产强制 true（`cookie.ts:16` 硬编码 false）。
- 分页 limit/offset 加上限与 NaN 兜底。
- `next.config.js` 关闭 `ignoreBuildErrors`/`ignoreDuringBuilds` 并修完类型错误。
- chromadb 不对外暴露端口 / 关 ALLOW_RESET；app 加 healthcheck；加 SIGTERM 优雅关闭（调 `closeDb()`）。
- 错误响应泛化，勿透传内部 message；补 session 过期清理调度；引入 zod 统一入参校验。
- 修 `favorites/[bookId]:104` 漏 await、`batch` 漏 await 等功能性 bug。

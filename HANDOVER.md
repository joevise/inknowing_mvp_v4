# InKnowing 项目交接文档（2026-06-29 版）

> **生成时间**：2026-06-29
> **整理人**：Joey（dajoe_joey workspace）
> **上一版本**：2026-06-19（Dr.EOJAD）—— 本文档为全量重写
> **接收方**：下一位接手 InKnowing 的同事

---

## 0. TL;DR（30 秒读完）

- 线上 https://inknowing.ai 持续稳定，**实测 200 / 45ms**。
- 6/20 协作者完成 **SQLite → PostgreSQL 全量迁移**，业务已跑在 PG 上（messages 222 / characters 87 / books 57 / users 5 / user_memories 4）。
- 6/21~6/22 同事在 **服务器上直接编辑** 加了：**书内记忆隔离**、**书内交互足迹**、**空对话复用**、**对话界面重构**。这部分**之前未入 git**，今天已被 Joey 拉回提交到分支 `sync/server-2026-06-22`，PR 待 review/merge。
- 当前 GitHub 三个分支：`main`（6/19 老）/`develop`（6/20 PG 三件套）/`sync/server-2026-06-22`（**最新，跟线上一致**）。
- 部署服务器 `/opt/inknowing` **仍不是 git 仓库**，靠 rsync 部署 —— 这是接手第一个要决定的事。

---

## 1. 项目一句话

Next.js 14 全栈 AI 阅读助手：用户读书 + 跟书中"角色"对话 + RAG 检索原文。书籍可由用户发起请求自动入库。**记忆按书隔离，同书角色共享、跨书清零。**

---

## 2. 当前状态（实测，✅ 全绿）

| 项 | 状态 |
|---|---|
| **域名** | ✅ `https://inknowing.ai` + `https://www.inknowing.ai` |
| **HTTPS** | ✅ Caddy + Let's Encrypt 自动续期 |
| **GitHub** | `https://github.com/joevise/inknowing_mvp_v4` |
| **最新分支** | **`sync/server-2026-06-22`**（HEAD = `4928593`，与线上一致） |
| **部署服务器** | `67.209.182.23`（InKnowing 专用 VPS，**不是** .54） |
| **部署路径** | `/opt/inknowing/`（⚠️ 非 git 仓库） |
| **容器** | `inknowing-app`(Up 6d) / `inknowing-pg`(Up 8d) / `inknowing-chromadb`(Up 4w) |
| **磁盘 / 内存 / 负载** | 41% / 1G of 4G / 0.03 |
| **宿主 uptime** | 33 天 |

### 端口

| 端口 | 服务 |
|---|---|
| 443 → Caddy → :3001 | 公网入口 |
| :3001 (host) → :3000 (container) | inknowing-app |
| :8002 (host) → :8000 (container) | inknowing-chromadb |
| 127.0.0.1:5433 → :5432 | inknowing-pg（**仅本机**） |

---

## 3. 🚨 三个版本的版本树（接手必读）

```
main (6/19) ── 老 SQLite 版本，只有文档 commit
  │
  └── develop (6/20 23:56) ── 协作者推的 PG 三件套
        │   ├─ f71bb6c feat(pg+memory): 全库异步化 PG 适配层 + 跨会话用户记忆
        │   ├─ b2bd85e feat(s3): SQLite→PG 数据迁移脚本
        │   └─ 0820361 test(s4): 端到端记忆测试，实测全绿
        │
        └── sync/server-2026-06-22 (6/29 by Joey) ── 把服务器 6/21~6/22 改动捞回入库
              └─ 4928593 sync: 同步服务器 6/21~6/22 未入库改动到 develop
                  ├─ 书内记忆隔离 (user_memories.source_book_id 过滤)
                  ├─ 书内交互足迹 (getInteractedCharactersInBook + buildBookInteractionBlock)
                  ├─ 空对话复用 (findReusableEmptyConversation)
                  ├─ 对话界面拆分 (ConversationView/ConversationWorkspace)
                  ├─ docker-compose 显式 postgres 服务声明
                  └─ PG 兼容修复 (characters.ts GROUP BY 字段补齐)
```

**接手第一步**：把 `sync/server-2026-06-22` 合到 `develop`（→ 再合 `main`），然后**在 develop 上**继续开发，**别再直接改服务器**。

---

## 4. 数据库架构（已变更！）

### 从 SQLite 迁到 PostgreSQL 16
- **连接**：app 在 docker network 通过 `postgres:5432` 服务名访问；宿主迁移脚本通过 `127.0.0.1:5433` 访问。
- **凭据**：`DATABASE_URL` 在 `.env` 里（服务器 `/opt/inknowing/.env`）。
- **适配层**：`lib/db/client.ts` 实现了 `better-sqlite3` 兼容的异步接口
  - `db().prepare(sql).get/all/run(...args)` → 返回 Promise
  - 占位符 `?` → `$N` 自动转换
  - `transaction(fn)` 基于 `AsyncLocalStorage` 绑定连接
  - 连接池 max=20（可经 `PG_POOL_MAX` 调）
- **schema**：`lib/db/schema.ts` 内嵌 `PG_SCHEMA_SQL` + `PG_TRIGGERS_SQL`，启动时自动 ensure。
- **迁移脚本**：`scripts/migrate-sqlite-to-pg.ts`（已执行完成，逐表搬运 + 行数/内容双校验）。

### PG 当前表（11 张）
| 表 | 行数 |
|---|---|
| messages | 222 |
| characters | 87 |
| books | 57 |
| conversations | 48 |
| sessions | 48 |
| config | 44 |
| favorites | 6 |
| users | 5 |
| user_memories | 4 |
| documents | 0 |
| user_book_requests | 0 |

### SQLite 何处去
本地 `inknowing.db` 还在（迁移源），生产代码已**不再读它**。可以归档/删除（确认 PG 兜底后）。

---

## 5. 🧠 用户记忆系统（6/20~6/22 新加）

### 设计哲学：按书隔离
- **同一本书内**：所有角色共享读者记忆（你跟简爱聊过的事，罗切斯特能知道）
- **跨书**：完全清零（你跟简爱聊的事，三体人不知道）
- 通过 `user_memories.source_book_id` 字段过滤实现

### 关键函数
| 文件 | 函数 | 作用 |
|---|---|---|
| `lib/db/user-memories.ts` | `getTopMemoriesForInjection(userId, bookId?, limit=12)` | 按书取最高重要度记忆 |
| `lib/services/user-memory-service.ts` | `buildMemoryContextBlock(userId, bookId?)` | 生成注入对话的记忆文本块 |
| `lib/services/user-memory-service.ts` | `buildBookInteractionBlock(userId, bookId, currentCharacterId, bookTitle)` | 生成"书内交互足迹"块 |
| `lib/db/conversations.ts` | `getInteractedCharactersInBook(userId, bookId, excludeCharacterId?)` | 查同书已对话过的角色名（去重） |
| `lib/services/user-memory-service.ts` | `extractAndStoreMemories(...)` | 对话后异步抽取并落库 |

### 交互足迹示例（注入到 prompt）
```
[这位读者在《简爱》中的交流足迹]
该读者此前还与以下角色有过对话：罗切斯特、海伦·彭斯。
你与他们同属这本书的世界，可以自然地知晓这一点，就像听同伴提起过这位读者；
但你并不知道他们具体聊了什么。
```

### 验证脚本
- `scripts/verify-memory.ts` —— 检查记忆抽取与注入是否生效
- `scripts/e2e-memory-test.ts` —— 端到端：注册→登录→对话→记忆抽取→跨会话注入

---

## 6. 🛠️ 对话流改动（6/22）

### 空对话复用（消除堆积）
之前每次进对话页都会 `createConversation`，产生大量 0 消息空壳。
现在 `ConversationService.createConversation()` 内先查 `findReusableEmptyConversation`（同 user+book+character+type 且 0 消息），命中则直接复用。

### 组件拆分
原 `app/conversations/[id]/page.tsx`（720 行）拆成：
- `app/conversations/[id]/page.tsx`（240 行，路由 + 数据获取）
- `components/conversation/ConversationView.tsx`（511 行，UI 主体）
- `components/conversation/ConversationWorkspace.tsx`（82 行，布局壳）

---

## 7. 🌐 Caddy（保持不变）

`/etc/caddy/Caddyfile`：
```caddyfile
{ order rate_limit before basicauth }

inknowing.ai, www.inknowing.ai {
    encode zstd gzip
    # 全局限流: 60req/s + 600req/min per IP
    # /admin 严格限流: 30/min
    reverse_proxy 127.0.0.1:3001
    # /covers/* 转发段
}
```

⚠️ **历史教训**：当年加 HTTPS 时 Caddy ACME 403 死锁，根因是同时配了 `inknowing.ai {}` 和 `http://67.209.190.54 { reverse_proxy ... }` —— IP 兜底块劫持了 80 端口的 `.well-known/acme-challenge/`。**修复方案：只保留域名站点块**，删任何 `:80` 或 `http://IP` 全局兜底。

---

## 8. 🚨 接手必须先决策的事

### Q1：`/opt/inknowing` 要不要转成 git 仓库？
**强烈建议转**。当前 rsync 流程导致的事故就是本次：6/21~6/22 改动只活在服务器上 10 天没人发现。
- 方案 A：`cd /opt && mv inknowing inknowing.old && git clone -b develop ... inknowing && 把 .env/data/uploads/public/covers 从 .old 拷回`
- 方案 B：继续 rsync，但每次部署前先 `git status` 服务器确认无未入库改动

### Q2：把 `sync/server-2026-06-22` 怎么合？
建议先 review PR → merge 到 `develop` → 再决定 `develop → main` 节奏（PG 切换是大改动，main 是否还想保留 SQLite 版本作为 fallback？）

### Q3：CI/CD
仓库里有 `.github/workflows/deploy.yml`，**当前线上不是它部署的**（部署时间和 workflow 跑过的痕迹对不上）。要么修好这个 workflow，要么删掉避免误导。

---

## 9. AI Provider 配置

- **主**：阿里通义千问 `qwen-max` + `text-embedding-v4`（OpenAI 兼容模式 `compatible-mode/v1`）
- **可切**：OpenRouter（commit `2c85d19` 起，admin 面板配）
- **Embedding 兼容层**：`lib/rag/chroma-client.ts` 自写 `DashScopeEmbeddingFunction`
- **运行时配置**：从 PG `config` 表读（44 行），管理后台 `/admin/settings` 可改

---

## 10. 关键路径速查

| 用途 | 路径 |
|---|---|
| Next.js 页面 | `app/**` |
| API routes | `app/api/**` |
| 数据库适配层 | `lib/db/client.ts` |
| Schema (PG) | `lib/db/schema.ts` |
| ORM-ish (每实体) | `lib/db/{books,characters,conversations,messages,user-memories,...}.ts` |
| 业务服务 | `lib/services/**` |
| AI 客户端 | `lib/ai/{client,chat,embedding,config,model-resolver}.ts` |
| RAG | `lib/rag/{chroma-client,vectorizer}.ts` |
| 管理后台 | `app/admin/**` |
| 数据库迁移 | `scripts/migrate-sqlite-to-pg.ts` |
| E2E 测试 | `scripts/e2e-memory-test.ts` |

---

## 11. 服务器运维速查

```bash
# SSH
ssh root@67.209.182.23   # 密码见密码库

# 部署位置
cd /opt/inknowing

# 看状态
docker compose ps
docker compose logs app --tail 100 -f

# PG 进数据库
docker exec -it inknowing-pg psql -U inknowing -d inknowing

# 重启
docker compose restart app

# .env 在
/opt/inknowing/.env  (含 DATABASE_URL / POSTGRES_PASSWORD / 各家 AI key)
```

---

## 12. 给接手同事的话

1. **先合 PR**（`sync/server-2026-06-22` → `develop`），让 git 跟线上一致。
2. **再决定第 8 节那三个问题**，不要先写新功能。
3. 新功能开发在 `develop` 分支上；改完本地起，过了再合 main 部署。
4. 服务器**别再直接 vim 改代码**了 —— 这次是 Joey 帮捞，下次可能就被 rsync 覆盖丢了。

---

## 13. 联系

- **Owner**：大Joe（刘正阳）
- **本次整理**：Joey（OpenClaw agent，dajoe_joey workspace）
- **遇到问题**：在飞书直接 @ 大Joe

祝接手顺利 🙌

# InKnowing 项目交接文档

> **生成时间**：2026-06-19
> **交接人**：Dr.EOJAD（joevise workspace）
> **接收方**：下一位负责 InKnowing 的 agent

---

## 1. 项目一句话

Next.js 14 全栈 AI 阅读助手：用户读书 + 跟书中的"角色"对话 + RAG 检索原文。书籍可由用户发起请求自动入库。

---

## 2. 当前状态（实测）

| 项 | 状态 | 备注 |
|---|---|---|
| **GitHub** | `https://github.com/joevise/inknowing_mvp_v4` `main=0484550` | 与本地一致 |
| **本地代码** | `/home/elttilz/joevise-projects/inknowing/` | 干净（无 uncommitted）|
| **线上代码** | `/opt/inknowing/`（67.209.190.54）`HEAD=7cb89ad` | ⚠️ **比远程落后 10 个 commit** |
| **线上服务** | ❌ **未运行** | `:3001`/`:8002` 都不通；无 `inknowing-app` 容器；无 systemd unit |
| **ChromaDB 容器** | 跑着但是别项目的（brand2context）| 8002 端口空着 |
| **数据库** | SQLite `inknowing.db` 在仓库根（开发模式遗留） | 生产应放 `data/` 卷 |
| **域名/HTTPS** | `inknowing.ai` 域名已购，Caddy 配过但未启 | 见 `core_memory/lessons.md` ACME 教训 |

---

## 3. 关键技术决策（已踩坑确认）

- **数据库**: SQLite + better-sqlite3（轻量，单容器够用）
- **向量库**: ChromaDB（独立容器，端口 8002 → 容器内 8000）
- **AI Provider**: 阿里通义千问 `qwen-max` + `text-embedding-v4`（兼容 OpenAI 协议走 `compatible-mode/v1`）
  - 可选切到 OpenRouter（commit `2c85d19` 加的，admin 面板可配）
- **Embedding 兼容层**: `lib/rag/chroma-client.ts` 自写 `DashScopeEmbeddingFunction`（Chroma 默认 OpenAIEmbeddingFunction 不兼容）
- **认证**: cookie-based，**生产模式强制 HTTPS**（这是 3001 端口直连无法登录的根因）
- **封面图**: `/api/covers/[filename]` 动态路由 + Caddy `/covers/*` 转发（commit `0484550`）

---

## 4. 已交付功能（按 commit 倒序）

| Commit | 功能 |
|---|---|
| `0484550` | 封面图动态 API + Caddy 转发 |
| `58ee004` | 管理后台：豆瓣重新抓封面 / 手动上传封面 |
| `4bdbaee` | 用户请求书籍自动发布 + `/my-requests` 页面 + Header 入口 |
| `83e35ea` | 修复 TDZ bug（recognitionResult 引用顺序）+ 豆瓣封面 |
| `6208a4d` | `/search` 结果页 + 入口改名"添加一本书" |
| `532dbff` | 用户发起加书流程 MVP |
| `7cb89ad` | 管理后台：书籍标题可点 + 零字符检测精度 |
| `52d3468` | 管理后台：角色管理闭环 |
| `2c85d19` | 管理后台 settings 面板接真实 LLM/embedding + OpenRouter |
| `69c55dc` | 支持 OpenRouter chat + Qwen text-embedding-v4 |

---

## 5. 关键文件 / 入口

- `app/`：Next.js App Router 页面（含 admin、my-requests、search）
- `lib/auth/check-auth.ts`：认证守卫（原仓库缺，是我补的）
- `lib/db/`：SQLite ORM（`books.ts` / `characters.ts` / `client.ts` / `seed.ts`）
- `lib/rag/chroma-client.ts`：自定义 Embedding + 向量增删查
- `Dockerfile` + `docker-compose.yml`：双容器编排（app + chromadb）
- `.env`：通义 KEY + session 配置（不入 git）
- `scripts/`：种子脚本、批处理工具
- 报告：`AI_SERVICE_README.md` / `ARCHITECTURE_COMPLIANCE_REPORT.md` / `DEVELOPMENT_PROGRESS.md` / `FINAL_REPORT.md` / `IMPLEMENTATION_STATUS.md`

---

## 6. 阻塞项 & 待办

### 🔴 P0 必须先做
1. **线上代码同步**：`/opt/inknowing` 落后 10 个 commit，要 `git pull && docker compose up -d --build`
2. **服务重启**：当前 app/chroma 容器都没运行，要 `docker compose up -d`
3. **HTTPS 上线**：cookie 登录必须 HTTPS。`inknowing.ai` 域名在手，Caddy 之前 ACME http-01 失败（403），方案在 `core_memory/lessons.md` 有记录（DNS challenge / 改 80 端口可达）

### 🟡 P1
4. **数据库迁移**：`inknowing.db` 放仓库根不健康，应进 `data/` 卷
5. **ChromaDB 数据备份**：`data/vectors/` 未见备份策略
6. **未完全解决的循环依赖**：`lib/rag/chroma-client.ts` 的 `queryByText` 可能有循环依赖问题（`memory/2026-03-23.md` 记录）

### 🟢 P2（功能演进）
7. 移动端响应式（当前以 PC 为主）
8. 角色对话多轮记忆（当前是无状态的）
9. 书籍审核流程（用户请求自动发布的兜底）

---

## 7. 接手第一天就该跑通

```bash
# 1. SSH 到 67.209.190.54
ssh root@67.209.190.54  # 密码: LMqdn0MZxhyl

# 2. 同步代码
cd /opt/inknowing
git pull

# 3. 起服务
docker compose up -d --build

# 4. 看健康
docker compose ps
curl http://localhost:3001
curl http://localhost:8002/api/v1/heartbeat

# 5. 看日志
docker compose logs -f --tail=100 app
```

如果 build 失败 → 看 `memory/2026-03-23.md` 的"已修复构建问题"列表（11 项），多半在那里。

---

## 8. 凭据 & 端点

- **SSH 67.209.190.54**：`root` / `LMqdn0MZxhyl`
- **管理后台**：`admin@system` / `admin123456`
- **通义 API Key**：见 `/opt/inknowing/.env`（`DASHSCOPE_API_KEY`）
- **GitHub**：`joevise/inknowing_mvp_v4`（private）

---

## 9. 同源参考资料

- 大记忆：`~/.openclaw/workspaces/joevise/core_memory/projects.md`（InKnowing 段）
- 教训：`~/.openclaw/workspaces/joevise/core_memory/lessons.md`（InKnowing 段，含 Caddy ACME 失败修复）
- 日志：`~/.openclaw/workspaces/joevise/memory/2026-03-23.md` / `2026-03-24.md` / `2026-03-28.md`
- 仓库内：`FINAL_REPORT.md` / `DEVELOPMENT_PROGRESS.md` / `IMPLEMENTATION_STATUS.md`

---

## 10. 一句话给新 agent

> 项目代码是稳的（10 个 commit 是功能演进，不是返工），**真正的阻塞只有运维**：线上服务没起，HTTPS 没上。把这两件做完就能继续做产品功能。

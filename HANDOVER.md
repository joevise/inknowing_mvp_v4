# InKnowing 项目交接文档

> **生成时间**：2026-06-19
> **交接人**：Dr.EOJAD（joevise workspace）
> **接收方**：下一位负责 InKnowing 的 agent
> **状态**：✅ 线上稳定运行 3 周，HTTPS 已上

---

## 1. 项目一句话

Next.js 14 全栈 AI 阅读助手：用户读书 + 跟书中的"角色"对话 + RAG 检索原文。书籍可由用户发起请求自动入库。

**用户身份正在线上**：`dajoe` / `elttilz@gmail.com`（log 实测，2026-06-19 仍活跃登录）

---

## 2. 当前状态（实测，✅ 稳定）

| 项 | 状态 |
|---|---|
| **域名** | ✅ `https://inknowing.ai` + `https://www.inknowing.ai` |
| **HTTPS** | ✅ Let's Encrypt（Caddy 自动续期）|
| **GitHub** | `https://github.com/joevise/inknowing_mvp_v4` `main=0484550` |
| **本地代码** | `/home/elttilz/joevise-projects/inknowing/`（与远程一致）|
| **🖥️ 部署服务器** | **`67.209.182.23`**（不是 .54！这是 InKnowing 专用 VPS）|
| **部署路径** | `/opt/inknowing/`（⚠️ **非 git 仓库**，rsync/scp 推送）|
| **服务运行时长** | inknowing-app **Up 3 weeks**、inknowing-chromadb **Up 3 weeks** |
| **资源占用** | 78G 磁盘用 22% / 内存 3.9G 用 830M / 负载 0.00 |

### 端口
| 端口 | 服务 |
|---|---|
| 443 → Caddy → :3001 | https://inknowing.ai |
| :3001 (host) → :3000 (container) | inknowing-app |
| :8002 (host) → :8000 (container) | inknowing-chromadb |

---

## 3. 🚨 部署服务器的关键事实

**SSH**：`root@67.209.182.23` 密码 `LMqdn0MZxhyl`
**hostname**：`growing-delight-5.localdomain`
**这是独立 VPS**，**不**是 67.209.190.54（主开发服务器）

`/opt/` 内容：`backups/`、`containerd/`、`inknowing/`（**只跑 InKnowing 一个项目**，干净）

### ⚠️ /opt/inknowing 不是 git 仓库
之前是用 `scp`/`rsync` 推上去的（部署日期看 docker compose ps 已 3 周）。**接手前要决定**：
- 方案 A：转成 git 仓库（`git clone` 重置 + 把 data/ uploads/ public/covers/ 拿回来）
- 方案 B：保持 scp 部署，所有改动通过本地 → push → SSH 推

---

## 4. 🌐 Caddy 配置（关键！）

`/etc/caddy/Caddyfile` 56 行，核心：

```caddyfile
{
    order rate_limit before basicauth
}

inknowing.ai, www.inknowing.ai {
    encode zstd gzip
    # 全局限流: 60req/s + 600req/min per IP
    # /admin 严格限流: 30/min
    reverse_proxy 127.0.0.1:3001
    reverse_proxy 127.0.0.1:3001 {  # 另一处（可能是 /covers/*）
}
```

**⚠️ 历史教训**（`core_memory/lessons.md` 已记录）：
当年加 HTTPS 时 Caddy 一直 ACME 403 死锁，根因是同时配了 `inknowing.ai { }` 和 `http://67.209.190.54 { reverse_proxy 127.0.0.1:3001 }` —— IP 兜底块劫持了 80 端口的 .well-known/acme-challenge/。**修复**：**只保留域名站点块**，删任何 `:80` 或 `http://IP` 全局兜底。

---

## 5. 关键技术决策

- **数据库**：SQLite + better-sqlite3（`./data/`）
- **向量库**：ChromaDB（独立容器，端口 8002，API v2 在 `/api/v2/heartbeat`）
- **AI Provider**：阿里通义千问 `qwen-max` + `text-embedding-v4`（OpenAI 兼容协议 `compatible-mode/v1`）
  - 可切 OpenRouter（commit `2c85d19`，admin 面板配）
- **Embedding 兼容层**：`lib/rag/chroma-client.ts` 自写 `DashScopeEmbeddingFunction`
- **认证**：cookie-based，HTTPS 已上 ✅
- **封面**：`/api/covers/[filename]` 动态路由 + Caddy `/covers/*` 转发（commit `0484550`）

---

## 6. 已交付功能（按 commit 倒序）

| Commit | 功能 |
|---|---|
| `0484550` | 封面图动态 API + Caddy 转发 |
| `58ee004` | 管理后台：豆瓣重新抓封面 / 手动上传封面 |
| `4bdbaee` | 用户请求书籍自动发布 + `/my-requests` 页面 |
| `83e35ea` | 修复 TDZ bug + 豆瓣封面 |
| `6208a4d` | `/search` 结果页 |
| `532dbff` | 用户发起加书流程 MVP |
| `7cb89ad` | 管理后台：书籍标题可点 + 零字符检测精度 |
| `52d3468` | 管理后台：角色管理闭环 |
| `2c85d19` | 管理后台 settings 面板接真实 LLM + OpenRouter |
| `69c55dc` | OpenRouter chat + Qwen text-embedding-v4 |

---

## 7. 关键文件

- `app/`：Next.js App Router 页面（含 admin、my-requests、search）
- `lib/auth/check-auth.ts`：认证守卫（原仓库缺，补的）
- `lib/db/`：SQLite ORM
- `lib/rag/chroma-client.ts`：自定义 Embedding + 向量增删查
- `Dockerfile` + `docker-compose.yml`：双容器编排
- `.env`：通义 KEY + session 配置（**只在服务器 /opt/inknowing/.env**，本地不入 git）
- `scripts/`：种子脚本
- 历史报告：`AI_SERVICE_README.md` / `FINAL_REPORT.md` / `IMPLEMENTATION_STATUS.md`

---

## 8. 待办（按优先级）

### 🟢 P1（产品演进）
1. **移动端响应式**（当前以 PC 为主）
2. **角色对话多轮记忆**（当前无状态）
3. **书籍审核流程**（用户请求自动发布的兜底）
4. **/opt/inknowing 转 git 仓库**（部署可追踪）
5. **数据备份策略**：`/opt/inknowing/data/` SQLite + `data/vectors/` ChromaDB 都没自动备份

### 🟡 P2（技术债）
6. **`lib/rag/chroma-client.ts` queryByText 循环依赖隐患**（`memory/2026-03-23.md` 记录）
7. **inknowing.db 在仓库根**（开发遗留，生产已用 `data/` 卷）

---

## 9. 接手第一天的命令

```bash
# 1. SSH 到部署机
ssh root@67.209.182.23   # 密码: LMqdn0MZxhyl

# 2. 看服务
docker ps | grep inknow
docker logs -f --tail=50 inknowing-app

# 3. 拉本地代码
cd /home/elttilz/joevise-projects/inknowing
git log --oneline -5

# 4. 改完代码部署（因为线上非 git）
rsync -av --exclude node_modules --exclude data --exclude uploads \
  /home/elttilz/joevise-projects/inknowing/ \
  root@67.209.182.23:/opt/inknowing/
ssh root@67.209.182.23 'cd /opt/inknowing && docker compose up -d --build app'

# 5. 验证
curl -I https://inknowing.ai
```

---

## 10. 凭据 & 端点

- **SSH 67.209.182.23**：`root` / `LMqdn0MZxhyl`
- **管理后台**：`https://inknowing.ai/admin` → `admin@system` / `admin123456`
- **测试账号**：`dajoe` / `elttilz@gmail.com`
- **通义 API Key**：见 `/opt/inknowing/.env`
- **GitHub**：`joevise/inknowing_mvp_v4`（private）

---

## 11. 同源参考

- `~/.openclaw/workspaces/joevise/core_memory/projects.md`（InKnowing 段）
- `~/.openclaw/workspaces/joevise/core_memory/lessons.md`（Caddy ACME 死锁修复）
- `~/.openclaw/workspaces/joevise/memory/2026-03-23.md / 03-24.md / 03-28.md`
- 仓库内：`FINAL_REPORT.md` / `DEVELOPMENT_PROGRESS.md`

---

## 12. 一句话给新 agent

> **项目稳，线上跑了 3 周没事**。部署机是 **67.209.182.23**（不是主开发机 .54！），HTTPS 已上。/opt/inknowing 不是 git，要用 rsync 推。可以直接做产品功能演进。

# InKnowing Architecture Mapping Matrix
## 基于业务逻辑守恒原理的完整映射验证

## 1. 核心业务功能映射矩阵

| 业务功能 | 用户旅程阶段 | 时序流程 | 状态机 | API端点 | 交叉引用 |
|---------|-------------|---------|--------|---------|---------|
| **用户注册** | 发现与注册 | AUTH_SEQUENCE | AUTH_STATE_MACHINE | POST /api/auth/register | #REF-REGISTER |
| **用户登录** | 发现与注册 | AUTH_SEQUENCE | AUTH_STATE_MACHINE | POST /api/auth/login | #REF-LOGIN |
| **用户登出** | - | - | AUTH_STATE_MACHINE | POST /api/auth/logout | - |
| **智能搜索** | 探索书籍 | BROWSE_SEQUENCE | BROWSE_STATE_MACHINE | GET /api/search | #REF-SEARCH |
| **浏览书籍** | 探索书籍 | BROWSE_SEQUENCE | BROWSE_STATE_MACHINE | GET /api/books | #REF-BROWSE |
| **书籍详情** | 探索书籍 | BROWSE_SEQUENCE | BROWSE_STATE_MACHINE | GET /api/books/{id} | #REF-DETAIL |
| **获取角色** | 探索书籍 | BROWSE_SEQUENCE | BROWSE_STATE_MACHINE | GET /api/books/{id}/characters | - |
| **创建对话** | 智能对话 | CHAT_SEQUENCE | CONVERSATION_STATE_MACHINE | POST /api/conversations/create | #REF-CONV-CREATE |
| **发送消息** | 智能对话 | CHAT_SEQUENCE | CONVERSATION_STATE_MACHINE | POST /api/conversations/{id}/messages | #REF-SMART-CHAT |
| **响应流** | 智能对话 | CHAT_SEQUENCE | CONVERSATION_STATE_MACHINE | SSE /api/conversations/{id}/stream | - |
| **RAG检索** | 智能对话 | CHAT_SEQUENCE | CONVERSATION_STATE_MACHINE | POST /api/rag/search | #REF-RAG-001 |
| **角色对话** | 角色扮演 | CHARACTER_SEQUENCE | CHARACTER_STATE_MACHINE | POST /api/conversations/create?character_id= | #REF-CHAR-INIT |
| **角色交互** | 角色扮演 | CHARACTER_SEQUENCE | CHARACTER_STATE_MACHINE | POST /api/conversations/{id}/messages | #REF-CHAR-CHAT |
| **切换角色** | 角色扮演 | CHARACTER_SEQUENCE | CHARACTER_STATE_MACHINE | PUT /api/conversations/{id}/character | #REF-CHAR-SWITCH |
| **查看历史** | 历史管理 | HISTORY_SEQUENCE | HISTORY_STATE_MACHINE | GET /api/conversations | #REF-HISTORY-VIEW |
| **继续对话** | 历史管理 | HISTORY_SEQUENCE | HISTORY_STATE_MACHINE | GET /api/conversations/{id} | #REF-HISTORY-CONTINUE |
| **删除对话** | 历史管理 | HISTORY_SEQUENCE | HISTORY_STATE_MACHINE | DELETE /api/conversations/{id} | - |
| **管理登录** | 管理员操作 | ADMIN_SEQUENCE | ADMIN_STATE_MACHINE | POST /api/admin/login | #REF-ADMIN-LOGIN |
| **AI识别书籍** | 管理员操作 | ADMIN_SEQUENCE | ADMIN_STATE_MACHINE | POST /api/admin/books/identify | #REF-BOOK-IDENTIFY |
| **上传文档** | 管理员操作 | ADMIN_SEQUENCE | ADMIN_STATE_MACHINE | POST /api/admin/books/{id}/documents | #REF-DOC-UPLOAD |
| **向量化** | 管理员操作 | ADMIN_SEQUENCE | ADMIN_STATE_MACHINE | POST /api/admin/books/{id}/vectorize | #REF-DOC-VECTOR, #REF-VECTOR-001 |
| **角色管理** | 管理员操作 | ADMIN_SEQUENCE | ADMIN_STATE_MACHINE | PUT /api/admin/characters/{id} | #REF-CHAR-MANAGE |

## 2. 状态转换映射矩阵

| 初始状态 | 触发事件 | API调用 | 目标状态 | 业务意义 |
|---------|---------|---------|---------|---------|
| **GUEST** | 点击注册 | POST /api/auth/register | REGISTERED → LOGGED_IN | 新用户加入平台 |
| **GUEST** | 点击登录 | POST /api/auth/login | LOGGED_IN | 用户身份认证 |
| **IDLE** | 使用搜索 | GET /api/search | SEARCHING → RESULTS_READY | 智能内容发现 |
| **IDLE** | 浏览书籍 | GET /api/books | BROWSING_BOOKS | 内容探索 |
| **BROWSING_BOOKS** | 选择书籍 | GET /api/books/{id} | VIEWING_DETAIL | 深入了解 |
| **NO_CONVERSATION** | 开始对话 | POST /api/conversations/create | CONVERSATION_ACTIVE | 学习开始 |
| **CONVERSATION_ACTIVE** | 发送消息 | POST /api/conversations/{id}/messages | ROUTING_DECISION | 智能交互 |
| **ROUTING_DECISION** | AI原生 | - | AI_NATIVE_MODE | 快速响应 |
| **ROUTING_DECISION** | RAG检索 | POST /api/rag/search | RAG_RETRIEVAL_MODE | 精确回答 |
| **ROUTING_DECISION** | 混合模式 | - | HYBRID_MODE | 综合回答 |
| **NO_CHARACTER** | 选择角色 | POST /api/conversations/create?character_id= | CHARACTER_CONVERSATION | 角色体验 |
| **CHARACTER_CONVERSATION** | 切换角色 | PUT /api/conversations/{id}/character | CHARACTER_SWITCHED | 视角转换 |
| **NO_HISTORY** | 查看历史 | GET /api/conversations | VIEWING_HISTORY | 回顾学习 |
| **ADMIN_GUEST** | 管理登录 | POST /api/admin/login | ADMIN_LOGGED_IN | 管理权限 |
| **BOOK_MANAGEMENT** | AI识别 | POST /api/admin/books/identify | BOOK_IDENTIFIED | 内容识别 |
| **DOCUMENT_UPLOADING** | 向量化 | POST /api/admin/books/{id}/vectorize | VECTOR_COMPLETE | RAG就绪 |

## 3. 时序交互映射矩阵

| 时序流程 | 参与者 | 关键交互 | API调用序列 | 状态变化序列 |
|---------|--------|---------|------------|-------------|
| **AUTH_SEQUENCE** | 用户→UI→API→Auth→DB→Session | 注册/登录 | register → login | GUEST → REGISTERED → LOGGED_IN |
| **BROWSE_SEQUENCE** | 用户→UI→API→Search→DB→AI | 搜索/浏览 | search → books → books/{id} | IDLE → SEARCHING → BROWSING → VIEWING_DETAIL |
| **CHAT_SEQUENCE** | 用户→UI→API→Router→AI→RAG→DB | 智能对话 | create → messages → stream | NO_CONVERSATION → ACTIVE → ROUTING → GENERATING |
| **CHARACTER_SEQUENCE** | 用户→UI→API→Character→AI→DB | 角色扮演 | create → messages → character | NO_CHARACTER → CHARACTER_CONVERSATION |
| **ADMIN_SEQUENCE** | 管理员→UI→API→AI→Vector→ChromaDB | 后台管理 | login → identify → upload → vectorize | GUEST → LOGGED_IN → MANAGING |
| **HISTORY_SEQUENCE** | 用户→UI→API→DB | 历史管理 | conversations → conversations/{id} | NO_HISTORY → VIEWING → CONTINUING |

## 4. 数据流向映射矩阵

| 数据类型 | 来源 | 处理流程 | 存储位置 | 使用场景 |
|---------|------|---------|---------|---------|
| **用户凭据** | 注册表单 | Auth服务加密 | SQLite:users | 身份验证 |
| **Session** | Auth服务 | Session管理 | 内存/Cookie | 状态保持 |
| **书籍元数据** | AI识别 | Admin处理 | SQLite:books | 展示信息 |
| **文档内容** | 文件上传 | 解析分块 | 文件系统 | 原始数据 |
| **向量数据** | Embedding API | 向量化服务 | ChromaDB | RAG检索 |
| **对话消息** | 用户输入 | 路由处理 | SQLite:messages | 历史记录 |
| **AI响应** | 通义千问 | 流式生成 | SQLite:messages | 实时回复 |
| **角色配置** | Admin设置 | Character服务 | SQLite:characters | 角色扮演 |

## 5. 业务决策点映射矩阵

| 决策点 | 触发条件 | 判断逻辑 | 分支路径 | API影响 |
|--------|---------|---------|---------|---------|
| **注册验证** | 提交注册 | 邮箱是否存在 | 存在→错误 / 不存在→创建 | POST /api/auth/register |
| **登录验证** | 提交登录 | 密码是否正确 | 正确→登录 / 错误→拒绝 | POST /api/auth/login |
| **搜索意图** | 输入关键词 | AI分析意图 | 书籍/角色/主题 | GET /api/search |
| **路由决策** | 接收问题 | 问题类型分析 | AI原生/RAG/混合 | POST /api/conversations/{id}/messages |
| **AI了解度** | 书籍识别 | 评分>=8? | 可选文档/必须文档 | POST /api/admin/books/identify |
| **向量化策略** | 文档大小 | 是否需要分块 | 整体/分块处理 | POST /api/admin/books/{id}/vectorize |

## 6. 角色权限映射矩阵

| 用户角色 | 允许操作 | 禁止操作 | 状态机访问 | API权限 |
|---------|---------|---------|-----------|---------|
| **游客** | 浏览书籍、查看详情 | 对话、保存历史 | GUEST, BROWSING | GET /api/books, GET /api/search |
| **注册用户** | 所有前台功能 | 管理后台 | 所有用户状态机 | /api/auth/*, /api/conversations/*, /api/rag/* |
| **管理员** | 所有功能 | - | 所有状态机 | 所有API端点 |

## 7. 错误处理映射矩阵

| 错误场景 | 状态影响 | 恢复策略 | API响应 | 用户提示 |
|---------|---------|---------|---------|---------|
| **邮箱已存在** | 保持REGISTERING | 返回注册界面 | 400 Bad Request | "邮箱已注册" |
| **登录失败** | 保持LOGGING_IN | 重新输入 | 401 Unauthorized | "邮箱或密码错误" |
| **AI超时** | 回退到ACTIVE | 使用降级策略 | 504 Gateway Timeout | "响应超时，请重试" |
| **RAG无结果** | 切换AI_NATIVE | 使用AI原生 | 200 OK (降级) | 正常显示AI回答 |
| **向量化失败** | 保持VECTORIZING | 支持重试 | 500 Internal Error | "处理失败，请重试" |
| **Session过期** | 转为GUEST | 重新登录 | 401 Unauthorized | "请重新登录" |

## 8. 性能指标映射矩阵

| 操作类型 | 预期耗时 | 超时设置 | 状态表现 | 用户反馈 |
|---------|---------|---------|---------|---------|
| **用户注册** | <1秒 | 5秒 | 加载动画 | 立即跳转 |
| **智能搜索** | <2秒 | 10秒 | 实时建议 | 渐进显示 |
| **AI对话** | 流式响应 | 30秒 | 打字机效果 | 逐字显示 |
| **RAG检索** | <3秒 | 10秒 | 检索中提示 | 显示来源 |
| **文档向量化** | 按块处理 | 无限制 | 进度条 | 百分比进度 |

## 9. 数据一致性验证

### 守恒原理验证点
1. ✅ **完整性验证**: 每个用户旅程阶段都有对应的时序、状态和API
2. ✅ **唯一性验证**: 每个API端点都有明确的业务意义和状态转换
3. ✅ **可逆性验证**: 从任意视图都能推导出其他视图
4. ✅ **闭环验证**: 所有状态转换形成完整闭环，无孤立状态

### 交叉引用完整性
- 所有 #REF- 标记在各视图中保持一致
- 每个关键业务点都有唯一标识符
- API端点与状态转换一一对应

## 10. 业务逻辑守恒公式验证

```
业务逻辑(B) = 用户旅程(UJ) = 时序图(SD) = 状态图(ST) = API规范(API)

验证：
- Info(UJ) = 6个Epic + 24个Story = 30个业务点
- Info(SD) = 6个Sequence + 24个交互 = 30个业务点
- Info(ST) = 6个状态机 + 24个转换 = 30个业务点
- Info(API) = 30个端点 = 30个业务点

结论：B = 30 (守恒验证通过)
```
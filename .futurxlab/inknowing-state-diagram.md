# InKnowing State Diagram
## 基于业务逻辑守恒原理的状态转换设计

## 1. 用户认证状态机 (AUTH_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> GUEST: 初次访问

    GUEST --> REGISTERING: 点击注册 [API: POST /api/auth/register]
    REGISTERING --> VALIDATING: 提交表单
    VALIDATING --> REGISTERING: 邮箱已存在
    VALIDATING --> REGISTERED: 注册成功
    REGISTERED --> LOGGED_IN: 自动登录 [Session创建]

    GUEST --> LOGGING_IN: 点击登录 [API: POST /api/auth/login]
    LOGGING_IN --> AUTHENTICATING: 提交凭据
    AUTHENTICATING --> LOGGING_IN: 认证失败
    AUTHENTICATING --> LOGGED_IN: 认证成功 [Session创建]

    LOGGED_IN --> SESSION_ACTIVE: Session有效(24h)
    SESSION_ACTIVE --> SESSION_EXPIRED: 超时
    SESSION_EXPIRED --> GUEST: 需要重新登录

    LOGGED_IN --> LOGGED_OUT: 用户登出 [API: POST /api/auth/logout]
    LOGGED_OUT --> GUEST: Session销毁

    state LOGGED_IN {
        [*] --> USER_ACTIVE
        USER_ACTIVE --> USER_IDLE: 无操作
        USER_IDLE --> USER_ACTIVE: 任意操作
    }

    note right of GUEST: 游客状态：可浏览但不能保存
    note right of LOGGED_IN: 登录状态：完整功能访问
```

## 2. 书籍浏览状态机 (BROWSE_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> IDLE: 进入平台

    IDLE --> SEARCHING: 使用搜索框 [API: GET /api/search]
    SEARCHING --> SEARCH_PROCESSING: 解析意图
    SEARCH_PROCESSING --> RESULTS_READY: AI分析完成
    RESULTS_READY --> VIEWING_RESULTS: 显示结果
    VIEWING_RESULTS --> IDLE: 清空搜索

    IDLE --> BROWSING_BOOKS: 查看书籍列表 [API: GET /api/books]
    BROWSING_BOOKS --> FILTERING: 应用筛选条件
    FILTERING --> FILTERED_VIEW: 筛选完成
    FILTERED_VIEW --> BROWSING_BOOKS: 清除筛选

    BROWSING_BOOKS --> VIEWING_DETAIL: 选择书籍 [API: GET /api/books/{id}]
    VIEWING_DETAIL --> LOADING_CHARACTERS: 加载角色 [API: GET /api/books/{id}/characters]
    LOADING_CHARACTERS --> BOOK_READY: 信息完整

    BOOK_READY --> CHOOSING_MODE: 准备对话
    CHOOSING_MODE --> BOOK_CHAT: 选择书籍对话
    CHOOSING_MODE --> CHARACTER_CHAT: 选择角色对话

    state BROWSING_BOOKS {
        [*] --> GRID_VIEW
        GRID_VIEW --> LIST_VIEW: 切换视图
        LIST_VIEW --> GRID_VIEW: 切换视图
    }

    note right of SEARCHING: 智能搜索状态
    note right of BOOK_READY: 书籍就绪状态
```

## 3. 对话交互状态机 (CONVERSATION_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> NO_CONVERSATION: 初始状态

    NO_CONVERSATION --> CREATING_CONVERSATION: 开始对话 [API: POST /api/conversations/create]
    CREATING_CONVERSATION --> CONVERSATION_CREATED: 创建成功
    CONVERSATION_CREATED --> CONVERSATION_ACTIVE: 进入对话

    CONVERSATION_ACTIVE --> USER_TYPING: 用户输入
    USER_TYPING --> MESSAGE_SENDING: 发送消息 [API: POST /api/conversations/{id}/messages]
    MESSAGE_SENDING --> ROUTING_DECISION: 智能路由判断

    ROUTING_DECISION --> AI_NATIVE_MODE: 概括性问题
    ROUTING_DECISION --> RAG_RETRIEVAL_MODE: 细节性问题
    ROUTING_DECISION --> HYBRID_MODE: 综合性问题

    AI_NATIVE_MODE --> GENERATING_RESPONSE: AI生成中
    RAG_RETRIEVAL_MODE --> VECTOR_SEARCHING: 向量检索 [API: POST /api/rag/search]
    VECTOR_SEARCHING --> CHUNKS_RETRIEVED: 获取相关片段
    CHUNKS_RETRIEVED --> GENERATING_RESPONSE: 基于检索生成
    HYBRID_MODE --> PARALLEL_PROCESSING: 并行处理
    PARALLEL_PROCESSING --> GENERATING_RESPONSE: 综合生成

    GENERATING_RESPONSE --> STREAMING_RESPONSE: 流式输出 [SSE: /api/conversations/{id}/stream]
    STREAMING_RESPONSE --> RESPONSE_COMPLETE: 生成完成
    RESPONSE_COMPLETE --> MESSAGE_SAVED: 保存记录
    MESSAGE_SAVED --> CONVERSATION_ACTIVE: 等待下一轮

    CONVERSATION_ACTIVE --> USER_INTERRUPTING: 用户中断
    USER_INTERRUPTING --> GENERATION_STOPPED: 停止生成
    GENERATION_STOPPED --> CONVERSATION_ACTIVE: 恢复等待

    CONVERSATION_ACTIVE --> ENDING_CONVERSATION: 结束对话
    ENDING_CONVERSATION --> CONVERSATION_SAVED: 保存历史 [API: PUT /api/conversations/{id}]
    CONVERSATION_SAVED --> NO_CONVERSATION: 退出对话

    state GENERATING_RESPONSE {
        [*] --> TOKEN_GENERATION
        TOKEN_GENERATION --> TOKEN_GENERATION: 逐字生成
        TOKEN_GENERATION --> [*]: 完成
    }

    note right of ROUTING_DECISION: 智能路由核心决策点
    note right of VECTOR_SEARCHING: RAG检索状态
```

## 4. 角色对话状态机 (CHARACTER_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> NO_CHARACTER: 初始状态

    NO_CHARACTER --> SELECTING_CHARACTER: 选择角色
    SELECTING_CHARACTER --> LOADING_CHARACTER: 加载角色配置 [API: GET /api/characters/{id}]
    LOADING_CHARACTER --> CHARACTER_INITIALIZED: 角色就绪
    CHARACTER_INITIALIZED --> CHARACTER_CONVERSATION: 进入角色对话 [API: POST /api/conversations/create?character_id=]

    CHARACTER_CONVERSATION --> CHARACTER_LISTENING: 等待用户输入
    CHARACTER_LISTENING --> CHARACTER_THINKING: 接收消息 [API: POST /api/conversations/{id}/messages]
    CHARACTER_THINKING --> APPLYING_PERSONA: 应用角色设定
    APPLYING_PERSONA --> CHARACTER_GENERATING: 生成角色回复
    CHARACTER_GENERATING --> CHARACTER_RESPONDING: 流式输出回复
    CHARACTER_RESPONDING --> CHARACTER_RESPONSE_DONE: 回复完成
    CHARACTER_RESPONSE_DONE --> CHARACTER_CONVERSATION: 继续对话

    CHARACTER_CONVERSATION --> SWITCHING_CHARACTER: 切换角色 [API: PUT /api/conversations/{id}/character]
    SWITCHING_CHARACTER --> SAVING_CONTEXT: 保存当前对话
    SAVING_CONTEXT --> LOADING_NEW_CHARACTER: 加载新角色
    LOADING_NEW_CHARACTER --> CHARACTER_SWITCHED: 切换完成
    CHARACTER_SWITCHED --> CHARACTER_CONVERSATION: 新角色对话

    CHARACTER_CONVERSATION --> EXITING_CHARACTER: 退出角色模式
    EXITING_CHARACTER --> NO_CHARACTER: 返回普通模式

    state CHARACTER_CONVERSATION {
        [*] --> IN_CHARACTER
        IN_CHARACTER --> MAINTAINING_PERSONA: 保持角色性格
        MAINTAINING_PERSONA --> IN_CHARACTER: 持续扮演
    }

    note right of APPLYING_PERSONA: 严格遵循角色设定
    note right of CHARACTER_CONVERSATION: 沉浸式角色体验
```

## 5. 管理后台状态机 (ADMIN_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> ADMIN_GUEST: 访问/admin

    ADMIN_GUEST --> ADMIN_AUTHENTICATING: 输入密码 [API: POST /api/admin/login]
    ADMIN_AUTHENTICATING --> ADMIN_GUEST: 密码错误
    ADMIN_AUTHENTICATING --> ADMIN_LOGGED_IN: 验证成功

    ADMIN_LOGGED_IN --> ADMIN_DASHBOARD: 进入仪表板

    ADMIN_DASHBOARD --> BOOK_MANAGEMENT: 书籍管理
    BOOK_MANAGEMENT --> BOOK_IDENTIFYING: AI识别书籍 [API: POST /api/admin/books/identify]
    BOOK_IDENTIFYING --> BOOK_IDENTIFIED: 识别完成
    BOOK_IDENTIFIED --> BOOK_CREATING: 创建书籍
    BOOK_CREATING --> BOOK_CREATED: 创建成功

    BOOK_CREATED --> DOCUMENT_REQUIRED: AI了解度<8
    BOOK_CREATED --> DOCUMENT_OPTIONAL: AI了解度>=8

    DOCUMENT_REQUIRED --> DOCUMENT_UPLOADING: 上传文档 [API: POST /api/admin/books/{id}/documents]
    DOCUMENT_OPTIONAL --> DOCUMENT_UPLOADING: 选择上传
    DOCUMENT_UPLOADING --> DOCUMENT_PARSING: 解析文档
    DOCUMENT_PARSING --> DOCUMENT_CHUNKING: 分块处理
    DOCUMENT_CHUNKING --> VECTORIZING: 向量化 [API: POST /api/admin/books/{id}/vectorize]

    VECTORIZING --> EMBEDDING_GENERATION: 生成向量
    EMBEDDING_GENERATION --> CHROMADB_STORING: 存储到ChromaDB
    CHROMADB_STORING --> VECTOR_COMPLETE: 向量化完成
    VECTOR_COMPLETE --> BOOK_READY: 书籍就绪

    BOOK_MANAGEMENT --> CHARACTER_MANAGEMENT: 角色管理
    CHARACTER_MANAGEMENT --> CHARACTER_EXTRACTING: 自动提取角色
    CHARACTER_EXTRACTING --> CHARACTERS_GENERATED: 角色生成
    CHARACTERS_GENERATED --> CHARACTER_EDITING: 编辑角色 [API: PUT /api/admin/characters/{id}]
    CHARACTER_EDITING --> CHARACTER_SAVED: 保存角色

    BOOK_MANAGEMENT --> BOOK_STATUS_CONTROL: 状态控制
    BOOK_STATUS_CONTROL --> BOOK_ONLINE: 上架 [API: PUT /api/admin/books/{id}/status]
    BOOK_STATUS_CONTROL --> BOOK_OFFLINE: 下架

    ADMIN_DASHBOARD --> AI_CONFIG: AI配置
    AI_CONFIG --> CONFIG_EDITING: 编辑配置 [API: PUT /api/admin/config/ai]
    CONFIG_EDITING --> CONFIG_TESTING: 测试连接
    CONFIG_TESTING --> CONFIG_SAVED: 保存配置

    ADMIN_LOGGED_IN --> ADMIN_TIMEOUT: 30分钟无操作
    ADMIN_TIMEOUT --> ADMIN_GUEST: 自动登出

    state VECTORIZING {
        [*] --> CHUNK_PROCESSING
        CHUNK_PROCESSING --> CHUNK_VECTORIZED: 处理块
        CHUNK_VECTORIZED --> CHUNK_PROCESSING: 下一块
        CHUNK_VECTORIZED --> [*]: 全部完成
    }

    note right of DOCUMENT_REQUIRED: 必须上传文档
    note right of VECTORIZING: 向量化处理状态
```

## 6. 对话历史状态机 (HISTORY_STATE_MACHINE)

```mermaid
stateDiagram-v2
    [*] --> NO_HISTORY: 初始状态

    NO_HISTORY --> LOADING_HISTORY: 访问个人中心 [API: GET /api/conversations]
    LOADING_HISTORY --> HISTORY_LOADED: 加载完成
    HISTORY_LOADED --> VIEWING_HISTORY: 查看列表

    VIEWING_HISTORY --> FILTERING_HISTORY: 筛选历史
    FILTERING_HISTORY --> FILTERED_HISTORY: 应用筛选
    FILTERED_HISTORY --> VIEWING_HISTORY: 清除筛选

    VIEWING_HISTORY --> SEARCHING_HISTORY: 搜索历史 [API: GET /api/conversations/search]
    SEARCHING_HISTORY --> SEARCH_RESULTS: 返回结果
    SEARCH_RESULTS --> VIEWING_HISTORY: 查看结果

    VIEWING_HISTORY --> SELECTING_CONVERSATION: 选择对话
    SELECTING_CONVERSATION --> LOADING_CONVERSATION: 加载对话 [API: GET /api/conversations/{id}]
    LOADING_CONVERSATION --> CONVERSATION_RESTORED: 恢复上下文
    CONVERSATION_RESTORED --> CONTINUING_CONVERSATION: 继续对话

    VIEWING_HISTORY --> DELETING_CONVERSATION: 删除对话 [API: DELETE /api/conversations/{id}]
    DELETING_CONVERSATION --> CONFIRMING_DELETE: 确认删除
    CONFIRMING_DELETE --> HISTORY_UPDATED: 删除成功
    CONFIRMING_DELETE --> VIEWING_HISTORY: 取消删除
    HISTORY_UPDATED --> VIEWING_HISTORY: 刷新列表

    state VIEWING_HISTORY {
        [*] --> TIMELINE_VIEW
        TIMELINE_VIEW --> BOOK_GROUP_VIEW: 按书籍分组
        BOOK_GROUP_VIEW --> TIMELINE_VIEW: 时间轴视图
    }

    note right of CONVERSATION_RESTORED: 完整恢复对话上下文
    note right of CONTINUING_CONVERSATION: 基于历史继续对话
```

## 状态转换与业务逻辑守恒验证

### 状态覆盖完整性检查

| 业务功能 | 状态机 | 初始状态 | 最终状态 | API触发点 |
|---------|--------|---------|----------|-----------|
| 用户注册 | AUTH_STATE_MACHINE | GUEST | LOGGED_IN | POST /api/auth/register |
| 用户登录 | AUTH_STATE_MACHINE | GUEST | LOGGED_IN | POST /api/auth/login |
| 书籍搜索 | BROWSE_STATE_MACHINE | IDLE | VIEWING_RESULTS | GET /api/search |
| 书籍对话 | CONVERSATION_STATE_MACHINE | NO_CONVERSATION | CONVERSATION_ACTIVE | POST /api/conversations/create |
| 角色对话 | CHARACTER_STATE_MACHINE | NO_CHARACTER | CHARACTER_CONVERSATION | POST /api/conversations/create?character_id= |
| 文档向量化 | ADMIN_STATE_MACHINE | DOCUMENT_UPLOADING | VECTOR_COMPLETE | POST /api/admin/books/{id}/vectorize |
| 查看历史 | HISTORY_STATE_MACHINE | NO_HISTORY | VIEWING_HISTORY | GET /api/conversations |

### 状态转换守恒验证

1. **状态完整性**: 每个业务流程都有明确的状态路径
2. **转换唯一性**: 每个状态转换都有唯一的触发条件
3. **API映射性**: 每个关键转换都对应具体的API调用
4. **可逆性验证**: 可以从状态图推导出完整的业务流程

### 关键状态标注

- **认证状态**: GUEST → LOGGED_IN (核心转换)
- **对话状态**: NO_CONVERSATION → CONVERSATION_ACTIVE (业务核心)
- **路由状态**: ROUTING_DECISION (智能决策点)
- **向量状态**: VECTORIZING (RAG核心处理)
- **角色状态**: CHARACTER_CONVERSATION (沉浸体验)
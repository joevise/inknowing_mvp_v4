# InKnowing Sequence Diagram
## 基于业务逻辑守恒原理的时序交互设计

## 1. 用户注册登录时序 (AUTH_SEQUENCE)

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 前端界面
    participant API as API网关
    participant Auth as 认证服务
    participant DB as SQLite数据库
    participant Session as Session管理

    Note over U,Session: 用户注册流程 #REF-REGISTER
    U->>UI: 访问注册页面
    UI->>U: 显示注册表单
    U->>UI: 输入邮箱和密码
    UI->>API: [POST /api/auth/register]<br/>{email, password}
    API->>Auth: 验证邮箱格式
    Auth->>DB: 检查邮箱是否存在
    alt 邮箱已存在
        DB-->>Auth: 邮箱已注册
        Auth-->>API: 返回错误
        API-->>UI: {"error": "邮箱已注册"}
        UI-->>U: 显示错误提示
    else 邮箱可用
        DB-->>Auth: 邮箱未注册
        Auth->>Auth: 加密密码
        Auth->>DB: 创建用户记录
        DB-->>Auth: 用户创建成功
        Auth->>Session: 创建Session
        Session-->>Auth: Session创建成功
        Auth-->>API: 返回成功+Session
        API-->>UI: {"success": true, "session": "..."}
        UI->>UI: 保存Session
        UI->>U: 跳转到首页
    end

    Note over U,Session: 用户登录流程 #REF-LOGIN
    U->>UI: 访问登录页面
    U->>UI: 输入邮箱密码
    UI->>API: [POST /api/auth/login]<br/>{email, password}
    API->>Auth: 验证凭据
    Auth->>DB: 查询用户信息
    DB-->>Auth: 返回用户数据
    Auth->>Auth: 验证密码
    alt 验证失败
        Auth-->>API: 认证失败
        API-->>UI: {"error": "邮箱或密码错误"}
        UI-->>U: 显示错误提示
    else 验证成功
        Auth->>Session: 创建Session(24小时)
        Session-->>Auth: Session创建成功
        Auth-->>API: 返回用户信息+Session
        API-->>UI: {"user": {...}, "session": "..."}
        UI->>UI: 保存Session
        UI->>U: 跳转到个人主页
    end
```

## 2. 书籍浏览与搜索时序 (BROWSE_SEQUENCE)

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 前端界面
    participant API as API网关
    participant Search as 搜索服务
    participant DB as SQLite数据库
    participant AI as 通义千问API

    Note over U,AI: 智能搜索流程 #REF-SEARCH
    U->>UI: 输入搜索关键词
    UI->>API: [GET /api/search]<br/>?query=关键词
    API->>Search: 解析搜索意图
    Search->>AI: 调用AI理解意图
    AI-->>Search: 返回意图分析

    alt 搜索书籍
        Search->>DB: 查询相关书籍
        DB-->>Search: 返回书籍列表
    else 搜索角色
        Search->>DB: 查询相关角色
        DB-->>Search: 返回角色列表
    else 搜索主题
        Search->>DB: 模糊匹配相关内容
        DB-->>Search: 返回混合结果
    end

    Search-->>API: 整合搜索结果
    API-->>UI: {"books": [...], "characters": [...]}
    UI->>U: 显示搜索建议

    Note over U,DB: 书籍列表浏览 #REF-BROWSE
    U->>UI: 访问书籍页面
    UI->>API: [GET /api/books]<br/>?category=文学&tags=经典
    API->>DB: 查询书籍列表
    DB->>DB: 应用筛选条件
    DB-->>API: 返回筛选结果
    API-->>UI: {"books": [...], "total": 10}
    UI->>U: 展示书籍封面墙

    Note over U,DB: 书籍详情获取 #REF-DETAIL
    U->>UI: 点击书籍封面
    UI->>API: [GET /api/books/{id}]
    API->>DB: 查询书籍详情
    DB-->>API: 返回完整信息
    API->>DB: [GET /api/books/{id}/characters]
    DB-->>API: 返回角色列表
    API-->>UI: {"book": {...}, "characters": [...]}
    UI->>U: 显示书籍详情页
```

## 3. 智能对话时序 (CHAT_SEQUENCE)

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 前端界面
    participant API as API网关
    participant Router as 智能路由
    participant AI as 通义千问API
    participant RAG as ChromaDB检索
    participant DB as SQLite数据库

    Note over U,DB: 创建对话会话 #REF-CONV-CREATE
    U->>UI: 点击"与书籍对话"
    UI->>API: [POST /api/conversations/create]<br/>{book_id, type: "book"}
    API->>DB: 创建对话记录
    DB-->>API: 返回conversation_id
    API-->>UI: {"conversation_id": "..."}
    UI->>U: 进入对话界面

    Note over U,DB: 智能问答流程 #REF-SMART-CHAT
    U->>UI: 输入问题
    UI->>API: [POST /api/conversations/{id}/messages]<br/>{content: "这本书主要讲什么？"}
    API->>Router: 分析问题类型
    Router->>Router: 判断路由策略

    alt 概括性问题（AI原生）
        Router->>AI: 直接调用AI
        AI->>AI: 生成回答
        AI-->>Router: 流式返回结果
    else 细节性问题（RAG检索）
        Router->>RAG: [POST /api/rag/search]<br/>向量检索
        RAG->>RAG: 相似度匹配
        RAG-->>Router: 返回相关片段
        Router->>AI: 基于检索结果生成
        AI-->>Router: 流式返回结果
    else 综合性问题（混合模式）
        Router->>RAG: 先检索相关内容
        RAG-->>Router: 返回参考片段
        Router->>AI: 结合AI知识和检索
        AI-->>Router: 流式返回结果
    end

    Router->>API: [SSE /api/conversations/{id}/stream]
    API->>UI: EventStream推送
    UI->>U: 打字机效果显示

    API->>DB: 保存消息记录
    DB-->>API: 保存成功
```

## 4. 角色对话时序 (CHARACTER_SEQUENCE)

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 前端界面
    participant API as API网关
    participant Character as 角色服务
    participant AI as 通义千问API
    participant DB as SQLite数据库

    Note over U,DB: 角色对话初始化 #REF-CHAR-INIT
    U->>UI: 选择角色对话
    UI->>API: [POST /api/conversations/create]<br/>{book_id, character_id, type: "character"}
    API->>DB: 获取角色配置
    DB-->>API: 返回角色prompt模板
    API->>Character: 初始化角色上下文
    Character->>Character: 加载角色设定
    Character-->>API: 角色就绪
    API->>DB: 创建对话记录
    DB-->>API: 返回conversation_id
    API-->>UI: {"conversation_id": "...", "character": {...}}
    UI->>U: 显示角色对话界面

    Note over U,DB: 角色扮演交互 #REF-CHAR-CHAT
    U->>UI: 向角色提问
    UI->>API: [POST /api/conversations/{id}/messages]<br/>{content: "你对这件事怎么看？"}
    API->>Character: 处理角色对话
    Character->>Character: 应用角色性格
    Character->>AI: 调用AI（带角色prompt）
    AI->>AI: 以角色身份思考
    AI-->>Character: 生成角色回复
    Character->>Character: 确保风格一致
    Character-->>API: 返回角色化回复
    API->>UI: EventStream推送
    UI->>U: 显示角色回复
    API->>DB: 保存对话记录
    DB-->>API: 保存成功

    Note over U,DB: 角色切换流程 #REF-CHAR-SWITCH
    U->>UI: 切换到其他角色
    UI->>API: [PUT /api/conversations/{id}/character]<br/>{new_character_id}
    API->>DB: 保存当前对话
    DB-->>API: 保存成功
    API->>DB: 获取新角色配置
    DB-->>API: 返回新角色信息
    API->>Character: 切换角色上下文
    Character-->>API: 切换成功
    API-->>UI: {"character": {...}}
    UI->>U: 更新对话界面
```

## 5. 管理后台时序 (ADMIN_SEQUENCE)

```mermaid
sequenceDiagram
    participant A as 管理员
    participant UI as 管理界面
    participant API as API网关
    participant AI as 通义千问API
    participant Vector as 向量化服务
    participant ChromaDB as ChromaDB
    participant DB as SQLite数据库
    participant FS as 文件系统

    Note over A,DB: 管理员登录 #REF-ADMIN-LOGIN
    A->>UI: 访问/admin
    UI->>UI: 显示登录界面
    A->>UI: 输入管理密码
    UI->>API: [POST /api/admin/login]<br/>{password}
    API->>API: 验证环境变量密码
    API-->>UI: {"admin_session": "..."}
    UI->>A: 进入管理后台

    Note over A,DB: AI识别书籍 #REF-BOOK-IDENTIFY
    A->>UI: 输入书名
    UI->>API: [POST /api/admin/books/identify]<br/>{title: "书名"}
    API->>AI: 请求识别书籍
    AI->>AI: 分析书籍信息
    AI-->>API: 返回书籍元数据
    API->>API: 评估AI了解程度(1-10)
    API->>AI: 生成分类和标签
    AI-->>API: 返回分类标签
    API->>API: 搜索封面图片
    API-->>UI: {"book_info": {...}, "ai_score": 8}
    UI->>A: 显示识别结果

    alt AI了解程度>=8
        UI->>A: 标记"AI原生"(可选文档)
    else AI了解程度<8
        UI->>A: 标记"需要文档"(必须上传)
    end

    Note over A,ChromaDB: 文档向量化 #REF-DOC-VECTOR
    A->>UI: 上传TXT/Markdown文档
    UI->>API: [POST /api/admin/books/{id}/documents]<br/>FormData(file)
    API->>FS: 保存文档文件
    FS-->>API: 文件保存成功
    API->>API: 解析文档内容
    API->>API: 分块处理(chunk)

    loop 对每个文本块
        API->>Vector: 请求向量化
        Vector->>AI: [POST /embeddings]<br/>调用embedding API
        AI-->>Vector: 返回向量数据
        Vector->>ChromaDB: 存储向量
        ChromaDB-->>Vector: 存储成功
        Vector-->>API: 处理进度更新
        API->>UI: 推送进度(SSE)
        UI->>A: 显示处理进度
    end

    API->>DB: 更新书籍状态
    DB-->>API: 更新成功
    API-->>UI: {"status": "vectorized"}
    UI->>A: 向量化完成

    Note over A,DB: 角色管理 #REF-CHAR-MANAGE
    A->>UI: 查看书籍角色
    UI->>API: [GET /api/admin/books/{id}/characters]
    API->>DB: 查询角色列表
    DB-->>API: 返回角色数据
    API-->>UI: {"characters": [...]}
    UI->>A: 显示角色列表
    A->>UI: 编辑角色信息
    UI->>API: [PUT /api/admin/characters/{id}]<br/>{name, description, prompt}
    API->>DB: 更新角色配置
    DB-->>API: 更新成功
    API-->>UI: {"success": true}
    UI->>A: 更新成功提示
```

## 6. 历史管理时序 (HISTORY_SEQUENCE)

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 前端界面
    participant API as API网关
    participant DB as SQLite数据库

    Note over U,DB: 查看对话历史 #REF-HISTORY-VIEW
    U->>UI: 访问个人中心
    UI->>API: [GET /api/users/profile]
    API->>DB: 查询用户信息
    DB-->>API: 返回用户数据
    API->>API: [GET /api/conversations]<br/>获取用户对话列表
    API->>DB: 查询对话历史
    DB-->>API: 返回对话列表
    API-->>UI: {"user": {...}, "conversations": [...]}
    UI->>U: 显示历史时间轴

    Note over U,DB: 继续历史对话 #REF-HISTORY-CONTINUE
    U->>UI: 点击历史对话
    UI->>API: [GET /api/conversations/{id}]
    API->>DB: 查询完整对话
    DB-->>API: 返回对话内容
    API->>DB: 获取消息列表
    DB-->>API: 返回历史消息
    API-->>UI: {"conversation": {...}, "messages": [...]}
    UI->>U: 恢复对话界面
    U->>UI: 继续提问
    UI->>API: [POST /api/conversations/{id}/messages]
    API->>API: 处理新消息（保持上下文）
```

## 时序图与其他视图的映射验证

### 业务逻辑守恒验证
1. **完整性检查**：每个用户旅程阶段都有对应的时序流程
2. **API一致性**：所有API调用与OpenAPI规范完全对应
3. **状态同步**：时序中的每个关键节点都对应状态转换

### 交叉引用映射表

| 时序流程 | 用户旅程映射 | 状态转换 | API端点 |
|---------|------------|---------|---------|
| AUTH_SEQUENCE | 发现与注册 | GUEST→REGISTERED | /api/auth/* |
| BROWSE_SEQUENCE | 探索书籍 | IDLE→BROWSING | /api/books/* |
| CHAT_SEQUENCE | 智能对话 | BROWSING→CONVERSING | /api/conversations/* |
| CHARACTER_SEQUENCE | 角色扮演 | CONVERSING→CHARACTER_MODE | /api/conversations/character |
| ADMIN_SEQUENCE | 管理员操作 | IDLE→ADMIN_MODE | /api/admin/* |
| HISTORY_SEQUENCE | 历史管理 | IDLE→REVIEWING | /api/conversations/history |

### 关键交互点标注
- #REF-REGISTER: 用户注册交互
- #REF-LOGIN: 用户登录交互
- #REF-SEARCH: 智能搜索交互
- #REF-CONV-CREATE: 对话创建交互
- #REF-SMART-CHAT: 智能路由决策
- #REF-CHAR-INIT: 角色初始化
- #REF-DOC-VECTOR: 文档向量化
- #REF-HISTORY-VIEW: 历史查看
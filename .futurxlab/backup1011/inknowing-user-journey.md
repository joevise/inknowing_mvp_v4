# InKnowing User Journey Diagram
## 基于业务逻辑守恒原理的用户旅程设计

```mermaid
journey
    title InKnowing 知应 - AI知识对话平台用户旅程
    section 发现与注册
      访问平台首页: 5: 新用户
      浏览精选书籍: 4: 新用户
      决定注册账号 {API: POST /api/auth/register}: 5: 新用户
      输入邮箱密码: 3: 新用户
      完成注册并自动登录 {API: POST /api/auth/login}: 5: 新用户

    section 探索书籍
      进入个人主页: 5: 注册用户
      使用智能搜索框 {API: GET /api/search}: 5: 注册用户
      浏览书籍列表 {API: GET /api/books}: 5: 注册用户
      按分类筛选 {API: GET /api/books?category=}: 4: 注册用户
      查看书籍详情 {API: GET /api/books/{id}}: 5: 注册用户
      查看角色列表 {API: GET /api/books/{id}/characters}: 4: 注册用户

    section 智能对话
      选择与书籍对话 {API: POST /api/conversations/create}: 5: 注册用户
      输入问题 {API: POST /api/conversations/{id}/messages}: 5: 注册用户
      等待AI响应流 {API: SSE /api/conversations/{id}/stream}: 4: 注册用户
      查看引用来源 #REF-RAG-001: 5: 注册用户
      继续深入对话: 5: 注册用户
      保存对话历史 {API: PUT /api/conversations/{id}}: 5: 注册用户

    section 角色扮演
      选择角色对话 {API: POST /api/conversations/create?character_id=}: 4: 注册用户
      与角色交流 {API: POST /api/conversations/{id}/messages}: 5: 注册用户
      体验角色性格 #REF-CHAR-001: 5: 注册用户
      切换其他角色 {API: PUT /api/conversations/{id}/character}: 4: 注册用户
      沉浸式学习: 5: 注册用户

    section 历史管理
      访问个人中心 {API: GET /api/users/profile}: 5: 注册用户
      查看对话历史 {API: GET /api/conversations}: 5: 注册用户
      搜索历史记录 {API: GET /api/conversations/search}: 4: 注册用户
      继续历史对话 {API: GET /api/conversations/{id}}: 5: 注册用户
      删除对话记录 {API: DELETE /api/conversations/{id}}: 3: 注册用户

    section 管理员操作
      登录管理后台 {API: POST /api/admin/login}: 5: 管理员
      AI识别书籍 {API: POST /api/admin/books/identify}: 5: 管理员
      上传书籍文档 {API: POST /api/admin/books/{id}/documents}: 5: 管理员
      向量化处理 #REF-VECTOR-001 {API: POST /api/admin/books/{id}/vectorize}: 4: 管理员
      管理角色信息 {API: PUT /api/admin/characters/{id}}: 4: 管理员
      配置AI服务 {API: PUT /api/admin/config/ai}: 5: 管理员
      上下架书籍 {API: PUT /api/admin/books/{id}/status}: 5: 管理员
```

## 用户旅程关键决策点

### 1. 用户注册决策
- **触发条件**: 想要保存对话历史
- **API映射**: POST /api/auth/register
- **状态转换**: 游客 → 注册用户
- **时序起点**: 注册交互流程

### 2. 对话模式选择
- **触发条件**: 选择学习方式
- **API映射**: POST /api/conversations/create
- **状态转换**: 浏览 → 对话中
- **时序起点**: 对话创建流程

### 3. RAG检索决策 #REF-RAG-001
- **触发条件**: 问题类型判断
- **API映射**: POST /api/rag/search
- **状态转换**: 等待 → 检索中 → 响应中
- **时序起点**: RAG检索流程

### 4. 角色切换决策 #REF-CHAR-001
- **触发条件**: 改变对话视角
- **API映射**: PUT /api/conversations/{id}/character
- **状态转换**: 角色A对话 → 角色B对话
- **时序起点**: 角色切换流程

### 5. 向量化决策 #REF-VECTOR-001
- **触发条件**: 文档上传完成
- **API映射**: POST /api/admin/books/{id}/vectorize
- **状态转换**: 文档已上传 → 向量化中 → 就绪
- **时序起点**: 向量化处理流程

## 业务逻辑守恒验证

### 守恒原理验证点
1. **用户意图 = Σ(API调用)**
   - 每个用户动作都映射到具体API
   - 无孤立的用户操作

2. **决策点完整性**
   - 所有分支路径都有对应的API支持
   - 状态转换条件明确

3. **双向可推导性**
   - 从用户旅程 → 可推导出需要的API
   - 从API集合 → 可还原用户使用流程

## 与其他视图的映射关系

| 用户旅程阶段 | 时序图映射 | 状态图映射 | API端点映射 |
|------------|-----------|-----------|------------|
| 发现与注册 | AUTH_SEQUENCE | GUEST→REGISTERED | /api/auth/* |
| 探索书籍 | BROWSE_SEQUENCE | BROWSING | /api/books/* |
| 智能对话 | CHAT_SEQUENCE | CONVERSING | /api/conversations/* |
| 角色扮演 | CHARACTER_SEQUENCE | CHARACTER_MODE | /api/conversations/character |
| 历史管理 | HISTORY_SEQUENCE | REVIEWING | /api/conversations/history |
| 管理员操作 | ADMIN_SEQUENCE | ADMIN_MODE | /api/admin/* |
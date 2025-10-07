# Requirements Document (修订版)

## Project Overview
**Project Name**: 知应(InKnowing) - AI知识对话平台 MVP
**Version**: 1.0.0 (MVP)
**Last Updated**: 2025-01-07
**Author**: FuturX PM

## Business Context
知应(InKnowing)是一个AI驱动的知识萃取平台，通过AI技术让用户能够与书籍内容和书中角色进行深度对话。MVP版本聚焦核心业务价值验证，采用最简技术实现，确保3-4周内快速上线，支持10本精选书籍。

## Stakeholders
- **Product Owner**: 产品负责人 - 负责产品愿景和业务价值实现
- **Development Team**: 全栈开发工程师 - 负责快速实现MVP
- **End Users**: 早期种子用户（约10人）- 体验并反馈产品价值

## User Stories

### Epic 1: 用户账户管理（简化版）
提供最基础的用户账户功能，确保能区分用户即可。

#### Story 1.1: 用户注册（极简版）
**As a** 新用户
**I want** 通过邮箱密码快速注册
**So that** 我能保存我的对话历史

**Priority**: High
**Story Points**: 2

**Acceptance Criteria:**
- WHEN 用户提交邮箱和密码 THE SYSTEM SHALL 直接创建账户
- IF 邮箱已存在 THEN THE SYSTEM SHALL 提示"邮箱已注册"
- THE SYSTEM SHALL 注册成功后自动登录用户
- THE SYSTEM SHALL 使用简单session保持登录状态

**Definition of Done:**
- [ ] 简单注册表单实现
- [ ] 用户数据存入SQLite
- [ ] 基础session管理
- [ ] 手动测试通过

#### Story 1.2: 用户登录（极简版）
**As a** 已注册用户
**I want** 使用邮箱密码登录
**So that** 我能继续我的学习

**Priority**: High
**Story Points**: 2

**Acceptance Criteria:**
- WHEN 用户输入正确的邮箱密码 THE SYSTEM SHALL 创建session并跳转首页
- IF 邮箱或密码错误 THEN THE SYSTEM SHALL 显示错误提示
- THE SYSTEM SHALL 保持登录状态直到用户退出
- WHERE 用户关闭浏览器 THE SYSTEM SHALL 保留session 24小时

### Epic 2: 书籍管理系统（完整功能）
实现完整的书籍管理功能，这是核心业务逻辑，所有功能必须完整实现。

#### Story 2.1: AI自动识别书籍
**As a** 管理员
**I want** 通过输入书名让AI自动识别并生成完整书籍信息
**So that** 我能快速高效地添加书籍

**Priority**: High
**Story Points**: 5

**Acceptance Criteria:**
- WHEN 管理员输入书名 THE SYSTEM SHALL 调用通义千问API识别书籍
- THE SYSTEM SHALL 自动获取：书名、作者、简介、出版信息
- THE SYSTEM SHALL 自动生成分类（文学/商业/科学/心理/哲学等）
- THE SYSTEM SHALL 自动生成标签（#必读 #经典 #思维提升等）
- THE SYSTEM SHALL 自动搜索并推荐3个封面图片选项
- THE SYSTEM SHALL 评估AI对该书的了解程度（1-10分）
- WHERE AI了解程度>=8 THE SYSTEM SHALL 标记为"AI原生"可选文档上传
- WHERE AI了解程度<8 THE SYSTEM SHALL 标记为"需要文档"必须上传
- WHILE AI处理中 THE SYSTEM SHALL 显示处理进度

#### Story 2.2: 文档上传与向量化（完整RAG功能）
**As a** 管理员
**I want** 上传书籍文档作为主文档或补充材料
**So that** 系统能提供精确的RAG检索和增强回答

**Priority**: High
**Story Points**: 6

**Acceptance Criteria:**
- WHEN 管理员上传TXT/Markdown文件 THE SYSTEM SHALL 验证格式并保存
- THE SYSTEM SHALL 支持主文档和补充材料两种类型
- THE SYSTEM SHALL 自动解析文档内容为章节段落
- THE SYSTEM SHALL 调用通义千问embedding API生成向量
- THE SYSTEM SHALL 将向量数据存入ChromaDB
- THE SYSTEM SHALL 支持多个补充材料（读书笔记、作者访谈、解读文章）
- WHERE 文档过大 THE SYSTEM SHALL 分块处理
- IF 解析失败 THEN THE SYSTEM SHALL 显示具体错误并支持重试
- WHILE 向量化处理 THE SYSTEM SHALL 显示实时进度

#### Story 2.3: 书籍信息完整管理
**As a** 管理员
**I want** 完整管理书籍的所有信息和状态
**So that** 我能灵活控制平台内容

**Priority**: High
**Story Points**: 4

**Acceptance Criteria:**
- THE SYSTEM SHALL 提供书籍列表页面显示所有书籍
- THE SYSTEM SHALL 支持添加新书籍
- THE SYSTEM SHALL 支持编辑所有书籍信息（名称、作者、简介、封面等）
- THE SYSTEM SHALL 支持删除书籍（同时清理向量数据）
- THE SYSTEM SHALL 支持上架/下架控制书籍可见性
- THE SYSTEM SHALL 支持设置对话策略（纯AI/纯RAG/混合模式）
- THE SYSTEM SHALL 支持手动上传或更换封面图片
- WHERE 书籍有关联数据 THE SYSTEM SHALL 在删除前提示确认

#### Story 2.4: 角色提取与管理（完整功能）
**As a** 管理员
**I want** 完整管理书中角色信息
**So that** 用户能获得丰富的角色对话体验

**Priority**: Medium
**Story Points**: 4

**Acceptance Criteria:**
- WHEN 书籍添加完成 THE SYSTEM SHALL 自动从书中提取2-5个主要角色
- THE SYSTEM SHALL 为每个角色自动生成：名称、简介、性格特征
- THE SYSTEM SHALL 允许管理员编辑角色的所有信息
- THE SYSTEM SHALL 支持设置角色的说话风格和背景故事
- THE SYSTEM SHALL 支持为每个角色配置独立的prompt模板
- THE SYSTEM SHALL 支持手动添加新角色
- THE SYSTEM SHALL 支持删除角色
- WHERE 用户选择角色对话 THE SYSTEM SHALL 严格应用角色设定

#### Story 2.5: 分类标签管理
**As a** 管理员
**I want** 管理书籍的分类和标签体系
**So that** 用户能更好地发现和筛选书籍

**Priority**: Low
**Story Points**: 2

**Acceptance Criteria:**
- THE SYSTEM SHALL 提供预设分类：文学、商业、科学、心理、哲学等
- THE SYSTEM SHALL 支持创建自定义标签
- THE SYSTEM SHALL 支持为书籍设置多个分类和标签
- THE SYSTEM SHALL 在前台支持按分类和标签筛选

### Epic 3: 智能对话系统（核心功能）
实现完整的AI对话能力，包括智能路由和多模式支持。

#### Story 3.1: 智能搜索框（核心交互）
**As a** 用户
**I want** 通过自然语言与系统交互
**So that** 我能直观地找到想要的内容

**Priority**: High
**Story Points**: 4

**Acceptance Criteria:**
- WHEN 用户输入文字 THE SYSTEM SHALL 实时解析用户意图
- WHEN 输入"我想了解[主题]" THE SYSTEM SHALL 智能推荐相关书籍
- WHEN 输入"和[角色名]聊天" THE SYSTEM SHALL 直接进入角色对话
- WHEN 输入"最近在看的书" THE SYSTEM SHALL 调出用户历史记录
- THE SYSTEM SHALL 提供实时搜索建议（书名、角色、主题）
- THE SYSTEM SHALL 记录搜索历史便于快速访问
- WHERE 搜索无结果 THE SYSTEM SHALL 提供相关推荐

#### Story 3.2: 书籍内容对话（智能路由系统）
**As a** 用户
**I want** 与书籍内容进行深度对话
**So that** 我能全面理解书籍知识

**Priority**: High
**Story Points**: 10

**Acceptance Criteria:**
- THE SYSTEM SHALL 根据问题类型自动选择最佳回答策略
- WHEN 用户提问概括性问题 THE SYSTEM SHALL 优先使用AI原生知识（快速响应）
- WHEN 用户询问具体章节细节 THE SYSTEM SHALL 使用ChromaDB检索精确内容
- WHEN 需要综合理解 THE SYSTEM SHALL 使用混合模式结合两种来源
- THE SYSTEM SHALL 支持的问题类型：
  - 概括性："这本书主要讲什么？"
  - 细节性："第五章具体说了什么？"
  - 应用性："如何运用书中的方法？"
  - 对比性："和其他同类书有何不同？"
- THE SYSTEM SHALL 实时流式输出回答（打字机效果）
- THE SYSTEM SHALL 支持用户中断生成
- WHERE 使用RAG检索 THE SYSTEM SHALL 轻量标注信息来源
- IF 检索无相关内容 THEN THE SYSTEM SHALL 回退到AI原生知识

#### Story 3.3: 角色扮演对话（沉浸式体验）
**As a** 用户
**I want** 与书中角色进行对话
**So that** 我能从角色视角理解内容

**Priority**: Medium
**Story Points**: 6

**Acceptance Criteria:**
- WHEN 用户选择角色 THE SYSTEM SHALL 进入角色扮演模式
- THE SYSTEM SHALL 严格保持角色的性格特征和说话风格
- THE SYSTEM SHALL 基于书籍内容限定角色的知识范围
- THE SYSTEM SHALL 支持的对话类型：
  - 情景对话：模拟书中场景
  - 请教问题：向角色请教观点
  - 观点讨论：与角色辩论交流
- WHILE 对话进行 THE SYSTEM SHALL 在每条消息前显示角色名称
- IF 问题超出角色认知 THEN THE SYSTEM SHALL 以角色身份自然回应不知道
- WHERE 用户切换角色 THE SYSTEM SHALL 保存当前对话并开启新对话

#### Story 3.4: 对话历史与记忆系统
**As a** 用户
**I want** 系统记住我的所有学习轨迹
**So that** 我能实现持续性学习

**Priority**: Medium
**Story Points**: 4

**Acceptance Criteria:**
- THE SYSTEM SHALL 自动保存每个用户的所有对话
- THE SYSTEM SHALL 在用户个人中心显示对话历史时间轴
- THE SYSTEM SHALL 按书籍分组展示历史对话
- THE SYSTEM SHALL 支持搜索历史对话内容
- WHEN 用户点击历史对话 THE SYSTEM SHALL 完整恢复对话上下文
- THE SYSTEM SHALL 支持继续之前的对话
- WHERE 用户删除对话 THE SYSTEM SHALL 永久删除记录
- WHILE 新对话进行 THE SYSTEM SHALL 实时保存到SQLite

### Epic 4: 管理后台系统（完整功能）
提供完整的后台管理能力，技术简单但功能完整。

#### Story 4.1: 管理后台框架
**As a** 管理员
**I want** 访问完整的管理后台
**So that** 我能高效管理所有内容

**Priority**: High
**Story Points**: 3

**Acceptance Criteria:**
- WHEN 访问/admin路径 THE SYSTEM SHALL 显示管理登录页
- THE SYSTEM SHALL 使用环境变量配置的管理员密码验证
- WHEN 登录成功 THE SYSTEM SHALL 显示管理仪表板
- THE SYSTEM SHALL 提供导航菜单：书籍管理、角色管理、系统配置
- THE SYSTEM SHALL 显示系统状态：书籍数量、用户数量、对话统计
- WHERE 30分钟无操作 THE SYSTEM SHALL 自动退出

#### Story 4.2: AI服务配置管理
**As a** 管理员
**I want** 配置和管理AI服务
**So that** 系统能灵活使用不同的AI能力

**Priority**: High
**Story Points**: 3

**Acceptance Criteria:**
- THE SYSTEM SHALL 支持配置通义千问API Key（环境变量）
- THE SYSTEM SHALL 支持配置对话模型（默认qwen-max）
- THE SYSTEM SHALL 支持配置Embedding模型
- THE SYSTEM SHALL 支持配置OpenAI兼容接口（Base URL + API Key）
- THE SYSTEM SHALL 提供配置测试功能验证连接
- IF 配置无效 THEN THE SYSTEM SHALL 显示详细错误信息
- WHERE 需要切换模型 THE SYSTEM SHALL 立即生效

### Epic 5: 用户前台界面（完整体验）
实现完整的用户界面，保持极简美学但功能完整。

#### Story 5.1: 首页与导航
**As a** 用户
**I want** 优雅的首页体验
**So that** 我能快速开始学习之旅

**Priority**: High
**Story Points**: 4

**Acceptance Criteria:**
- THE SYSTEM SHALL 在首页中心展示智能搜索框
- THE SYSTEM SHALL 展示精选书籍封面墙（悬停显示信息）
- THE SYSTEM SHALL 提供分类Tab筛选（无边框设计）
- THE SYSTEM SHALL 提供标签云筛选（极简风格）
- THE SYSTEM SHALL 显示个人入口（登录/个人中心）
- WHERE 用户已登录 THE SYSTEM SHALL 显示最近阅读

#### Story 5.2: 书籍详情页
**As a** 用户
**I want** 了解书籍详情并选择对话方式
**So that** 我能选择最适合的学习方式

**Priority**: High
**Story Points**: 3

**Acceptance Criteria:**
- THE SYSTEM SHALL 展示书籍封面和完整信息
- THE SYSTEM SHALL 显示内容简介（优美排版）
- THE SYSTEM SHALL 列出可对话的角色（极简卡片）
- THE SYSTEM SHALL 提供两个主要入口按钮：
  - "与书籍对话"：进入内容对话
  - "与角色对话"：选择角色对话
- THE SYSTEM SHALL 推荐相关书籍

#### Story 5.3: 对话界面设计
**As a** 用户
**I want** 舒适的对话体验
**So that** 我能专注于内容学习

**Priority**: High
**Story Points**: 4

**Acceptance Criteria:**
- THE SYSTEM SHALL 采用类ChatGPT布局但更精致
- THE SYSTEM SHALL 使用米白背景和墨绿色点缀
- THE SYSTEM SHALL 用极淡背景色区分对话气泡
- THE SYSTEM SHALL 右对齐用户消息，左对齐AI回复
- THE SYSTEM SHALL 使用14px字体和1.8倍行高
- THE SYSTEM SHALL 提供极简功能按钮（发送、中断、清空）
- WHILE AI回复生成 THE SYSTEM SHALL 显示优雅的打字机效果

#### Story 5.4: 个人中心
**As a** 用户
**I want** 管理我的学习记录
**So that** 我能追踪学习进度

**Priority**: Medium
**Story Points**: 3

**Acceptance Criteria:**
- THE SYSTEM SHALL 显示用户基本信息
- THE SYSTEM SHALL 展示对话历史时间轴
- THE SYSTEM SHALL 支持按书籍筛选历史
- THE SYSTEM SHALL 支持继续历史对话
- THE SYSTEM SHALL 提供简单的个人设置
- WHERE 用户退出登录 THE SYSTEM SHALL 清除session

## Non-Functional Requirements（技术简化但功能完整）

### Performance Requirements
- THE SYSTEM SHALL 在本地开发环境流畅运行
- WHEN 调用AI API THE SYSTEM SHALL 设置30秒超时
- THE SYSTEM SHALL 支持10个用户并发使用

### Technical Requirements（简化实现）
- THE SYSTEM SHALL 使用SQLite存储所有结构化数据
- THE SYSTEM SHALL 使用ChromaDB存储所有向量数据
- THE SYSTEM SHALL 使用本地文件系统存储文档
- THE SYSTEM SHALL 使用Next.js 14 App Router
- THE SYSTEM SHALL 使用简单session管理（不用JWT）
- THE SYSTEM SHALL 使用环境变量管理所有配置
- THE SYSTEM SHALL 使用console.log进行调试

### Development Requirements
- THE SYSTEM SHALL 支持热重载便于开发
- THE SYSTEM SHALL 显示详细错误信息便于调试
- WHERE 出现异常 THE SYSTEM SHALL 打印完整堆栈
- THE SYSTEM SHALL 不需要写测试代码（手动测试）
- THE SYSTEM SHALL 不需要API文档（代码注释即可）

## Constraints and Assumptions

### Technical Constraints
- 使用SQLite（简单但完整的数据存储）
- 使用ChromaDB（必须，用于RAG功能）
- 本地文件存储（MVP阶段）
- 简单密码和session（不用复杂认证）
- 不考虑安全防护（MVP阶段）

### Business Constraints
- MVP必须3-4周完成
- 初始10个用户
- 10本精选书籍完整配置

### Assumptions
- 用户可信，不会恶意攻击
- 单机部署即可满足需求
- 通义千问API稳定
- 开发者熟悉Next.js

## Success Criteria (MVP版)
- 所有核心业务功能正常工作
- AI识别、文档上传、RAG检索完整实现
- 角色对话系统正常运行
- 10本书籍完整配置并可对话
- 管理后台功能完整可用
- UI基本可用且美观

## Risk Assessment
- **风险1**：ChromaDB配置复杂 - 提供配置示例
- **风险2**：文档解析异常 - 支持手动修正
- **风险3**：AI API限流 - 实现简单重试

## Development Priorities
1. **第一优先级**：跑通核心对话流程
2. **第二优先级**：完整的书籍管理功能
3. **第三优先级**：RAG检索能力
4. **第四优先级**：角色系统
5. **第五优先级**：UI美化

## Notes for Developer
- 业务功能必须完整，技术可以简化
- 优先实现功能，后期再优化
- 大量使用console.log便于调试
- 不要过度设计，够用就好
- 遇到问题先用最简单的方案
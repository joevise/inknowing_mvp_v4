# AI服务集成文档

## 概述

本项目已完整实现Phase 4的AI服务集成，支持通义千问API和OpenAI兼容接口。所有AI功能模块均已开发完成并可测试。

## 已实现的功能模块

### 1. 核心模块
- **`lib/ai/client.ts`** - AI客户端管理（OpenAI SDK初始化、重试机制）
- **`lib/ai/config.ts`** - 配置管理（环境变量读取、模型选择）

### 2. 功能模块
- **`lib/ai/chat.ts`** - 对话功能
  - `chat()` - 普通对话
  - `streamChat()` - 流式对话（打字机效果）
  - `createChatStream()` - SSE流创建

- **`lib/ai/embedding.ts`** - 文本向量化
  - `generateEmbedding()` - 单文本向量化
  - `generateBatchEmbeddings()` - 批量向量化
  - `cosineSimilarity()` - 相似度计算

- **`lib/ai/book-recognition.ts`** - 书籍识别
  - 自动识别书籍信息
  - AI了解程度评分（1-10）
  - 封面图片推荐

- **`lib/ai/character-extraction.ts`** - 角色提取
  - 提取2-5个主要角色
  - 生成角色性格、说话风格
  - 角色背景故事

- **`lib/ai/intent-recognition.ts`** - 意图识别
  - 识别用户输入意图
  - 智能路由到相应功能
  - 提供操作建议

### 3. 提示词模板
- **`lib/ai/prompts.ts`** - 所有AI功能的提示词模板
  - 书籍识别提示词
  - 角色提取提示词
  - 对话提示词
  - 意图识别提示词

### 4. 测试接口
- **`app/api/ai/test/route.ts`** - AI服务测试API
  - GET: 基础连接测试
  - POST: 各功能模块测试
  - PUT: 流式响应测试

## 配置指南

### 1. 通义千问配置

1. 获取API密钥
   - 访问 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)
   - 创建API密钥

2. 配置环境变量
   ```env
   # .env.local
   QWEN_API_KEY=sk-your_actual_key_here
   QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
   QWEN_CHAT_MODEL=qwen-max
   QWEN_EMBEDDING_MODEL=text-embedding-v3
   ```

   **重要**：`QWEN_API_BASE` 必须使用 `/compatible-mode/v1` 路径才能与OpenAI SDK兼容

### 2. OpenAI配置（可选）

如果要使用OpenAI：
```env
OPENAI_API_KEY=sk-your_openai_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
AI_CHAT_MODEL=gpt-3.5-turbo
AI_EMBEDDING_MODEL=text-embedding-ada-002
```

## 测试方法

### 方法1：使用测试脚本

```bash
# 确保服务正在运行
npm run dev

# 在另一个终端运行测试
node test-ai.js
```

测试脚本会自动测试：
- 连接验证
- 普通对话
- 流式对话
- 文本向量化
- 书籍识别
- 角色提取
- 意图识别

### 方法2：使用cURL测试

```bash
# 基础测试
curl http://localhost:3000/api/ai/test

# 测试对话
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"test":"chat","data":{"content":"你好"}}'

# 测试书籍识别
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"test":"book","data":{"title":"红楼梦"}}'

# 测试流式响应
curl -X PUT http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"content":"介绍一下AI"}'
```

### 方法3：完整测试套件

```bash
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"test":"full-test"}'
```

## 功能特性

### 1. 智能重试机制
- 自动重试失败请求（最多3次）
- 递增延迟（1秒、2秒、3秒）
- 详细错误日志

### 2. 流式响应
- 支持打字机效果
- SSE（Server-Sent Events）格式
- 支持中断生成

### 3. Token管理
- 估算token使用量
- 自动截断过长历史
- 批量处理优化

### 4. 错误处理
- 友好的错误提示
- 降级处理策略
- 详细的调试日志

## 支持的模型

### 通义千问模型
- **对话模型**：qwen-max, qwen-plus, qwen-turbo
- **向量模型**：text-embedding-v3, text-embedding-v2

### OpenAI模型
- **对话模型**：gpt-4, gpt-3.5-turbo
- **向量模型**：text-embedding-3-small, text-embedding-ada-002

## 常见问题

### 1. API密钥无效
- 检查密钥是否正确复制
- 确认密钥有相应权限
- 检查账户余额

### 2. 连接超时
- 默认超时30秒
- 可在 `lib/ai/config.ts` 调整
- 检查网络连接

### 3. 流式响应不工作
- 确保使用PUT方法调用
- 检查响应头设置
- 查看浏览器控制台

### 4. 向量化失败
- 确认使用正确的模型名称
- 文本不能为空
- 批量处理注意大小限制

## 调试日志

所有AI操作都有详细日志：
```javascript
console.log('[模块名] 操作描述', 数据);
```

查看日志：
1. 开发服务器终端
2. 浏览器控制台（客户端）
3. Network标签页（API调用）

## 下一步开发

1. **集成ChromaDB**
   - 存储文档向量
   - 实现RAG检索

2. **完善对话系统**
   - 添加对话历史管理
   - 实现上下文保持

3. **优化性能**
   - 缓存常用结果
   - 并行处理优化

4. **增强功能**
   - 多轮对话优化
   - 个性化推荐

## 技术支持

如遇问题，请检查：
1. 环境变量配置
2. API密钥有效性
3. 网络连接状态
4. 控制台错误日志

---

**Phase 4 AI服务集成** - 完整实现 ✅
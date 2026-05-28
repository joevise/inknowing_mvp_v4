# 书籍申请功能部署说明

## 改动文件清单

### 数据库相关
- `lib/db/schema.ts` - 添加 `UserBookRequest` 接口定义和 `user_book_requests` 表 SQL
- `lib/db/book-requests.ts` - 新建，书籍申请 CRUD 操作
- `lib/db/index.ts` - 导出新的 CRUD 函数
- `scripts/migrate-user-book-requests.ts` - 新建，数据库迁移脚本

### 后端 API
- `app/api/books/request/route.ts` - 新建，用户提交书籍申请
- `app/api/user/my-requests/route.ts` - 新建，用户查看自己的申请列表
- `app/api/admin/book-requests/route.ts` - 新建，管理员获取所有申请
- `app/api/admin/book-requests/[id]/route.ts` - 新建，管理员删除申请
- `app/api/admin/book-requests/[id]/retry/route.ts` - 新建，管理员重试识别
- `app/api/admin/book-requests/[id]/reject/route.ts` - 新建，管理员拒绝申请

### 前端页面
- `app/page.tsx` - 添加"申请上架"入口链接
- `app/request-book/page.tsx` - 新建，申请表单页面
- `app/profile/page.tsx` - 添加"我的申请"Tab
- `app/admin/book-requests/page.tsx` - 新建，管理员申请管理页面
- `components/layout/AdminLayout.tsx` - 添加"书籍申请"导航入口

## 部署步骤

### 1. 运行数据库迁移

在服务器上执行以下命令：

```bash
cd ~/joevise-projects/inknowing
npx ts-node scripts/migrate-user-book-requests.ts
```

预期输出：
```
[BookRequest] 开始迁移: 添加user_book_requests表...
[BookRequest] ✓ user_book_requests表已创建
[BookRequest] ✓ user_id索引已创建
[BookRequest] ✓ status索引已创建
[BookRequest] ✓ book_id索引已创建
[BookRequest] ✓ updated_at触发器已创建
[BookRequest] ✅ 迁移完成！user_book_requests表已创建
```

### 2. 重启服务

```bash
# 如果使用 PM2
pm2 restart inknowing

# 或者重启 Next.js 服务
npm run build && npm run start
```

### 3. 验证部署

#### 3.1 验证迁移

```bash
sqlite3 data/inknowing.db ".schema user_book_requests"
```

应该看到 `user_book_requests` 表的定义。

#### 3.2 验证 API

```bash
# 测试用户申请接口（需要先登录获取 session）
curl -X POST http://localhost:3000/api/books/request \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<YOUR_SESSION>" \
  -d '{"title": "测试书籍", "author": "测试作者"}'
```

预期响应：
```json
{
  "request_id": "xxx-xxx-xxx",
  "status": "pending",
  "message": "申请已提交，我们正在努力识别这本书"
}
```

#### 3.3 验证管理员页面

访问 `http://your-domain.com/admin/book-requests`，应该能看到申请管理界面。

## 功能说明

### 用户端
- 首页搜索框下方有"找不到想看的书？📝 申请上架"入口
- `/request-book` 页面可提交申请
- `/profile` 页面有"我的申请"Tab，可查看申请状态

### 管理端
- `/admin/book-requests` 可查看所有申请
- 默认显示"许愿池"（wishlist 状态）申请
- 支持重试识别、拒绝、删除操作
- Tab 分类：全部/许愿池/等待中/处理中/已上架/失败/已拒绝

### 业务逻辑
1. 用户提交申请 → 创建 `pending` 状态记录
2. 异步调用 AI 识别：
   - 识别成功且信息完整 → `created`
   - 识别失败或信息不完整 → `wishlist`
3. 管理员可重试识别 wishlist/failed 状态的申请
4. 每天每用户最多申请 5 本书

## 回滚方案

如需回滚，执行：

```bash
# 删除表（会丢失所有申请数据）
sqlite3 data/inknowing.db "DROP TABLE IF EXISTS user_book_requests;"
```

然后重启服务即可。
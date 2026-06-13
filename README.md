# 小相册故事化后端服务

一个智能照片故事生成系统，为相册App、亲子记录工具和打印相册平台提供核心后端服务。

## 功能特性

### 核心功能
- **相册分析引擎**：自动识别拍摄时间顺序、地点线索、人物主角和重复照片
- **故事生成引擎**：生成章节标题、封面建议、照片排序、场景说明、情绪标签、旁白文案和明信片式短句
- **叙事风格选择**：支持温馨、搞笑、旅行、成长、纪实、艺术六种风格
- **版本控制系统**：支持手动改稿、版本回滚、版本对比
- **多人协作编辑**：协作者权限管理、实时评论反馈
- **故事片段收藏**：精彩片段标记、收藏夹管理
- **分享包生成**：JSON格式导出、一键分享链接
- **印刷版摘要输出**：适合印刷的排版格式

### 技术架构
- **框架**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL 15
- **缓存**：Redis 7
- **消息队列**：RabbitMQ
- **对象存储**：MinIO
- **容器化**：Docker & Docker Compose

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- Docker & Docker Compose
- Git

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd story-service
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，修改必要的配置
```

3. **启动服务**
```bash
# 开发环境
npm run dev

# 或使用 Docker Compose
docker-compose up -d
```

4. **验证服务**
```bash
curl http://localhost:3000/health
```

## API文档

### 认证接口

#### 注册用户
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "用户名"
}
```

#### 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 相册管理

#### 创建相册
```http
POST /api/v1/albums
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "我的相册",
  "description": "相册描述"
}
```

#### 添加照片
```http
POST /api/v1/albums/:id/photos
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/photo.jpg",
  "exif_data": {
    "camera": "iPhone 15",
    "aperture": "f/1.8"
  },
  "taken_at": "2024-02-09T10:30:00Z"
}
```

#### 批量添加照片
```http
POST /api/v1/albums/:id/photos/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "photos": [
    {"url": "https://example.com/photo1.jpg"},
    {"url": "https://example.com/photo2.jpg"}
  ]
}
```

#### 分析相册
```http
POST /api/v1/albums/:id/analyze
Authorization: Bearer <token>
```

### 故事生成

#### 生成故事
```http
POST /api/v1/stories/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "albumId": "album-uuid",
  "style": "温馨",
  "settings": {
    "toneIntensity": 80,
    "narrativeLength": "medium",
    "emotionTendency": "positive",
    "emojiUsage": "medium",
    "poetryQuote": false
  }
}
```

#### 获取故事列表
```http
GET /api/v1/stories?page=1&pageSize=20
Authorization: Bearer <token>
```

#### 更新故事
```http
PUT /api/v1/stories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "新的标题",
  "status": "published"
}
```

#### 更新章节
```http
PUT /api/v1/stories/:id/chapters/:cid
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "新的章节标题",
  "narration": "新的旁白文案",
  "postcard": "新的明信片短句"
}
```

### 版本管理

#### 获取版本历史
```http
GET /api/v1/stories/:id/versions
Authorization: Bearer <token>
```

#### 回滚到指定版本
```http
POST /api/v1/stories/:id/rollback
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetVersion": 3
}
```

### 协作管理

#### 添加协作者
```http
POST /api/v1/stories/:id/collaborators
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "permission": "edit"
}
```

#### 添加评论
```http
POST /api/v1/stories/:id/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "chapterId": "chapter-uuid",
  "content": "这个章节写得真好！",
  "position": "narration"
}
```

### 收藏管理

#### 添加收藏
```http
POST /api/v1/favorites
Authorization: Bearer <token>
Content-Type: application/json

{
  "storyId": "story-uuid",
  "chapterId": "chapter-uuid",
  "title": "精彩章节",
  "excerpt": "收藏内容摘要"
}
```

#### 获取收藏列表
```http
GET /api/v1/favorites
Authorization: Bearer <token>
```

### 导出功能

#### 生成分享包
```http
POST /api/v1/stories/:id/export/share
Authorization: Bearer <token>
```

#### 生成印刷版
```http
POST /api/v1/stories/:id/export/print
Authorization: Bearer <token>
Content-Type: application/json

{
  "paperSize": "A5",
  "includePhotos": true
}
```

#### 创建导出任务
```http
POST /api/v1/exports
Authorization: Bearer <token>
Content-Type: application/json

{
  "storyId": "story-uuid",
  "exportType": "share",
  "format": "json",
  "settings": {}
}
```

## 项目结构

```
story-service/
├── api-gateway/           # API网关配置
├── services/              # 微服务
│   ├── user-service/     # 用户服务
│   ├── album-service/    # 相册服务
│   ├── analysis-service/ # 分析服务
│   ├── story-service/    # 故事服务
│   ├── collaboration-service/ # 协作服务
│   ├── export-service/    # 导出服务
│   └── version-service/   # 版本服务
├── shared/                # 共享模块
│   ├── common/           # 通用工具
│   ├── models/           # 数据模型
│   ├── middleware/       # 中间件
│   └── config/          # 配置管理
├── scripts/              # 数据库脚本
│   ├── init-db.sql      # 数据库初始化
│   └── seed-data.sql    # 种子数据
├── tests/                # 测试文件
├── docker-compose.yml   # Docker编排
├── Dockerfile           # Docker镜像
└── package.json         # 依赖管理
```

## 数据库

### 初始化数据库
```bash
# 自动初始化（通过Docker Compose）
docker-compose up -d db

# 手动初始化
psql -h localhost -U postgres -d storydb -f scripts/init-db.sql
psql -h localhost -U postgres -d storydb -f scripts/seed-data.sql
```

### 主要表结构
- **users**: 用户表
- **albums**: 相册表
- **photos**: 照片表
- **stories**: 故事表
- **chapters**: 章节表
- **story_versions**: 版本历史表
- **collaborations**: 协作者表
- **comments**: 评论表
- **favorites**: 收藏表
- **exports**: 导出记录表

## 开发指南

### 本地开发
```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 运行测试
npm test

# 启动开发服务器
npm run dev
```

### Docker部署
```bash
# 构建镜像
npm run build

# 启动服务
npm run start

# 停止服务
npm run stop

# 查看日志
docker-compose logs -f
```

## 叙事风格

### 温馨风格
强调亲情、温暖、感动的叙事风格，适合家庭相册、亲子记录。

### 搞笑风格
轻松幽默，突出有趣瞬间，适合生活记录、朋友聚会。

### 旅行风格
以地点为主线，叙事性强，适合旅行记录、风景相册。

### 成长风格
记录变化、进步、里程碑，适合孩子成长记录、毕业相册。

### 纪实风格
客观记录，时间线清晰，适合新闻纪实、日常记录。

### 艺术风格
唯美、诗意、有意境，适合艺术摄影、作品集展示。

## 安全说明

- 所有API需要认证（除健康检查和注册登录）
- 使用JWT进行身份验证
- 密码使用bcrypt加密存储
- 支持协作者权限控制（view/edit/admin）
- 支持敏感内容隐藏

## 性能优化

- Redis缓存分析结果
- 消息队列异步处理长时间任务
- 数据库索引优化
- 支持水平扩展

## 许可证

MIT License

## 联系方式

如有问题，请提交Issue或联系开发团队。

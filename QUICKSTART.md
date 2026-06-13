# 快速入门指南

## 5分钟快速启动

### 1. 环境准备
确保已安装：
- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### 2. 启动服务
```bash
# 克隆项目
git clone <repository-url>
cd story-service

# 启动服务
chmod +x start.sh
./start.sh
```

### 3. 验证服务
```bash
# 检查健康状态
curl http://localhost:3000/health

# 应该返回:
# {"success":true,"data":{"status":"ok","timestamp":"..."}}
```

### 4. 创建第一个故事

#### 4.1 注册账号
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "password123",
    "nickname": "演示用户"
  }'
```

#### 4.2 登录获取Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "password123"
  }'
```

保存返回的 `token` 值。

#### 4.3 创建相册
```bash
curl -X POST http://localhost:3000/api/v1/albums \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "春节团聚",
    "description": "2024年春节家庭聚会"
  }'
```

保存返回的相册 `id`。

#### 4.4 添加照片
```bash
curl -X POST http://localhost:3000/api/v1/albums/YOUR_ALBUM_ID/photos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "url": "https://example.com/photo1.jpg",
    "taken_at": "2024-02-09T10:30:00Z",
    "exif_data": {
      "camera": "iPhone 15",
      "aperture": "f/1.8"
    }
  }'
```

#### 4.5 分析相册
```bash
curl -X POST http://localhost:3000/api/v1/albums/YOUR_ALBUM_ID/analyze \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### 4.6 生成故事
```bash
curl -X POST http://localhost:3000/api/v1/stories/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "albumId": "YOUR_ALBUM_ID",
    "style": "温馨",
    "settings": {
      "toneIntensity": 80,
      "narrativeLength": "medium",
      "emotionTendency": "positive"
    }
  }'
```

#### 4.7 查看故事
```bash
# 获取故事ID（从前一步返回）
curl http://localhost:3000/api/v1/stories/YOUR_STORY_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### 4.8 生成分享包
```bash
curl -X POST http://localhost:3000/api/v1/stories/YOUR_STORY_ID/export/share \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 常用命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f story-service

# 查看最近100行日志
docker-compose logs --tail 100
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart story-service
```

### 数据库操作
```bash
# 连接数据库
docker-compose exec db psql -U postgres -d storydb

# 查看表
\dt

# 查看用户
SELECT * FROM users;
```

## 故障排查

### 服务无法启动
```bash
# 检查Docker状态
docker info

# 查看错误日志
docker-compose logs
```

### 数据库连接失败
```bash
# 检查数据库是否运行
docker-compose ps db

# 重启数据库
docker-compose restart db
```

### API响应慢
```bash
# 检查资源使用
docker stats

# 增加内存限制（修改docker-compose.yml）
```

## 清理环境

### 停止所有服务
```bash
./stop.sh
```

### 完全清理（包括数据）
```bash
docker-compose down -v
rm -rf data/
```

## 下一步

- 阅读完整 [README.md](README.md)
- 查看 [API文档](README.md#api文档)
- 了解 [项目结构](README.md#项目结构)
- 配置生产环境

## 获取帮助

- 提交 Issue
- 查看文档
- 联系开发团队

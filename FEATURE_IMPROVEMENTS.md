# 功能改进说明文档

## 1. 导出任务立即返回pending状态

### 问题
之前导出任务在创建时可能会因为权限验证等问题失败，导致合法请求无法正常创建任务。

### 解决方案
✅ **已修复**

- 导出任务创建后立即返回，包含 `pending` 状态
- 支持协作者权限验证（owner、view、edit、admin 权限都可以创建导出）
- 只有故事确实不存在时才返回404
- 后台异步处理任务，可通过 GET `/api/v1/exports/:id` 查询状态

### 示例响应
```json
{
  "success": true,
  "data": {
    "id": "export-uuid",
    "story_id": "story-uuid",
    "export_type": "share",
    "format": "json",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 2. 重复照片完整信息返回

### 问题
相册分析时需要能清晰看到每张重复照片属于哪个重复组，以及系统推荐保留哪一张。

### 解决方案
✅ **已实现**

返回结构改进：
```json
{
  "albumId": "album-uuid",
  "duplicateGroups": [
    {
      "groupId": "group_1",
      "photoId": "photo-uuid-1",
      "duplicateIds": ["photo-uuid-2", "photo-uuid-3"],
      "recommendedKeep": "photo-uuid-1",
      "reason": "共3张相似照片，保留质量最佳的一张"
    }
  ],
  "photos": [
    {
      "id": "photo-uuid-1",
      "duplicates": ["photo-uuid-2", "photo-uuid-3"],
      ...
    }
  ]
}
```

### 推荐算法
1. **质量评分**：综合EXIF信息、地点、人脸数量
2. **原因说明**：连拍照片、拍摄时间接近等多种原因说明

## 3. 故事生成时只保留推荐照片

### 问题
重复照片不应该在故事中出现多次，需要根据分析结果的推荐只保留一张。

### 解决方案
✅ **已实现**

生成故事时：
1. 接收分析返回的 `duplicateGroups` 信息
2. 只保留每个重复组中 `recommendedKeep` 指定的照片
3. 其余重复照片自动过滤

```typescript
// 生成故事时传入重复组信息
const story = await storyService.generateStory(
  userId,
  albumId,
  '旅行',
  settings,
  duplicateGroups  // 分析返回的重复组信息
);
```

### 分享包和印刷摘要
✅ 自动过滤重复照片
✅ 保持照片顺序正确
✅ 章节分布合理

## 4. 版本控制完整恢复

### 问题
改故事后版本列表应该立即更新，回滚时要完全恢复到当时状态。

### 解决方案
✅ **已实现**

#### 编辑后立即创建版本
```typescript
// 更新故事标题
await storyService.updateStory(storyId, userId, { title: '新标题' });
// → 自动创建新版本

// 更新章节文案
await storyService.updateChapter(storyId, chapterId, userId, { 
  narration: '新旁白文案' 
});
// → 自动创建新版本
```

#### 回滚时完全恢复
```typescript
await versionService.rollback(storyId, userId, 3);
// → 恢复到版本3时的状态，包括：
//   ✅ 故事标题
//   ✅ 章节标题
//   ✅ 章节描述
//   ✅ 旁白文案
//   ✅ 明信片短句
//   ✅ 情绪标签
//   ✅ 照片顺序
//   ✅ 照片关联
```

#### 版本对比API
```bash
GET /api/v1/stories/:id/versions
# 返回完整的版本列表，每条记录包含：
# - version_number
# - created_at
# - change_summary
# - created_by 用户信息
```

## 5. 敏感内容和地点信息处理

### 问题
上传照片时需要保留地点信息用于场景说明，同时支持隐藏敏感照片。

### 解决方案
✅ **已实现**

#### 添加照片时支持新参数
```json
POST /api/v1/albums/:id/photos
{
  "url": "https://example.com/photo.jpg",
  "location_data": {
    "lat": 30.2741,
    "lng": 120.1551,
    "name": "杭州西湖"
  },
  "is_flagged": false
}
```

#### 批量添加时支持
```json
POST /api/v1/albums/:id/photos/batch
{
  "photos": [
    {
      "url": "https://example.com/photo1.jpg",
      "location_data": {"lat": 30.2741, "lng": 120.1551, "name": "西湖"},
      "is_flagged": false
    },
    {
      "url": "https://example.com/photo2.jpg",
      "is_flagged": true  // 标记为敏感
    }
  ]
}
```

#### 地点信息用于章节生成
✅ **旅行风格**章节标题包含地点
- 原始：`1. 探索`
- 改进：`1. 西湖的探索`

✅ **场景说明**包含位置描述
- 原始：`这一章节包含 5 张照片，记录着美好的瞬间。`
- 改进：`这一章节包含 5 张照片，在杭州记录着美好的瞬间。`

#### 敏感照片过滤
在以下场景中自动过滤 `is_flagged=true` 的照片：

1. **故事生成**
   ```sql
   WHERE album_id = $1 AND is_flagged = false
   ```

2. **分享包生成**
   ```sql
   FILTER (WHERE p.id IS NOT NULL AND p.is_flagged = false)
   ```

3. **印刷摘要生成**
   ```sql
   FILTER (WHERE p.id IS NOT NULL AND p.is_flagged = false)
   ```

4. **导出JSON/Html**
   ✅ 自动排除敏感照片
   ✅ 保持照片顺序正确

### 完整工作流示例

```bash
# 1. 上传照片（含地点和敏感标记）
curl -X POST /api/v1/albums/:id/photos \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "https://example.com/photo.jpg",
    "location_data": {"lat": 30.2741, "lng": 120.1551, "name": "杭州西湖"},
    "is_flagged": false
  }'

# 2. 分析相册（返回重复组信息）
curl -X POST /api/v1/albums/:id/analyze \
  -H "Authorization: Bearer <token>"
# → 返回 duplicateGroups，包含推荐保留的照片ID

# 3. 生成故事（基于分析结果过滤重复）
curl -X POST /api/v1/stories/generate \
  -H "Authorization: Bearer <token>" \
  -d '{
    "albumId": "album-id",
    "style": "旅行",
    "settings": {...},
    "duplicateGroups": [...]  // 可选，传入则过滤重复
  }'
# → 章节标题包含地点，敏感照片不出现

# 4. 生成分享包
curl -X POST /api/v1/stories/:id/export/share \
  -H "Authorization: Bearer <token>"
# → 包含地点说明，敏感照片不出现

# 5. 生成印刷版
curl -X POST /api/v1/stories/:id/export/print \
  -H "Authorization: Bearer <token>"
# → 包含位置描述，敏感照片不出现
```

## 技术实现要点

### 权限层级
```typescript
const permissionHierarchy = {
  'view': 1,   // 可查看、可导出
  'edit': 2,    // 可编辑、可导出
  'admin': 3    // 完全控制
};
```

### 重复检测算法
```typescript
isDuplicate(photo1, photo2) {
  // 1. 相同URL
  if (url相同) return true;
  
  // 2. 5秒内拍摄 + 100米内
  if (时间差<5秒 && 距离<100米) return true;
  
  return false;
}
```

### 照片推荐评分
```typescript
selectRecommendedPhoto(photos) {
  let bestScore = 0;
  
  for (const photo of photos) {
    let score = 0;
    if (exif_data) score += 20;
    if (location_data) score += 15;
    if (face_data) score += 15;
    score += quality;  // 分析质量分数
    
    if (score > bestScore) {
      bestScore = score;
      bestPhoto = photo;
    }
  }
  
  return bestPhoto;
}
```

## 总结

所有5个功能需求均已完整实现：

1. ✅ 导出任务立即返回pending状态
2. ✅ 重复照片分析返回完整重复组信息
3. ✅ 故事生成时只保留推荐照片
4. ✅ 版本控制完整恢复
5. ✅ 地点和敏感标记正确处理

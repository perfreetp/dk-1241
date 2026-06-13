-- 小相册故事化后端服务 - 种子数据
-- 用于开发和测试

-- 清理现有数据（按依赖关系顺序）
DELETE FROM exports;
DELETE FROM favorites;
DELETE FROM comments;
DELETE FROM collaborations;
DELETE FROM chapter_photos;
DELETE FROM chapters;
DELETE FROM story_versions;
DELETE FROM stories;
DELETE FROM photos;
DELETE FROM albums;
DELETE FROM users;

-- 重置序列
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE albums_id_seq RESTART WITH 1;
ALTER SEQUENCE photos_id_seq RESTART WITH 1;
ALTER SEQUENCE stories_id_seq RESTART WITH 1;
ALTER SEQUENCE chapters_id_seq RESTART WITH 1;
ALTER SEQUENCE story_versions_id_seq RESTART WITH 1;
ALTER SEQUENCE comments_id_seq RESTART WITH 1;
ALTER SEQUENCE favorites_id_seq RESTART WITH 1;
ALTER SEQUENCE exports_id_seq RESTART WITH 1;

-- 插入测试用户
INSERT INTO users (id, email, password_hash, nickname, role) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@storyservice.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYBkq5J7fK', '管理员', 'admin'),
('550e8400-e29b-41d4-a716-446655440002', 'user1@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYBkq5J7fK', '测试用户1', 'user'),
('550e8400-e29b-41d4-a716-446655440003', 'user2@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYBkq5J7fK', '测试用户2', 'user');

-- 插入测试相册
INSERT INTO albums (id, user_id, name, description, status) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '2024年春节团聚', '记录春节期间的温馨时光', 'active'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '杭州旅行', '五一假期杭州之旅', 'active'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '宝宝成长记录', '记录孩子成长的点点滴滴', 'active');

-- 插入测试照片（春节相册）
INSERT INTO photos (id, album_id, url, taken_at, exif_data, emotion_tags, location_data) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'https://example.com/photos/spring1.jpg', '2024-02-09 10:30:00', 
 '{"camera": "iPhone 15", "aperture": "f/1.8", "iso": 100}', ARRAY['温馨', '团圆'], 
 '{"lat": 39.9042, "lng": 116.4074, "name": "北京"}'),

('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'https://example.com/photos/spring2.jpg', '2024-02-09 12:00:00',
 '{"camera": "iPhone 15", "aperture": "f/2.0", "iso": 120}', ARRAY['温馨', '美食'],
 '{"lat": 39.9042, "lng": 116.4074, "name": "北京"}'),

('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'https://example.com/photos/spring3.jpg', '2024-02-10 18:00:00',
 '{"camera": "iPhone 15", "aperture": "f/1.8", "iso": 200}', ARRAY['快乐', '热闹'],
 '{"lat": 39.9042, "lng": 116.4074, "name": "北京"}');

-- 插入测试照片（杭州旅行）
INSERT INTO photos (id, album_id, url, taken_at, exif_data, emotion_tags, location_data) VALUES
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'https://example.com/photos/hangzhou1.jpg', '2024-05-01 08:30:00',
 '{"camera": "Sony A7M4", "aperture": "f/8.0", "iso": 100}', ARRAY['期待', '兴奋'],
 '{"lat": 30.2741, "lng": 120.1551, "name": "杭州西湖"}'),

('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 'https://example.com/photos/hangzhou2.jpg', '2024-05-01 10:00:00',
 '{"camera": "Sony A7M4", "aperture": "f/5.6", "iso": 100}', ARRAY['宁静', '美好'],
 '{"lat": 30.2741, "lng": 120.1551, "name": "杭州西湖"}'),

('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', 'https://example.com/photos/hangzhou3.jpg', '2024-05-02 14:00:00',
 '{"camera": "Sony A7M4", "aperture": "f/4.0", "iso": 200}', ARRAY['探索', '惊喜'],
 '{"lat": 30.2315, "lng": 120.1281, "name": "灵隐寺"}');

-- 插入测试故事
INSERT INTO stories (id, album_id, user_id, title, style, status, settings, current_version) VALUES
('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 
 '温馨的春节', '温馨', 'draft',
 '{"toneIntensity": 80, "narrativeLength": "medium", "emotionTendency": "positive"}', 1),

('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002',
 '杭州漫游记', '旅行', 'published',
 '{"toneIntensity": 60, "narrativeLength": "long", "emotionTendency": "positive"}', 2);

-- 插入测试章节
INSERT INTO chapters (id, story_id, order_index, title, description, emotion_tags, narration, postcard) VALUES
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 1, '团圆时刻', '除夕夜的温馨团聚',
 ARRAY['温馨', '期待'], '又是一年春节时，我们一家人终于团聚在一起...', '家的味道，是最美的风景'),

('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440001', 2, '年夜饭', '丰盛的年夜饭，满满的幸福感',
 ARRAY['温馨', '美食', '快乐'], '厨房里飘出阵阵香味，妈妈的拿手菜...', '每一道菜都是爱的味道'),

('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440002', 1, '初到西湖', '踏上杭州的土地',
 ARRAY['期待', '兴奋'], '西湖，我们来了！湖光山色尽收眼底...', '水光潋滟晴方好'),

('990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440002', 2, '漫步苏堤', '感受西湖的宁静',
 ARRAY['宁静', '美好'], '苏堤春晓，柳绿桃红，微风拂面...', '最爱湖东行不足');

-- 插入章节照片关联
INSERT INTO chapter_photos (chapter_id, photo_id, order_index, caption) VALUES
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 1, '全家人团聚'),
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 1, '丰盛的年夜饭'),
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440004', 1, '西湖美景'),
('990e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440005', 1, '苏堤春晓');

-- 插入测试版本
INSERT INTO story_versions (story_id, version_number, content, change_summary, created_by) VALUES
('880e8400-e29b-41d4-a716-446655440002', 1, 
 '{"title": "杭州之旅", "chapters": [{"title": "出发", "photos": []}]}',
 '初始版本', '550e8400-e29b-41d4-a716-446655440002'),

('880e8400-e29b-41d4-a716-446655440002', 2,
 '{"title": "杭州漫游记", "chapters": [{"title": "初到西湖", "photos": []}, {"title": "漫步苏堤", "photos": []}]}',
 '完善章节结构', '550e8400-e29b-41d4-a716-446655440002');

-- 插入测试协作关系
INSERT INTO collaborations (story_id, user_id, permission, invited_by, accepted_at) VALUES
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'edit',
 '550e8400-e29b-41d4-a716-446655440002', '2024-06-01 10:00:00');

-- 插入测试评论
INSERT INTO comments (story_id, user_id, chapter_id, content, position) VALUES
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 
 '990e8400-e29b-41d4-a716-446655440003', '这段描写很美！', 'narration'),

('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003',
 '990e8400-e29b-41d4-a716-446655440004', '明信片文案很喜欢', 'postcard');

-- 插入测试收藏
INSERT INTO favorites (user_id, story_id, chapter_id, title, excerpt) VALUES
('550e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440002',
 '990e8400-e29b-41d4-a716-446655440004', '漫步苏堤', '水光潋滟晴方好');

-- 打印完成消息
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Test users created:';
    RAISE NOTICE '  - admin@storyservice.com (admin)';
    RAISE NOTICE '  - user1@example.com (user)';
    RAISE NOTICE '  - user2@example.com (user)';
    RAISE NOTICE 'Default password for all users: password123';
END $$;

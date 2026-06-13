import db from '../../shared/common/database';
import { 
  Story, Chapter, ChapterPhoto, StoryWithDetails, ChapterWithPhotos,
  StoryStyle, StorySettings, StoryContent, StoryGenerationResult, GeneratedChapter, DuplicateGroup
} from '../../shared/models';
import { NotFoundError, ForbiddenError } from '../../shared/common';
import { v4 as uuidv4 } from 'uuid';

export class StoryService {
  async generateStory(
    userId: string,
    albumId: string,
    style: StoryStyle,
    settings?: StorySettings,
    duplicateGroups?: DuplicateGroup[]
  ): Promise<StoryGenerationResult> {
    const albumResult = await db.query(
      'SELECT * FROM albums WHERE id = $1 AND user_id = $2',
      [albumId, userId]
    );

    if (albumResult.rows.length === 0) {
      throw new NotFoundError('Album', albumId);
    }

    const photosResult = await db.query(
      `SELECT * FROM photos 
       WHERE album_id = $1 AND is_flagged = false
       ORDER BY taken_at ASC NULLS LAST, created_at ASC`,
      [albumId]
    );

    let photos = photosResult.rows;
    
    if (photos.length === 0) {
      throw new Error('No photos in album to generate story');
    }

    photos = this.filterDuplicatePhotos(photos, duplicateGroups);

    const defaultSettings: StorySettings = {
      toneIntensity: settings?.toneIntensity ?? 50,
      narrativeLength: settings?.narrativeLength ?? 'medium',
      emotionTendency: settings?.emotionTendency ?? 'positive',
      emojiUsage: settings?.emojiUsage ?? 'medium',
      poetryQuote: settings?.poetryQuote ?? false,
    };

    const storyId = uuidv4();
    const chapters = this.generateChapters(photos, style, defaultSettings);
    
    const storyResult = await db.query(
      `INSERT INTO stories (id, album_id, user_id, title, style, status, settings)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING *`,
      [storyId, albumId, userId, chapters[0]?.title || '默认故事', style, JSON.stringify(defaultSettings)]
    );

    for (const chapter of chapters) {
      const chapterId = uuidv4();
      await db.query(
        `INSERT INTO chapters (id, story_id, order_index, title, description, emotion_tags, narration, postcard)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          chapterId,
          storyId,
          chapter.orderIndex,
          chapter.title,
          chapter.description,
          chapter.emotionTags,
          chapter.narration,
          chapter.postcard,
        ]
      );

      for (const photo of chapter.photos) {
        await db.query(
          `INSERT INTO chapter_photos (chapter_id, photo_id, order_index, caption)
           VALUES ($1, $2, $3, $4)`,
          [chapterId, photo.id, chapter.photos.indexOf(photo), photo.caption]
        );
      }
    }

    await this.createVersion(storyId, userId, 'Initial story generation');

    return {
      storyId,
      title: chapters[0]?.title || '默认故事',
      style,
      chapters,
      createdAt: new Date(),
    };
  }

  private filterDuplicatePhotos(photos: any[], duplicateGroups?: DuplicateGroup[]): any[] {
    if (!duplicateGroups || duplicateGroups.length === 0) {
      return photos;
    }

    const recommendedPhotoIds = new Set<string>();
    for (const group of duplicateGroups) {
      recommendedPhotoIds.add(group.recommendedKeep);
    }

    const seen = new Set<string>();
    const filtered: any[] = [];

    for (const photo of photos) {
      if (seen.has(photo.id)) continue;

      if (recommendedPhotoIds.has(photo.id)) {
        filtered.push(photo);
        seen.add(photo.id);
      } else {
        const inDuplicateGroup = duplicateGroups.some(
          g => g.photoId === photo.id || g.duplicateIds.includes(photo.id)
        );
        
        if (!inDuplicateGroup) {
          filtered.push(photo);
          seen.add(photo.id);
        }
      }
    }

    return filtered;
  }

  private generateChapters(photos: any[], style: StoryStyle, settings: StorySettings): GeneratedChapter[] {
    const chapters: GeneratedChapter[] = [];
    const chunkSize = Math.ceil(photos.length / 3);
    
    for (let i = 0; i < photos.length; i += chunkSize) {
      const chunk = photos.slice(i, i + chunkSize);
      const chapterIndex = Math.floor(i / chunkSize) + 1;
      
      const emotionTags = this.getEmotionTags(chunk, style);
      const narration = this.generateNarration(chunk, style, settings);
      const postcard = this.generatePostcard(chunk, style);
      
      chapters.push({
        id: uuidv4(),
        orderIndex: chapterIndex,
        title: this.generateChapterTitle(chunk, chapterIndex, style),
        description: this.generateDescription(chunk, style),
        coverPhotoId: chunk[0]?.id || '',
        emotionTags,
        narration,
        postcard,
        photos: chunk.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          caption: this.generateCaption(photo, style),
        })),
      });
    }

    return chapters;
  }

  private getEmotionTags(photos: any[], style: StoryStyle): string[] {
    const baseTags: Record<StoryStyle, string[]> = {
      '温馨': ['温馨', '亲情', '感动'],
      '搞笑': ['欢乐', '有趣', '搞笑'],
      '旅行': ['探索', '发现', '新奇'],
      '成长': ['进步', '变化', '回忆'],
      '纪实': ['真实', '记录', '自然'],
      '艺术': ['美感', '创意', '意境'],
    };

    return baseTags[style] || ['美好', '难忘'];
  }

  private generateNarration(photos: any[], style: StoryStyle, settings: StorySettings): string {
    const narrations: Record<StoryStyle, string[]> = {
      '温馨': [
        '时光匆匆，但这些温暖的瞬间永远铭刻在心。',
        '家人们的笑容，是世界上最珍贵的宝藏。',
        '每一张照片都承载着一份深深的爱。',
      ],
      '搞笑': [
        '生活处处有惊喜，这些瞬间让人忍俊不禁！',
        '回头看这些照片，还是忍不住笑出声来。',
        '有趣的灵魂万里挑一，这些时刻独一无二！',
      ],
      '旅行': [
        '背上行囊，去探索这个美丽的世界。',
        '每一处风景都有它独特的故事。',
        '在路上，遇见更好的自己。',
      ],
      '成长': [
        '时间是最好的见证者，记录着每一步成长。',
        '从稚嫩到成熟，每一刻都值得被珍藏。',
        '成长的道路上，我们一直在前进。',
      ],
      '纪实': [
        '镜头捕捉真实的瞬间，生活本来的样子。',
        '平凡的日子，也有不平凡的故事。',
        '用镜头记录，用心感受。',
      ],
      '艺术': [
        '光影之间，发现生活中的艺术之美。',
        '每一个画面都是一幅独特的画作。',
        '用艺术的眼睛，看待这个世界。',
      ],
    };

    const styleNarrations = narrations[style] || narrations['纪实'];
    const index = Math.floor(Math.random() * styleNarrations.length);
    return styleNarrations[index];
  }

  private generatePostcard(photos: any[], style: StoryStyle): string {
    const postcards: Record<StoryStyle, string[]> = {
      '温馨': ['珍藏每一刻', '爱在心中', '温暖相伴'],
      '搞笑': ['笑出强大', '快乐加倍', '欢乐时光'],
      '旅行': ['风景这边独好', '在路上', '发现美好'],
      '成长': ['时光印记', '成长的足迹', '美好回忆'],
      '纪实': ['真实之美', '生活记录', '瞬间永恒'],
      '艺术': ['光影艺术', '美的瞬间', '意境之美'],
    };

    const stylePostcards = postcards[style] || postcards['纪实'];
    return stylePostcards[Math.floor(Math.random() * stylePostcards.length)];
  }

  private generateChapterTitle(photos: any[], index: number, style: StoryStyle): string {
    const locationName = this.extractLocationName(photos);
    
    const titles: Record<StoryStyle, string[]> = {
      '温馨': ['温馨时刻', '爱的记录', '家人时光', '温情回忆'],
      '搞笑': ['欢乐瞬间', '趣味时刻', '爆笑回忆', '开心一刻'],
      '旅行': ['出发', '探索', '发现', '风景', '足迹'],
      '成长': ['成长的脚步', '蜕变', '新篇章', '进步'],
      '纪实': ['记录', '时光', '瞬间', '日常', '真实'],
      '艺术': ['光影', '美感', '瞬间', '艺术', '创意'],
    };

    const styleTitles = titles[style] || titles['纪实'];
    const baseTitle = styleTitles[Math.floor(Math.random() * styleTitles.length)];
    
    if (locationName && style === '旅行') {
      return `${index}. ${locationName}的${baseTitle}`;
    }
    
    return `${index}. ${baseTitle}`;
  }

  private generateDescription(photos: any[], style: StoryStyle): string {
    const photoCount = photos.length;
    const locationName = this.extractLocationName(photos);
    const locationInfo = locationName ? `在${locationName}` : '';
    
    if (locationName) {
      return `这一章节包含 ${photoCount} 张照片，${locationInfo}记录着美好的瞬间。`;
    }
    
    return `这一章节包含 ${photoCount} 张照片，记录着美好的瞬间。`;
  }

  private extractLocationName(photos: any[]): string | null {
    for (const photo of photos) {
      if (photo.location_data && photo.location_data.name) {
        return photo.location_data.name;
      }
    }
    return null;
  }

  private generateCaption(photo: any, style: StoryStyle): string {
    const captions = [
      '美好的瞬间',
      '难忘的记忆',
      '珍贵的时刻',
      '快乐的回忆',
    ];
    return captions[Math.floor(Math.random() * captions.length)];
  }

  async findById(id: string): Promise<Story | null> {
    const result = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdWithDetails(id: string, userId?: string): Promise<StoryWithDetails | null> {
    const story = await this.findById(id);
    
    if (!story) {
      return null;
    }

    if (userId) {
      const hasPermission = await this.checkViewPermission(id, userId);
      if (!hasPermission) {
        throw new ForbiddenError('You do not have permission to view this story');
      }
    }

    const [chaptersResult, versionsResult, collaboratorsResult] = await Promise.all([
      db.query<Chapter>(
        'SELECT * FROM chapters WHERE story_id = $1 ORDER BY order_index',
        [id]
      ),
      db.query(
        'SELECT * FROM story_versions WHERE story_id = $1 ORDER BY version_number DESC',
        [id]
      ),
      db.query(
        'SELECT c.*, u.email, u.nickname FROM collaborations c JOIN users u ON c.user_id = u.id WHERE c.story_id = $1',
        [id]
      ),
    ]);

    return {
      ...story,
      chapters: chaptersResult.rows,
      versions: versionsResult.rows,
      collaborators: collaboratorsResult.rows,
    };
  }

  async findChaptersWithPhotos(storyId: string): Promise<ChapterWithPhotos[]> {
    const chaptersResult = await db.query<Chapter>(
      'SELECT * FROM chapters WHERE story_id = $1 ORDER BY order_index',
      [storyId]
    );

    const chaptersWithPhotos: ChapterWithPhotos[] = [];

    for (const chapter of chaptersResult.rows) {
      const photosResult = await db.query(
        `SELECT cp.*, p.* FROM chapter_photos cp
         JOIN photos p ON cp.photo_id = p.id
         WHERE cp.chapter_id = $1
         ORDER BY cp.order_index`,
        [chapter.id]
      );

      chaptersWithPhotos.push({
        ...chapter,
        photos: photosResult.rows,
      });
    }

    return chaptersWithPhotos;
  }

  async findByUserId(userId: string, page: number = 1, pageSize: number = 20): Promise<{ stories: Story[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [storiesResult, countResult] = await Promise.all([
      db.query<Story>(
        `SELECT * FROM stories 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM stories WHERE user_id = $1',
        [userId]
      ),
    ]);

    return {
      stories: storiesResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async updateStory(
    id: string,
    userId: string,
    data: {
      title?: string;
      style?: StoryStyle;
      status?: 'draft' | 'published' | 'archived';
      settings?: StorySettings;
    }
  ): Promise<Story> {
    const story = await this.findById(id);
    
    if (!story) {
      throw new NotFoundError('Story', id);
    }

    const hasPermission = await this.checkEditPermission(id, userId);

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to edit this story. Only the owner and collaborators with edit/admin permission can make changes.');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.style !== undefined) {
      updates.push(`style = $${paramIndex++}`);
      values.push(data.style);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(data.settings));
    }

    if (updates.length === 0) {
      return story;
    }

    values.push(id);

    const result = await db.query<Story>(
      `UPDATE stories SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    await this.createVersion(id, userId, 'Story updated');

    return result.rows[0];
  }

  private async checkEditPermission(storyId: string, userId: string): Promise<boolean> {
    const storyResult = await db.query<Story>(
      'SELECT user_id FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      return false;
    }

    const story = storyResult.rows[0];

    if (story.user_id === userId) {
      return true;
    }

    const collabResult = await db.query(
      'SELECT permission FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );

    if (collabResult.rows.length === 0) {
      return false;
    }

    const permission = collabResult.rows[0].permission;
    return permission === 'edit' || permission === 'admin';
  }

  private async checkViewPermission(storyId: string, userId: string): Promise<boolean> {
    const storyResult = await db.query<Story>(
      'SELECT user_id FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      return false;
    }

    const story = storyResult.rows[0];

    if (story.user_id === userId) {
      return true;
    }

    const collabResult = await db.query(
      'SELECT 1 FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );

    return collabResult.rows.length > 0;
  }

  async updateChapter(
    storyId: string,
    chapterId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      emotion_tags?: string[];
      narration?: string;
      postcard?: string;
      order_index?: number;
    }
  ): Promise<Chapter> {
    const story = await this.findById(storyId);
    
    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    const hasPermission = await this.checkEditPermission(storyId, userId);

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to edit this story. Only the owner and collaborators with edit/admin permission can make changes.');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.emotion_tags !== undefined) {
      updates.push(`emotion_tags = $${paramIndex++}`);
      values.push(data.emotion_tags);
    }

    if (data.narration !== undefined) {
      updates.push(`narration = $${paramIndex++}`);
      values.push(data.narration);
    }

    if (data.postcard !== undefined) {
      updates.push(`postcard = $${paramIndex++}`);
      values.push(data.postcard);
    }

    if (data.order_index !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      values.push(data.order_index);
    }

    if (updates.length === 0) {
      const existingChapter = await db.query<Chapter>(
        'SELECT * FROM chapters WHERE id = $1 AND story_id = $2',
        [chapterId, storyId]
      );
      if (existingChapter.rows.length === 0) {
        throw new NotFoundError('Chapter', chapterId);
      }
      return existingChapter.rows[0];
    }

    values.push(chapterId);
    values.push(storyId);

    const result = await db.query<Chapter>(
      `UPDATE chapters SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND story_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Chapter', chapterId);
    }

    await this.createVersion(storyId, userId, `Chapter "${data.title || chapterId}" updated`);

    return result.rows[0];
  }

  async deleteStory(id: string, userId: string): Promise<void> {
    const story = await this.findById(id);
    
    if (!story) {
      throw new NotFoundError('Story', id);
    }

    if (story.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to delete this story');
    }

    await db.query('DELETE FROM stories WHERE id = $1', [id]);
  }

  async createVersion(storyId: string, userId: string, changeSummary: string): Promise<any> {
    const story = await this.findByIdWithDetails(storyId);
    
    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    const newVersion = story.current_version + 1;

    const content: StoryContent = {
      title: story.title || '',
      style: story.style,
      chapters: story.chapters?.map(ch => ({
        id: ch.id,
        title: ch.title || '',
        description: ch.description || undefined,
        photos: [],
        emotion_tags: ch.emotion_tags || undefined,
        narration: ch.narration || undefined,
        postcard: ch.postcard || undefined,
      })) || [],
    };

    await db.query(
      `INSERT INTO story_versions (story_id, version_number, content, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [storyId, newVersion, JSON.stringify(content), changeSummary, userId]
    );

    await db.query(
      'UPDATE stories SET current_version = $1 WHERE id = $2',
      [newVersion, storyId]
    );

    return { versionNumber: newVersion };
  }

  async getVersions(storyId: string, userId: string): Promise<any[]> {
    const story = await this.findById(storyId);
    
    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    if (story.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to view this story');
    }

    const result = await db.query(
      `SELECT sv.*, u.email, u.nickname as created_by_nickname
       FROM story_versions sv
       JOIN users u ON sv.created_by = u.id
       WHERE sv.story_id = $1
       ORDER BY sv.version_number DESC`,
      [storyId]
    );

    return result.rows;
  }

  async rollback(storyId: string, userId: string, targetVersion: number): Promise<Story> {
    const story = await this.findById(storyId);
    
    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    if (story.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to rollback this story');
    }

    const versionResult = await db.query(
      'SELECT * FROM story_versions WHERE story_id = $1 AND version_number = $2',
      [storyId, targetVersion]
    );

    if (versionResult.rows.length === 0) {
      throw new NotFoundError('Version', targetVersion.toString());
    }

    const version = versionResult.rows[0];
    const content = version.content;

    await db.query('DELETE FROM chapters WHERE story_id = $1', [storyId]);

    for (const chapterContent of content.chapters) {
      await db.query(
        `INSERT INTO chapters (id, story_id, order_index, title, description, emotion_tags, narration, postcard)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          chapterContent.id || uuidv4(),
          storyId,
          content.chapters.indexOf(chapterContent),
          chapterContent.title,
          chapterContent.description || null,
          chapterContent.emotion_tags || null,
          chapterContent.narration || null,
          chapterContent.postcard || null,
        ]
      );
    }

    await this.createVersion(storyId, userId, `Rolled back to version ${targetVersion}`);

    const updatedStory = await this.findById(storyId);
    return updatedStory!;
  }
}

export const storyService = new StoryService();

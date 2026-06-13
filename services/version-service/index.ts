import db from '../../shared/common/database';
import { StoryVersion, StoryContent, Story } from '../../shared/models';
import { NotFoundError, ForbiddenError } from '../../shared/common';
import { v4 as uuidv4 } from 'uuid';

export class VersionService {
  async createVersion(
    storyId: string,
    userId: string,
    changeSummary: string
  ): Promise<StoryVersion> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];
    const newVersionNumber = story.current_version + 1;

    const chaptersResult = await db.query(
      `SELECT c.*, 
              COALESCE(json_agg(
                json_build_object(
                  'id', cp.id,
                  'photo_id', cp.photo_id,
                  'order_index', cp.order_index,
                  'caption', cp.caption
                )
              ) FILTER (WHERE cp.id IS NOT NULL), '[]') as chapter_photos
       FROM chapters c
       LEFT JOIN chapter_photos cp ON c.id = cp.chapter_id
       WHERE c.story_id = $1
       GROUP BY c.id
       ORDER BY c.order_index`,
      [storyId]
    );

    const content: StoryContent = {
      title: story.title || '',
      style: story.style,
      chapters: chaptersResult.rows.map(row => ({
        id: row.id,
        title: row.title || '',
        description: row.description || undefined,
        photos: (row.chapter_photos || []).map((cp: any) => ({
          id: cp.photo_id,
          caption: cp.caption,
        })),
        emotion_tags: row.emotion_tags || undefined,
        narration: row.narration || undefined,
        postcard: row.postcard || undefined,
      })),
    };

    const versionResult = await db.query<StoryVersion>(
      `INSERT INTO story_versions (story_id, version_number, content, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [storyId, newVersionNumber, JSON.stringify(content), changeSummary, userId]
    );

    await db.query(
      'UPDATE stories SET current_version = $1 WHERE id = $2',
      [newVersionNumber, storyId]
    );

    return versionResult.rows[0];
  }

  async getVersions(storyId: string, userId: string): Promise<any[]> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== userId) {
      const collabResult = await db.query(
        'SELECT * FROM collaborations WHERE story_id = $1 AND user_id = $2',
        [storyId, userId]
      );

      if (collabResult.rows.length === 0) {
        throw new ForbiddenError('You do not have permission to view this story');
      }
    }

    const versionsResult = await db.query(
      `SELECT sv.*, 
              u.email as created_by_email,
              u.nickname as created_by_nickname
       FROM story_versions sv
       JOIN users u ON sv.created_by = u.id
       WHERE sv.story_id = $1
       ORDER BY sv.version_number DESC`,
      [storyId]
    );

    return versionsResult.rows;
  }

  async getVersion(storyId: string, versionId: string, userId: string): Promise<StoryVersion> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== userId) {
      const collabResult = await db.query(
        'SELECT * FROM collaborations WHERE story_id = $1 AND user_id = $2',
        [storyId, userId]
      );

      if (collabResult.rows.length === 0) {
        throw new ForbiddenError('You do not have permission to view this story');
      }
    }

    const versionResult = await db.query<StoryVersion>(
      'SELECT * FROM story_versions WHERE id = $1 AND story_id = $2',
      [versionId, storyId]
    );

    if (versionResult.rows.length === 0) {
      throw new NotFoundError('Version', versionId);
    }

    return versionResult.rows[0];
  }

  async rollback(storyId: string, userId: string, targetVersion: number): Promise<Story> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to rollback this story');
    }

    const versionResult = await db.query<StoryVersion>(
      'SELECT * FROM story_versions WHERE story_id = $1 AND version_number = $2',
      [storyId, targetVersion]
    );

    if (versionResult.rows.length === 0) {
      throw new NotFoundError('Version', targetVersion.toString());
    }

    const version = versionResult.rows[0];
    const content: StoryContent = version.content;

    await db.transaction(async (client) => {
      await client.query('DELETE FROM chapter_photos WHERE chapter_id IN (SELECT id FROM chapters WHERE story_id = $1)', [storyId]);
      await client.query('DELETE FROM chapters WHERE story_id = $1', [storyId]);

      for (let i = 0; i < content.chapters.length; i++) {
        const chapterData = content.chapters[i];
        const chapterId = chapterData.id || uuidv4();

        await client.query(
          `INSERT INTO chapters (id, story_id, order_index, title, description, emotion_tags, narration, postcard)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            chapterId,
            storyId,
            i,
            chapterData.title,
            chapterData.description || null,
            chapterData.emotion_tags || null,
            chapterData.narration || null,
            chapterData.postcard || null,
          ]
        );

        for (let j = 0; j < chapterData.photos.length; j++) {
          const photoData = chapterData.photos[j];
          await client.query(
            `INSERT INTO chapter_photos (chapter_id, photo_id, order_index, caption)
             VALUES ($1, $2, $3, $4)`,
            [chapterId, photoData.id, j, photoData.caption || null]
          );
        }
      }
    });

    await this.createVersion(storyId, userId, `Rolled back to version ${targetVersion}`);

    const updatedStoryResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    return updatedStoryResult.rows[0];
  }

  async compareVersions(storyId: string, version1: number, version2: number, userId: string): Promise<{
    version1: StoryVersion;
    version2: StoryVersion;
    differences: any;
  }> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to view this story');
    }

    const [v1Result, v2Result] = await Promise.all([
      db.query<StoryVersion>(
        'SELECT * FROM story_versions WHERE story_id = $1 AND version_number = $2',
        [storyId, version1]
      ),
      db.query<StoryVersion>(
        'SELECT * FROM story_versions WHERE story_id = $1 AND version_number = $2',
        [storyId, version2]
      ),
    ]);

    if (v1Result.rows.length === 0) {
      throw new NotFoundError('Version', version1.toString());
    }

    if (v2Result.rows.length === 0) {
      throw new NotFoundError('Version', version2.toString());
    }

    const differences = this.calculateDifferences(
      v1Result.rows[0].content,
      v2Result.rows[0].content
    );

    return {
      version1: v1Result.rows[0],
      version2: v2Result.rows[0],
      differences,
    };
  }

  private calculateDifferences(content1: StoryContent, content2: StoryContent): any {
    const differences: any = {
      titleChanged: content1.title !== content2.title,
      styleChanged: content1.style !== content2.style,
      chaptersAdded: 0,
      chaptersRemoved: 0,
      chaptersModified: 0,
    };

    const ids1 = new Set(content1.chapters.map(c => c.id));
    const ids2 = new Set(content2.chapters.map(c => c.id));

    content2.chapters.forEach(chapter2 => {
      if (!ids1.has(chapter2.id)) {
        differences.chaptersAdded++;
      }
    });

    content1.chapters.forEach(chapter1 => {
      if (!ids2.has(chapter1.id)) {
        differences.chaptersRemoved++;
      }
    });

    content1.chapters.forEach(chapter1 => {
      const chapter2 = content2.chapters.find(c => c.id === chapter1.id);
      if (chapter2) {
        if (
          chapter1.title !== chapter2.title ||
          chapter1.description !== chapter2.description ||
          chapter1.narration !== chapter2.narration ||
          chapter1.postcard !== chapter2.postcard
        ) {
          differences.chaptersModified++;
        }
      }
    });

    return differences;
  }

  async deleteOldVersions(storyId: string, keepCount: number = 10): Promise<number> {
    const result = await db.query(
      `DELETE FROM story_versions 
       WHERE story_id = $1 
       AND id NOT IN (
         SELECT id FROM story_versions 
         WHERE story_id = $1 
         ORDER BY version_number DESC 
         LIMIT $2
       )`,
      [storyId, keepCount]
    );

    return result.rowCount || 0;
  }

  async getVersionDiff(storyId: string, versionId1: string, versionId2: string, userId: string): Promise<any> {
    const v1 = await this.getVersion(storyId, versionId1, userId);
    const v2 = await this.getVersion(storyId, versionId2, userId);

    return this.calculateDifferences(v1.content, v2.content);
  }
}

export const versionService = new VersionService();

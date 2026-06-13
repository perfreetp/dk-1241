import db from '../../shared/common/database';
import { 
  Export, Story, ExportType, ExportFormat, 
  SharePackage, PrintSummary 
} from '../../shared/models';
import { NotFoundError, ForbiddenError } from '../../shared/common';
import { v4 as uuidv4 } from 'uuid';

export class ExportService {
  async createExport(
    storyId: string,
    userId: string,
    exportType: ExportType,
    format: ExportFormat,
    settings?: Record<string, any>
  ): Promise<Export> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    const hasPermission = story.user_id === userId || 
                         (await this.isCollaborator(storyId, userId, 'view'));

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to export this story');
    }

    const result = await db.query<Export>(
      `INSERT INTO exports (story_id, user_id, export_type, format, settings, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [storyId, userId, exportType, format, settings ? JSON.stringify(settings) : null]
    );

    const exportJob = result.rows[0];

    this.processExport(exportJob.id).catch(error => {
      console.error(`Export job ${exportJob.id} failed:`, error);
    });

    return exportJob;
  }

  private async isCollaborator(storyId: string, userId: string, requiredPermission?: string): Promise<boolean> {
    const result = await db.query(
      'SELECT permission FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }

    if (!requiredPermission) {
      return true;
    }

    const permissionHierarchy: Record<string, number> = {
      'view': 1,
      'edit': 2,
      'admin': 3
    };

    const userPermission = result.rows[0].permission;
    return permissionHierarchy[userPermission] >= permissionHierarchy[requiredPermission];
  }

  private async processExport(exportId: string): Promise<void> {
    try {
      await db.query(
        `UPDATE exports SET status = 'processing' WHERE id = $1`,
        [exportId]
      );

      const exportResult = await db.query<Export>(
        'SELECT * FROM exports WHERE id = $1',
        [exportId]
      );

      if (exportResult.rows.length === 0) {
        throw new Error('Export not found');
      }

      const exportJob = exportResult.rows[0];

      const fileUrl = await this.generateExport(exportJob);

      await db.query(
        `UPDATE exports 
         SET status = 'completed', file_url = $1, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [fileUrl, exportId]
      );
    } catch (error) {
      await db.query(
        `UPDATE exports SET status = 'failed' WHERE id = $1`,
        [exportId]
      );
      throw error;
    }
  }

  private async generateExport(exportJob: Export): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const exportId = exportJob.id;
    return `https://storage.example.com/exports/${exportId}.${exportJob.format}`;
  }

  async getExport(exportId: string, userId: string): Promise<Export> {
    const result = await db.query<Export>(
      'SELECT * FROM exports WHERE id = $1',
      [exportId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Export', exportId);
    }

    const exportJob = result.rows[0];

    if (exportJob.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to view this export');
    }

    return exportJob;
  }

  async getExports(storyId: string, userId: string): Promise<Export[]> {
    const result = await db.query<Export>(
      `SELECT * FROM exports WHERE story_id = $1 ORDER BY created_at DESC`,
      [storyId]
    );

    return result.rows;
  }

  async generateSharePackage(storyId: string, userId: string): Promise<SharePackage> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    const hasPermission = story.user_id === userId || 
                         (await this.isCollaborator(storyId, userId, 'view'));

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to share this story');
    }

    const chaptersResult = await db.query(
      `SELECT c.*, 
              COALESCE(json_agg(
                json_build_object(
                  'url', p.url,
                  'caption', cp.caption,
                  'location', p.location_data,
                  'isFlagged', p.is_flagged
                )
              ) FILTER (WHERE p.id IS NOT NULL AND p.is_flagged = false ORDER BY cp.order_index), '[]') as photos
       FROM chapters c
       LEFT JOIN chapter_photos cp ON c.id = cp.chapter_id
       LEFT JOIN photos p ON cp.photo_id = p.id
       WHERE c.story_id = $1
       GROUP BY c.id
       ORDER BY c.order_index`,
      [storyId]
    );

    const sharePackage: SharePackage = {
      storyId,
      version: story.current_version,
      title: story.title || 'Untitled Story',
      style: story.style,
      chapters: chaptersResult.rows.map(row => {
        const filteredPhotos = (row.photos || []).filter((photo: any) => !photo.isFlagged);
        
        const locationName = this.extractLocationFromPhotos(filteredPhotos);
        
        return {
          title: row.title || '',
          description: this.generateLocationDescription(row.description, locationName),
          coverPhotoUrl: filteredPhotos.length > 0 ? filteredPhotos[0].url : undefined,
          narration: row.narration || undefined,
          postcard: row.postcard || undefined,
          photos: filteredPhotos.map((photo: any) => ({
            url: photo.url,
            caption: photo.caption,
          })),
        };
      }),
      metadata: {
        createdAt: story.created_at,
        generatedBy: 'story-service',
        includesPhotos: true,
      },
    };

    return sharePackage;
  }

  async generatePrintSummary(
    storyId: string,
    userId: string,
    settings?: { paperSize?: string; includePhotos?: boolean }
  ): Promise<PrintSummary> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    const hasPermission = story.user_id === userId || 
                         (await this.isCollaborator(storyId, userId, 'view'));

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to print this story');
    }

    const chaptersResult = await db.query(
      `SELECT c.*, 
              COALESCE(json_agg(
                json_build_object(
                  'url', p.url,
                  'caption', cp.caption,
                  'isFlagged', p.is_flagged,
                  'location', p.location_data
                )
              ) FILTER (WHERE p.id IS NOT NULL AND p.is_flagged = false ORDER BY cp.order_index), '[]') as photos
       FROM chapters c
       LEFT JOIN chapter_photos cp ON c.id = cp.chapter_id
       LEFT JOIN photos p ON cp.photo_id = p.id
       WHERE c.story_id = $1
       GROUP BY c.id
       ORDER BY c.order_index`,
      [storyId]
    );

    const includePhotos = settings?.includePhotos ?? true;
    let pageNumber = 1;

    const printSummary: PrintSummary = {
      storyId,
      title: story.title || 'Untitled Story',
      style: story.style,
      chapters: chaptersResult.rows.map(row => {
        const filteredPhotos = (row.photos || []).filter((photo: any) => !photo.isFlagged);
        const photos = includePhotos ? filteredPhotos : [];
        const chapterPages = Math.ceil(Math.max(1, photos.length) / 2);
        const locationName = this.extractLocationFromPhotos(filteredPhotos);

        const chapter = {
          title: row.title || '',
          description: this.generateLocationDescription(row.description, locationName),
          coverPhotoUrl: includePhotos && photos.length > 0 ? photos[0].url : undefined,
          narration: row.narration || undefined,
          photos: photos.map((photo: any, idx: number) => {
            const currentPage = pageNumber + Math.floor(idx / 2);
            return {
              url: photo.url,
              caption: photo.caption,
              pageNumber: includePhotos ? currentPage : undefined,
            };
          }),
        };

        pageNumber += chapterPages;
        return chapter;
      }),
      metadata: {
        totalPages: Math.max(1, pageNumber - 1),
        paperSize: settings?.paperSize || 'A5',
        createdAt: new Date(),
        author: userId,
      },
    };

    return printSummary;
  }

  async downloadExport(exportId: string, userId: string): Promise<{ url: string; format: string }> {
    const exportJob = await this.getExport(exportId, userId);

    if (exportJob.status !== 'completed') {
      throw new Error('Export is not ready for download');
    }

    if (!exportJob.file_url) {
      throw new Error('Export file not found');
    }

    return {
      url: exportJob.file_url,
      format: exportJob.format,
    };
  }

  async cancelExport(exportId: string, userId: string): Promise<void> {
    const exportJob = await this.getExport(exportId, userId);

    if (exportJob.status !== 'pending' && exportJob.status !== 'processing') {
      throw new Error('Cannot cancel export that is already completed or failed');
    }

    await db.query(
      `UPDATE exports SET status = 'failed' WHERE id = $1`,
      [exportId]
    );
  }

  async deleteExport(exportId: string, userId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM exports WHERE id = $1 AND user_id = $2',
      [exportId, userId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Export', exportId);
    }
  }

  async exportToJson(storyId: string, userId: string): Promise<string> {
    const sharePackage = await this.generateSharePackage(storyId, userId);
    return JSON.stringify(sharePackage, null, 2);
  }

  async exportToHtml(storyId: string, userId: string): Promise<string> {
    const sharePackage = await this.generateSharePackage(storyId, userId);

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sharePackage.title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #333; }
    .chapter { margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .chapter h2 { color: #666; margin-top: 0; }
    .narration { font-style: italic; color: #555; margin: 15px 0; }
    .postcard { background: #fff8dc; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .photos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .photo { border-radius: 4px; overflow: hidden; }
    .photo img { width: 100%; height: auto; }
    .photo-caption { font-size: 14px; color: #777; text-align: center; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>${sharePackage.title}</h1>
  <p style="text-align: center; color: #888;">风格: ${sharePackage.style}</p>`;

    for (const chapter of sharePackage.chapters) {
      html += `
  <div class="chapter">
    <h2>${chapter.title}</h2>
    ${chapter.description ? `<p>${chapter.description}</p>` : ''}
    ${chapter.narration ? `<div class="narration">${chapter.narration}</div>` : ''}
    ${chapter.postcard ? `<div class="postcard">💌 ${chapter.postcard}</div>` : ''}
    ${chapter.photos.length > 0 ? `
    <div class="photos">
      ${chapter.photos.map(photo => `
      <div class="photo">
        <img src="${photo.url}" alt="${photo.caption || ''}">
        ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  private extractLocationFromPhotos(photos: any[]): string | null {
    for (const photo of photos) {
      if (photo.location && photo.location.name) {
        return photo.location.name;
      }
    }
    return null;
  }

  private generateLocationDescription(existingDescription: string | null, locationName: string | null): string | undefined {
    if (!existingDescription && !locationName) {
      return undefined;
    }
    
    if (existingDescription && locationName) {
      if (existingDescription.includes(locationName)) {
        return existingDescription;
      }
      return `在${locationName}，${existingDescription}`;
    }
    
    if (locationName) {
      return `在${locationName}${existingDescription ? '，' + existingDescription : ''}`;
    }
    
    return existingDescription || undefined;
  }
}

export const exportService = new ExportService();

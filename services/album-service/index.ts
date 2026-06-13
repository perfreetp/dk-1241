import db from '../../shared/common/database';
import { Album, Photo, AlbumWithPhotos } from '../../shared/models';
import { NotFoundError, ForbiddenError } from '../../shared/common';

export class AlbumService {
  async createAlbum(userId: string, data: { name: string; description?: string }): Promise<Album> {
    const result = await db.query<Album>(
      `INSERT INTO albums (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, data.name, data.description || null]
    );

    return result.rows[0];
  }

  async findById(id: string): Promise<Album | null> {
    const result = await db.query<Album>(
      'SELECT * FROM albums WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdWithPhotos(id: string): Promise<AlbumWithPhotos | null> {
    const album = await this.findById(id);
    
    if (!album) {
      return null;
    }

    const photosResult = await db.query<Photo>(
      `SELECT * FROM photos 
       WHERE album_id = $1 
       ORDER BY taken_at ASC NULLS LAST, created_at ASC`,
      [id]
    );

    return {
      ...album,
      photos: photosResult.rows,
    };
  }

  async findByUserId(userId: string, page: number = 1, pageSize: number = 20): Promise<{ albums: Album[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [albumsResult, countResult] = await Promise.all([
      db.query<Album>(
        `SELECT * FROM albums 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM albums WHERE user_id = $1',
        [userId]
      ),
    ]);

    return {
      albums: albumsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async updateAlbum(
    id: string,
    userId: string,
    data: { name?: string; description?: string; cover_photo_id?: string; status?: string }
  ): Promise<Album> {
    const album = await this.findById(id);
    
    if (!album) {
      throw new NotFoundError('Album', id);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update this album');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.cover_photo_id !== undefined) {
      updates.push(`cover_photo_id = $${paramIndex++}`);
      values.push(data.cover_photo_id);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (updates.length === 0) {
      return album;
    }

    values.push(id);

    const result = await db.query<Album>(
      `UPDATE albums SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  async deleteAlbum(id: string, userId: string): Promise<void> {
    const album = await this.findById(id);
    
    if (!album) {
      throw new NotFoundError('Album', id);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to delete this album');
    }

    await db.query('DELETE FROM albums WHERE id = $1', [id]);
  }

  async addPhoto(
    albumId: string,
    userId: string,
    data: {
      url: string;
      thumbnail_url?: string;
      exif_data?: Record<string, any>;
      taken_at?: Date;
    }
  ): Promise<Photo> {
    const album = await this.findById(albumId);
    
    if (!album) {
      throw new NotFoundError('Album', albumId);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to add photos to this album');
    }

    const result = await db.query<Photo>(
      `INSERT INTO photos (album_id, url, thumbnail_url, exif_data, taken_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        albumId,
        data.url,
        data.thumbnail_url || null,
        data.exif_data ? JSON.stringify(data.exif_data) : null,
        data.taken_at || null,
      ]
    );

    return result.rows[0];
  }

  async addPhotos(
    albumId: string,
    userId: string,
    photos: Array<{
      url: string;
      thumbnail_url?: string;
      exif_data?: Record<string, any>;
      taken_at?: Date;
    }>
  ): Promise<Photo[]> {
    const album = await this.findById(albumId);
    
    if (!album) {
      throw new NotFoundError('Album', albumId);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to add photos to this album');
    }

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const insertedPhotos: Photo[] = [];

      for (const photo of photos) {
        const result = await client.query<Photo>(
          `INSERT INTO photos (album_id, url, thumbnail_url, exif_data, taken_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            albumId,
            photo.url,
            photo.thumbnail_url || null,
            photo.exif_data ? JSON.stringify(photo.exif_data) : null,
            photo.taken_at || null,
          ]
        );
        insertedPhotos.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return insertedPhotos;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPhotos(albumId: string, userId: string): Promise<Photo[]> {
    const album = await this.findById(albumId);
    
    if (!album) {
      throw new NotFoundError('Album', albumId);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to view this album');
    }

    const result = await db.query<Photo>(
      `SELECT * FROM photos 
       WHERE album_id = $1 
       ORDER BY taken_at ASC NULLS LAST, created_at ASC`,
      [albumId]
    );

    return result.rows;
  }

  async deletePhoto(albumId: string, photoId: string, userId: string): Promise<void> {
    const album = await this.findById(albumId);
    
    if (!album) {
      throw new NotFoundError('Album', albumId);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to delete photos from this album');
    }

    const result = await db.query(
      'DELETE FROM photos WHERE id = $1 AND album_id = $2',
      [photoId, albumId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Photo', photoId);
    }
  }

  async updatePhoto(
    albumId: string,
    photoId: string,
    userId: string,
    data: {
      url?: string;
      thumbnail_url?: string;
      exif_data?: Record<string, any>;
      emotion_tags?: string[];
      location_data?: Record<string, any>;
      is_flagged?: boolean;
    }
  ): Promise<Photo> {
    const album = await this.findById(albumId);
    
    if (!album) {
      throw new NotFoundError('Album', albumId);
    }

    if (album.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update this photo');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(data.url);
    }

    if (data.thumbnail_url !== undefined) {
      updates.push(`thumbnail_url = $${paramIndex++}`);
      values.push(data.thumbnail_url);
    }

    if (data.exif_data !== undefined) {
      updates.push(`exif_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.exif_data));
    }

    if (data.emotion_tags !== undefined) {
      updates.push(`emotion_tags = $${paramIndex++}`);
      values.push(data.emotion_tags);
    }

    if (data.location_data !== undefined) {
      updates.push(`location_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.location_data));
    }

    if (data.is_flagged !== undefined) {
      updates.push(`is_flagged = $${paramIndex++}`);
      values.push(data.is_flagged);
    }

    if (updates.length === 0) {
      const existingPhoto = await db.query<Photo>(
        'SELECT * FROM photos WHERE id = $1',
        [photoId]
      );
      if (existingPhoto.rows.length === 0) {
        throw new NotFoundError('Photo', photoId);
      }
      return existingPhoto.rows[0];
    }

    values.push(photoId);
    values.push(albumId);

    const result = await db.query<Photo>(
      `UPDATE photos SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND album_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Photo', photoId);
    }

    return result.rows[0];
  }
}

export const albumService = new AlbumService();

import db from '../../shared/common/database';
import { 
  Collaboration, Comment, Favorite, PermissionLevel, Story 
} from '../../shared/models';
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/common';

export class CollaborationService {
  async addCollaborator(
    storyId: string,
    ownerId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<Collaboration> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== ownerId) {
      throw new ForbiddenError('Only the owner can add collaborators');
    }

    if (story.user_id === userId) {
      throw new ConflictError('Cannot add owner as collaborator');
    }

    const existingCollabResult = await db.query(
      'SELECT * FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );

    if (existingCollabResult.rows.length > 0) {
      throw new ConflictError('User is already a collaborator');
    }

    const result = await db.query<Collaboration>(
      `INSERT INTO collaborations (story_id, user_id, permission, invited_by, accepted_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [storyId, userId, permission, ownerId]
    );

    return result.rows[0];
  }

  async removeCollaborator(storyId: string, ownerId: string, userId: string): Promise<void> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== ownerId) {
      throw new ForbiddenError('Only the owner can remove collaborators');
    }

    const result = await db.query(
      'DELETE FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Collaborator', userId);
    }
  }

  async updateCollaboratorPermission(
    storyId: string,
    ownerId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<Collaboration> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    if (story.user_id !== ownerId) {
      throw new ForbiddenError('Only the owner can update collaborator permissions');
    }

    const result = await db.query<Collaboration>(
      `UPDATE collaborations 
       SET permission = $1
       WHERE story_id = $2 AND user_id = $3
       RETURNING *`,
      [permission, storyId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Collaborator', userId);
    }

    return result.rows[0];
  }

  async getCollaborators(storyId: string, userId: string): Promise<any[]> {
    const storyResult = await db.query<Story>(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      throw new NotFoundError('Story', storyId);
    }

    const story = storyResult.rows[0];

    const hasAccess = story.user_id === userId || 
                      (await this.isCollaborator(storyId, userId));

    if (!hasAccess) {
      throw new ForbiddenError('You do not have permission to view this story');
    }

    const result = await db.query(
      `SELECT c.*, u.email, u.nickname, u.avatar_url
       FROM collaborations c
       JOIN users u ON c.user_id = u.id
       WHERE c.story_id = $1`,
      [storyId]
    );

    return result.rows;
  }

  async isCollaborator(storyId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );
    return result.rows.length > 0;
  }

  async getCollaboratorPermission(storyId: string, userId: string): Promise<PermissionLevel | null> {
    const result = await db.query<Collaboration>(
      'SELECT permission FROM collaborations WHERE story_id = $1 AND user_id = $2',
      [storyId, userId]
    );
    return result.rows[0]?.permission || null;
  }

  async addComment(
    storyId: string,
    userId: string,
    data: { chapterId?: string; content: string; position?: string }
  ): Promise<Comment> {
    const result = await db.query<Comment>(
      `INSERT INTO comments (story_id, user_id, chapter_id, content, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [storyId, userId, data.chapterId || null, data.content, data.position || null]
    );

    return result.rows[0];
  }

  async getComments(storyId: string, userId: string): Promise<any[]> {
    const result = await db.query(
      `SELECT c.*, u.email, u.nickname, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.story_id = $1
       ORDER BY c.created_at DESC`,
      [storyId]
    );

    return result.rows;
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<Comment> {
    const existingComment = await db.query<Comment>(
      'SELECT * FROM comments WHERE id = $1',
      [commentId]
    );

    if (existingComment.rows.length === 0) {
      throw new NotFoundError('Comment', commentId);
    }

    const comment = existingComment.rows[0];

    if (comment.user_id !== userId) {
      throw new ForbiddenError('You can only update your own comments');
    }

    const result = await db.query<Comment>(
      `UPDATE comments SET content = $1 WHERE id = $2 RETURNING *`,
      [content, commentId]
    );

    return result.rows[0];
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const existingComment = await db.query<Comment>(
      'SELECT * FROM comments WHERE id = $1',
      [commentId]
    );

    if (existingComment.rows.length === 0) {
      throw new NotFoundError('Comment', commentId);
    }

    const comment = existingComment.rows[0];

    if (comment.user_id !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
  }

  async addFavorite(
    userId: string,
    storyId: string,
    data: { chapterId?: string; title?: string; excerpt?: string }
  ): Promise<Favorite> {
    const result = await db.query<Favorite>(
      `INSERT INTO favorites (user_id, story_id, chapter_id, title, excerpt)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, storyId, data.chapterId || null, data.title || null, data.excerpt || null]
    );

    return result.rows[0];
  }

  async getFavorites(userId: string): Promise<any[]> {
    const result = await db.query(
      `SELECT f.*, s.title as story_title, s.style
       FROM favorites f
       JOIN stories s ON f.story_id = s.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async deleteFavorite(favoriteId: string, userId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Favorite', favoriteId);
    }
  }

  async isFavorited(userId: string, storyId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND story_id = $2',
      [userId, storyId]
    );
    return result.rows.length > 0;
  }

  async getSharedWithMe(userId: string): Promise<any[]> {
    const result = await db.query(
      `SELECT s.*, c.permission, u.nickname as owner_nickname
       FROM stories s
       JOIN collaborations c ON s.id = c.story_id
       JOIN users u ON s.user_id = u.id
       WHERE c.user_id = $1
       ORDER BY c.invited_at DESC`,
      [userId]
    );

    return result.rows;
  }
}

export const collaborationService = new CollaborationService();

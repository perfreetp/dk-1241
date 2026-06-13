import bcrypt from 'bcryptjs';
import db from '../../shared/common/database';
import { User } from '../../shared/models';
import { NotFoundError, ConflictError, UnauthorizedError } from '../../shared/common';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../shared/middleware/auth';

const BCRYPT_ROUNDS = 12;

export class UserService {
  async createUser(data: {
    email: string;
    password: string;
    nickname?: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const result = await db.query<User>(
      `INSERT INTO users (email, password_hash, nickname)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.email, passwordHash, data.nickname || null]
    );

    return result.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async authenticate(email: string, password: string): Promise<{ user: User; token: string; refreshToken: string }> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return { user, token, refreshToken };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    const { userId } = verifyRefreshToken(refreshToken);
    
    const user = await this.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return { token: newToken, refreshToken: newRefreshToken };
  }

  async updateUser(id: string, data: { nickname?: string; avatar_url?: string }): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(data.nickname);
    }

    if (data.avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatar_url);
    }

    if (updates.length === 0) {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }
      return user;
    }

    values.push(id);

    const result = await db.query<User>(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User', id);
    }

    return result.rows[0];
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundError('User', id);
    }

    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, id]
    );
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('User', id);
    }
  }

  async listUsers(page: number = 1, pageSize: number = 20): Promise<{ users: User[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [usersResult, countResult] = await Promise.all([
      db.query<User>(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      ),
      db.query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
    ]);

    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}

export const userService = new UserService();

import request from 'supertest';
import app from '../index';

describe('API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let albumId: string;
  let storyId: string;

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      
      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('should reject invalid login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Album Management', () => {
    it('should create a new album', async () => {
      const res = await request(app)
        .post('/api/v1/albums')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Album',
          description: 'A test album description',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Album');
      
      albumId = res.body.data.id;
    });

    it('should get album list', async () => {
      const res = await request(app)
        .get('/api/v1/albums')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should add photos to album', async () => {
      const res = await request(app)
        .post(`/api/v1/albums/${albumId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/photo1.jpg',
          exif_data: {
            camera: 'iPhone 15',
            aperture: 'f/1.8',
          },
          taken_at: '2024-02-09T10:30:00Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should batch add photos', async () => {
      const res = await request(app)
        .post(`/api/v1/albums/${albumId}/photos/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photos: [
            { url: 'https://example.com/photo2.jpg' },
            { url: 'https://example.com/photo3.jpg' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should analyze album', async () => {
      const res = await request(app)
        .post(`/api/v1/albums/${albumId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.albumId).toBe(albumId);
    });
  });

  describe('Story Generation', () => {
    it('should generate a story', async () => {
      const res = await request(app)
        .post('/api/v1/stories/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          albumId: albumId,
          style: '温馨',
          settings: {
            toneIntensity: 80,
            narrativeLength: 'medium',
            emotionTendency: 'positive',
            emojiUsage: 'medium',
            poetryQuote: false,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBeDefined();
      expect(Array.isArray(res.body.data.chapters)).toBe(true);
      
      storyId = res.body.data.storyId;
    });

    it('should get story list', async () => {
      const res = await request(app)
        .get('/api/v1/stories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get story details', async () => {
      const res = await request(app)
        .get(`/api/v1/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(storyId);
    });

    it('should update story', async () => {
      const res = await request(app)
        .put(`/api/v1/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Story Title',
          status: 'published',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Story Title');
    });
  });

  describe('Version Control', () => {
    it('should get version history', async () => {
      const res = await request(app)
        .get(`/api/v1/stories/${storyId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Collaboration', () => {
    it('should add a comment', async () => {
      const res = await request(app)
        .post(`/api/v1/stories/${storyId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a great story!',
          position: 'narration',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('This is a great story!');
    });

    it('should get comments', async () => {
      const res = await request(app)
        .get(`/api/v1/stories/${storyId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Export', () => {
    it('should generate share package', async () => {
      const res = await request(app)
        .post(`/api/v1/stories/${storyId}/export/share`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storyId).toBe(storyId);
      expect(res.body.data.title).toBeDefined();
    });

    it('should generate print summary', async () => {
      const res = await request(app)
        .post(`/api/v1/stories/${storyId}/export/print`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paperSize: 'A5',
          includePhotos: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storyId).toBe(storyId);
    });
  });

  describe('Favorites', () => {
    it('should add to favorites', async () => {
      const res = await request(app)
        .post('/api/v1/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storyId: storyId,
          title: 'Favorite Chapter',
          excerpt: 'This is my favorite part',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should get favorites', async () => {
      const res = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent album', async () => {
      const res = await request(app)
        .get('/api/v1/albums/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/albums');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

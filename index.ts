import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './shared/config';
import logger from './shared/common/logger';
import { errorHandler, notFoundHandler, requestId, cors as corsMiddleware } from './shared/middleware';
import { authenticate } from './shared/middleware/auth';
import { validate, validateParams, validateQuery, schemas } from './shared/common/validation';
import { asyncHandler, sendSuccess, sendError } from './shared/common/response';
import { userService } from './services/user-service';
import { albumService } from './services/album-service';
import { storyService } from './services/story-service';
import { analysisService } from './services/analysis-service';
import { collaborationService } from './services/collaboration-service';
import { exportService } from './services/export-service';
import { versionService } from './services/version-service';

const app: Express = express();

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(corsMiddleware);

app.get('/health', (req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/v1/auth/register',
  validate(schemas.user.create),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);
    const { password_hash, ...userWithoutPassword } = user;
    sendSuccess(res, userWithoutPassword, 201);
  })
);

app.post('/api/v1/auth/login',
  validate(schemas.user.login),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await userService.authenticate(email, password);
    sendSuccess(res, {
      user: { id: result.user.id, email: result.user.email, nickname: result.user.nickname },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  })
);

app.post('/api/v1/albums',
  authenticate,
  validate(schemas.album.create),
  asyncHandler(async (req: Request, res: Response) => {
    const album = await albumService.createAlbum(req.userId!, req.body);
    sendSuccess(res, album, 201);
  })
);

app.get('/api/v1/albums',
  authenticate,
  validateQuery(schemas.pagination),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await albumService.findByUserId(req.userId!, page, pageSize);
    sendSuccess(res, result.albums, 200, { page, pageSize, total: result.total });
  })
);

app.get('/api/v1/albums/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const album = await albumService.findByIdWithPhotos(req.params.id);
    if (!album) {
      return sendError(res, 'NOT_FOUND', 'Album not found', 404);
    }
    sendSuccess(res, album);
  })
);

app.put('/api/v1/albums/:id',
  authenticate,
  validate(schemas.album.update),
  asyncHandler(async (req: Request, res: Response) => {
    const album = await albumService.updateAlbum(req.params.id, req.userId!, req.body);
    sendSuccess(res, album);
  })
);

app.delete('/api/v1/albums/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await albumService.deleteAlbum(req.params.id, req.userId!);
    sendSuccess(res, { message: 'Album deleted successfully' });
  })
);

app.post('/api/v1/albums/:id/photos',
  authenticate,
  validate(schemas.photo.create),
  asyncHandler(async (req: Request, res: Response) => {
    const photo = await albumService.addPhoto(req.params.id, req.userId!, req.body);
    sendSuccess(res, photo, 201);
  })
);

app.post('/api/v1/albums/:id/photos/batch',
  authenticate,
  validate(schemas.photo.batch),
  asyncHandler(async (req: Request, res: Response) => {
    const photos = await albumService.addPhotos(req.params.id, req.userId!, req.body.photos);
    sendSuccess(res, photos, 201);
  })
);

app.post('/api/v1/albums/:id/analyze',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await analysisService.analyzeAlbum(req.params.id);
    sendSuccess(res, result);
  })
);

app.post('/api/v1/stories/generate',
  authenticate,
  validate(schemas.story.generate),
  asyncHandler(async (req: Request, res: Response) => {
    const { albumId, style, settings } = req.body;
    const result = await storyService.generateStory(req.userId!, albumId, style, settings);
    sendSuccess(res, result, 201);
  })
);

app.get('/api/v1/stories',
  authenticate,
  validateQuery(schemas.pagination),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await storyService.findByUserId(req.userId!, page, pageSize);
    sendSuccess(res, result.stories, 200, { page, pageSize, total: result.total });
  })
);

app.get('/api/v1/stories/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const story = await storyService.findByIdWithDetails(req.params.id);
    if (!story) {
      return sendError(res, 'NOT_FOUND', 'Story not found', 404);
    }
    sendSuccess(res, story);
  })
);

app.put('/api/v1/stories/:id',
  authenticate,
  validate(schemas.story.update),
  asyncHandler(async (req: Request, res: Response) => {
    const story = await storyService.updateStory(req.params.id, req.userId!, req.body);
    sendSuccess(res, story);
  })
);

app.put('/api/v1/stories/:id/chapters/:cid',
  authenticate,
  validate(schemas.chapter.update),
  asyncHandler(async (req: Request, res: Response) => {
    const chapter = await storyService.updateChapter(req.params.id, req.params.cid, req.userId!, req.body);
    sendSuccess(res, chapter);
  })
);

app.delete('/api/v1/stories/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await storyService.deleteStory(req.params.id, req.userId!);
    sendSuccess(res, { message: 'Story deleted successfully' });
  })
);

app.get('/api/v1/stories/:id/versions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const versions = await versionService.getVersions(req.params.id, req.userId!);
    sendSuccess(res, versions);
  })
);

app.post('/api/v1/stories/:id/rollback',
  authenticate,
  validate(schemas.version.rollback),
  asyncHandler(async (req: Request, res: Response) => {
    const { targetVersion } = req.body;
    const story = await versionService.rollback(req.params.id, req.userId!, targetVersion);
    sendSuccess(res, story);
  })
);

app.post('/api/v1/stories/:id/collaborators',
  authenticate,
  validate(schemas.collaboration.create),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, permission } = req.body;
    const collaboration = await collaborationService.addCollaborator(req.params.id, req.userId!, userId, permission);
    sendSuccess(res, collaboration, 201);
  })
);

app.get('/api/v1/stories/:id/collaborators',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const collaborators = await collaborationService.getCollaborators(req.params.id, req.userId!);
    sendSuccess(res, collaborators);
  })
);

app.delete('/api/v1/stories/:id/collaborators/:uid',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await collaborationService.removeCollaborator(req.params.id, req.userId!, req.params.uid);
    sendSuccess(res, { message: 'Collaborator removed successfully' });
  })
);

app.post('/api/v1/stories/:id/comments',
  authenticate,
  validate(schemas.comment.create),
  asyncHandler(async (req: Request, res: Response) => {
    const comment = await collaborationService.addComment(req.params.id, req.userId!, req.body);
    sendSuccess(res, comment, 201);
  })
);

app.get('/api/v1/stories/:id/comments',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const comments = await collaborationService.getComments(req.params.id, req.userId!);
    sendSuccess(res, comments);
  })
);

app.post('/api/v1/stories/:id/export/share',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sharePackage = await exportService.generateSharePackage(req.params.id, req.userId!);
    sendSuccess(res, sharePackage);
  })
);

app.post('/api/v1/stories/:id/export/print',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paperSize, includePhotos } = req.body;
    const printSummary = await exportService.generatePrintSummary(req.params.id, req.userId!, { paperSize, includePhotos });
    sendSuccess(res, printSummary);
  })
);

app.post('/api/v1/exports',
  authenticate,
  validate(schemas.export.create),
  asyncHandler(async (req: Request, res: Response) => {
    const { storyId, exportType, format, settings } = req.body;
    const exportJob = await exportService.createExport(storyId, req.userId!, exportType, format, settings);
    sendSuccess(res, exportJob, 201);
  })
);

app.get('/api/v1/exports/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const exportJob = await exportService.getExport(req.params.id, req.userId!);
    sendSuccess(res, exportJob);
  })
);

app.get('/api/v1/favorites',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const favorites = await collaborationService.getFavorites(req.userId!);
    sendSuccess(res, favorites);
  })
);

app.post('/api/v1/favorites',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { storyId, chapterId, title, excerpt } = req.body;
    const favorite = await collaborationService.addFavorite(req.userId!, storyId, { chapterId, title, excerpt });
    sendSuccess(res, favorite, 201);
  })
);

app.delete('/api/v1/favorites/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await collaborationService.deleteFavorite(req.params.id, req.userId!);
    sendSuccess(res, { message: 'Favorite deleted successfully' });
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Story Service API running on port ${PORT}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`API Version: ${config.api.version}`);
});

export default app;

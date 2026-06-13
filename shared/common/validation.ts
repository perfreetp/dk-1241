import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
    }

    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details,
        },
      });
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details,
        },
      });
    }

    next();
  };
};

export const schemas = {
  uuid: Joi.string().uuid(),
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
  }),

  user: {
    create: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(100).required(),
      nickname: Joi.string().min(1).max(100),
    }),
    
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
    
    update: Joi.object({
      nickname: Joi.string().min(1).max(100),
      avatar_url: Joi.string().uri(),
    }),
  },

  album: {
    create: Joi.object({
      name: Joi.string().min(1).max(255).required(),
      description: Joi.string().max(1000),
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(255),
      description: Joi.string().max(1000),
      cover_photo_id: Joi.string().uuid(),
      status: Joi.string().valid('active', 'archived'),
    }),
  },

  photo: {
    create: Joi.object({
      url: Joi.string().uri().required(),
      thumbnail_url: Joi.string().uri(),
      exif_data: Joi.object(),
      taken_at: Joi.date().iso(),
    }),
    
    batch: Joi.object({
      photos: Joi.array().items(
        Joi.object({
          url: Joi.string().uri().required(),
          thumbnail_url: Joi.string().uri(),
          exif_data: Joi.object(),
          taken_at: Joi.date().iso(),
        })
      ).min(1).max(100).required(),
    }),
  },

  story: {
    generate: Joi.object({
      albumId: Joi.string().uuid().required(),
      style: Joi.string().valid('温馨', '搞笑', '旅行', '成长', '纪实', '艺术').required(),
      settings: Joi.object({
        toneIntensity: Joi.number().min(0).max(100).default(50),
        narrativeLength: Joi.string().valid('short', 'medium', 'long').default('medium'),
        emotionTendency: Joi.string().valid('positive', 'neutral', 'nostalgic').default('positive'),
        emojiUsage: Joi.string().valid('low', 'medium', 'high').default('medium'),
        poetryQuote: Joi.boolean().default(false),
      }).default(),
    }),
    
    update: Joi.object({
      title: Joi.string().min(1).max(255),
      style: Joi.string().valid('温馨', '搞笑', '旅行', '成长', '纪实', '艺术'),
      status: Joi.string().valid('draft', 'published', 'archived'),
      settings: Joi.object({
        toneIntensity: Joi.number().min(0).max(100),
        narrativeLength: Joi.string().valid('short', 'medium', 'long'),
        emotionTendency: Joi.string().valid('positive', 'neutral', 'nostalgic'),
        emojiUsage: Joi.string().valid('low', 'medium', 'high'),
        poetryQuote: Joi.boolean(),
      }),
    }),
  },

  chapter: {
    update: Joi.object({
      title: Joi.string().min(1).max(255),
      description: Joi.string().max(1000),
      cover_photo_id: Joi.string().uuid(),
      emotion_tags: Joi.array().items(Joi.string()),
      narration: Joi.string().max(5000),
      postcard: Joi.string().max(500),
      order_index: Joi.number().integer().min(0),
    }),
  },

  collaboration: {
    create: Joi.object({
      userId: Joi.string().uuid().required(),
      permission: Joi.string().valid('view', 'edit', 'admin').required(),
    }),
    
    update: Joi.object({
      permission: Joi.string().valid('view', 'edit', 'admin').required(),
    }),
  },

  comment: {
    create: Joi.object({
      chapterId: Joi.string().uuid(),
      content: Joi.string().min(1).max(1000).required(),
      position: Joi.string().valid('chapter', 'narration', 'postcard'),
    }),
    
    update: Joi.object({
      content: Joi.string().min(1).max(1000).required(),
    }),
  },

  export: {
    create: Joi.object({
      exportType: Joi.string().valid('share', 'print', 'pdf', 'json').required(),
      format: Joi.string().valid('json', 'pdf', 'html').required(),
      settings: Joi.object({
        paperSize: Joi.string().valid('A4', 'A5', 'B5'),
        includePhotos: Joi.boolean().default(true),
        includeComments: Joi.boolean().default(false),
      }).default(),
    }),
  },

  version: {
    rollback: Joi.object({
      targetVersion: Joi.number().integer().min(1).required(),
    }),
  },
};

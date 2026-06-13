import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  env: string;
  port: number;
  
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
  
  redis: {
    host: string;
    port: number;
    url: string;
    password?: string;
  };
  
  rabbitmq: {
    host: string;
    port: number;
    url: string;
    username: string;
    password: string;
  };
  
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  
  s3: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
  
  analysis: {
    faceDetectionModelPath: string;
    emotionRecognitionModelPath: string;
    imageSimilarityThreshold: number;
  };
  
  api: {
    version: string;
    prefix: string;
    requestTimeout: number;
    maxFileSize: number;
  };
  
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  
  logging: {
    level: string;
    format: string;
  };
  
  cors: {
    origins: string[];
  };
  
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'storydb',
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/storydb',
    pool: {
      min: 2,
      max: 10,
    },
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },
  
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    username: 'guest',
    password: 'guest',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'localhost',
    port: parseInt(process.env.S3_PORT || '9000', 10),
    useSSL: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'photos',
  },
  
  analysis: {
    faceDetectionModelPath: process.env.FACE_DETECTION_MODEL_PATH || './models/face_detection',
    emotionRecognitionModelPath: process.env.EMOTION_RECOGNITION_MODEL_PATH || './models/emotion_recognition',
    imageSimilarityThreshold: parseFloat(process.env.IMAGE_SIMILARITY_THRESHOLD || '0.85'),
  },
  
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api/v1',
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },
  
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
  },
};

export default config;
export { Config };

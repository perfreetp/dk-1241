export interface User {
  id: string;
  email: string;
  password_hash: string;
  nickname?: string;
  avatar_url?: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface Album {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_photo_id?: string;
  photo_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Photo {
  id: string;
  album_id: string;
  url: string;
  thumbnail_url?: string;
  exif_data?: Record<string, any>;
  analysis_result?: PhotoAnalysisResult;
  face_data?: FaceData[];
  emotion_tags?: string[];
  location_data?: LocationData;
  taken_at?: Date;
  is_repeated: boolean;
  is_flagged: boolean;
  created_at: Date;
}

export interface PhotoAnalysisResult {
  hasFaces: boolean;
  hasLocation: boolean;
  hasExif: boolean;
  quality: number;
  faces: number;
  dominantColors?: string[];
}

export interface FaceData {
  x: number;
  y: number;
  width: number;
  height: number;
  embedding?: number[];
  personId?: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface Story {
  id: string;
  album_id: string;
  user_id: string;
  title?: string;
  style: StoryStyle;
  status: StoryStatus;
  settings?: StorySettings;
  current_version: number;
  created_at: Date;
  updated_at: Date;
}

export type StoryStyle = '温馨' | '搞笑' | '旅行' | '成长' | '纪实' | '艺术';
export type StoryStatus = 'draft' | 'published' | 'archived';

export interface StorySettings {
  toneIntensity: number;
  narrativeLength: 'short' | 'medium' | 'long';
  emotionTendency: 'positive' | 'neutral' | 'nostalgic';
  emojiUsage: 'low' | 'medium' | 'high';
  poetryQuote: boolean;
}

export interface Chapter {
  id: string;
  story_id: string;
  order_index: number;
  title?: string;
  description?: string;
  cover_photo_id?: string;
  emotion_tags?: string[];
  narration?: string;
  postcard?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChapterPhoto {
  id: string;
  chapter_id: string;
  photo_id: string;
  order_index: number;
  caption?: string;
  created_at: Date;
}

export interface StoryVersion {
  id: string;
  story_id: string;
  version_number: number;
  content: StoryContent;
  change_summary?: string;
  created_by: string;
  created_at: Date;
}

export interface StoryContent {
  title: string;
  style: StoryStyle;
  chapters: ChapterContent[];
}

export interface ChapterContent {
  id?: string;
  title: string;
  description?: string;
  photos: ChapterPhotoContent[];
  emotion_tags?: string[];
  narration?: string;
  postcard?: string;
}

export interface ChapterPhotoContent {
  id: string;
  url: string;
  caption?: string;
}

export interface Collaboration {
  id: string;
  story_id: string;
  user_id: string;
  permission: PermissionLevel;
  invited_by?: string;
  invited_at: Date;
  accepted_at?: Date;
}

export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  chapter_id?: string;
  content: string;
  position?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Favorite {
  id: string;
  user_id: string;
  story_id: string;
  chapter_id?: string;
  title?: string;
  excerpt?: string;
  created_at: Date;
}

export interface Export {
  id: string;
  story_id: string;
  user_id: string;
  export_type: ExportType;
  format: ExportFormat;
  file_url?: string;
  settings?: Record<string, any>;
  status: ExportStatus;
  created_at: Date;
  completed_at?: Date;
}

export type ExportType = 'share' | 'print' | 'pdf' | 'json';
export type ExportFormat = 'json' | 'pdf' | 'html';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface StoryWithDetails extends Story {
  album?: Album;
  chapters?: Chapter[];
  versions?: StoryVersion[];
  collaborators?: Collaboration[];
  user?: User;
}

export interface ChapterWithPhotos extends Chapter {
  photos?: (ChapterPhoto & { photo: Photo })[];
  cover_photo?: Photo;
}

export interface AlbumWithPhotos extends Album {
  photos?: Photo[];
}

export interface StoryGenerationRequest {
  albumId: string;
  style: StoryStyle;
  settings?: StorySettings;
}

export interface StoryGenerationResult {
  storyId: string;
  title: string;
  style: StoryStyle;
  chapters: GeneratedChapter[];
  createdAt: Date;
}

export interface GeneratedChapter {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  coverPhotoId: string;
  emotionTags: string[];
  narration: string;
  postcard: string;
  photos: GeneratedPhoto[];
}

export interface GeneratedPhoto {
  id: string;
  url: string;
  caption: string;
}

export interface PhotoAnalysisRequest {
  albumId: string;
  photos: {
    id: string;
    url: string;
    exif_data?: Record<string, any>;
  }[];
}

export interface PhotoAnalysisResponse {
  albumId: string;
  photos: {
    id: string;
    analysis: PhotoAnalysisResult;
    faces: FaceData[];
    emotions: string[];
    location: LocationData | null;
    duplicates: string[];
  }[];
  timeline: TimelineCluster[];
  locations: LocationCluster[];
  people: PersonCluster[];
}

export interface TimelineCluster {
  startDate: Date;
  endDate: Date;
  photoIds: string[];
  label: string;
}

export interface LocationCluster {
  location: LocationData;
  photoIds: string[];
  visitCount: number;
}

export interface PersonCluster {
  personId: string;
  photoIds: string[];
  frequency: number;
  isProtagonist: boolean;
}

export interface SharePackage {
  storyId: string;
  version: number;
  title: string;
  style: StoryStyle;
  chapters: ShareChapter[];
  metadata: {
    createdAt: Date;
    generatedBy: string;
    includesPhotos: boolean;
  };
}

export interface ShareChapter {
  title: string;
  description?: string;
  coverPhotoUrl?: string;
  narration?: string;
  postcard?: string;
  photos: SharePhoto[];
}

export interface SharePhoto {
  url: string;
  caption?: string;
}

export interface PrintSummary {
  storyId: string;
  title: string;
  style: StoryStyle;
  chapters: PrintChapter[];
  metadata: PrintMetadata;
}

export interface PrintChapter {
  title: string;
  description?: string;
  coverPhotoUrl?: string;
  narration?: string;
  photos: PrintPhoto[];
}

export interface PrintPhoto {
  url: string;
  caption?: string;
  pageNumber?: number;
}

export interface PrintMetadata {
  totalPages: number;
  paperSize: string;
  createdAt: Date;
  author?: string;
}

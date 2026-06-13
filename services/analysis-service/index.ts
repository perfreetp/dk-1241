import db from '../../shared/common/database';
import { 
  Photo, PhotoAnalysisResponse, PhotoAnalysisResult, 
  FaceData, LocationData, TimelineCluster, LocationCluster, PersonCluster 
} from '../../shared/models';
import { v4 as uuidv4 } from 'uuid';

export class AnalysisService {
  async analyzeAlbum(albumId: string): Promise<PhotoAnalysisResponse> {
    const photosResult = await db.query<Photo>(
      `SELECT * FROM photos WHERE album_id = $1 ORDER BY taken_at ASC NULLS LAST`,
      [albumId]
    );

    const photos = photosResult.rows;
    
    const analysisResults = await Promise.all(
      photos.map(photo => this.analyzePhoto(photo))
    );

    const timeline = this.clusterByTimeline(photos);
    const locations = this.clusterByLocation(photos);
    const people = this.clusterByPeople(photos);

    for (let i = 0; i < photos.length; i++) {
      const analysis = analysisResults[i];
      
      await db.query(
        `UPDATE photos 
         SET analysis_result = $1, 
             emotion_tags = $2, 
             face_data = $3,
             is_repeated = $4
         WHERE id = $5`,
        [
          JSON.stringify(analysis.analysis),
          analysis.emotions,
          JSON.stringify(analysis.faces),
          analysis.duplicates.length > 0,
          photos[i].id,
        ]
      );
    }

    return {
      albumId,
      photos: analysisResults,
      timeline,
      locations,
      people,
    };
  }

  private async analyzePhoto(photo: Photo): Promise<{
    id: string;
    analysis: PhotoAnalysisResult;
    faces: FaceData[];
    emotions: string[];
    location: LocationData | null;
    duplicates: string[];
  }> {
    const hasExif = !!photo.exif_data;
    const hasLocation = !!photo.location_data;
    const hasFaces = !!photo.face_data;

    const analysis: PhotoAnalysisResult = {
      hasFaces,
      hasLocation,
      hasExif,
      quality: this.calculateQuality(photo),
      faces: photo.face_data?.length || 0,
      dominantColors: this.extractDominantColors(photo),
    };

    const faces: FaceData[] = photo.face_data || [];
    const emotions = photo.emotion_tags || this.inferEmotions(photo);
    const location: LocationData | null = photo.location_data || null;
    const duplicates = this.findDuplicates(photo);

    return {
      id: photo.id,
      analysis,
      faces,
      emotions,
      location,
      duplicates,
    };
  }

  private calculateQuality(photo: Photo): number {
    let quality = 50;

    if (photo.exif_data) {
      quality += 20;
    }

    if (photo.location_data) {
      quality += 15;
    }

    if (photo.face_data && photo.face_data.length > 0) {
      quality += 15;
    }

    return Math.min(100, quality);
  }

  private extractDominantColors(photo: Photo): string[] {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    ];
    
    const count = Math.floor(Math.random() * 3) + 1;
    const selectedColors: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      if (!selectedColors.includes(color)) {
        selectedColors.push(color);
      }
    }
    
    return selectedColors;
  }

  private inferEmotions(photo: Photo): string[] {
    const emotionSets = [
      ['温馨', '幸福'],
      ['快乐', '愉悦'],
      ['宁静', '平和'],
      ['兴奋', '期待'],
      ['感动', '怀念'],
    ];
    
    return emotionSets[Math.floor(Math.random() * emotionSets.length)];
  }

  private findDuplicates(photo: Photo): string[] {
    return [];
  }

  private clusterByTimeline(photos: Photo[]): TimelineCluster[] {
    const clusters: TimelineCluster[] = [];
    const sortedPhotos = [...photos].sort((a, b) => {
      const dateA = a.taken_at ? new Date(a.taken_at).getTime() : 0;
      const dateB = b.taken_at ? new Date(b.taken_at).getTime() : 0;
      return dateA - dateB;
    });

    let currentCluster: TimelineCluster | null = null;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * DAY_MS;

    for (const photo of sortedPhotos) {
      if (!photo.taken_at) continue;

      const photoDate = new Date(photo.taken_at);

      if (!currentCluster) {
        currentCluster = {
          startDate: photoDate,
          endDate: photoDate,
          photoIds: [photo.id],
          label: this.getTimelineLabel(photoDate),
        };
      } else {
        const timeDiff = photoDate.getTime() - currentCluster.endDate.getTime();

        if (timeDiff < DAY_MS) {
          currentCluster.endDate = photoDate;
          currentCluster.photoIds.push(photo.id);
        } else if (timeDiff < WEEK_MS) {
          currentCluster.endDate = photoDate;
          currentCluster.photoIds.push(photo.id);
        } else {
          clusters.push(currentCluster);
          currentCluster = {
            startDate: photoDate,
            endDate: photoDate,
            photoIds: [photo.id],
            label: this.getTimelineLabel(photoDate),
          };
        }
      }
    }

    if (currentCluster) {
      clusters.push(currentCluster);
    }

    return clusters;
  }

  private getTimelineLabel(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${year}年${month}月${day}日`;
  }

  private clusterByLocation(photos: Photo[]): LocationCluster[] {
    const locationMap = new Map<string, LocationCluster>();

    for (const photo of photos) {
      if (!photo.location_data) continue;

      const key = `${photo.location_data.lat.toFixed(2)}_${photo.location_data.lng.toFixed(2)}`;
      
      if (locationMap.has(key)) {
        const cluster = locationMap.get(key)!;
        cluster.photoIds.push(photo.id);
        cluster.visitCount++;
      } else {
        locationMap.set(key, {
          location: photo.location_data,
          photoIds: [photo.id],
          visitCount: 1,
        });
      }
    }

    return Array.from(locationMap.values()).sort((a, b) => b.visitCount - a.visitCount);
  }

  private clusterByPeople(photos: Photo[]): PersonCluster[] {
    const personMap = new Map<string, PersonCluster>();

    for (const photo of photos) {
      if (!photo.face_data || photo.face_data.length === 0) continue;

      for (const face of photo.face_data) {
        const personId = face.personId || 'unknown';
        
        if (personMap.has(personId)) {
          const cluster = personMap.get(personId)!;
          cluster.photoIds.push(photo.id);
          cluster.frequency++;
        } else {
          personMap.set(personId, {
            personId,
            photoIds: [photo.id],
            frequency: 1,
            isProtagonist: false,
          });
        }
      }
    }

    const clusters = Array.from(personMap.values());
    
    if (clusters.length > 0) {
      const maxFrequency = Math.max(...clusters.map(c => c.frequency));
      clusters.forEach(cluster => {
        if (cluster.frequency === maxFrequency) {
          cluster.isProtagonist = true;
        }
      });
    }

    return clusters.sort((a, b) => b.frequency - a.frequency);
  }

  async detectFaces(photoUrl: string): Promise<FaceData[]> {
    const faces: FaceData[] = [];
    
    const numFaces = Math.floor(Math.random() * 3);
    for (let i = 0; i < numFaces; i++) {
      faces.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        width: 50 + Math.random() * 50,
        height: 50 + Math.random() * 50,
        personId: `person_${uuidv4().substring(0, 8)}`,
      });
    }
    
    return faces;
  }

  async detectEmotions(photoUrl: string): Promise<string[]> {
    const allEmotions = ['温馨', '快乐', '宁静', '兴奋', '感动', '搞笑'];
    const numEmotions = Math.floor(Math.random() * 2) + 1;
    const selectedEmotions: string[] = [];
    
    for (let i = 0; i < numEmotions; i++) {
      const emotion = allEmotions[Math.floor(Math.random() * allEmotions.length)];
      if (!selectedEmotions.includes(emotion)) {
        selectedEmotions.push(emotion);
      }
    }
    
    return selectedEmotions;
  }

  async findSimilarPhotos(photoUrl: string, albumId: string): Promise<string[]> {
    const similarPhotos: string[] = [];
    
    const result = await db.query<Photo>(
      `SELECT id FROM photos 
       WHERE album_id = $1 AND url != $2 
       ORDER BY RANDOM() 
       LIMIT 2`,
      [albumId, photoUrl]
    );
    
    return result.rows.map(row => row.id);
  }

  async extractLocation(gpsData: { lat: number; lng: number }): Promise<LocationData> {
    return {
      lat: gpsData.lat,
      lng: gpsData.lng,
      name: this.reverseGeocode(gpsData.lat, gpsData.lng),
      address: `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`,
    };
  }

  private reverseGeocode(lat: number, lng: number): string {
    const locations = [
      '北京',
      '上海',
      '杭州西湖',
      '深圳',
      '广州',
      '成都',
      '西安',
      '南京',
      '厦门',
      '青岛',
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }

  async processBatchAnalysis(albumId: string): Promise<void> {
    const analysis = await this.analyzeAlbum(albumId);
    
    console.log(`Analysis completed for album ${albumId}`);
    console.log(`Found ${analysis.timeline.length} timeline clusters`);
    console.log(`Found ${analysis.locations.length} location clusters`);
    console.log(`Found ${analysis.people.length} people`);
  }
}

export const analysisService = new AnalysisService();

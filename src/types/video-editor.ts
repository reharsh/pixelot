export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text';
  duration?: number;
  thumbnail?: string;
  size: string;
  format: string;
  src?: string; // Source URL for media assets
}

export interface TimelineClip {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  name: string;
  type: 'video' | 'audio' | 'image' | 'text';
  canvasObjectId?: string; // Link to corresponding Fabric.js object
}

export interface Track {
  id: string;
  name: string;
  clips: TimelineClip[];
  isLocked?: boolean;
  isMuted?: boolean;
  isVisible?: boolean;
  isKeyframeMode?: boolean; // Animation mode toggle
}

export interface VideoEditorState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number[];
  selectedClip: string | null;
  assets: MediaAsset[];
  tracks: Track[];
}
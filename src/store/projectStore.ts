import { create } from 'zustand';
import { MediaAsset, Track, TimelineClip } from '@/types/video-editor';
import * as fabric from 'fabric';
import { createUUID } from '@/lib/uuid';

export interface CanvasObject {
  id: string;
  type: 'text' | 'rect' | 'circle' | 'triangle' | 'image' | 'video' | 'group' | string; // Allow for custom object types
  // Position & Dimensions
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX: boolean;
  flipY: boolean;
  // Style
  fill: string | fabric.Pattern | fabric.Gradient<any>;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  // Image/Video-specific
  src?: string;
  // Additional Fabric.js properties
  originX?: string;
  originY?: string;
  selectable?: boolean;
  evented?: boolean;
}

// UPDATED: Changed time to relativeTime for clip-relative keyframes
export interface Keyframe {
  id: string;
  objectId: string;
  relativeTime: number; // CHANGED: Time relative to the clip's start time
  property: string;
  value: any;
  easing?: string;
}

interface ProjectState {
  // Core project data
  objects: CanvasObject[];
  keyframes: Keyframe[];
  activeObjectId: string | null;
  selectedKeyframeId: string | null; // Track selected keyframe
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  
  // Media and timeline
  assets: MediaAsset[];
  tracks: Track[];
  selectedClipId: string | null;
  
  // UI state that needs to be global
  volume: number[];
  timelineZoom: number[];
  
  // Canvas state
  canvasHistory: string[];
  historyIndex: number;
  zoomLevel: number;
  canvasInstance: fabric.Canvas | null;
}

interface ProjectActions {
  // Object management
  setObjects: (objects: CanvasObject[]) => void;
  addObject: (object: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  setActiveObjectId: (id: string | null) => void;
  
  // Keyframe management
  setKeyframes: (keyframes: Keyframe[]) => void;
  addKeyframe: (keyframe: Keyframe) => void;
  removeKeyframe: (id: string) => void;
  setSelectedKeyframeId: (id: string | null) => void; // Select keyframe
  
  // Playback controls
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setVolume: (volume: number[]) => void;
  
  // Asset management
  setAssets: (assets: MediaAsset[]) => void;
  addAsset: (asset: MediaAsset) => void;
  removeAsset: (id: string) => void;
  
  // Track management
  setTracks: (tracks: Track[]) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  reorderTracks: (activeId: string, overId: string) => void;
  removeClipFromTrack: (trackId: string, clipId: string) => void;
  setSelectedClipId: (id: string | null) => void;
  setTimelineZoom: (zoom: number[]) => void;
  
  // Clip manipulation
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  
  // Track controls
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  
  // Keyframe animation mode
  toggleTrackKeyframeMode: (trackId: string) => void;
  applyObjectPropertyChange: (objectId: string, property: string, value: any) => void;
  
  // Canvas management
  setCanvasInstance: (canvas: fabric.Canvas | null) => void;
  saveCanvasState: (state: string) => void;
  undo: () => void;
  redo: () => void;
  setZoomLevel: (level: number) => void;
  
  // Canvas actions - UPDATED: Add clipStartTime parameter
  addShapeToCanvas: (shapeType: string, properties?: any, id?: string, clipStartTime?: number) => string | undefined;
  addTextToCanvas: (textProperties?: any, id?: string, clipStartTime?: number) => string | undefined;
  addImageToCanvas: (src: string, properties?: any, id?: string, clipStartTime?: number) => string | undefined;
  addVideoToCanvas: (src: string, properties?: any, id?: string, clipStartTime?: number) => string | undefined;
  
  // Initial keyframe creation helper
  addInitialKeyframes: (objectId: string, fabricObject: fabric.Object, clipStartTime: number) => void;
  
  // Single delete action for comprehensive asset deletion
  deleteSelectedAsset: () => void;
  
  // Utility actions
  reset: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  objects: [],
  keyframes: [],
  activeObjectId: null,
  selectedKeyframeId: null,
  duration: 30, // 30 seconds
  currentTime: 0,
  isPlaying: false,
  
  assets: [],
  tracks: [],
  selectedClipId: null,
  
  volume: [50],
  timelineZoom: [100],
  
  canvasHistory: [],
  historyIndex: -1,
  zoomLevel: 1,
  canvasInstance: null,
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,
  
  // Object management
  setObjects: (objects) => {
    console.log('🏪 STORE: Setting objects:', objects.length);
    set({ objects });
  },
  
  addObject: (object) => {
    console.log('🏪 STORE: Adding object:', object.id, object.type);
    set((state) => ({
      objects: [...state.objects, object],
      activeObjectId: object.id,
    }));
  },
  
  updateObject: (id, updates) => {
    console.log('🏪 STORE: Updating object:', id, updates);
    set((state) => ({
      objects: state.objects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
  },
  
  removeObject: (id) => {
    console.log('🏪 STORE: Removing object:', id);
    
    // Enhanced removeObject: Also clean up timeline when canvas object is removed
    const state = get();
    
    // Find and remove corresponding timeline clip
    let trackToRemove: string | null = null;
    const updatedTracks = state.tracks.map(track => {
      const updatedClips = track.clips.filter(clip => clip.canvasObjectId !== id);
      
      // If track becomes empty after removing clip, mark it for removal
      if (track.clips.length > 0 && updatedClips.length === 0) {
        trackToRemove = track.id;
        console.log('🏪 STORE: Track', track.id, 'will be removed as it becomes empty');
      }
      
      return { ...track, clips: updatedClips };
    });
    
    // Remove empty track if found
    const finalTracks = trackToRemove 
      ? updatedTracks.filter(track => track.id !== trackToRemove)
      : updatedTracks;
    
    set((state) => ({
      objects: state.objects.filter(obj => obj.id !== id),
      activeObjectId: state.activeObjectId === id ? null : state.activeObjectId,
      tracks: finalTracks,
      selectedClipId: trackToRemove && state.selectedClipId ? null : state.selectedClipId,
      // Clear selected keyframe if it belongs to the removed object
      keyframes: state.keyframes.filter(kf => kf.objectId !== id),
      selectedKeyframeId: state.keyframes.find(kf => kf.id === state.selectedKeyframeId)?.objectId === id 
        ? null : state.selectedKeyframeId,
    }));
    
    if (trackToRemove) {
      console.log('🏪 STORE: Removed empty track:', trackToRemove);
    }
  },
  
  setActiveObjectId: (id) => {
    console.log('🏪 STORE: Setting active object ID:', id);
    set({ activeObjectId: id });
  },
  
  // Keyframe management
  setKeyframes: (keyframes) => {
    console.log('🏪 STORE: Setting keyframes:', keyframes.length);
    set({ keyframes });
  },
  
  addKeyframe: (keyframe) => {
    console.log('🏪 STORE: Adding keyframe:', keyframe.id, keyframe.property, 'relativeTime:', keyframe.relativeTime);
    set((state) => {
      // Remove any existing keyframe for the same object, property, and relative time
      const filteredKeyframes = state.keyframes.filter(kf => 
        !(kf.objectId === keyframe.objectId && 
          kf.property === keyframe.property && 
          Math.abs(kf.relativeTime - keyframe.relativeTime) < 0.01)
      );
      
      return {
        keyframes: [...filteredKeyframes, keyframe],
      };
    });
  },
  
  removeKeyframe: (id) => {
    console.log('🏪 STORE: Removing keyframe:', id);
    set((state) => ({
      keyframes: state.keyframes.filter(kf => kf.id !== id),
      selectedKeyframeId: state.selectedKeyframeId === id ? null : state.selectedKeyframeId,
    }));
  },
  
  // Keyframe selection
  setSelectedKeyframeId: (id) => {
    console.log('🏪 STORE: Setting selected keyframe ID:', id);
    set({ selectedKeyframeId: id });
  },
  
  // Playback controls
  setCurrentTime: (currentTime) => {
    console.log('🏪 STORE: Setting current time:', currentTime);
    set({ currentTime });
  },
  
  setDuration: (duration) => {
    console.log('🏪 STORE: Setting duration:', duration);
    set({ duration });
  },
  
  setIsPlaying: (isPlaying) => {
    console.log('🏪 STORE: Setting is playing:', isPlaying);
    set({ isPlaying });
  },
  
  togglePlay: () => {
    const state = get();
    console.log('🏪 STORE: Toggling play from', state.isPlaying, 'to', !state.isPlaying);
    set({ isPlaying: !state.isPlaying });
  },
  
  setVolume: (volume) => {
    console.log('🏪 STORE: Setting volume:', volume);
    set({ volume });
  },
  
  // Asset management
  setAssets: (assets) => {
    console.log('🏪 STORE: Setting assets:', assets.length);
    set({ assets });
  },
  
  addAsset: (asset) => {
    console.log('🏪 STORE: Adding asset:', asset.id, asset.name);
    set((state) => ({
      assets: [...state.assets, asset],
    }));
  },
  
  removeAsset: (id) => {
    console.log('🏪 STORE: Removing asset:', id);
    set((state) => ({
      assets: state.assets.filter(asset => asset.id !== id),
    }));
  },
  
  // Track management
  setTracks: (tracks) => {
    console.log('🏪 STORE: Setting tracks:', tracks.length);
    set({ tracks });
  },
  
  addTrack: (track) => {
    console.log('🏪 STORE: Adding track:', track.id, track.name);
    set((state) => ({
      tracks: [...state.tracks, track],
    }));
  },
  
  removeTrack: (trackId) => {
    console.log('🏪 STORE: Removing track:', trackId);
    set((state) => ({
      tracks: state.tracks.filter(track => track.id !== trackId),
      selectedClipId: state.selectedClipId && 
        state.tracks.find(t => t.id === trackId)?.clips.some(c => c.id === state.selectedClipId) 
        ? null : state.selectedClipId,
    }));
  },
  
  reorderTracks: (activeId, overId) => {
    console.log('🏪 STORE: Reordering tracks from', activeId, 'to', overId);
    set((state) => {
      const tracks = [...state.tracks];
      const activeIndex = tracks.findIndex(track => track.id === activeId);
      const overIndex = tracks.findIndex(track => track.id === overId);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const [movedTrack] = tracks.splice(activeIndex, 1);
        tracks.splice(overIndex, 0, movedTrack);
        console.log('🏪 STORE: Track reordering completed');
      }
      
      return { tracks };
    });
  },
  
  // Enhanced removeClipFromTrack: Automatically remove track if it becomes empty
  removeClipFromTrack: (trackId, clipId) => {
    console.log('🏪 STORE: Removing clip from track:', trackId, clipId);
    
    set((state) => {
      const updatedTracks = state.tracks.map(track => {
        if (track.id === trackId) {
          const updatedClips = track.clips.filter(clip => clip.id !== clipId);
          return { ...track, clips: updatedClips };
        }
        return track;
      });
      
      // Check if the track is now empty and remove it
      const trackAfterClipRemoval = updatedTracks.find(track => track.id === trackId);
      const shouldRemoveTrack = trackAfterClipRemoval && trackAfterClipRemoval.clips.length === 0;
      
      const finalTracks = shouldRemoveTrack 
        ? updatedTracks.filter(track => track.id !== trackId)
        : updatedTracks;
      
      if (shouldRemoveTrack) {
        console.log('🏪 STORE: Removing empty track after clip removal:', trackId);
      }
      
      return {
        tracks: finalTracks,
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      };
    });
  },
  
  setSelectedClipId: (id) => {
    console.log('🏪 STORE: Setting selected clip ID:', id);
    set({ selectedClipId: id });
  },
  
  setTimelineZoom: (timelineZoom) => {
    console.log('🏪 STORE: Setting timeline zoom:', timelineZoom);
    set({ timelineZoom });
  },
  
  // Clip manipulation with FIXED duration extension logic
  updateClip: (trackId, clipId, updates) => {
    console.log('🏪 STORE: Updating clip:', trackId, clipId, updates);
    
    set((state) => {
      const updatedTracks = state.tracks.map(track => {
        if (track.id === trackId) {
          const updatedClips = track.clips.map(clip => {
            if (clip.id === clipId) {
              const updatedClip = { ...clip, ...updates };
              
              // Ensure clip properties are valid
              updatedClip.startTime = Math.max(0, updatedClip.startTime);
              updatedClip.duration = Math.max(0.1, updatedClip.duration);
              
              // Update trimEnd if duration changed
              if (updates.duration !== undefined) {
                updatedClip.trimEnd = updatedClip.trimStart + updatedClip.duration;
              }
              
              console.log('🏪 STORE: Updated clip properties:', updatedClip);
              return updatedClip;
            }
            return clip;
          });
          
          return { ...track, clips: updatedClips };
        }
        return track;
      });
      
      // Calculate max end time from clips, starting from 0 instead of current duration
      let maxEndTime = 0;
      updatedTracks.forEach(track => {
        track.clips.forEach(clip => {
          const clipEndTime = clip.startTime + clip.duration;
          if (clipEndTime > maxEndTime) {
            maxEndTime = clipEndTime;
          }
        });
      });
      
      // Extend timeline duration if needed
      const newDuration = Math.max(state.duration, maxEndTime);
      
      if (newDuration > state.duration) {
        console.log('🏪 STORE: Extending timeline duration from', state.duration, 'to', newDuration);
      }
      
      return {
        tracks: updatedTracks,
        duration: newDuration,
      };
    });
  },
  
  // Track controls - Only update state, let canvas handle Fabric.js updates
  toggleTrackVisibility: (trackId) => {
    console.log('🏪 STORE: Toggling track visibility (state only):', trackId);
    set((state) => ({
      tracks: state.tracks.map(track => 
        track.id === trackId 
          ? { ...track, isVisible: track.isVisible !== false ? false : true }
          : track
      ),
    }));
  },
  
  toggleTrackMute: (trackId) => {
    console.log('🏪 STORE: Toggling track mute (state only):', trackId);
    set((state) => ({
      tracks: state.tracks.map(track => 
        track.id === trackId 
          ? { ...track, isMuted: !track.isMuted }
          : track
      ),
    }));
  },
  
  toggleTrackLock: (trackId) => {
    console.log('🏪 STORE: Toggling track lock (state only):', trackId);
    set((state) => ({
      tracks: state.tracks.map(track => 
        track.id === trackId 
          ? { ...track, isLocked: !track.isLocked }
          : track
      ),
    }));
  },
  
  // Keyframe animation mode
  toggleTrackKeyframeMode: (trackId) => {
    console.log('🎬 KEYFRAME: Toggling keyframe mode for track:', trackId);
    set((state) => ({
      tracks: state.tracks.map(track => 
        track.id === trackId 
          ? { ...track, isKeyframeMode: !track.isKeyframeMode }
          : track
      ),
    }));
  },
  
  applyObjectPropertyChange: (objectId, property, value) => {
    console.log('🎬 KEYFRAME: Applying property change:', objectId, property, '=', value);
    
    const state = get();
    const { selectedClipId, tracks, currentTime } = state;
    
    // Check if we should create a keyframe
    if (selectedClipId) {
      // Find the track that contains the selected clip
      let targetTrack = null;
      let targetClip = null;
      
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipId);
        if (clip && clip.canvasObjectId === objectId) {
          targetTrack = track;
          targetClip = clip;
          break;
        }
      }
      
      // If track is in keyframe mode, create a keyframe
      if (targetTrack && targetTrack.isKeyframeMode && targetClip) {
        console.log('🎬 KEYFRAME: Track is in keyframe mode, creating keyframe');
        
        // UPDATED: Calculate relative time from clip start
        const relativeTime = currentTime - targetClip.startTime;
        console.log('🎬 KEYFRAME: Calculated relative time:', relativeTime, '(currentTime:', currentTime, '- clipStartTime:', targetClip.startTime, ')');
        
        const keyframe: Keyframe = {
          id: createUUID(),
          objectId: objectId,
          relativeTime: relativeTime, // CHANGED: Use relative time instead of absolute time
          property: property,
          value: value,
          easing: 'linear',
        };
        
        // Add the keyframe
        get().addKeyframe(keyframe);
        console.log('🎬 KEYFRAME: Created keyframe:', keyframe);
      } else {
        console.log('🎬 KEYFRAME: Track not in keyframe mode or no matching clip found');
      }
    }
    
    // Always update the object property in the store
    get().updateObject(objectId, { [property]: value });
  },
  
  // Canvas management
  setCanvasInstance: (canvasInstance) => {
    console.log('🏪 STORE: Setting canvas instance:', canvasInstance ? 'Canvas set' : 'Canvas cleared');
    set({ canvasInstance });
  },
  
  saveCanvasState: (state) => {
    console.log('🏪 STORE: Saving canvas state to history');
    set((currentState) => {
      const newHistory = currentState.canvasHistory.slice(0, currentState.historyIndex + 1);
      newHistory.push(state);
      
      // Limit history to 20 states
      if (newHistory.length > 20) {
        newHistory.shift();
        console.log('🏪 STORE: History limit reached, removing oldest state');
      } else {
        console.log('🏪 STORE: Canvas state saved, new history index:', currentState.historyIndex + 1);
        return {
          canvasHistory: newHistory,
          historyIndex: currentState.historyIndex + 1,
        };
      }
      
      return {
        canvasHistory: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  },
  
  undo: () => {
    console.log('🏪 STORE: Performing undo');
    set((state) => {
      if (state.historyIndex > 0) {
        console.log('🏪 STORE: Undo successful, new index:', state.historyIndex - 1);
        return { historyIndex: state.historyIndex - 1 };
      }
      console.log('🏪 STORE: Cannot undo, already at beginning');
      return state;
    });
  },
  
  redo: () => {
    console.log('🏪 STORE: Performing redo');
    set((state) => {
      if (state.historyIndex < state.canvasHistory.length - 1) {
        console.log('🏪 STORE: Redo successful, new index:', state.historyIndex + 1);
        return { historyIndex: state.historyIndex + 1 };
      }
      console.log('🏪 STORE: Cannot redo, already at end');
      return state;
    });
  },
  
  setZoomLevel: (zoomLevel) => {
    console.log('🏪 STORE: Setting zoom level:', Math.round(zoomLevel * 100) + '%');
    set({ zoomLevel });
  },
  
  // UPDATED: Initial keyframe creation helper - Use provided clipStartTime
  addInitialKeyframes: (objectId, fabricObject, clipStartTime) => {
    console.log('🎬 INITIAL KEYFRAMES: Creating initial keyframes for object:', objectId, 'at clip start time:', clipStartTime);
    
    const commonProperties = [
      { name: 'left', value: fabricObject.left || 0 },
      { name: 'top', value: fabricObject.top || 0 },
      { name: 'scaleX', value: fabricObject.scaleX || 1 },
      { name: 'scaleY', value: fabricObject.scaleY || 1 },
      { name: 'angle', value: fabricObject.angle || 0 },
      { name: 'opacity', value: fabricObject.opacity || 1 },
      { name: 'fill', value: fabricObject.fill || '#000000' },
    ];
    
    // Add text-specific properties
    if (fabricObject.type === 'text' || fabricObject.type === 'i-text') {
      const textObj = fabricObject as fabric.Text;
      commonProperties.push(
        { name: 'text', value: textObj.text || '' },
        { name: 'fontSize', value: textObj.fontSize || 20 },
        { name: 'fontWeight', value: String(textObj.fontWeight || 'normal') },
        { name: 'fontFamily', value: textObj.fontFamily || 'Arial' }
      );
    }
    
    // Create keyframes for each property
    commonProperties.forEach(prop => {
      const keyframe: Keyframe = {
        id: createUUID(),
        objectId: objectId,
        relativeTime: 0, // CHANGED: Initial keyframes are always at relative time 0 (start of clip)
        property: prop.name,
        value: prop.value,
        easing: 'linear',
      };
      
      get().addKeyframe(keyframe);
      console.log('🎬 INITIAL KEYFRAMES: Created initial keyframe for', prop.name, '=', prop.value, 'at relative time: 0');
    });
    
    console.log('🎬 INITIAL KEYFRAMES: Completed initial keyframe creation for object:', objectId);
  },
  
  // Canvas actions - UPDATED: Add clipStartTime parameter
  addShapeToCanvas: (shapeType, properties = {}, id, clipStartTime) => {
    console.log('🏪 STORE: Adding shape to canvas via store:', shapeType, 'clipStartTime:', clipStartTime);
    const state = get();
    const { canvasInstance } = state;
    
    if (!canvasInstance) {
      console.log('🏪 STORE: No canvas instance available');
      return;
    }

    const canvasSize = { 
      width: canvasInstance.getWidth(), 
      height: canvasInstance.getHeight() 
    };
    
    const defaultProps = {
      left: Math.random() * (canvasSize.width * 0.6) + canvasSize.width * 0.1,
      top: Math.random() * (canvasSize.height * 0.6) + canvasSize.height * 0.1,
      stroke: properties.fill || '#ffffff',
      strokeWidth: 2,
      ...properties
    };

    let shape: fabric.Object;

    switch (shapeType) {
      case 'rectangle':
        shape = new fabric.Rect({
          ...defaultProps,
          width: canvasSize.width * 0.12,
          height: canvasSize.height * 0.08,
          rx: 5,
          ry: 5,
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          ...defaultProps,
          radius: Math.min(canvasSize.width, canvasSize.height) * 0.04,
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          ...defaultProps,
          width: canvasSize.width * 0.08,
          height: canvasSize.height * 0.08,
        });
        break;
      case 'star':
        const starPoints = [];
        const outerRadius = Math.min(canvasSize.width, canvasSize.height) * 0.04;
        const innerRadius = outerRadius * 0.4;
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / 5;
          starPoints.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
          });
        }
        shape = new fabric.Polygon(starPoints, defaultProps);
        break;
      case 'heart':
        const heartPath = "M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5 C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3 C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z";
        shape = new fabric.Path(heartPath, {
          ...defaultProps,
          scaleX: 2,
          scaleY: 2,
        });
        break;
      case 'hexagon':
        const hexPoints = [];
        const hexRadius = Math.min(canvasSize.width, canvasSize.height) * 0.04;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          hexPoints.push({
            x: Math.cos(angle) * hexRadius,
            y: Math.sin(angle) * hexRadius
          });
        }
        shape = new fabric.Polygon(hexPoints, defaultProps);
        break;
      default:
        console.log('🏪 STORE: Unknown shape type:', shapeType);
        return;
    }

    // Assign unique ID for animation engine
    const shapeId = id || createUUID();
    (shape as any).id = shapeId;
    console.log('🏪 STORE: Assigned unique ID to shape:', shapeId);

    console.log('🏪 STORE: Shape created:', shape.toJSON());
    canvasInstance.add(shape);
    canvasInstance.setActiveObject(shape);
    canvasInstance.renderAll();
    
    // UPDATED: Create initial keyframes using clipStartTime if provided
    if (clipStartTime !== undefined) {
      console.log('🎬 INITIAL KEYFRAMES: Creating initial keyframes at clip start time:', clipStartTime);
      get().addInitialKeyframes(shapeId, shape, clipStartTime);
    }
    
    const canvasState = JSON.stringify(canvasInstance.toJSON());
    console.log('🏪 STORE: Saving canvas state after shape addition');
    get().saveCanvasState(canvasState);

    return shapeId;
  },
  
  addTextToCanvas: (textProperties = {}, id, clipStartTime) => {
    console.log('🏪 STORE: Adding text to canvas via store:', textProperties, 'clipStartTime:', clipStartTime);
    const state = get();
    const { canvasInstance } = state;
    
    if (!canvasInstance) {
      console.log('🏪 STORE: No canvas instance available');
      return;
    }

    const canvasSize = { 
      width: canvasInstance.getWidth(), 
      height: canvasInstance.getHeight() 
    };
    
    const text = new fabric.Text(textProperties.text || 'New Text', {
      left: Math.random() * (canvasSize.width * 0.6) + canvasSize.width * 0.1,
      top: Math.random() * (canvasSize.height * 0.6) + canvasSize.height * 0.1,
      fontFamily: 'Arial',
      fontSize: textProperties.fontSize || Math.min(canvasSize.width / 30, 32),
      fill: textProperties.fill || '#ffffff',
      fontWeight: textProperties.fontWeight || 'normal',
      ...textProperties
    });

    // Assign unique ID for animation engine
    const textId = id || createUUID();
    (text as any).id = textId;
    console.log('🏪 STORE: Assigned unique ID to text:', textId);

    console.log('🏪 STORE: Text object created:', text.toJSON());
    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
    canvasInstance.renderAll();
    
    // UPDATED: Create initial keyframes using clipStartTime if provided
    if (clipStartTime !== undefined) {
      console.log('🎬 INITIAL KEYFRAMES: Creating initial keyframes at clip start time:', clipStartTime);
      get().addInitialKeyframes(textId, text, clipStartTime);
    }
    
    const canvasState = JSON.stringify(canvasInstance.toJSON());
    console.log('🏪 STORE: Saving canvas state after text addition');
    get().saveCanvasState(canvasState);

    return textId;
  },
  
  addImageToCanvas: (src, properties = {}, id, clipStartTime) => {
    console.log('🏪 STORE: Adding image to canvas via store:', src, 'clipStartTime:', clipStartTime);
    const state = get();
    const { canvasInstance } = state;
    
    if (!canvasInstance) {
      console.log('🏪 STORE: No canvas instance available');
      return;
    }

    const canvasSize = { 
      width: canvasInstance.getWidth(), 
      height: canvasInstance.getHeight() 
    };
    
    const imageId = id || createUUID();
    
    console.log('🖼️ IMAGE LOADING: Starting fabric.Image.fromURL with src:', src);
    console.log('🖼️ IMAGE LOADING: Using crossOrigin: anonymous for CORS support');

    const img = new window.Image();
img.onload = function() {
  console.log('🖼️ IMAGE LOADING: Image loaded successfully (manual)');
  console.log('🖼️ IMAGE LOADING: Image dimensions:', img.width, 'x', img.height);

  const fabricImg = new fabric.Image(img);

  // Scale image to fit canvas while maintaining aspect ratio
  const maxWidth = canvasSize.width * 0.4;
  const maxHeight = canvasSize.height * 0.4;

  const scaleX = maxWidth / (img.width || 1);
  const scaleY = maxHeight / (img.height || 1);
  const scale = Math.min(scaleX, scaleY);

  fabricImg.set({
    left: Math.random() * (canvasSize.width * 0.6) + canvasSize.width * 0.1,
    top: Math.random() * (canvasSize.height * 0.6) + canvasSize.height * 0.1,
    scaleX: scale,
    scaleY: scale,
    ...properties
  });

  // Assign unique ID for animation engine
  (fabricImg as any).id = imageId;
  console.log('🖼️ IMAGE LOADING: Assigned unique ID to image:', imageId);

  console.log('🖼️ IMAGE LOADING: Image object created:', fabricImg.toJSON());
  canvasInstance.add(fabricImg);
  canvasInstance.setActiveObject(fabricImg);
  canvasInstance.renderAll();

  // Create initial keyframes using clipStartTime if provided
  if (clipStartTime !== undefined) {
    console.log('🎬 INITIAL KEYFRAMES: Creating initial keyframes at clip start time:', clipStartTime);
    get().addInitialKeyframes(imageId, fabricImg, clipStartTime);
  }

  const canvasState = JSON.stringify(canvasInstance.toJSON());
  console.log('🏪 STORE: Saving canvas state after image addition');
  get().saveCanvasState(canvasState);
};
img.onerror = function(e) {
  console.error('🖼️ IMAGE LOADING: Image failed to load', e);
};
img.crossOrigin = 'anonymous'; // Only needed for remote images
img.src = src;

    return imageId;
  },
  
  addVideoToCanvas: (src, properties = {}, id, clipStartTime) => {
    console.log('🏪 STORE: Adding video placeholder to canvas via store:', src, 'clipStartTime:', clipStartTime);
    const state = get();
    const { canvasInstance } = state;
    
    if (!canvasInstance) {
      console.log('🏪 STORE: No canvas instance available');
      return;
    }

    const canvasSize = { 
      width: canvasInstance.getWidth(), 
      height: canvasInstance.getHeight() 
    };
    
    // Create a rectangle as video placeholder
    const videoPlaceholder = new fabric.Rect({
      left: Math.random() * (canvasSize.width * 0.6) + canvasSize.width * 0.1,
      top: Math.random() * (canvasSize.height * 0.6) + canvasSize.height * 0.1,
      width: canvasSize.width * 0.3,
      height: canvasSize.height * 0.2,
      fill: '#1a1a1a',
      stroke: '#ffffff',
      strokeWidth: 2,
      rx: 5,
      ry: 5,
      ...properties
    });

    // Add text overlay to indicate it's a video
    const videoText = new fabric.Text('VIDEO', {
      left: videoPlaceholder.left! + (videoPlaceholder.width! / 2),
      top: videoPlaceholder.top! + (videoPlaceholder.height! / 2),
      fontSize: 16,
      fill: '#ffffff',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    // Group the rectangle and text
    const videoGroup = new fabric.Group([videoPlaceholder, videoText], {
      left: videoPlaceholder.left,
      top: videoPlaceholder.top
    });

    // Assign unique ID for animation engine
    const videoId = id || createUUID();
    (videoGroup as any).id = videoId;
    console.log('🏪 STORE: Assigned unique ID to video placeholder:', videoId);

    console.log('🏪 STORE: Video placeholder created:', videoGroup.toJSON());
    canvasInstance.add(videoGroup);
    canvasInstance.setActiveObject(videoGroup);
    canvasInstance.renderAll();
    
    // UPDATED: Create initial keyframes using clipStartTime if provided
    if (clipStartTime !== undefined) {
      console.log('🎬 INITIAL KEYFRAMES: Creating initial keyframes at clip start time:', clipStartTime);
      get().addInitialKeyframes(videoId, videoGroup, clipStartTime);
    }
    
    const canvasState = JSON.stringify(canvasInstance.toJSON());
    console.log('🏪 STORE: Saving canvas state after video placeholder addition');
    get().saveCanvasState(canvasState);

    return videoId;
  },
  
  // Single delete action for comprehensive asset deletion
  deleteSelectedAsset: () => {
    console.log('🗑️ DELETE: Starting comprehensive asset deletion');
    
    const state = get();
    const { selectedClipId, canvasInstance } = state;
    
    if (!selectedClipId) {
      console.log('🗑️ DELETE: No clip selected, nothing to delete');
      return;
    }
    
    // Find the selected clip and its track
    let targetTrack: Track | null = null;
    let targetClip: TimelineClip | null = null;
    
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) {
        targetTrack = track;
        targetClip = clip;
        break;
      }
    }
    
    if (!targetTrack || !targetClip) {
      console.log('🗑️ DELETE: Selected clip not found in tracks');
      return;
    }
    
    console.log('🗑️ DELETE: Found target clip:', targetClip.id, 'in track:', targetTrack.id);
    console.log('🗑️ DELETE: Canvas object ID:', targetClip.canvasObjectId);
    
    // Remove from canvas if there's a corresponding canvas object
    if (targetClip.canvasObjectId && canvasInstance) {
      const objects = canvasInstance.getObjects();
      const fabricObj = objects.find(obj => (obj as any).id === targetClip.canvasObjectId);
      
      if (fabricObj) {
        console.log('🗑️ DELETE: Removing object from canvas:', targetClip.canvasObjectId);
        canvasInstance.remove(fabricObj);
        canvasInstance.renderAll();
        
        // Save canvas state
        const canvasState = JSON.stringify(canvasInstance.toJSON());
        get().saveCanvasState(canvasState);
      } else {
        console.log('🗑️ DELETE: Canvas object not found:', targetClip.canvasObjectId);
      }
    }
    
    // Remove clip from track (this will also remove the track if it becomes empty)
    get().removeClipFromTrack(targetTrack.id, targetClip.id);
    
    console.log('🗑️ DELETE: Comprehensive asset deletion completed');
  },
  
  // Utility actions
  reset: () => {
    console.log('🏪 STORE: Resetting store to initial state');
    set(initialState);
  },
}));
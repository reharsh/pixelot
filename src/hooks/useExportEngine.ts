import { useCallback, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
// @ts-expect-error: no types for gifenc
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
// @ts-expect-error: no types for webm-writer
import WebMWriter from 'webm-writer';

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'complete';
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
  message?: string;
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'gif' | 'webm';
  quality?: number; // 0-1 for JPEG, 0-10 for GIF
  frameRate?: number; // fps for GIF/video
  width?: number;
  height?: number;
  startTime?: number;
  endTime?: number;
}

// Animation interpolation utilities (copied from useAnimationEngine.ts)
const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * t;
};

const lerpColor = (startColor: string, endColor: string, t: number): string => {
  if (startColor.startsWith('#') && endColor.startsWith('#')) {
    const start = parseInt(startColor.slice(1), 16);
    const end = parseInt(endColor.slice(1), 16);
    const startR = (start >> 16) & 255;
    const startG = (start >> 8) & 255;
    const startB = start & 255;
    const endR = (end >> 16) & 255;
    const endG = (end >> 8) & 255;
    const endB = end & 255;
    const r = Math.round(lerp(startR, endR, t));
    const g = Math.round(lerp(startG, endG, t));
    const b = Math.round(lerp(startB, endB, t));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
  return t < 0.5 ? startColor : endColor;
};

// Easing functions (copied from useAnimationEngine.ts)
const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

export const useExportEngine = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const {
    canvasInstance,
    duration,
    currentTime,
    keyframes,
    tracks,
    setCurrentTime,
    setIsPlaying,
  } = useProjectStore();

  // Helper function to update canvas to a specific time
  const updateCanvasToTime = useCallback(async (time: number): Promise<void> => {
    if (!canvasInstance) return;

    console.log('🎬 EXPORT: Updating canvas to time:', time.toFixed(3) + 's');
    
    const objects = canvasInstance.getObjects();
    
    // Create a map of object IDs to their corresponding clips for clip start time lookup
    const objectToClipMap = new Map<string, { clip: any, track: any }>();
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.canvasObjectId) {
          objectToClipMap.set(clip.canvasObjectId, { clip, track });
        }
      });
    });

    // Group keyframes by object ID
    const keyframesByObject: Record<string, typeof keyframes> = {};
    keyframes.forEach(keyframe => {
      if (!keyframesByObject[keyframe.objectId]) {
        keyframesByObject[keyframe.objectId] = [];
      }
      keyframesByObject[keyframe.objectId].push(keyframe);
    });

    // Update each object based on its keyframes
    objects.forEach(obj => {
      const objectId = (obj as any).id;
      if (!objectId) return;

      const objectKeyframes = keyframesByObject[objectId];
      if (!objectKeyframes || objectKeyframes.length === 0) return;

      const clipInfo = objectToClipMap.get(objectId);
      if (!clipInfo) return;

      const { clip } = clipInfo;
      const relativeTimeInClip = time - clip.startTime;

      // Group keyframes by property
      const keyframesByProperty: Record<string, typeof keyframes> = {};
      objectKeyframes.forEach(keyframe => {
        if (!keyframesByProperty[keyframe.property]) {
          keyframesByProperty[keyframe.property] = [];
        }
        keyframesByProperty[keyframe.property].push(keyframe);
      });

      // Sort keyframes by relative time for each property
      Object.keys(keyframesByProperty).forEach(property => {
        keyframesByProperty[property].sort((a, b) => a.relativeTime - b.relativeTime);
      });

      // Interpolate each property
      Object.keys(keyframesByProperty).forEach(property => {
        const propertyKeyframes = keyframesByProperty[property];
        let prevKeyframe = null;
        let nextKeyframe = null;
        for (let i = 0; i < propertyKeyframes.length; i++) {
          const keyframe = propertyKeyframes[i];
          if (keyframe.relativeTime <= relativeTimeInClip) {
            prevKeyframe = keyframe;
          }
          if (keyframe.relativeTime >= relativeTimeInClip && !nextKeyframe) {
            nextKeyframe = keyframe;
            break;
          }
        }
        if (prevKeyframe || nextKeyframe) {
          let interpolatedValue;
          if (!prevKeyframe) {
            interpolatedValue = nextKeyframe!.value;
          } else if (!nextKeyframe) {
            interpolatedValue = prevKeyframe.value;
          } else if (prevKeyframe.relativeTime === nextKeyframe.relativeTime) {
            interpolatedValue = nextKeyframe.value;
          } else {
            const timeDiff = nextKeyframe.relativeTime - prevKeyframe.relativeTime;
            const timeProgress = (relativeTimeInClip - prevKeyframe.relativeTime) / timeDiff;
            // Apply easing
            const easing = nextKeyframe.easing || 'linear';
            const easingFunction = easingFunctions[easing as keyof typeof easingFunctions] || easingFunctions.linear;
            const easedProgress = easingFunction(timeProgress);
            // Interpolate based on value type
            if (typeof prevKeyframe.value === 'number' && typeof nextKeyframe.value === 'number') {
              interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, easedProgress);
            } else if (typeof prevKeyframe.value === 'string' && typeof nextKeyframe.value === 'string') {
              if (prevKeyframe.value.startsWith('#') && nextKeyframe.value.startsWith('#')) {
                interpolatedValue = lerpColor(prevKeyframe.value, nextKeyframe.value, easedProgress);
              } else {
                interpolatedValue = easedProgress < 0.5 ? prevKeyframe.value : nextKeyframe.value;
              }
            } else {
              interpolatedValue = easedProgress < 0.5 ? prevKeyframe.value : nextKeyframe.value;
            }
          }
          try {
            (obj as any).set(property, interpolatedValue);
          } catch (error) {
            console.error('🎬 EXPORT: Error applying property', property, 'to object', objectId, ':', error);
          }
        }
      });
    });

    // Update object visibility based on timeline position
    tracks.forEach(track => {
      const trackIsVisible = track.isVisible !== false;
      
      track.clips.forEach(clip => {
        if (!clip.canvasObjectId) return;

        const fabricObj = objects.find(obj => (obj as any).id === clip.canvasObjectId);
        if (!fabricObj) return;

        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;
        const shouldBeVisibleByTime = time >= clipStartTime && time <= clipEndTime;
        const shouldBeVisible = shouldBeVisibleByTime && trackIsVisible;

        fabricObj.set('visible', shouldBeVisible);
      });
    });

    canvasInstance.renderAll();
    
    // Small delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 16));
  }, [canvasInstance, keyframes, tracks]);

  // Export current frame as image
  const exportImage = useCallback(async (options: ExportOptions = { format: 'png' }): Promise<void> => {
    if (!canvasInstance) {
      throw new Error('No canvas instance available');
    }

    console.log('📸 EXPORT: Starting image export with options:', options);
    setIsExporting(true);
    setExportProgress({
      phase: 'preparing',
      progress: 0,
      message: 'Preparing image export...'
    });

    try {
      // Update progress
      setExportProgress({
        phase: 'rendering',
        progress: 50,
        message: 'Rendering current frame...'
      });

      // Get the current canvas state as data URL
      const dataURL = canvasInstance.toDataURL({
        format: options.format === 'jpeg' ? 'jpeg' : 'png',
        quality: options.quality || (options.format === 'jpeg' ? 0.9 : 1.0),
        multiplier: 1
      });

      // Update progress
      setExportProgress({
        phase: 'finalizing',
        progress: 90,
        message: 'Finalizing export...'
      });

      // Create download
      const link = document.createElement('a');
      link.download = `frame-${currentTime.toFixed(2)}s.${options.format}`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportProgress({
        phase: 'complete',
        progress: 100,
        message: 'Image exported successfully!'
      });

      console.log('📸 EXPORT: Image export completed successfully');
    } catch (error) {
      console.error('📸 EXPORT: Image export failed:', error);
      throw error;
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1000);
    }
  }, [canvasInstance, currentTime]);

  // Export animation as GIF
  const exportGIF = useCallback(async (options: ExportOptions = { format: 'gif', frameRate: 24 }): Promise<void> => {
    if (!canvasInstance) {
      throw new Error('No canvas instance available');
    }

    console.log('🎞️ EXPORT: Starting GIF export with options:', options);
    setIsExporting(true);

    const frameRate = options.frameRate || 24;
    const startTime = options.startTime || 0;
    const endTime = options.endTime || duration;
    const exportDuration = endTime - startTime;
    const totalFrames = Math.ceil(exportDuration * frameRate);
    const frameInterval = 1 / frameRate;

    console.log('🎞️ EXPORT: GIF parameters:', {
      frameRate,
      startTime,
      endTime,
      exportDuration,
      totalFrames,
      frameInterval
    });

    try {
      setExportProgress({
        phase: 'preparing',
        progress: 0,
        totalFrames,
        message: 'Preparing GIF export...'
      });

      // Store original state
      const originalTime = currentTime;
      const originalPlaying = useProjectStore.getState().isPlaying;
      setIsPlaying(false);

      // Initialize GIF encoder
      const gif = GIFEncoder();
      const canvasWidth = canvasInstance.getWidth();
      const canvasHeight = canvasInstance.getHeight();

      setExportProgress({
        phase: 'rendering',
        progress: 5,
        totalFrames,
        currentFrame: 0,
        message: 'Rendering frames...'
      });

      // Create a temporary canvas to extract image data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasWidth;
      tempCanvas.height = canvasHeight;
      const tempCtx = tempCanvas.getContext('2d')!;

      // Render each frame
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const frameTime = startTime + (frameIndex * frameInterval);
        
        console.log(`🎞️ EXPORT: Rendering frame ${frameIndex + 1}/${totalFrames} at time ${frameTime.toFixed(3)}s`);

        // Update canvas to this frame's time
        await updateCanvasToTime(frameTime);

        // Get the Fabric.js canvas as data URL and draw it to temp canvas
        const dataURL = canvasInstance.toDataURL({ format: 'png', multiplier: 1 });
        const img = new Image();
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
            tempCtx.drawImage(img, 0, 0);
            resolve();
          };
          img.src = dataURL;
        });

        // Get image data from temp canvas
        const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        // Quantize colors for GIF (reduce to 256 colors)
        const palette = quantize(new Uint8Array(imageData.data), 256);
        const index = applyPalette(new Uint8Array(imageData.data), palette);

        // Add frame to GIF
        gif.writeFrame(index, canvasWidth, canvasHeight, {
          palette,
          delay: Math.round(1000 / frameRate), // delay in ms
        });

        // Update progress
        const progress = 5 + ((frameIndex + 1) / totalFrames) * 80;
        setExportProgress({
          phase: 'rendering',
          progress,
          totalFrames,
          currentFrame: frameIndex + 1,
          message: `Rendering frame ${frameIndex + 1}/${totalFrames}...`
        });
      }

      setExportProgress({
        phase: 'encoding',
        progress: 85,
        totalFrames,
        message: 'Encoding GIF...'
      });

      // Finalize GIF
      gif.finish();
      const buffer = gif.bytes();

      setExportProgress({
        phase: 'finalizing',
        progress: 95,
        totalFrames,
        message: 'Finalizing GIF...'
      });

      // Create download
      const blob = new Blob([buffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `animation-${startTime.toFixed(1)}s-${endTime.toFixed(1)}s.gif`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Restore original state
      setCurrentTime(originalTime);
      setIsPlaying(originalPlaying);

      setExportProgress({
        phase: 'complete',
        progress: 100,
        totalFrames,
        message: 'GIF exported successfully!'
      });

      console.log('🎞️ EXPORT: GIF export completed successfully');
    } catch (error) {
      console.error('🎞️ EXPORT: GIF export failed:', error);
      throw error;
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1000);
    }
  }, [canvasInstance, duration, currentTime, updateCanvasToTime, setCurrentTime, setIsPlaying]);

  // Export animation as WebM video
  const exportVideo = useCallback(async (options: ExportOptions = { format: 'webm', frameRate: 30 }): Promise<void> => {
    if (!canvasInstance) {
      throw new Error('No canvas instance available');
    }

    console.log('🎬 EXPORT: Starting video export with options:', options);
    setIsExporting(true);

    const frameRate = options.frameRate || 30;
    const startTime = options.startTime || 0;
    const endTime = options.endTime || duration;
    const exportDuration = endTime - startTime;
    const totalFrames = Math.ceil(exportDuration * frameRate);
    const frameInterval = 1 / frameRate;

    console.log('🎬 EXPORT: Video parameters:', {
      frameRate,
      startTime,
      endTime,
      exportDuration,
      totalFrames,
      frameInterval
    });

    try {
      setExportProgress({
        phase: 'preparing',
        progress: 0,
        totalFrames,
        message: 'Preparing video export...'
      });

      // Store original state
      const originalTime = currentTime;
      const originalPlaying = useProjectStore.getState().isPlaying;
      setIsPlaying(false);

      // Create a temporary canvas to capture frames
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasInstance.getWidth();
      tempCanvas.height = canvasInstance.getHeight();
      const tempCtx = tempCanvas.getContext('2d')!;

      // Initialize WebM writer with the temporary canvas
      const videoWriter = new WebMWriter({
        quality: options.quality || 0.95,
        frameRate: frameRate,
        transparent: false,
      });

      setExportProgress({
        phase: 'rendering',
        progress: 5,
        totalFrames,
        currentFrame: 0,
        message: 'Rendering frames...'
      });

      // Render each frame
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const frameTime = startTime + (frameIndex * frameInterval);
        
        console.log(`🎬 EXPORT: Rendering frame ${frameIndex + 1}/${totalFrames} at time ${frameTime.toFixed(3)}s`);

        // Update canvas to this frame's time
        await updateCanvasToTime(frameTime);

        // Get the Fabric.js canvas as data URL and draw it to temp canvas
        const dataURL = canvasInstance.toDataURL({ format: 'png', multiplier: 1 });
        const img = new Image();
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(img, 0, 0);
            resolve();
          };
          img.src = dataURL;
        });

        // Add the temporary canvas as a frame to the video
        videoWriter.addFrame(tempCanvas);

        // Update progress
        const progress = 5 + ((frameIndex + 1) / totalFrames) * 80;
        setExportProgress({
          phase: 'rendering',
          progress,
          totalFrames,
          currentFrame: frameIndex + 1,
          message: `Rendering frame ${frameIndex + 1}/${totalFrames}...`
        });
      }

      setExportProgress({
        phase: 'encoding',
        progress: 85,
        totalFrames,
        message: 'Encoding video...'
      });

      // Finalize video
      const videoBlob = await videoWriter.complete();

      setExportProgress({
        phase: 'finalizing',
        progress: 95,
        totalFrames,
        message: 'Finalizing video...'
      });

      // Create download
      const url = URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.download = `animation-${startTime.toFixed(1)}s-${endTime.toFixed(1)}s.webm`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Restore original state
      setCurrentTime(originalTime);
      setIsPlaying(originalPlaying);

      setExportProgress({
        phase: 'complete',
        progress: 100,
        totalFrames,
        message: 'Video exported successfully!'
      });

      console.log('🎬 EXPORT: Video export completed successfully');
    } catch (error) {
      console.error('🎬 EXPORT: Video export failed:', error);
      throw error;
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1000);
    }
  }, [canvasInstance, duration, currentTime, updateCanvasToTime, setCurrentTime, setIsPlaying]);

  return {
    isExporting,
    exportProgress,
    exportImage,
    exportGIF,
    exportVideo,
  };
};
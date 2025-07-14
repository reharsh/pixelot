import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';

// Animation interpolation utilities
const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * t;
};

const lerpColor = (startColor: string, endColor: string, t: number): string => {
  // Simple color interpolation for hex colors
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
  
  // Fallback to start color if interpolation fails
  return t < 0.5 ? startColor : endColor;
};

// Easing functions
const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

export const useAnimationEngine = () => {
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);

  const {
    canvasInstance,
    keyframes,
    tracks, // UPDATED: Get tracks to find clip start times
    currentTime,
    isPlaying,
    duration,
    setCurrentTime,
    setIsPlaying,
  } = useProjectStore();

  // UPDATED: Core animation update function with relative keyframe support
  const updateCanvas = useCallback((time: number) => {
    if (!canvasInstance) {
      console.log('🎬 ANIMATION: No canvas instance available');
      return;
    }

    console.log('🎬 ANIMATION: Updating canvas at time:', time.toFixed(2) + 's');
    
    const objects = canvasInstance.getObjects();
    console.log('🎬 ANIMATION: Found', objects.length, 'objects on canvas');

    // UPDATED: Create a map of object IDs to their corresponding clips for clip start time lookup
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

    console.log('🎬 ANIMATION: Keyframes grouped by object:', Object.keys(keyframesByObject).length, 'objects have keyframes');

    // Update each object based on its keyframes
    objects.forEach(obj => {
      const objectId = (obj as any).id;
      if (!objectId) {
        console.log('🎬 ANIMATION: Object has no ID, skipping animation');
        return;
      }

      const objectKeyframes = keyframesByObject[objectId];
      if (!objectKeyframes || objectKeyframes.length === 0) {
        console.log('🎬 ANIMATION: No keyframes for object', objectId);
        return;
      }

      // UPDATED: Get the clip information for this object
      const clipInfo = objectToClipMap.get(objectId);
      if (!clipInfo) {
        console.log('🎬 ANIMATION: No clip found for object', objectId, 'skipping animation');
        return;
      }

      const { clip } = clipInfo;
      console.log('🎬 ANIMATION: Processing', objectKeyframes.length, 'keyframes for object', objectId, 'clip start:', clip.startTime);

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

      // UPDATED: Calculate the relative time within the clip
      const relativeTimeInClip = time - clip.startTime;
      console.log('🎬 ANIMATION: Relative time in clip:', relativeTimeInClip.toFixed(2) + 's', '(global time:', time.toFixed(2) + 's', '- clip start:', clip.startTime.toFixed(2) + 's)');

      // Interpolate each property
      Object.keys(keyframesByProperty).forEach(property => {
        const propertyKeyframes = keyframesByProperty[property];
        
        // Find the keyframes to interpolate between using relative time
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

        // If we have keyframes to work with
        if (prevKeyframe || nextKeyframe) {
          let interpolatedValue;

          if (!prevKeyframe) {
            // Before first keyframe
            interpolatedValue = nextKeyframe!.value;
            console.log('🎬 ANIMATION: Using first keyframe value for', property, ':', interpolatedValue);
          } else if (!nextKeyframe) {
            // After last keyframe
            interpolatedValue = prevKeyframe.value;
            console.log('🎬 ANIMATION: Using last keyframe value for', property, ':', interpolatedValue);
          } else if (prevKeyframe.relativeTime === nextKeyframe.relativeTime) {
            // Same relative time
            interpolatedValue = nextKeyframe.value;
            console.log('🎬 ANIMATION: Using exact keyframe value for', property, ':', interpolatedValue);
          } else {
            // Interpolate between keyframes using relative time
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
              // Try color interpolation
              if (prevKeyframe.value.startsWith('#') && nextKeyframe.value.startsWith('#')) {
                interpolatedValue = lerpColor(prevKeyframe.value, nextKeyframe.value, easedProgress);
              } else {
                interpolatedValue = easedProgress < 0.5 ? prevKeyframe.value : nextKeyframe.value;
              }
            } else {
              interpolatedValue = easedProgress < 0.5 ? prevKeyframe.value : nextKeyframe.value;
            }

            console.log('🎬 ANIMATION: Interpolated', property, 'from', prevKeyframe.value, 'to', nextKeyframe.value, 'at progress', easedProgress.toFixed(2), '=', interpolatedValue);
          }

          // Apply the interpolated value to the object
          try {
            (obj as any).set(property, interpolatedValue);
            console.log('🎬 ANIMATION: Applied', property, '=', interpolatedValue, 'to object', objectId);
          } catch (error) {
            console.error('🎬 ANIMATION: Error applying property', property, 'to object', objectId, ':', error);
          }
        }
      });
    });

    // Render the canvas with all updates
    canvasInstance.renderAll();
    console.log('🎬 ANIMATION: Canvas rendered with updates');
  }, [canvasInstance, keyframes, tracks]); // UPDATED: Added tracks dependency

  // Animation loop using requestAnimationFrame
  const animationLoop = useCallback((timestamp: number) => {
    if (!isAnimatingRef.current) {
      console.log('🎬 ANIMATION: Animation loop stopped');
      return;
    }

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Convert to seconds and update current time
    const deltaSeconds = deltaTime / 1000;
    const newTime = Math.min(currentTime + deltaSeconds, duration);

    console.log('🎬 ANIMATION: Frame update - Delta:', deltaSeconds.toFixed(3) + 's', 'New time:', newTime.toFixed(2) + 's');

    setCurrentTime(newTime);

    // Check if we've reached the end
    if (newTime >= duration) {
      console.log('🎬 ANIMATION: Reached end of timeline, stopping playback');
      setIsPlaying(false);
      isAnimatingRef.current = false;
      return;
    }

    // Continue the animation loop
    animationFrameRef.current = requestAnimationFrame(animationLoop);
  }, [currentTime, duration, setCurrentTime, setIsPlaying]);

  // Start/stop animation based on isPlaying state
  useEffect(() => {
    console.log('🎬 ANIMATION: Play state changed to:', isPlaying);

    if (isPlaying && !isAnimatingRef.current) {
      console.log('🎬 ANIMATION: Starting animation loop');
      isAnimatingRef.current = true;
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    } else if (!isPlaying && isAnimatingRef.current) {
      console.log('🎬 ANIMATION: Stopping animation loop');
      isAnimatingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        console.log('🎬 ANIMATION: Cleaning up animation frame');
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isAnimatingRef.current = false;
    };
  }, [isPlaying, animationLoop]);

  // Update canvas when currentTime changes (for manual scrubbing)
  useEffect(() => {
      console.log('🎬 ANIMATION: Manual time update to:', currentTime.toFixed(2) + 's');
      updateCanvas(currentTime);
  }, [currentTime, isPlaying, updateCanvas]);

  // Log keyframe changes
  useEffect(() => {
    console.log('🎬 ANIMATION: Keyframes updated, total count:', keyframes.length);
    keyframes.forEach(keyframe => {
      console.log('🎬 ANIMATION: Keyframe -', keyframe.objectId, keyframe.property, 'at relative time', keyframe.relativeTime + 's', '=', keyframe.value);
    });
  }, [keyframes]);

  // UPDATED: Utility functions for adding keyframes with relative time
  const addKeyframe = useCallback((objectId: string, property: string, relativeTime: number, value: any, easing: string = 'linear') => {
    const keyframe = {
      id: `keyframe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      objectId,
      property,
      relativeTime, // CHANGED: Use relative time instead of absolute time
      value,
      easing,
    };

    console.log('🎬 ANIMATION: Adding keyframe with relative time:', keyframe);
    useProjectStore.getState().addKeyframe(keyframe);
  }, []);

  const removeKeyframe = useCallback((keyframeId: string) => {
    console.log('🎬 ANIMATION: Removing keyframe:', keyframeId);
    useProjectStore.getState().removeKeyframe(keyframeId);
  }, []);

  // Expose utility functions
  return {
    addKeyframe,
    removeKeyframe,
    updateCanvas,
  };
};
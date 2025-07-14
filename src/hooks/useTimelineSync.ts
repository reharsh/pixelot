import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import * as fabric from 'fabric';

/**
 * Hook to synchronize timeline clips with canvas object visibility
 * Objects should only be visible when the playhead is within their timeline duration
 * AND their track is visible
 */
export const useTimelineSync = () => {
  const {
    canvasInstance,
    tracks,
    currentTime,
  } = useProjectStore();

  // Update canvas object visibility based on timeline position AND track visibility
  const updateCanvasVisibility = useCallback(() => {
    if (!canvasInstance) {
      console.log('🔄 TIMELINE SYNC: No canvas instance available');
      return;
    }

    console.log('🔄 TIMELINE SYNC: Updating canvas visibility at time:', currentTime.toFixed(2) + 's');
    
    const objects = canvasInstance.getObjects();
    console.log('🔄 TIMELINE SYNC: Found', objects.length, 'objects on canvas');

    // Create a map of Fabric.js objects by their ID for quick lookup
    const fabricObjectsMap = new Map<string, fabric.Object>();
    objects.forEach(obj => {
      const objectId = (obj as any).id;
      if (objectId) {
        fabricObjectsMap.set(objectId, obj);
      }
    });

    let visibilityChanged = false;

    // Handle orphaned objects (objects without corresponding timeline clips)
    objects.forEach(obj => {
      const objectId = (obj as any).id;
      if (!objectId) {
        console.log('🔄 TIMELINE SYNC: Object has no ID, skipping');
        return;
      }

      // Check if this object has a corresponding timeline clip
      let hasCorrespondingClip = false;
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (clip.canvasObjectId === objectId) {
            hasCorrespondingClip = true;
            break;
          }
        }
        if (hasCorrespondingClip) break;
      }

      // If object has no corresponding timeline clip, keep it visible (e.g., welcome text)
      if (!hasCorrespondingClip && !obj.visible) {
        console.log('🔄 TIMELINE SYNC: Making orphaned object visible:', objectId);
        obj.set('visible', true);
        visibilityChanged = true;
      }
    });

    // Iterate through tracks and their clips to determine visibility
    tracks.forEach(track => {
      // Determine if the track itself is visible. Default to true if undefined.
      const trackIsVisible = track.isVisible !== false; 
      console.log('🔄 TIMELINE SYNC: Track', track.name, 'visibility:', trackIsVisible);
      
      track.clips.forEach(clip => {
        if (!clip.canvasObjectId) {
          return; // Skip clips without a canvas object
        }

        const fabricObj = fabricObjectsMap.get(clip.canvasObjectId);
        if (!fabricObj) {
          console.log('🔄 TIMELINE SYNC: Canvas object not found for clip:', clip.canvasObjectId);
          return;
        }

        // Determine if the object should be visible based on:
        // 1. Playhead position within clip duration
        // 2. Track visibility state
        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;
        const shouldBeVisibleByTime = currentTime >= clipStartTime && currentTime <= clipEndTime;
        
        // An object is visible only if its track is visible AND the playhead is within its time range
        const shouldBeVisible = shouldBeVisibleByTime && trackIsVisible;

        if (fabricObj.visible !== shouldBeVisible) {
          console.log('🔄 TIMELINE SYNC: Changing visibility for object', clip.canvasObjectId, 'from', fabricObj.visible, 'to', shouldBeVisible);
          console.log('🔄 TIMELINE SYNC: Clip time range:', clipStartTime.toFixed(2) + 's', 'to', clipEndTime.toFixed(2) + 's', 'Track visible:', trackIsVisible, 'Time visible:', shouldBeVisibleByTime);
          fabricObj.set('visible', shouldBeVisible);
          visibilityChanged = true;
        }
      });
    });

    // Re-render canvas if any visibility changed
    if (visibilityChanged) {
      console.log('🔄 TIMELINE SYNC: Visibility changes detected, re-rendering canvas');
      canvasInstance.renderAll();
    } else {
      console.log('🔄 TIMELINE SYNC: No visibility changes needed');
    }
  }, [canvasInstance, tracks, currentTime]);

  // Update visibility when current time changes
  useEffect(() => {
    updateCanvasVisibility();
  }, [updateCanvasVisibility]);

  // Update visibility when tracks change
  useEffect(() => {
    console.log('🔄 TIMELINE SYNC: Tracks changed, updating visibility');
    updateCanvasVisibility();
  }, [tracks, updateCanvasVisibility]);

  // Return the update function for manual calls if needed
  return {
    updateCanvasVisibility,
  };
};
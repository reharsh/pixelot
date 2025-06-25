import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';

/**
 * Hook to synchronize the Z-index of Fabric.js objects with the track order
 * Tracks at lower indices are rendered at the back (lower Z-index)
 * Tracks at higher indices are rendered at the front (higher Z-index)
 */
export const useCanvasZIndexSync = () => {
  const {
    canvasInstance,
    tracks,
  } = useProjectStore();

  // Synchronize canvas Z-index with track order
  const syncCanvasZIndex = useCallback(() => {
    if (!canvasInstance) {
      console.log('🎨 Z-INDEX SYNC: No canvas instance available');
      return;
    }

    console.log('🎨 Z-INDEX SYNC: Synchronizing canvas Z-index with track order');
    console.log('🎨 Z-INDEX SYNC: Track count:', tracks.length);

    const objects = canvasInstance.getObjects();
    console.log('🎨 Z-INDEX SYNC: Canvas objects count:', objects.length);

    // Create a map of canvas object IDs to their desired Z-index based on track order
    const objectZIndexMap = new Map<string, number>();

    tracks.forEach((track, trackIndex) => {
      console.log('🎨 Z-INDEX SYNC: Processing track', trackIndex, ':', track.name);
      
      track.clips.forEach((clip) => {
        if (clip.canvasObjectId) {
          // Track index determines Z-index: lower track index = lower Z-index (back)
          objectZIndexMap.set(clip.canvasObjectId, trackIndex);
          console.log('🎨 Z-INDEX SYNC: Mapping object', clip.canvasObjectId, 'to Z-index', trackIndex);
        }
      });
    });

    console.log('🎨 Z-INDEX SYNC: Object Z-index map size:', objectZIndexMap.size);

    // Apply Z-index to canvas objects using the correct Fabric.js method
    let changesApplied = 0;
    objects.forEach((obj) => {
      const objectId = (obj as any).id;
      if (!objectId) {
        console.log('🎨 Z-INDEX SYNC: Object has no ID, skipping');
        return;
      }

      // Check if this is a group or active selection - these don't support moveTo
      if (obj.type === 'group' || obj.type === 'activeSelection') {
        console.log('🎨 Z-INDEX SYNC: Skipping group/activeSelection object', objectId, 'type:', obj.type);
        return;
      }

      const desiredZIndex = objectZIndexMap.get(objectId);
      if (desiredZIndex !== undefined) {
        const currentIndex = canvasInstance.getObjects().indexOf(obj);
        
        if (currentIndex !== desiredZIndex) {
          console.log('🎨 Z-INDEX SYNC: Moving object', objectId, 'from index', currentIndex, 'to', desiredZIndex);
          
          // Verify the object has the moveTo method before calling it
          if (typeof obj.moveTo === 'function') {
            obj.moveTo(desiredZIndex);
            changesApplied++;
          } else {
            console.warn('🎨 Z-INDEX SYNC: Object', objectId, 'does not have moveTo method, type:', obj.type);
          }
        } else {
          console.log('🎨 Z-INDEX SYNC: Object', objectId, 'already at correct Z-index', desiredZIndex);
        }
      } else {
        console.log('🎨 Z-INDEX SYNC: No Z-index mapping found for object', objectId, '(orphaned object)');
      }
    });

    if (changesApplied > 0) {
      console.log('🎨 Z-INDEX SYNC: Applied', changesApplied, 'Z-index changes, re-rendering canvas');
      canvasInstance.renderAll();
    } else {
      console.log('🎨 Z-INDEX SYNC: No Z-index changes needed');
    }
  }, [canvasInstance, tracks]);

  // Sync Z-index when tracks change
  useEffect(() => {
    console.log('🎨 Z-INDEX SYNC: Tracks changed, triggering Z-index sync');
    syncCanvasZIndex();
  }, [syncCanvasZIndex]);

  // Sync Z-index when canvas instance changes
  useEffect(() => {
    if (canvasInstance) {
      console.log('🎨 Z-INDEX SYNC: Canvas instance changed, triggering Z-index sync');
      syncCanvasZIndex();
    }
  }, [canvasInstance, syncCanvasZIndex]);

  // Return the sync function for manual calls if needed
  return {
    syncCanvasZIndex,
  };
};
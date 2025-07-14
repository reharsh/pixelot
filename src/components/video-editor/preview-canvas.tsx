import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { Trash2, RotateCcw, ZoomIn, ZoomOut, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/projectStore';
import { createUUID } from '@/lib/uuid';
import { useCanvasZIndexSync } from '@/hooks/useCanvasZIndexSync';
import { useTimelineSync } from '@/hooks/useTimelineSync';

const PreviewCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1920, height: 1080 });

  // Get state and actions from the store
  const {
    objects,
    canvasHistory,
    historyIndex,
    zoomLevel,
    selectedClipId,
    tracks,
    isPlaying, // NEW: Get isPlaying state
    saveCanvasState,
    undo,
    redo,
    setZoomLevel,
    setCanvasInstance,
    addObject,
    updateObject,
    removeObject,
    setSelectedClipId,
    deleteSelectedAsset, // NEW: Use the comprehensive delete action
    applyObjectPropertyChange, // NEW: Use centralized property change action
  } = useProjectStore();

  // Initialize sync hooks
  useCanvasZIndexSync();
  useTimelineSync();

  // Helper function to map Fabric.js object type to our CanvasObject type
  const mapFabricTypeToCanvasType = (fabricType: string): string => {
    switch (fabricType) {
      case 'i-text':
      case 'text':
        return 'text';
      case 'rect':
        return 'rect';
      case 'circle':
        return 'circle';
      case 'triangle':
        return 'triangle';
      case 'image':
        return 'image';
      case 'group':
        return 'group';
      default:
        return fabricType;
    }
  };

  // Helper function to extract CanvasObject properties from Fabric.js object
  const extractCanvasObjectFromFabric = (fabricObj: fabric.Object): any => {
    const baseProps = {
      id: (fabricObj as any).id || createUUID(),
      type: mapFabricTypeToCanvasType(fabricObj.type || 'unknown'),
      left: fabricObj.left || 0,
      top: fabricObj.top || 0,
      width: fabricObj.width || 0,
      height: fabricObj.height || 0,
      scaleX: fabricObj.scaleX || 1,
      scaleY: fabricObj.scaleY || 1,
      angle: fabricObj.angle || 0,
      flipX: fabricObj.flipX || false,
      flipY: fabricObj.flipY || false,
      fill: fabricObj.fill || '#000000',
      stroke: fabricObj.stroke || '',
      strokeWidth: fabricObj.strokeWidth || 0,
      opacity: fabricObj.opacity || 1,
      visible: fabricObj.visible !== false,
      originX: fabricObj.originX || 'left',
      originY: fabricObj.originY || 'top',
      selectable: fabricObj.selectable !== false,
      evented: fabricObj.evented !== false,
    };

    // Add text-specific properties
    if (fabricObj.type === 'i-text' || fabricObj.type === 'text') {
      const textObj = fabricObj as fabric.Text;
      return {
        ...baseProps,
        text: textObj.text || '',
        fontFamily: textObj.fontFamily || 'Arial',
        fontSize: textObj.fontSize || 20,
        fontWeight: textObj.fontWeight || 'normal',
      };
    }

    // Add image-specific properties
    if (fabricObj.type === 'image') {
      const imageObj = fabricObj as fabric.Image;
      return {
        ...baseProps,
        src: (imageObj as any).src || '',
      };
    }

    return baseProps;
  };

  // Calculate responsive canvas size
  const calculateCanvasSize = useCallback(() => {
    if (!containerRef.current) return { width: 1920, height: 1080 };

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    
    const aspectRatio = 16 / 9;
    
    let width = containerWidth;
    let height = width / aspectRatio;
    
    if (height > containerHeight) {
      height = containerHeight;
      width = height * aspectRatio;
    }
    
    width = Math.max(width, 400);
    height = Math.max(height, 225);
    
    return { width: Math.floor(width), height: Math.floor(height) };
  }, []);

  // Initialize the canvas only once
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    console.log('🎨 CANVAS: Initializing Fabric.js canvas');
    console.log('📐 CANVAS: Initial canvas size:', canvasSize);

    // FIX 1: Extend fabric.Object.prototype.toObject to include custom 'id' property
    // This ensures IDs persist through undo/redo operations
    const originalToObject = fabric.Object.prototype.toObject;
    fabric.Object.prototype.toObject = function(propertiesToInclude) {
      return originalToObject.call(this, (propertiesToInclude || []).concat(['id']));
    };
    console.log('🔧 CANVAS: Extended fabric.Object.prototype.toObject to include ID persistence');

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: '#000000',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    
    // Store canvas instance in Zustand store
    setCanvasInstance(canvas);
    console.log('🏪 CANVAS: Canvas instance stored in Zustand store');

    // Add event listeners with detailed logging and store synchronization
    canvas.on('selection:created', (e) => {
      const selectedObj = e.selected?.[0];
      setSelectedObject(selectedObj || null);
      
      console.log('🎯 SELECTION: Object selected');
      console.log('📋 SELECTION: Selected object details:', selectedObj?.toJSON());
      
      // Canvas to Timeline Sync
      if (selectedObj) {
        const objectId = (selectedObj as any).id;
        if (objectId) {
          console.log('🔄 SYNC: Looking for clip with canvas object ID:', objectId);
          
          // Find the corresponding timeline clip
          const currentTracks = useProjectStore.getState().tracks;
          let foundClip = null;
          
          for (const track of currentTracks) {
            for (const clip of track.clips) {
              if (clip.canvasObjectId === objectId) {
                foundClip = clip;
                break;
              }
            }
            if (foundClip) break;
          }
          
          if (foundClip) {
            console.log('🔄 SYNC: Found corresponding clip:', foundClip.id);
            setSelectedClipId(foundClip.id);
          } else {
            console.log('🔄 SYNC: No corresponding clip found for object:', objectId);
          }
        }
      }
    });

    canvas.on('selection:updated', (e) => {
      const selectedObj = e.selected?.[0];
      setSelectedObject(selectedObj || null);
      
      console.log('🔄 SELECTION: Selection updated');
      console.log('📋 SELECTION: Updated selected object details:', selectedObj?.toJSON());
      
      // Canvas to Timeline Sync
      if (selectedObj) {
        const objectId = (selectedObj as any).id;
        if (objectId) {
          console.log('🔄 SYNC: Looking for clip with canvas object ID:', objectId);
          
          // Find the corresponding timeline clip
          const currentTracks = useProjectStore.getState().tracks;
          let foundClip = null;
          
          for (const track of currentTracks) {
            for (const clip of track.clips) {
              if (clip.canvasObjectId === objectId) {
                foundClip = clip;
                break;
              }
            }
            if (foundClip) break;
          }
          
          if (foundClip) {
            console.log('🔄 SYNC: Found corresponding clip:', foundClip.id);
            setSelectedClipId(foundClip.id);
          } else {
            console.log('🔄 SYNC: No corresponding clip found for object:', objectId);
          }
        }
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
      console.log('❌ SELECTION: Selection cleared');
      
      // Clear timeline selection as well
      setSelectedClipId(null);
    });

    // Canvas-to-Store synchronization event listeners
    canvas.on('object:added', (e) => {
      const fabricObj = e.target;
      if (!fabricObj) return;

      console.log('➕ OBJECT: Object added to canvas');
      console.log('📋 OBJECT: Added object details:', fabricObj.toJSON());
      console.log('🔍 OBJECT DEBUG: Object type:', fabricObj.type);
      console.log('🔍 OBJECT DEBUG: Object ID:', (fabricObj as any).id);
      console.log('🔍 OBJECT DEBUG: Object dimensions:', fabricObj.width, 'x', fabricObj.height);
      console.log('🔍 OBJECT DEBUG: Object position:', fabricObj.left, ',', fabricObj.top);
      
      // Assign unique ID if not present
      if (!(fabricObj as any).id) {
        (fabricObj as any).id = createUUID();
        console.log('🆔 OBJECT: Assigned unique ID to object:', (fabricObj as any).id);
      }
      
      // Extract CanvasObject from Fabric.js object
      const canvasObject = extractCanvasObjectFromFabric(fabricObj);
      console.log('🏪 OBJECT: Adding object to store:', canvasObject);
      
      // Add to store (but prevent infinite loops by checking if it's already there)
      const existingObject = objects.find(obj => obj.id === canvasObject.id);
      if (!existingObject) {
        addObject(canvasObject);
      }
      
      // Save canvas state for undo/redo (only if not playing)
      if (canvasHistory.length > 0 && !isPlaying) {
        const canvasState = JSON.stringify(canvas.toJSON());
        console.log('💾 HISTORY: Saving canvas state after object addition');
        saveCanvasState(canvasState);
      }
    });

    canvas.on('object:removed', (e) => {
      const fabricObj = e.target;
      if (!fabricObj) return;

      console.log('🗑️ OBJECT: Object removed from canvas');
      console.log('📋 OBJECT: Removed object details:', fabricObj.toJSON());
      
      const objectId = (fabricObj as any).id;
      if (objectId) {
        console.log('🏪 OBJECT: Removing object from store:', objectId);
        removeObject(objectId);
      }
      
      // Save canvas state for undo/redo (only if not playing)
      if (!isPlaying) {
        const canvasState = JSON.stringify(canvas.toJSON());
        console.log('💾 HISTORY: Saving canvas state after object removal');
        saveCanvasState(canvasState);
      }
    });

    canvas.on('object:modified', (e) => {
      const fabricObj = e.target;
      if (!fabricObj || isPlaying) return; // NEW: Skip during playback

      console.log('✏️ OBJECT: Object modified by user');
      console.log('📋 OBJECT: Modified object details:', fabricObj.toJSON());
      
      const objectId = (fabricObj as any).id;
      if (objectId) {
        // Extract updated properties
        const updatedProperties = extractCanvasObjectFromFabric(fabricObj);
        console.log('🏪 OBJECT: Processing property changes for object:', objectId);
        
        // NEW: Use centralized property change action for each changed property
        const propertiesToCheck = ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'opacity', 'fill'];
        
        propertiesToCheck.forEach(property => {
          if (updatedProperties[property] !== undefined) {
            applyObjectPropertyChange(objectId, property, updatedProperties[property]);
          }
        });
        
        // Handle text-specific properties
        if (updatedProperties.type === 'text') {
          const textProperties = ['text', 'fontSize', 'fontWeight', 'fontFamily'];
          textProperties.forEach(property => {
            if (updatedProperties[property] !== undefined) {
              applyObjectPropertyChange(objectId, property, updatedProperties[property]);
            }
          });
        }
      }
      
      // Save canvas state for undo/redo
      const canvasState = JSON.stringify(canvas.toJSON());
      console.log('💾 HISTORY: Saving canvas state after object modification');
      saveCanvasState(canvasState);
    });

    canvas.on('object:moving', (e) => {
      console.log('🚚 OBJECT: Object being moved');
      console.log('📍 OBJECT: Current position:', { 
        left: e.target?.left, 
        top: e.target?.top 
      });
    });

    canvas.on('object:scaling', (e) => {
      console.log('📏 OBJECT: Object being scaled');
      console.log('📐 OBJECT: Current scale:', { 
        scaleX: e.target?.scaleX, 
        scaleY: e.target?.scaleY 
      });
    });

    canvas.on('object:rotating', (e) => {
      console.log('🔄 OBJECT: Object being rotated');
      console.log('🌀 OBJECT: Current angle:', e.target?.angle);
    });

    // Save initial empty state
    setTimeout(() => {
      const initialState = JSON.stringify(canvas.toJSON());
      console.log('💾 HISTORY: Saving initial empty canvas state');
      saveCanvasState(initialState);
    }, 100);

    // Cleanup function
    return () => {
      console.log('🧹 CANVAS: Disposing canvas on unmount');
      setCanvasInstance(null);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [saveCanvasState, setCanvasInstance]);

  // NEW: Store-to-Canvas synchronization - Apply property changes from store to canvas
  useEffect(() => {
    if (!fabricCanvasRef.current || isPlaying) return; // NEW: Skip during playback to prevent conflicts

    console.log('🔄 STORE-TO-CANVAS: Syncing store object changes to canvas');
    
    const canvas = fabricCanvasRef.current;
    const fabricObjects = canvas.getObjects();
    
    // Create a map of Fabric.js objects by their ID for quick lookup
    const fabricObjectsMap = new Map<string, fabric.Object>();
    fabricObjects.forEach(obj => {
      const objectId = (obj as any).id;
      if (objectId) {
        fabricObjectsMap.set(objectId, obj);
      }
    });

    let hasChanges = false;

    // Apply store object properties to corresponding Fabric.js objects
    objects.forEach(storeObject => {
      const fabricObj = fabricObjectsMap.get(storeObject.id);
      
      if (fabricObj) {
        console.log('🔄 STORE-TO-CANVAS: Applying store properties to object:', storeObject.id);
        
        // Apply all properties from store to Fabric.js object
        const propertiesToApply: any = {
          left: storeObject.left,
          top: storeObject.top,
          width: storeObject.width,
          height: storeObject.height,
          scaleX: storeObject.scaleX,
          scaleY: storeObject.scaleY,
          angle: storeObject.angle,
          flipX: storeObject.flipX,
          flipY: storeObject.flipY,
          fill: storeObject.fill,
          stroke: storeObject.stroke,
          strokeWidth: storeObject.strokeWidth,
          opacity: storeObject.opacity,
          visible: storeObject.visible,
        };

        // Add text-specific properties
        if (storeObject.type === 'text' && (fabricObj.type === 'text' || fabricObj.type === 'i-text')) {
          propertiesToApply.text = storeObject.text;
          propertiesToApply.fontSize = storeObject.fontSize;
          propertiesToApply.fontWeight = storeObject.fontWeight;
          propertiesToApply.fontFamily = storeObject.fontFamily;
        }

        // Apply properties to Fabric.js object
        fabricObj.set(propertiesToApply);
        hasChanges = true;
        
        console.log('🔄 STORE-TO-CANVAS: Applied properties:', propertiesToApply);
      }
    });

    // Re-render canvas if any changes were applied
    if (hasChanges) {
      console.log('🔄 STORE-TO-CANVAS: Re-rendering canvas with updated properties');
      canvas.renderAll();
    }
  }, [objects, isPlaying]);

  // FIX 2: Track Actions - Move Fabric.js updates to useEffect watching tracks
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    console.log('🎛️ TRACK ACTIONS: Syncing track states with canvas objects');
    
    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.canvasObjectId) {
          const fabricObj = objects.find(obj => (obj as any).id === clip.canvasObjectId);
          
          if (fabricObj) {
            console.log('🎛️ TRACK ACTIONS: Updating object', clip.canvasObjectId, 'for track', track.id);
            
            // Apply track visibility
            fabricObj.set('visible', track.isVisible !== false);
            
            // Apply track lock state
            fabricObj.set('selectable', !track.isLocked);
            fabricObj.set('evented', !track.isLocked);
            
            console.log('🎛️ TRACK ACTIONS: Object updated - visible:', track.isVisible !== false, 'selectable:', !track.isLocked);
          }
        }
      });
    });
    
    canvas.renderAll();
    console.log('🎛️ TRACK ACTIONS: Canvas re-rendered with track state updates');
  }, [tracks]);

  // FIX 2: Timeline to Canvas Sync - Listen for selectedClipId changes with improved selection
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    console.log('🔄 SYNC: Timeline selection changed to:', selectedClipId);
    
    if (selectedClipId) {
      // Find the corresponding timeline clip
      let foundClip = null;
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (clip.id === selectedClipId) {
            foundClip = clip;
            break;
          }
        }
        if (foundClip) break;
      }
      
      if (foundClip && foundClip.canvasObjectId) {
        console.log('🔄 SYNC: Looking for canvas object with ID:', foundClip.canvasObjectId);
        
        // Find the corresponding canvas object
        const objects = fabricCanvasRef.current.getObjects();
        const fabricObj = objects.find(obj => (obj as any).id === foundClip.canvasObjectId);
        
        if (fabricObj) {
          console.log('🔄 SYNC: Found canvas object, setting as active');
          // FIX 2: Clear any existing selection first for better visual feedback
          fabricCanvasRef.current.discardActiveObject();
          fabricCanvasRef.current.setActiveObject(fabricObj);
          fabricCanvasRef.current.renderAll();
          setSelectedObject(fabricObj);
        } else {
          console.log('🔄 SYNC: Canvas object not found for clip:', foundClip.canvasObjectId);
        }
      }
    } else {
      // Clear canvas selection
      console.log('🔄 SYNC: Clearing canvas selection');
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.renderAll();
      setSelectedObject(null);
    }
  }, [selectedClipId, tracks]);

  // Effect to sync Fabric.js canvas with our global objects state
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    console.log('🔄 SYNC: Syncing canvas with global objects state');
    console.log('📊 STORE STATE: Objects in store:', objects.length);
    console.log('📊 CANVAS STATE: Objects on canvas:', canvas.getObjects().length);

    canvas.setDimensions(canvasSize);
    canvas.renderAll();
  }, [objects, canvasSize]);

  // Handle window resize and panel changes
  useEffect(() => {
    const handleResize = () => {
      const newSize = calculateCanvasSize();
      console.log('📐 RESIZE: Canvas size changing from', canvasSize, 'to', newSize);
      setCanvasSize(newSize);
      
      if (fabricCanvasRef.current) {
        const objects = fabricCanvasRef.current.getObjects();
        console.log('📊 RESIZE: Objects before resize:', objects.length);
        
        fabricCanvasRef.current.setDimensions(newSize);
        
        const scaleX = newSize.width / canvasSize.width;
        const scaleY = newSize.height / canvasSize.height;
        
        if (Math.abs(scaleX - 1) > 0.1 || Math.abs(scaleY - 1) > 0.1) {
          console.log('📏 RESIZE: Scaling objects proportionally', { scaleX, scaleY });
          objects.forEach(obj => {
            if (obj.left && obj.top) {
              obj.set({
                left: obj.left * scaleX,
                top: obj.top * scaleY,
                scaleX: (obj.scaleX || 1) * Math.min(scaleX, scaleY),
                scaleY: (obj.scaleY || 1) * Math.min(scaleX, scaleY)
              });
            }
          });
        }
        
        fabricCanvasRef.current.renderAll();
        console.log('📐 RESIZE: Canvas resize complete');
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    setTimeout(handleResize, 100);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateCanvasSize, canvasSize.width, canvasSize.height]);

  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;

    console.log('🧹 CLEAR: Clearing entire canvas');
    console.log('📊 CLEAR: Objects before clear:', fabricCanvasRef.current.getObjects().length);

    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = '#000000';
    fabricCanvasRef.current.renderAll();
    setSelectedObject(null);
    
    const canvasState = JSON.stringify(fabricCanvasRef.current.toJSON());
    console.log('💾 CLEAR: Saving canvas state after clear');
    console.log('📊 CLEAR: Canvas is now empty');
    saveCanvasState(canvasState);
  };

  const handleUndo = () => {
    if (!fabricCanvasRef.current) return;

    console.log('↩️ UNDO: Performing undo operation');
    console.log('📊 UNDO: Current history index:', historyIndex);
    console.log('📊 UNDO: History length:', canvasHistory.length);

    if (historyIndex <= 0) {
      console.log('❌ UNDO: Cannot undo, already at beginning');
      return;
    }

    // Call the store's undo action
    undo();
    
    // Get the updated state from the store after undo
    const { canvasHistory: updatedCanvasHistory, historyIndex: updatedHistoryIndex } = useProjectStore.getState();
    const canvasState = updatedCanvasHistory[updatedHistoryIndex];
    
    console.log('📊 UNDO: Loading state from history index:', updatedHistoryIndex);
    console.log('📊 UNDO: Canvas state to load:', canvasState);
    
    fabricCanvasRef.current.loadFromJSON(canvasState, () => {
      fabricCanvasRef.current?.renderAll();
      setSelectedObject(null);
      console.log('✅ UNDO: Undo operation completed');
      console.log('📊 UNDO: Objects on canvas after undo:', fabricCanvasRef.current?.getObjects().length);
    });
  };

  const handleRedo = () => {
    if (!fabricCanvasRef.current) return;

    console.log('↪️ REDO: Performing redo operation');
    console.log('📊 REDO: Current history index:', historyIndex);
    console.log('📊 REDO: History length:', canvasHistory.length);

    if (historyIndex >= canvasHistory.length - 1) {
      console.log('❌ REDO: Cannot redo, already at end');
      return;
    }

    // Call the store's redo action
    redo();
    
    // Get the updated state from the store after redo
    const { canvasHistory: updatedCanvasHistory, historyIndex: updatedHistoryIndex } = useProjectStore.getState();
    const canvasState = updatedCanvasHistory[updatedHistoryIndex];
    
    console.log('📊 REDO: Loading state from history index:', updatedHistoryIndex);
    console.log('📊 REDO: Canvas state to load:', canvasState);
    
    fabricCanvasRef.current.loadFromJSON(canvasState, () => {
      fabricCanvasRef.current?.renderAll();
      setSelectedObject(null);
      console.log('✅ REDO: Redo operation completed');
      console.log('📊 REDO: Objects on canvas after redo:', fabricCanvasRef.current?.getObjects().length);
    });
  };

  const zoomIn = () => {
    if (!fabricCanvasRef.current) return;

    const newZoom = Math.min(zoomLevel * 1.2, 3);
    console.log('🔍 ZOOM IN: Zooming in from', Math.round(zoomLevel * 100) + '%', 'to', Math.round(newZoom * 100) + '%');
    
    setZoomLevel(newZoom);
    fabricCanvasRef.current.setZoom(newZoom);
    fabricCanvasRef.current.renderAll();
    
    console.log('✅ ZOOM IN: Zoom in completed');
  };

  const zoomOut = () => {
    if (!fabricCanvasRef.current) return;

    const newZoom = Math.max(zoomLevel / 1.2, 0.1);
    console.log('🔍 ZOOM OUT: Zooming out from', Math.round(zoomLevel * 100) + '%', 'to', Math.round(newZoom * 100) + '%');
    
    setZoomLevel(newZoom);
    fabricCanvasRef.current.setZoom(newZoom);
    fabricCanvasRef.current.renderAll();
    
    console.log('✅ ZOOM OUT: Zoom out completed');
  };

  // Log store state changes
  useEffect(() => {
    console.log('📊 STORE STATE: Canvas history updated');
    console.log('📊 STORE STATE: History length:', canvasHistory.length);
    console.log('📊 STORE STATE: Current history index:', historyIndex);
  }, [canvasHistory, historyIndex]);

  useEffect(() => {
    console.log('📊 STORE STATE: Zoom level changed to:', Math.round(zoomLevel * 100) + '%');
  }, [zoomLevel]);

  useEffect(() => {
    console.log('📊 STORE STATE: Objects in store updated:', objects.length);
    objects.forEach(obj => {
      console.log('📊 STORE OBJECT:', obj.id, obj.type, `(${obj.left}, ${obj.top})`);
    });
  }, [objects]);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div 
        ref={containerRef}
        className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden p-4 min-h-0 relative"
      >
        <div className="relative border border-gray-600 shadow-2xl bg-black">
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
            }}
          />
          
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {canvasSize.width} × {canvasSize.height} • {Math.round(zoomLevel * 100)}%
          </div>
        </div>

        {/* Twitter Badge - Moved to left side */}
        <div className="absolute bottom-6 left-6 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-lg backdrop-blur-sm border">
          built with <Heart size={10}/> by 
          <a 
            href="https://x.com/_finkd" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://pbs.twimg.com/profile_images/1942942309626126337/wzUZxCQY_400x400.jpg" 
              alt="veyoog profile" 
              className="w-4 h-4 rounded-full inline-block align-middle"
            />
            veyoog
          </a>
        </div>

        <div className="absolute bottom-6 right-6 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 rounded-lg shadow-lg bg-background/90 backdrop-blur-sm border hover:bg-accent"
            onClick={zoomOut}
            disabled={zoomLevel <= 0.1}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 rounded-lg shadow-lg bg-background/90 backdrop-blur-sm border hover:bg-accent"
            onClick={zoomIn}
            disabled={zoomLevel >= 3}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 rounded-lg shadow-lg bg-background/90 backdrop-blur-sm border hover:bg-accent"
            onClick={deleteSelectedAsset}
            disabled={!selectedClipId}
            title="Delete Selected Asset"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreviewCanvas;
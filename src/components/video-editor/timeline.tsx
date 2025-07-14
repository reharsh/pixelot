import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import {
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { 
  ZoomIn
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Track, TimelineClip } from '@/types/video-editor';
import { useProjectStore } from '@/store/projectStore';
import { createUUID } from '@/lib/uuid';
import TimelineTrack from './timeline-track';

interface TimelineProps {
  currentTime: number;
  duration: number;
  timelineZoom: number[];
  onTimelineZoomChange: (zoom: number[]) => void;
  onTimelineClick: (time: number) => void;
}

export interface TimelineRef {
  handleExternalAssetDrop: (dragData: any, event: DragEndEvent) => void;
}

const Timeline = forwardRef<TimelineRef, TimelineProps>(({
  currentTime,
  duration,
  timelineZoom,
  onTimelineZoomChange,
  onTimelineClick,
}, ref) => {
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackLabelsScrollRef = useRef<HTMLDivElement>(null);
  const trackContentScrollRef = useRef<HTMLDivElement>(null);

  // Track mouse position globally
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Get store state and actions
  const {
    tracks,
    selectedClipId,
    keyframes, // NEW: Get keyframes for visual feedback
    selectedKeyframeId, // NEW: Get selected keyframe
    setSelectedKeyframeId, // NEW: Set selected keyframe
    addTrack,
    setSelectedClipId,
    setDuration,
    addShapeToCanvas,
    addTextToCanvas,
    addImageToCanvas,
    addVideoToCanvas,
    updateClip, // NEW: Add updateClip action
    setCurrentTime, // NEW: For keyframe click navigation
  } = useProjectStore();

  // Droppable zones
  const { setNodeRef: setEmptyTimelineDroppableRef } = useDroppable({
    id: 'empty-timeline-droppable-area',
  });

  const { setNodeRef: setMainTimelineDroppableRef } = useDroppable({
    id: 'main-timeline-droppable-area',
  });

  // Base pixels per second at 100% zoom
  const basePixelsPerSecond = 10;
  const pixelsPerSecond = (basePixelsPerSecond * timelineZoom[0]) / 100;
  const scaledTimelineWidth = duration * pixelsPerSecond;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Global mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Scroll synchronization between track labels and content
  const handleTrackLabelsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (trackContentScrollRef.current) {
      trackContentScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleTrackContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (trackLabelsScrollRef.current) {
      trackLabelsScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  // Horizontal scroll synchronization between ruler and track content
  useEffect(() => {
    const rulerContainer = scrollContainerRef.current;
    const trackContainer = trackContentScrollRef.current;
    
    if (!rulerContainer || !trackContainer) return;

    let isRulerScrolling = false;
    let isTrackScrolling = false;

    const handleRulerScroll = () => {
      if (isTrackScrolling) return;
      isRulerScrolling = true;
      trackContainer.scrollLeft = rulerContainer.scrollLeft;
      requestAnimationFrame(() => {
        isRulerScrolling = false;
      });
    };

    const handleTrackScroll = () => {
      if (isRulerScrolling) return;
      isTrackScrolling = true;
      rulerContainer.scrollLeft = trackContainer.scrollLeft;
      requestAnimationFrame(() => {
        isTrackScrolling = false;
      });
    };

    rulerContainer.addEventListener('scroll', handleRulerScroll);
    trackContainer.addEventListener('scroll', handleTrackScroll);

    return () => {
      rulerContainer.removeEventListener('scroll', handleRulerScroll);
      trackContainer.removeEventListener('scroll', handleTrackScroll);
    };
  }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineContentRef.current || !trackContentScrollRef.current) return;
    
    const rect = timelineContentRef.current.getBoundingClientRect();
    const scrollLeft = trackContentScrollRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const newTime = (x / scaledTimelineWidth) * duration;
    onTimelineClick(Math.max(0, Math.min(duration, newTime)));
  }, [duration, scaledTimelineWidth, onTimelineClick]);

  // Calculate drop time using global mouse position
  const calculateDropTimeFromMouse = useCallback((): number => {
    if (!timelineContentRef.current || !trackContentScrollRef.current) {
      console.log('🎯 TIMELINE: Missing refs for drop calculation');
      return 0;
    }
    
    const rect = timelineContentRef.current.getBoundingClientRect();
    const scrollLeft = trackContentScrollRef.current.scrollLeft;
    const x = mousePosition.x - rect.left + scrollLeft;
    const dropTime = Math.max(0, (x / scaledTimelineWidth) * duration);
    
    console.log('🎯 TIMELINE: Drop calculation using global mouse position:');
    console.log('  - mousePosition.x:', mousePosition.x);
    console.log('  - rect.left:', rect.left);
    console.log('  - scrollLeft:', scrollLeft);
    console.log('  - x position:', x);
    console.log('  - scaledTimelineWidth:', scaledTimelineWidth);
    console.log('  - duration:', duration);
    console.log('  - calculated time:', dropTime);
    
    return dropTime;
  }, [mousePosition.x, scaledTimelineWidth, duration]);

  // Asset drop handler - UPDATED: Pass clip start time to canvas functions
  const handleAssetDrop = useCallback((dragData: any, time: number) => {
    console.log('🎯 TIMELINE: Processing asset drop (one-clip-per-track)');
    console.log('🎯 TIMELINE: Drag data:', dragData);
    console.log('🎯 TIMELINE: Drop time (clip start time):', time);

    const canvasObjectId = createUUID();
    let clipDuration = 5; // Default duration
    let newClip: TimelineClip;
    let trackName = 'New Track';

    if (dragData.type === 'media') {
      const asset = dragData.asset;
      clipDuration = asset.duration || 10; // Use asset duration or default to 10 seconds
      trackName = `${asset.name} Track`;
      
      newClip = {
        id: `clip_${Date.now()}`,
        assetId: asset.id,
        startTime: time,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: clipDuration,
        name: asset.name,
        type: asset.type,
        canvasObjectId
      };

      console.log('🎯 TIMELINE: Created media clip at time:', time);

      // UPDATED: Add corresponding object to canvas based on media type, passing clip start time
      if (asset.type === 'image' && asset.src) {
        console.log('🖼️ TIMELINE: Adding image to canvas with clip start time:', time);
        addImageToCanvas(asset.src, {}, canvasObjectId, time);
      } else if (asset.type === 'video' && asset.src) {
        console.log('🎬 TIMELINE: Adding video placeholder to canvas with clip start time:', time);
        addVideoToCanvas(asset.src, {}, canvasObjectId, time);
      } else if (asset.type === 'audio') {
        console.log('🎵 TIMELINE: Audio asset added to timeline (no canvas representation)');
      }
    } else if (dragData.type === 'shape') {
      trackName = `${dragData.shapeType.charAt(0).toUpperCase() + dragData.shapeType.slice(1)} Track`;
      
      newClip = {
        id: `clip_${Date.now()}`,
        assetId: `shape_${dragData.shapeType}`,
        startTime: time,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: clipDuration,
        name: `${dragData.shapeType.charAt(0).toUpperCase() + dragData.shapeType.slice(1)} Shape`,
        type: 'image', // Shapes are treated as image type in timeline
        canvasObjectId
      };

      console.log('🔷 TIMELINE: Created shape clip at time:', time);

      // UPDATED: Add shape to canvas with clip start time
      console.log('🔷 TIMELINE: Adding shape to canvas with clip start time:', time);
      addShapeToCanvas(dragData.shapeType, dragData.properties, canvasObjectId, time);
    } else if (dragData.type === 'text') {
      trackName = 'Text Track';
      
      newClip = {
        id: `clip_${Date.now()}`,
        assetId: 'text_element',
        startTime: time,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: clipDuration,
        name: 'Text Element',
        type: 'text',
        canvasObjectId
      };

      console.log('📝 TIMELINE: Created text clip at time:', time);

      // UPDATED: Add text to canvas with clip start time
      console.log('📝 TIMELINE: Adding text to canvas with clip start time:', time);
      addTextToCanvas(dragData.textProperties, canvasObjectId, time);
    } else {
      console.log('❌ TIMELINE: Unknown drag data type:', dragData.type);
      return;
    }

    // Check if we need to extend the timeline duration
    const newEndTime = time + clipDuration;
    if (newEndTime > duration) {
      console.log('⏱️ TIMELINE: Extending timeline duration from', duration, 'to', newEndTime);
      setDuration(newEndTime);
    }

    // Always create a new track for this clip (one-clip-per-track design)
    const newTrack: Track = {
      id: createUUID(),
      name: trackName,
      clips: [newClip], // Only one clip per track
      isVisible: true,
      isMuted: false,
      isLocked: false,
    };

    console.log('🏪 TIMELINE: Adding new track using store action');
    addTrack(newTrack);
    console.log('✅ TIMELINE: Successfully added new track with clip');
  }, [addTrack, duration, setDuration, addShapeToCanvas, addTextToCanvas, addImageToCanvas, addVideoToCanvas]);

  // NEW: Handle clip manipulation drag end
  const handleClipDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const dragData = active.data.current;

    if (!dragData || !dragData.type.startsWith('clip-')) {
      return;
    }

    console.log('🎬 CLIP MANIPULATION: Handling clip drag end:', dragData.type);
    console.log('🎬 CLIP MANIPULATION: Delta:', delta);

    const { trackId, clipId, initialStartTime, initialDuration } = dragData;
    const deltaTimeSeconds = (delta.x / pixelsPerSecond);

    console.log('🎬 CLIP MANIPULATION: Delta time in seconds:', deltaTimeSeconds);

    let updates: Partial<TimelineClip> = {};

    switch (dragData.type) {
      case 'clip-move':
        // Move the entire clip
        const newStartTime = Math.max(0, initialStartTime + deltaTimeSeconds);
        updates = { startTime: newStartTime };
        console.log('🎬 CLIP MANIPULATION: Moving clip from', initialStartTime, 'to', newStartTime);
        break;

      case 'clip-resize-left':
        // Resize from the left (change start time and duration)
        const leftDelta = deltaTimeSeconds;
        const newLeftStartTime = Math.max(0, initialStartTime + leftDelta);
        const newLeftDuration = Math.max(0.1, initialDuration - leftDelta);
        
        updates = {
          startTime: newLeftStartTime,
          duration: newLeftDuration,
          trimStart: 0, // Reset trim start when resizing
        };
        console.log('🎬 CLIP MANIPULATION: Resizing left - start:', newLeftStartTime, 'duration:', newLeftDuration);
        break;

      case 'clip-resize-right':
        // Resize from the right (change duration only)
        const newRightDuration = Math.max(0.1, initialDuration + deltaTimeSeconds);
        
        updates = {
          duration: newRightDuration,
          trimEnd: newRightDuration, // Update trim end when resizing
        };
        console.log('🎬 CLIP MANIPULATION: Resizing right - duration:', newRightDuration);
        break;

      default:
        console.log('🎬 CLIP MANIPULATION: Unknown clip manipulation type:', dragData.type);
        return;
    }

    // Apply the updates
    updateClip(trackId, clipId, updates);
    console.log('🎬 CLIP MANIPULATION: Applied updates:', updates);
  }, [pixelsPerSecond, updateClip]);

  // External asset drop handler exposed via ref
  const handleExternalAssetDrop = useCallback((dragData: any, event: DragEndEvent) => {
    console.log('🎯 TIMELINE: External asset drop received');
    console.log('🎯 TIMELINE: Drag data:', dragData);
    console.log('🎯 TIMELINE: Event:', event);

    // Check if this is a clip manipulation drag
    if (dragData.type && dragData.type.startsWith('clip-')) {
      handleClipDragEnd(event);
      return;
    }

    // Use the global mouse position to calculate drop time
    const dropTime = calculateDropTimeFromMouse();
    console.log('🎯 TIMELINE: Final calculated drop time (clip start time):', dropTime);
    
    handleAssetDrop(dragData, dropTime);
  }, [handleAssetDrop, calculateDropTimeFromMouse, handleClipDragEnd]);

  // Expose the external drop handler via ref
  useImperativeHandle(ref, () => ({
    handleExternalAssetDrop,
  }), [handleExternalAssetDrop]);

  return (
    <div className="flex-1 border-t border-border flex flex-col bg-background">
      {/* Timeline Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <span className="font-medium">Timeline</span>
        <div className="flex items-center gap-2">
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <ZoomIn />
            <Slider
              value={timelineZoom}
              onValueChange={onTimelineZoomChange}
              min={25}
              max={400}
              step={25}
              className="w-20"
            />
            <span className="text-sm min-w-[3rem]">{timelineZoom[0]}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Fixed Track Labels Column */}
        <div className="w-48 flex-shrink-0 border-r border-border flex flex-col">
          {/* Track Labels Header */}
          <div className="h-8 bg-muted border-b border-border flex items-center px-2">
            <span className="text-xs font-medium">Tracks</span>
          </div>
          
          {/* Track Labels Scrollable Area */}
          <div 
            ref={trackLabelsScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={handleTrackLabelsScroll}
          >
            {tracks.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No tracks yet</p>
                <p className="text-xs">Drop assets to create tracks</p>
              </div>
            ) : (
              <SortableContext
                items={tracks.map(track => track.id)}
                strategy={verticalListSortingStrategy}
              >
                {tracks.map((track) => (
                  <TimelineTrack
                    key={`${track.id}-label`}
                    track={track}
                    duration={duration}
                    scaledTimelineWidth={scaledTimelineWidth}
                    selectedClip={selectedClipId}
                    onClipSelect={setSelectedClipId}
                    type="label"
                    // NEW: Pass keyframe-related props
                    keyframes={keyframes}
                    selectedKeyframeId={selectedKeyframeId}
                    setSelectedKeyframeId={setSelectedKeyframeId}
                    setCurrentTime={setCurrentTime}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </div>

        {/* Timeline Content Column - FIX 3: Remove w-full classes for proper scrolling */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Timeline Ruler - FIX 3: Remove w-full class */}
          <div className="h-8 border-b border-border bg-muted/50 relative overflow-hidden">
            <div 
              ref={scrollContainerRef}
              className="h-full overflow-x-auto overflow-y-hidden"
            >
              <div 
                className="h-full relative"
                style={{ width: `${Math.max(scaledTimelineWidth, 400)}px` }}
              >
                {/* Generate timestamp markers based on zoom level */}
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => {
                  // Show more frequent markers when zoomed in
                  const interval = timelineZoom[0] >= 200 ? 1 : timelineZoom[0] >= 100 ? 5 : 10;
                  if (i % interval !== 0) return null;
                  
                  const leftPosition = (i / duration) * scaledTimelineWidth;
                  
                  return (
                    <div
                      key={i}
                      className="absolute top-0 h-full flex items-center"
                      style={{ left: `${leftPosition}px` }}
                    >
                      <div className="w-px h-4 bg-border"></div>
                      <span className="text-xs text-muted-foreground ml-1">{formatTime(i)}</span>
                    </div>
                  );
                })}
                
                {/* Playhead */}
                <div
                  className="absolute top-0 w-px h-full bg-red-500 z-10"
                  style={{ left: `${(currentTime / duration) * scaledTimelineWidth}px` }}
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Track Content Scrollable Area - FIX 3: Remove w-full class */}
          <div 
            ref={trackContentScrollRef}
            className="flex-1 overflow-auto"
            onScroll={handleTrackContentScroll}
          >
            <div 
              ref={timelineContentRef}
              className="relative h-full"
              style={{ 
                width: `${Math.max(scaledTimelineWidth, 400)}px`,
                minHeight: `${Math.max(tracks.length * 48, 200)}px`
              }}
              onClick={handleTimelineClick}
            >
              {tracks.length === 0 ? (
                <div 
                  ref={setEmptyTimelineDroppableRef}
                  className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-lg"
                >
                  <div className="text-center">
                    <p className="text-lg font-medium">Drop assets here to create tracks</p>
                    <p className="text-sm">Drag media, shapes, or text from the assets panel</p>
                  </div>
                </div>
              ) : (
                <div ref={setMainTimelineDroppableRef}>
                  <SortableContext
                    items={tracks.map(track => track.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tracks.map((track) => (
                      <TimelineTrack
                        key={`${track.id}-content`}
                        track={track}
                        duration={duration}
                        scaledTimelineWidth={scaledTimelineWidth}
                        selectedClip={selectedClipId}
                        onClipSelect={setSelectedClipId}
                        type="content"
                        // NEW: Pass keyframe-related props
                        keyframes={keyframes}
                        selectedKeyframeId={selectedKeyframeId}
                        setSelectedKeyframeId={setSelectedKeyframeId}
                        setCurrentTime={setCurrentTime}
                      />
                    ))}
                  </SortableContext>
                </div>
              )}
              
              {/* Playhead overlay for track content */}
              <div
                className="absolute top-0 w-px h-full bg-red-500 z-20 pointer-events-none"
                style={{ left: `${(currentTime / duration) * scaledTimelineWidth}px` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';

export default Timeline;
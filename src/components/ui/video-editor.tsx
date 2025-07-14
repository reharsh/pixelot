import React, { useState, useRef } from 'react';
import { 
  DndContext, 
  DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { MediaAsset } from '@/types/video-editor';
import { useProjectStore } from '@/store/projectStore';
import { useAnimationEngine } from '@/hooks/useAnimationEngine';
import AssetsPanel from '@/components/video-editor/assets-panel';
import PreviewCanvas from '@/components/video-editor/preview-canvas';
import Timeline, { TimelineRef } from '@/components/video-editor/timeline';
import PlaybackControls from '@/components/video-editor/playback-controls';
import PropertyPanel from '@/components/video-editor/property-panel'; // NEW: Import PropertyPanel
import ExportDialog from '@/components/video-editor/export-dialog';
import { Button } from '@/components/ui/button'; // If not already imported

interface VideoEditorProps {
  onExport?: () => void;
  onSave?: () => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ onExport, onSave }) => {
  const timelineRef = useRef<TimelineRef>(null);
  
  // Get state from the global store
  const {
    currentTime,
    duration,
    timelineZoom,
    assets,
    setAssets,
    setCurrentTime,
    setTimelineZoom,
  } = useProjectStore();

  // Initialize the animation engine
  useAnimationEngine();

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('🎯 VIDEO EDITOR: Drag end event');
    console.log('🎯 VIDEO EDITOR: Active:', active.id, active.data.current);
    console.log('🎯 VIDEO EDITOR: Over:', over?.id);

    // Handle timeline drops via the timeline ref
    if (timelineRef.current && active.data.current) {
      timelineRef.current.handleExternalAssetDrop(active.data.current, event);
    }
  };

  const handleTimelineClick = (time: number) => {
    console.log('🎵 VIDEO EDITOR: Timeline clicked at time:', time);
    setCurrentTime(time);
  };

  const handleTimelineZoomChange = (zoom: number[]) => {
    console.log('🔍 VIDEO EDITOR: Timeline zoom changed to:', zoom[0] + '%');
    setTimelineZoom(zoom);
  };

  const handleAssetsChange = (newAssets: MediaAsset[]) => {
    console.log('📁 VIDEO EDITOR: Assets changed, count:', newAssets.length);
    setAssets(newAssets);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Assets Panel */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <AssetsPanel 
                assets={assets}
                onAssetsChange={handleAssetsChange}
              />
            </ResizablePanel>
            
            <ResizableHandle />
            
            {/* Main Content Area */}
            <ResizablePanel defaultSize={60} minSize={40}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                {/* Canvas Area */}
                <ResizablePanel defaultSize={70} minSize={30}>
                  <PreviewCanvas />
                </ResizablePanel>
                
                <ResizableHandle />
                
                {/* Timeline Area */}
                <ResizablePanel defaultSize={30} minSize={20}>
                  <Timeline
                    ref={timelineRef}
                    currentTime={currentTime}
                    duration={duration}
                    timelineZoom={timelineZoom}
                    assets={assets}
                    onTimelineClick={handleTimelineClick}
                    onTimelineZoomChange={handleTimelineZoomChange}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            
            <ResizableHandle />
            
            {/* NEW: Property Panel */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <PropertyPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <PlaybackControls />

        {/* Drag Overlay */}
        <DragOverlay>
          {/* You can customize the drag overlay here if needed */}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default VideoEditor;
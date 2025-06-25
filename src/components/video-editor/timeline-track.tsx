import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Volume2, VolumeX, Lock, Unlock, Zap, ZapOff, Diamond, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Track, TimelineClip } from '@/types/video-editor';
import { useProjectStore, Keyframe } from '@/store/projectStore';

interface TimelineTrackProps {
  track: Track;
  trackIndex: number;
  duration: number;
  scaledTimelineWidth: number;
  selectedClip: string | null;
  onClipSelect: (clipId: string | null) => void;
  onClipRemove: (trackId: string, clipId: string) => void;
  onClipUpdate: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  type: 'label' | 'content';
  // Keyframe-related props
  keyframes?: Keyframe[];
  selectedKeyframeId?: string | null;
  setSelectedKeyframeId?: (id: string | null) => void;
  setCurrentTime?: (time: number) => void;
}

// Keyframe Indicator Component
const KeyframeIndicator: React.FC<{
  keyframe: Keyframe;
  position: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  clipStartTime: number; // UPDATED: Add clip start time for display
}> = ({ keyframe, position, isSelected, onClick, onDelete, clipStartTime }) => {
  const [showDeleteButton, setShowDeleteButton] = React.useState(false);

  // UPDATED: Calculate global time for display
  const globalTime = clipStartTime + keyframe.relativeTime;

  return (
    <div
      className="absolute z-30 group"
      style={{ left: `${position}px`, top: '2px' }}
      onMouseEnter={() => setShowDeleteButton(true)}
      onMouseLeave={() => setShowDeleteButton(false)}
    >
      <div
        className={`w-3 h-3 cursor-pointer transition-all transform rotate-45 ${
          isSelected 
            ? 'bg-yellow-400 border-2 border-yellow-600 scale-125' 
            : 'bg-blue-400 border border-blue-600 hover:bg-blue-300 hover:scale-110'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={`Keyframe: ${keyframe.property} = ${keyframe.value} at ${globalTime.toFixed(2)}s (relative: ${keyframe.relativeTime.toFixed(2)}s)`}
      />
      
      {/* Delete button - only show when hovering and keyframe is selected */}
      {showDeleteButton && isSelected && (
        <Button
          variant="destructive"
          size="sm"
          className="absolute -top-8 -left-4 h-6 w-6 p-0 opacity-90 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete keyframe"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

// Draggable Clip Component for moving clips
const DraggableClip: React.FC<{
  clip: TimelineClip;
  trackId: string;
  duration: number;
  scaledTimelineWidth: number;
  selectedClip: string | null;
  onClipSelect: (clipId: string | null) => void;
  getTrackColor: (type: string) => string;
  // Keyframe-related props
  keyframes?: Keyframe[];
  selectedKeyframeId?: string | null;
  setSelectedKeyframeId?: (id: string | null) => void;
  setCurrentTime?: (time: number) => void;
}> = ({ 
  clip, 
  trackId, 
  duration, 
  scaledTimelineWidth, 
  selectedClip, 
  onClipSelect, 
  getTrackColor,
  keyframes = [],
  selectedKeyframeId,
  setSelectedKeyframeId,
  setCurrentTime
}) => {
  const { removeKeyframe } = useProjectStore();

  const {
    attributes: clipAttributes,
    listeners: clipListeners,
    setNodeRef: setClipNodeRef,
    isDragging: isClipDragging,
  } = useDraggable({
    id: `clip-move-${clip.id}`,
    data: {
      type: 'clip-move',
      trackId,
      clipId: clip.id,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
    },
  });

  // Left resize handle
  const {
    attributes: leftAttributes,
    listeners: leftListeners,
    setNodeRef: setLeftNodeRef,
    isDragging: isLeftDragging,
  } = useDraggable({
    id: `clip-resize-left-${clip.id}`,
    data: {
      type: 'clip-resize-left',
      trackId,
      clipId: clip.id,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
    },
  });

  // Right resize handle
  const {
    attributes: rightAttributes,
    listeners: rightListeners,
    setNodeRef: setRightNodeRef,
    isDragging: isRightDragging,
  } = useDraggable({
    id: `clip-resize-right-${clip.id}`,
    data: {
      type: 'clip-resize-right',
      trackId,
      clipId: clip.id,
      initialStartTime: clip.startTime,
      initialDuration: clip.duration,
    },
  });

  const clipWidth = (clip.duration / duration) * scaledTimelineWidth;
  const clipLeft = (clip.startTime / duration) * scaledTimelineWidth;

  // Filter keyframes for this clip's canvas object
  const clipKeyframes = keyframes.filter(kf => kf.objectId === clip.canvasObjectId);

  // UPDATED: Group keyframes by relative time to avoid overlapping indicators
  const keyframesByRelativeTime = clipKeyframes.reduce((acc, kf) => {
    const timeKey = kf.relativeTime.toFixed(2);
    if (!acc[timeKey]) {
      acc[timeKey] = [];
    }
    acc[timeKey].push(kf);
    return acc;
  }, {} as Record<string, Keyframe[]>);

  const handleKeyframeClick = (keyframe: Keyframe) => {
    console.log('🎬 KEYFRAME CLICK: Selected keyframe:', keyframe.id);
    if (setSelectedKeyframeId) {
      setSelectedKeyframeId(keyframe.id);
    }
    if (setCurrentTime) {
      // UPDATED: Navigate to global time (clip start + relative time)
      const globalTime = clip.startTime + keyframe.relativeTime;
      console.log('🎬 KEYFRAME CLICK: Navigating to global time:', globalTime, '(clip start:', clip.startTime, '+ relative:', keyframe.relativeTime, ')');
      setCurrentTime(globalTime);
    }
    onClipSelect(clip.id);
  };

  const handleKeyframeDelete = (keyframe: Keyframe) => {
    console.log('🎬 KEYFRAME DELETE: Deleting keyframe:', keyframe.id);
    removeKeyframe(keyframe.id);
    if (setSelectedKeyframeId && selectedKeyframeId === keyframe.id) {
      setSelectedKeyframeId(null);
    }
  };

  return (
    <div
      ref={setClipNodeRef}
      {...clipAttributes}
      {...clipListeners}
      className={`absolute h-10 rounded ${getTrackColor(clip.type)} cursor-move transition-all hover:brightness-110 ${
        selectedClip === clip.id ? 'ring-2 ring-primary' : ''
      } ${isClipDragging ? 'opacity-50 z-50' : ''}`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        top: '4px'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClipSelect(clip.id);
      }}
    >
      {/* Left resize handle */}
      <div
        ref={setLeftNodeRef}
        {...leftAttributes}
        {...leftListeners}
        className={`absolute left-0 top-0 w-2 h-full bg-white/20 cursor-ew-resize hover:bg-white/40 transition-colors ${
          isLeftDragging ? 'bg-white/60' : ''
        }`}
        style={{ borderRadius: '4px 0 0 4px' }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Clip content */}
      <div className="p-2 text-white text-xs truncate pointer-events-none">
        {clip.name}
      </div>

      {/* Right resize handle */}
      <div
        ref={setRightNodeRef}
        {...rightAttributes}
        {...rightListeners}
        className={`absolute right-0 top-0 w-2 h-full bg-white/20 cursor-ew-resize hover:bg-white/40 transition-colors ${
          isRightDragging ? 'bg-white/60' : ''
        }`}
        style={{ borderRadius: '0 4px 4px 0' }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* UPDATED: Keyframe indicators using relative time positioning */}
      {Object.entries(keyframesByRelativeTime).map(([relativeTimeKey, timeKeyframes]) => {
        const relativeTime = parseFloat(relativeTimeKey);
        // UPDATED: Position based on relative time within the clip
        const position = (relativeTime / clip.duration) * clipWidth;
        
        // Only show keyframes that fall within the clip's duration
        if (relativeTime < 0 || relativeTime > clip.duration) {
          return null;
        }

        // Use the first keyframe for the indicator (they're all at the same relative time)
        const representativeKeyframe = timeKeyframes[0];
        const isSelected = selectedKeyframeId === representativeKeyframe.id;

        return (
          <KeyframeIndicator
            key={relativeTimeKey}
            keyframe={representativeKeyframe}
            position={position}
            isSelected={isSelected}
            onClick={() => handleKeyframeClick(representativeKeyframe)}
            onDelete={() => handleKeyframeDelete(representativeKeyframe)}
            clipStartTime={clip.startTime} // UPDATED: Pass clip start time for display
          />
        );
      })}
    </div>
  );
};

const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  trackIndex,
  duration,
  scaledTimelineWidth,
  selectedClip,
  onClipSelect,
  onClipRemove,
  onClipUpdate,
  type,
  // Keyframe-related props
  keyframes = [],
  selectedKeyframeId,
  setSelectedKeyframeId,
  setCurrentTime,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  // Get track control actions from store
  const { 
    toggleTrackVisibility, 
    toggleTrackMute, 
    toggleTrackLock,
    toggleTrackKeyframeMode // Keyframe mode toggle
  } = useProjectStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTrackColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-blue-600';
      case 'audio': return 'bg-green-600';
      case 'image': return 'bg-purple-600';
      case 'text': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  if (type === 'label') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-48 h-12 flex-shrink-0 border-b border-border bg-muted/30 flex items-center px-2 gap-2"
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        
        {/* Track Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{track.name}</p>
          <p className="text-xs text-muted-foreground">
            {track.clips.length} clip{track.clips.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Track Controls */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title={track.isVisible !== false ? "Hide track" : "Show track"}
            onClick={() => toggleTrackVisibility(track.id)}
          >
            {track.isVisible !== false ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </Button>
          
          {/* Conditional Mute Button - Only show for audio tracks */}
          {track.clips[0]?.type === 'audio' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              title={track.isMuted ? "Unmute track" : "Mute track"}
              onClick={() => toggleTrackMute(track.id)}
            >
              {track.isMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title={track.isLocked ? "Unlock track" : "Lock track"}
            onClick={() => toggleTrackLock(track.id)}
          >
            {track.isLocked ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
          </Button>
          
          {/* Animation Mode Toggle */}
          <Button
            variant={track.isKeyframeMode ? "default" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0"
            title={track.isKeyframeMode ? "Disable animation mode" : "Enable animation mode"}
            onClick={() => toggleTrackKeyframeMode(track.id)}
          >
            {track.isKeyframeMode ? (
              <Zap className="w-3 h-3" />
            ) : (
              <ZapOff className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Content type - render the single track clip with manipulation capabilities
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="h-12 border-b border-border bg-background hover:bg-muted/10 transition-colors relative"
      data-track-id={track.id}
    >
      {/* Single Track Clip with drag and resize capabilities */}
      {track.clips[0] && (
        <DraggableClip
          clip={track.clips[0]}
          trackId={track.id}
          duration={duration}
          scaledTimelineWidth={scaledTimelineWidth}
          selectedClip={selectedClip}
          onClipSelect={onClipSelect}
          getTrackColor={getTrackColor}
          // Pass keyframe-related props
          keyframes={keyframes}
          selectedKeyframeId={selectedKeyframeId}
          setSelectedKeyframeId={setSelectedKeyframeId}
          setCurrentTime={setCurrentTime}
        />
      )}
    </div>
  );
};

export default TimelineTrack;
import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useProjectStore } from '@/store/projectStore';

// Helper function to format time in MM:SS:ms format
function formatTime(seconds: number): string {
  const totalSeconds = seconds;
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 100);
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  return `${pad(minutes)}:${pad(secs)}:${pad(milliseconds)}`;
}

const PlaybackControls: React.FC = () => {
  // Get all necessary state and functions from the global store
  const { 
    currentTime, 
    duration, 
    isPlaying, 
    volume,
    setCurrentTime, 
    togglePlay,
    setVolume 
  } = useProjectStore((state) => ({
    currentTime: state.currentTime,
    duration: state.duration,
    isPlaying: state.isPlaying,
    volume: state.volume,
    setCurrentTime: state.setCurrentTime,
    togglePlay: state.togglePlay,
    setVolume: state.setVolume,
  }));

  // Handle seeking when user drags the timeline slider
  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    console.log('🎵 PLAYBACK: Seeking to time:', newTime);
    setCurrentTime(newTime);
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 5); // Skip back 5 seconds
    console.log('🎵 PLAYBACK: Skipping back to:', newTime);
    setCurrentTime(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 5); // Skip forward 5 seconds
    console.log('🎵 PLAYBACK: Skipping forward to:', newTime);
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (newVolume: number[]) => {
    console.log('🎵 PLAYBACK: Volume changed to:', newVolume[0]);
    setVolume(newVolume);
  };

  const handlePlayPause = () => {
    console.log('🎵 PLAYBACK: Toggle play/pause from:', isPlaying, 'to:', !isPlaying);
    togglePlay();
  };

  return (
    <div className="h-16 border-t border-border flex items-center justify-center px-4 bg-background flex-shrink-0">
      <div className="flex items-center gap-4 w-full max-w-4xl">
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkipBack}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePlayPause}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSkipForward}>
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Current Time Display */}
        <div className="w-24 font-mono text-sm text-center text-muted-foreground">
          {formatTime(currentTime)}
        </div>
        
        {/* Timeline Seek Bar */}
        <div className="flex-1 px-4">
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={0.1}
            className="w-full seeker-range"
          />
        </div>
        
        {/* Total Duration Display */}
        <div className="w-24 font-mono text-sm text-center text-muted-foreground">
          {formatTime(duration)}
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          <Slider
            value={volume}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground min-w-[2rem]">{volume[0]}%</span>
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
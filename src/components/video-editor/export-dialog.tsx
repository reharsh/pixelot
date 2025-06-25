import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Image, 
  FileImage, 
  Film, 
  Settings,
  Clock,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useExportEngine, ExportOptions } from '@/hooks/useExportEngine';
import { useProjectStore } from '@/store/projectStore';

interface ExportDialogProps {
  children: React.ReactNode;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportType, setExportType] = useState<'image' | 'gif' | 'video'>('image');
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState([90]);
  const [frameRate, setFrameRate] = useState([24]);
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [startTime, setStartTime] = useState([0]);
  const [endTime, setEndTime] = useState([30]);

  const { duration } = useProjectStore();
  const { isExporting, exportProgress, exportImage, exportGIF, exportVideo } = useExportEngine();

  const handleExport = async () => {
    try {
      const options: ExportOptions = {
        format: exportType === 'image' ? imageFormat : exportType,
        quality: quality[0] / 100,
        frameRate: frameRate[0],
        startTime: useTimeRange ? startTime[0] : 0,
        endTime: useTimeRange ? endTime[0] : duration,
      };

      switch (exportType) {
        case 'image':
          await exportImage(options);
          break;
        case 'gif':
          await exportGIF(options);
          break;
        case 'video':
          await exportVideo(options);
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getExportIcon = () => {
    switch (exportType) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'gif': return <FileImage className="w-5 h-5" />;
      case 'video': return <Film className="w-5 h-5" />;
    }
  };

  const getProgressIcon = () => {
    if (!exportProgress) return null;
    
    switch (exportProgress.phase) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'preparing':
      case 'rendering':
      case 'encoding':
      case 'finalizing':
        return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedFrames = useTimeRange 
    ? Math.ceil((endTime[0] - startTime[0]) * frameRate[0])
    : Math.ceil(duration * frameRate[0]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Animation
          </DialogTitle>
          <DialogDescription>
            Export your animation as an image, GIF, or video file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="grid grid-cols-3 gap-3">
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  exportType === 'image' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setExportType('image')}
              >
                <CardContent className="p-4 text-center">
                  <Image className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-medium">Image</h3>
                  <p className="text-xs text-muted-foreground">Current frame</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  exportType === 'gif' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setExportType('gif')}
              >
                <CardContent className="p-4 text-center">
                  <FileImage className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <h3 className="font-medium">GIF</h3>
                  <p className="text-xs text-muted-foreground">Animated loop</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  exportType === 'video' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setExportType('video')}
              >
                <CardContent className="p-4 text-center">
                  <Film className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <h3 className="font-medium">Video</h3>
                  <p className="text-xs text-muted-foreground">WebM format</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Format-specific options */}
          {exportType === 'image' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Image Format</Label>
                <Select value={imageFormat} onValueChange={(value: 'png' | 'jpeg') => setImageFormat(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (Lossless)</SelectItem>
                    <SelectItem value="jpeg">JPEG (Compressed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {imageFormat === 'jpeg' && (
                <div className="space-y-2">
                  <Label>Quality: {quality[0]}%</Label>
                  <Slider
                    value={quality}
                    onValueChange={setQuality}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {(exportType === 'gif' || exportType === 'video') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Frame Rate: {frameRate[0]} fps</Label>
                <Slider
                  value={frameRate}
                  onValueChange={setFrameRate}
                  min={12}
                  max={60}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>12 fps (Small file)</span>
                  <span>60 fps (Smooth)</span>
                </div>
              </div>

              {exportType === 'video' && (
                <div className="space-y-2">
                  <Label>Quality: {quality[0]}%</Label>
                  <Slider
                    value={quality}
                    onValueChange={setQuality}
                    min={50}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}

              {/* Time Range Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useTimeRange"
                    checked={useTimeRange}
                    onChange={(e) => setUseTimeRange(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useTimeRange">Custom time range</Label>
                </div>

                {useTimeRange && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time: {formatTime(startTime[0])}</Label>
                      <Slider
                        value={startTime}
                        onValueChange={setStartTime}
                        min={0}
                        max={duration - 0.1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time: {formatTime(endTime[0])}</Label>
                      <Slider
                        value={endTime}
                        onValueChange={setEndTime}
                        min={startTime[0] + 0.1}
                        max={duration}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Export Info */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Duration: {formatTime(useTimeRange ? endTime[0] - startTime[0] : duration)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>Frames: {estimatedFrames}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Export Progress */}
          {isExporting && exportProgress && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getProgressIcon()}
                  Export Progress
                  <Badge variant="secondary" className="ml-auto">
                    {exportProgress.phase}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={exportProgress.progress} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{exportProgress.message}</span>
                  <span>{Math.round(exportProgress.progress)}%</span>
                </div>
                {exportProgress.currentFrame && exportProgress.totalFrames && (
                  <div className="text-xs text-muted-foreground">
                    Frame {exportProgress.currentFrame} of {exportProgress.totalFrames}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Export Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
              size="lg"
            >
              {getExportIcon()}
              {isExporting ? 'Exporting...' : `Export ${exportType.toUpperCase()}`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
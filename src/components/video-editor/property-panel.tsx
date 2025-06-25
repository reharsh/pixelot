import React from 'react';
import { 
  Settings, 
  Move, 
  RotateCw, 
  Maximize, 
  Eye, 
  Palette,
  Type,
  Image,
  Square,
  Diamond,
  Trash2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/store/projectStore';

const PropertyPanel: React.FC = () => {
  const {
    objects,
    selectedClipId,
    tracks,
    keyframes,
    selectedKeyframeId,
    setSelectedKeyframeId,
    removeKeyframe,
    applyObjectPropertyChange,
  } = useProjectStore();

  // Find the selected object based on selectedClipId
  const selectedObject = React.useMemo(() => {
    if (!selectedClipId) return null;

    // Find the clip that corresponds to the selected clip ID
    let selectedClip = null;
    for (const track of tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) {
        selectedClip = clip;
        break;
      }
    }

    if (!selectedClip || !selectedClip.canvasObjectId) return null;

    // Find the canvas object that corresponds to this clip
    return objects.find(obj => obj.id === selectedClip.canvasObjectId) || null;
  }, [selectedClipId, tracks, objects]);

  // Find the selected keyframe
  const selectedKeyframe = React.useMemo(() => {
    if (!selectedKeyframeId) return null;
    return keyframes.find(kf => kf.id === selectedKeyframeId) || null;
  }, [selectedKeyframeId, keyframes]);

  // UPDATED: Find the clip associated with the selected object for relative time display
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    
    for (const track of tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) {
        return clip;
      }
    }
    return null;
  }, [selectedClipId, tracks]);

  console.log('🎛️ PROPERTY PANEL: Selected object:', selectedObject);
  console.log('🎛️ PROPERTY PANEL: Selected keyframe:', selectedKeyframe);
  console.log('🎛️ PROPERTY PANEL: Selected clip:', selectedClip);

  const handlePropertyChange = (property: string, value: any) => {
    if (!selectedObject) return;

    console.log('🎛️ PROPERTY PANEL: Updating property via centralized action:', property, '=', value);
    // Use the centralized action that handles keyframe creation
    applyObjectPropertyChange(selectedObject.id, property, value);
  };

  const handleNumberInput = (property: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      handlePropertyChange(property, numValue);
    }
  };

  // Handle keyframe deletion
  const handleDeleteSelectedKeyframe = () => {
    if (!selectedKeyframe) return;
    
    console.log('🎛️ PROPERTY PANEL: Deleting selected keyframe:', selectedKeyframe.id);
    removeKeyframe(selectedKeyframe.id);
    setSelectedKeyframeId(null);
  };

  // Clear keyframe selection
  const handleClearKeyframeSelection = () => {
    console.log('🎛️ PROPERTY PANEL: Clearing keyframe selection');
    setSelectedKeyframeId(null);
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'rect': return <Square className="w-4 h-4" />;
      case 'circle': return <div className="w-4 h-4 rounded-full border-2 border-current" />;
      case 'triangle': return <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-l-transparent border-r-transparent border-b-current" />;
      default: return <Square className="w-4 h-4" />;
    }
  };

  if (!selectedObject) {
    return (
      <div className="h-full border-l border-border flex flex-col bg-background">
        <div className="h-12 border-b border-border flex items-center px-4">
          <Settings className="w-4 h-4 mr-2" />
          <span className="font-medium">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No object selected</p>
            <p className="text-xs">Select an object to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full border-l border-border flex flex-col bg-background">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4">
        <Settings className="w-4 h-4 mr-2" />
        <span className="font-medium">Properties</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* UPDATED: Selected Keyframe Section with relative time display */}
          {selectedKeyframe && selectedClip && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Diamond className="w-4 h-4 text-yellow-600" />
                  Selected Keyframe
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={handleClearKeyframeSelection}
                    title="Clear keyframe selection"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">Property</Label>
                    <p className="font-medium">{selectedKeyframe.property}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    <p className="font-medium">{String(selectedKeyframe.value)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Relative Time</Label>
                    <p className="font-medium">{selectedKeyframe.relativeTime.toFixed(2)}s</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Global Time</Label>
                    <p className="font-medium">{(selectedClip.startTime + selectedKeyframe.relativeTime).toFixed(2)}s</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Easing</Label>
                    <p className="font-medium">{selectedKeyframe.easing || 'linear'}</p>
                  </div>
                </div>
                <Separator />
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-8"
                  onClick={handleDeleteSelectedKeyframe}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete Keyframe
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Object Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {getObjectIcon(selectedObject.type)}
                Object Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Type</Label>
                <Badge variant="secondary" className="text-xs">
                  {selectedObject.type.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">ID</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedObject.id.slice(0, 8)}...
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Transform Properties */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Move className="w-4 h-4" />
                Transform
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Position */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">X</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.left)}
                      onChange={(e) => handleNumberInput('left', e.target.value)}
                      className="h-8 text-xs"
                      step="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Y</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.top)}
                      onChange={(e) => handleNumberInput('top', e.target.value)}
                      className="h-8 text-xs"
                      step="1"
                    />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Size</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.width)}
                      onChange={(e) => handleNumberInput('width', e.target.value)}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Height</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.height)}
                      onChange={(e) => handleNumberInput('height', e.target.value)}
                      className="h-8 text-xs"
                      step="1"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Scale */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Scale</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Scale X</Label>
                    <Input
                      type="number"
                      value={selectedObject.scaleX.toFixed(2)}
                      onChange={(e) => handleNumberInput('scaleX', e.target.value)}
                      className="h-8 text-xs"
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Scale Y</Label>
                    <Input
                      type="number"
                      value={selectedObject.scaleY.toFixed(2)}
                      onChange={(e) => handleNumberInput('scaleY', e.target.value)}
                      className="h-8 text-xs"
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  Rotation
                </Label>
                <div className="space-y-2">
                  <Slider
                    value={[selectedObject.angle]}
                    onValueChange={(value) => handlePropertyChange('angle', value[0])}
                    min={-180}
                    max={180}
                    step={1}
                    className="w-full"
                  />
                  <Input
                    type="number"
                    value={Math.round(selectedObject.angle)}
                    onChange={(e) => handleNumberInput('angle', e.target.value)}
                    className="h-8 text-xs"
                    step="1"
                    min="-180"
                    max="180"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Properties */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Opacity */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Opacity
                </Label>
                <div className="space-y-2">
                  <Slider
                    value={[selectedObject.opacity * 100]}
                    onValueChange={(value) => handlePropertyChange('opacity', value[0] / 100)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={Math.round(selectedObject.opacity * 100)}
                      onChange={(e) => handleNumberInput('opacity', (parseFloat(e.target.value) / 100).toString())}
                      className="h-8 text-xs flex-1"
                      step="1"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Fill Color */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Fill Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={typeof selectedObject.fill === 'string' ? selectedObject.fill : '#000000'}
                    onChange={(e) => handlePropertyChange('fill', e.target.value)}
                    className="h-8 w-16 p-1 border rounded"
                  />
                  <Input
                    type="text"
                    value={typeof selectedObject.fill === 'string' ? selectedObject.fill : '#000000'}
                    onChange={(e) => handlePropertyChange('fill', e.target.value)}
                    className="h-8 text-xs flex-1 font-mono"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Stroke */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Stroke</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={selectedObject.stroke || '#000000'}
                      onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                      className="h-8 w-16 p-1 border rounded"
                    />
                    <Input
                      type="text"
                      value={selectedObject.stroke || ''}
                      onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                      className="h-8 text-xs flex-1 font-mono"
                      placeholder="none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <Input
                      type="number"
                      value={selectedObject.strokeWidth}
                      onChange={(e) => handleNumberInput('strokeWidth', e.target.value)}
                      className="h-8 text-xs"
                      step="1"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Text Properties (only for text objects) */}
          {selectedObject.type === 'text' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Text Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Text Content */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Text</Label>
                  <Input
                    type="text"
                    value={selectedObject.text || ''}
                    onChange={(e) => handlePropertyChange('text', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Enter text..."
                  />
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Font Size</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={selectedObject.fontSize || 20}
                      onChange={(e) => handleNumberInput('fontSize', e.target.value)}
                      className="h-8 text-xs flex-1"
                      step="1"
                      min="8"
                      max="200"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>

                {/* Font Weight */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Font Weight</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {['normal', 'bold', '600'].map((weight) => (
                      <Button
                        key={weight}
                        variant={selectedObject.fontWeight === weight ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handlePropertyChange('fontWeight', weight)}
                      >
                        {weight === 'normal' ? 'Normal' : weight === 'bold' ? 'Bold' : '600'}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Font Family</Label>
                  <Input
                    type="text"
                    value={selectedObject.fontFamily || 'Arial'}
                    onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Arial"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flip Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Maximize className="w-4 h-4" />
                Flip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedObject.flipX ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handlePropertyChange('flipX', !selectedObject.flipX)}
                >
                  Flip X
                </Button>
                <Button
                  variant={selectedObject.flipY ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handlePropertyChange('flipY', !selectedObject.flipY)}
                >
                  Flip Y
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PropertyPanel;
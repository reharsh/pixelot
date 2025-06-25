import React, { useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { 
  Upload, 
  Search, 
  Music, 
  Grid,
  List,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Hexagon,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MediaAsset } from '@/types/video-editor';
import { useProjectStore } from '@/store/projectStore';

interface AssetsPanelProps {
  assets: MediaAsset[];
  onAssetsChange: (assets: MediaAsset[]) => void;
}

// Draggable Media Asset Component
const DraggableMediaAsset: React.FC<{ asset: MediaAsset; viewMode: 'grid' | 'list' }> = ({ asset, viewMode }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-media-${asset.id}`,
    data: {
      type: 'media',
      asset: asset,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="p-3 cursor-pointer hover:bg-accent transition-colors"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {viewMode === 'grid' ? (
        <div className="space-y-2">
          <div className="aspect-video bg-muted rounded flex items-center justify-center">
            {asset.thumbnail || asset.src ? (
              <img 
                src={asset.thumbnail || asset.src} 
                alt={asset.name} 
                className="w-full h-full object-cover rounded" 
              />
            ) : (
              <Music className="w-4 h-4" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium truncate" title={asset.name}>{asset.name}</p>
            <p className="text-xs text-muted-foreground">{asset.size}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={asset.name}>{asset.name}</p>
            <p className="text-xs text-muted-foreground">{asset.size} • {asset.format}</p>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">{asset.type}</Badge>
        </div>
      )}
    </Card>
  );
};

// Draggable Shape Component
const DraggableShape: React.FC<{ shape: any }> = ({ shape }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-shape-${shape.id}`,
    data: {
      type: 'shape',
      shapeType: shape.id,
      properties: { fill: shape.color },
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="p-4 cursor-pointer hover:bg-accent transition-colors"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex flex-col items-center gap-2">
        <div 
          className="w-10 h-10 rounded flex items-center justify-center"
          style={{ backgroundColor: shape.color + '20', color: shape.color }}
        >
          <shape.icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-medium text-center">{shape.name}</span>
      </div>
    </Card>
  );
};

// Draggable Text Style Component
const DraggableTextStyle: React.FC<{ style: any }> = ({ style }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-text-style-${style.id}`,
    data: {
      type: 'text',
      textProperties: {
        text: style.sample,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fill: '#ffffff',
      },
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="p-4 cursor-pointer hover:bg-accent transition-colors"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-3">
        <Type className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{style.name}</p>
          <p 
            className="text-xs text-muted-foreground truncate mt-1"
            style={{ 
              fontSize: Math.min(style.fontSize / 3, 12),
              fontWeight: style.fontWeight 
            }}
          >
            {style.sample}
          </p>
        </div>
      </div>
    </Card>
  );
};

// Draggable Quick Text Button Component
const DraggableQuickText: React.FC = () => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'draggable-quick-text',
    data: {
      type: 'text',
      textProperties: {
        text: 'New Text',
        fontSize: 32,
        fontWeight: 'normal',
        fill: '#ffffff',
      },
    },
  });

  return (
    <Button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      variant="outline"
      className="w-full"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Type className="w-4 h-4 mr-2" />
      Add Text
    </Button>
  );
};

// Helper function to convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to Base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const AssetsPanel: React.FC<AssetsPanelProps> = ({
  assets,
  onAssetsChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get actions from the store
  const { setAssets, addShapeToCanvas, addTextToCanvas } = useProjectStore();

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = useCallback(async (files: FileList) => {
    setIsLoading(true);
    setUploadProgress(0);

    const newAssets: MediaAsset[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Only process image files
      if (!file.type.startsWith('image/')) {
        console.log('📁 UPLOAD: Skipping non-image file:', file.name);
        continue;
      }
      
      console.log('📁 UPLOAD: Processing image file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      try {
        // Convert file to Base64
        console.log('📁 UPLOAD: Converting file to Base64...');
        const base64Src = await fileToBase64(file);
        console.log('📁 UPLOAD: Base64 conversion successful, length:', base64Src.length);
        
        const newAsset: MediaAsset = {
          id: `asset_${Date.now()}_${i}`,
          name: file.name,
          type: 'image',
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          format: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
          src: base64Src, // Store the Base64 string
          thumbnail: base64Src, // Use the same Base64 string as thumbnail
        };

        console.log('📁 UPLOAD: Created asset object:', {
          id: newAsset.id,
          name: newAsset.name,
          type: newAsset.type,
          size: newAsset.size,
          format: newAsset.format,
          srcLength: newAsset.src?.length || 0,
        });

        newAssets.push(newAsset);
        
        // Update progress
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress(progress);
        console.log('📁 UPLOAD: Progress:', progress + '%');
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('📁 UPLOAD: Error processing file:', file.name, error);
      }
    }

    console.log('📁 UPLOAD: Processed', newAssets.length, 'images successfully');
    
    const updatedAssets = [...assets, ...newAssets];
    onAssetsChange(updatedAssets);
    setAssets(updatedAssets);
    setIsLoading(false);
    setUploadProgress(0);
    
    console.log('📁 UPLOAD: Upload process completed, total assets:', updatedAssets.length);
  }, [assets, onAssetsChange, setAssets]);

  const shapes = [
    { id: 'rectangle', name: 'Rectangle', icon: Square, color: '#3b82f6' },
    { id: 'circle', name: 'Circle', icon: Circle, color: '#10b981' },
    { id: 'triangle', name: 'Triangle', icon: Triangle, color: '#f59e0b' },
    { id: 'star', name: 'Star', icon: Star, color: '#ef4444' },
    { id: 'heart', name: 'Heart', icon: Heart, color: '#ec4899' },
    { id: 'hexagon', name: 'Hexagon', icon: Hexagon, color: '#8b5cf6' },
  ];

  const textStyles = [
    { id: 'heading', name: 'Heading', fontSize: 48, fontWeight: 'bold', sample: 'Heading Text' },
    { id: 'subheading', name: 'Subheading', fontSize: 32, fontWeight: '600', sample: 'Subheading Text' },
    { id: 'body', name: 'Body Text', fontSize: 24, fontWeight: 'normal', sample: 'Body text content' },
    { id: 'caption', name: 'Caption', fontSize: 18, fontWeight: 'normal', sample: 'Caption text' },
  ];

  const handleShapeClick = (shapeType: string, color: string) => {
    console.log('🎨 ASSETS: Adding shape via store action:', shapeType);
    addShapeToCanvas(shapeType, { fill: color });
  };

  const handleTextStyleClick = (style: any) => {
    console.log('📝 ASSETS: Adding text via store action:', style);
    addTextToCanvas({
      text: style.sample,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fill: '#ffffff'
    });
  };

  const renderAssetGrid = (assetsToRender: MediaAsset[]) => (
    <div className={viewMode === 'grid' ? 'grid gap-3' : 'space-y-2'} style={{
      gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fit, minmax(140px, 1fr))' : undefined
    }}>
      {assetsToRender.map((asset) => (
        <DraggableMediaAsset
          key={asset.id}
          asset={asset}
          viewMode={viewMode}
        />
      ))}
    </div>
  );

  return (
    <div className="h-full border-r border-border flex flex-col bg-background">
      <div className="h-12 border-b border-border flex items-center px-4">
        <span className="font-medium">Assets</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Upload Area */}
        <div className="p-4 border-b border-border">
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/*'; // Only accept images
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleFileUpload(files);
              };
              input.click();
            }}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drop images here or click to upload</p>
          </div>
          {isLoading && (
            <div className="mt-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-muted-foreground mt-1">Converting to Base64... {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Search and View Controls */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'grid' | 'list')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="grid">
                  <Grid className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Assets Tabs */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs defaultValue="media">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="media">Images</TabsTrigger>
                <TabsTrigger value="shapes">Shapes</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
              </TabsList>
              
              {/* Media Tab */}
              <TabsContent value="media" className="mt-4">
                {renderAssetGrid(filteredAssets)}
                {filteredAssets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No images uploaded yet</p>
                    <p className="text-sm">Upload image files to get started</p>
                  </div>
                )}
              </TabsContent>

              {/* Shapes Tab */}
              <TabsContent value="shapes" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Basic Shapes</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {shapes.map((shape) => (
                        <DraggableShape key={shape.id} shape={shape} />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Text Styles</h4>
                    <div className="space-y-3">
                      {textStyles.map((style) => (
                        <DraggableTextStyle key={style.id} style={style} />
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-3">Quick Text</h4>
                    <DraggableQuickText />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AssetsPanel;
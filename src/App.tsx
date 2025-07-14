import VideoEditor from '@/components/ui/video-editor';
import { ThemeToggle } from './components/ui/theme-toggle';

function App() {
  const handleExport = () => {
    console.log('Exporting video...');
    // Add your export logic here
  };

  const handleSave = () => {
    console.log('Saving project...');
    // Add your save logic here
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <VideoEditor 
        onExport={handleExport}
        onSave={handleSave}
      />
    </div>
  );
}

export default App;
import VideoEditor from '@/components/ui/video-editor';

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
    <div className="w-screen h-screen overflow-hidden">
      <VideoEditor 
        onExport={handleExport}
        onSave={handleSave}
      />
    </div>
  );
}

export default App;
// Type declarations for external libraries without TypeScript support

declare module 'gifenc' {
    export function GIFEncoder(): {
      writeFrame: (index: Uint8Array, width: number, height: number, options: {
        palette: any[];
        delay: number;
      }) => void;
      finish: () => void;
      bytes: () => Uint8Array;
    };
    
    export function quantize(data: Uint8Array, colors: number): any[];
    export function applyPalette(data: Uint8Array, palette: any[]): Uint8Array;
  }
  
  declare module 'webm-writer' {
    interface WebMWriterOptions {
      quality?: number;
      frameRate?: number;
      transparent?: boolean;
    }
  
    class WebMWriter {
      constructor(options?: WebMWriterOptions);
      addFrame(canvas: HTMLCanvasElement): void;
      complete(): Promise<Blob>;
    }
  
    export default WebMWriter;
  }
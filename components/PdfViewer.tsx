import React, { useEffect, useRef, useState } from 'react';
import { ZoomInIcon, ZoomOutIcon, MagicIcon } from './icons';

declare const pdfjsLib: any;

interface PdfViewerProps {
  file: File | null;
  labels: { zoomIn: string; zoomOut: string; page: string; ocr: string; processing: string };
  onOcrPage: (base64Image: string) => Promise<void>;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file, labels, onOcrPage }) => {
  const [scale, setScale] = useState(1.0);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  useEffect(() => {
    if (!file) return;

    const loadPdf = async () => {
      const fileUrl = URL.createObjectURL(file);
      try {
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error loading PDF", error);
      }
    };

    loadPdf();
  }, [file]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context!,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
      } catch (e) {
        console.error("Render error", e);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  const handleOcrClick = async () => {
      if(!canvasRef.current || isOcrRunning) return;
      setIsOcrRunning(true);
      // Export high quality jpeg
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
      await onOcrPage(base64);
      setIsOcrRunning(false);
  }

  if (!file) return <div className="h-full flex items-center justify-center text-gray-400">No PDF Loaded</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap justify-between items-center mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg gap-2">
        <div className="flex gap-2 items-center">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title={labels.zoomOut}>
                <ZoomOutIcon className="w-5 h-5" />
            </button>
            <span className="text-xs self-center font-mono w-10 text-center">{(scale * 100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title={labels.zoomIn}>
                <ZoomInIcon className="w-5 h-5" />
            </button>
        </div>
        
        <button 
            onClick={handleOcrClick} 
            disabled={isOcrRunning}
            className="flex items-center gap-2 px-3 py-1 bg-primary text-white text-xs rounded shadow hover:opacity-90 disabled:bg-gray-400 transition-colors"
        >
            <MagicIcon className={`w-4 h-4 ${isOcrRunning ? 'animate-spin' : ''}`} />
            {isOcrRunning ? labels.processing : labels.ocr}
        </button>

        <div className="flex items-center gap-2 text-sm">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 bg-white dark:bg-gray-600 rounded disabled:opacity-50">&lt;</button>
            <span>{labels.page} {currentPage} / {numPages}</span>
            <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 bg-white dark:bg-gray-600 rounded disabled:opacity-50">&gt;</button>
        </div>
      </div>
      <div className="flex-grow overflow-auto border rounded-lg bg-gray-500/20 flex justify-center p-4">
        <canvas ref={canvasRef} className="shadow-lg max-w-none" />
      </div>
    </div>
  );
};

export default PdfViewer;
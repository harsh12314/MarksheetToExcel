import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, FileText } from 'lucide-react';

interface Props {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<Props> = ({ imageUrl, title, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Detect whether the document is a PDF
  const [isPdf, setIsPdf] = useState<boolean>(() => {
    const lowerUrl = (imageUrl || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    return (
      lowerUrl.includes('.pdf') ||
      lowerTitle.includes('.pdf') ||
      lowerUrl.startsWith('data:application/pdf')
    );
  });

  useEffect(() => {
    if (!imageUrl) return;
    const lowerUrl = imageUrl.toLowerCase();
    const lowerTitle = (title || '').toLowerCase();

    if (lowerUrl.includes('.pdf') || lowerTitle.includes('.pdf') || lowerUrl.startsWith('data:application/pdf')) {
      setIsPdf(true);
      return;
    }

    // Inspect blob MIME type dynamically if it's an object URL
    if (imageUrl.startsWith('blob:')) {
      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          if (blob.type === 'application/pdf' || blob.type.includes('pdf')) {
            setIsPdf(true);
          }
        })
        .catch(() => {});
    }
  }, [imageUrl, title]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isPdf ? 'PDF Document • Live Browser Viewer' : 'Image Scan • Zoom & Rotate Enabled'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Action: Open / Download PDF or Image */}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={title.toLowerCase().endsWith('.pdf') || !isPdf ? title : `${title}.pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition shadow-2xs"
              title="Open document in a new browser tab or download"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open / Download</span>
            </a>

            {!isPdf && (
              <>
                <div className="h-4 w-px bg-slate-300 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            <div className="h-4 w-px bg-slate-300 mx-0.5" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Display Area */}
        <div className="flex-1 overflow-auto p-3 bg-slate-900/90 flex items-center justify-center min-h-[500px]">
          {isPdf ? (
            <iframe
              src={imageUrl}
              title={title}
              className="w-full h-[78vh] rounded-xl shadow-xl bg-white border border-slate-700"
            />
          ) : (
            <div
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="origin-center"
            >
              <img
                src={imageUrl}
                alt={title}
                className="max-h-[78vh] max-w-full object-contain rounded-xl shadow-xl bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

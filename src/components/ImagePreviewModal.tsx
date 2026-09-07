import React from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface Props {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<Props> = ({ imageUrl, title, onClose }) => {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              Original Marksheet Scan: {title}
            </h3>
            <p className="text-xs text-slate-500">
              Inspect original document details, seals, and handwriting
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="h-4 w-px bg-slate-300 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Display Area */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950/5 flex items-center justify-center min-h-[400px]">
          {imageUrl.toLowerCase().includes('.pdf') ? (
            <iframe
              src={imageUrl}
              title={title}
              className="w-full h-[75vh] rounded shadow-md bg-white border border-slate-200"
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
                className="max-h-[75vh] max-w-full object-contain rounded shadow-md bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

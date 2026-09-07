import React, { useState, useEffect, useRef } from 'react';
import { BookmarkCheck, X, FolderCheck } from 'lucide-react';

export interface SaveBatchModalProps {
  isOpen: boolean;
  defaultName: string;
  itemCount: number;
  completedCount: number;
  onSave: (batchName: string) => void;
  onCancel: () => void;
}

export const SaveBatchModal: React.FC<SaveBatchModalProps> = ({
  isOpen,
  defaultName,
  itemCount,
  completedCount,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    onSave(trimmed.length > 0 ? trimmed : defaultName);
  };

  return (
    <div
      id="save-batch-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        id="save-batch-modal-box"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <FolderCheck className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Name Your Batch</h3>
              <p className="text-xs text-slate-500">
                Give this batch a memorable name so you can easily identify and reload it in History.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label htmlFor="batch-name-input" className="text-xs font-bold text-slate-700">
              Batch Title
            </label>
            <input
              id="batch-name-input"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 10 Science 2024"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-900 font-medium transition"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>{itemCount} Marksheets total</span>
              <span>{completedCount} Extracted</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-save-batch"
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs transition cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Save to History</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

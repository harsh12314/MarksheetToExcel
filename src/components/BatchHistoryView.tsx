import React, { useState, useCallback } from 'react';
import {
  History,
  Download,
  Trash2,
  Edit3,
  Check,
  Calendar,
  Award,
  Layers,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  FolderSync,
  PlusCircle,
  FileText,
  Eye
} from 'lucide-react';
import { SavedBatch, ProcessedMarksheet } from '../types';
import { downloadExcelFile, calculateTotalsAndPercentage } from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';
import { getDocumentUrl } from '../utils/localDocumentStore';

interface Props {
  history: SavedBatch[];
  onRestoreBatch: (batch: SavedBatch) => void;
  onDeleteBatch: (batchId: string) => void;
  onClearAllHistory: () => void;
  onRenameBatch: (batchId: string, newTitle: string) => void;
  onGoToUpload: () => void;
  onDeleteItemFromBatch?: (batchId: string, itemId: string) => void;
  onViewImage?: (previewUrl: string, title: string) => void;
}

export function BatchHistoryView({
  history,
  onRestoreBatch,
  onDeleteBatch,
  onClearAllHistory,
  onRenameBatch,
  onGoToUpload,
  onDeleteItemFromBatch,
  onViewImage,
}: Props) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(
    history.length > 0 ? history[0].id : null
  );
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Load document from browser IndexedDB (local storage) and open preview
  const handleViewDocument = useCallback(async (itemId: string, fallbackUrl: string | undefined, title: string) => {
    if (!onViewImage) return;
    setLoadingDocId(itemId);
    try {
      // Try IndexedDB first (persists after refresh on user's own device)
      const localUrl = await getDocumentUrl(itemId);
      if (localUrl) {
        onViewImage(localUrl, title);
      } else if (fallbackUrl && !fallbackUrl.startsWith('blob:')) {
        // Fallback to any non-blob URL stored in history metadata
        onViewImage(fallbackUrl, title);
      } else {
        alert('Document not available locally. It may have been uploaded in a different browser or device.');
      }
    } catch (e) {
      console.warn('[BatchHistory] Failed to load document from IndexedDB:', e);
      if (fallbackUrl && !fallbackUrl.startsWith('blob:')) {
        onViewImage(fallbackUrl, title);
      }
    } finally {
      setLoadingDocId(null);
    }
  }, [onViewImage]);

  // Non-blocking in-app confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const startRename = (batch: SavedBatch) => {
    setEditingBatchId(batch.id);
    setEditTitle(batch.title);
  };

  const saveRename = (batchId: string) => {
    if (editTitle.trim()) {
      onRenameBatch(batchId, editTitle.trim());
    }
    setEditingBatchId(null);
  };

  const handleExportBatchExcel = (batch: SavedBatch) => {
    const exportTargets = batch.items.filter(
      (it) => it.status === 'success' && it.data
    );

    if (exportTargets.length === 0) {
      setDownloadMessage('This saved batch does not have completed marksheets to export yet.');
      setTimeout(() => setDownloadMessage(null), 4000);
      return;
    }

    const rowsToExport = exportTargets.map((it) => ({
      student: it.data!,
      filename: it.file.name,
      isApproved: it.approved,
    }));

    const safeTitle = batch.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadExcelFile(rowsToExport, `${safeTitle}_Export.xlsx`);

    setDownloadMessage(`Downloaded Excel spreadsheet for "${batch.title}"!`);
    setTimeout(() => setDownloadMessage(null), 4000);
  };

  const formatSavedDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const totalArchivedStudents = history.reduce(
    (acc, b) => acc + (b.completedCount || b.itemCount || 0),
    0
  );

  return (
    <div id="batch-history-view" className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Saved Batches History</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                {history.length} {history.length === 1 ? 'Batch' : 'Batches'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Every time you click <strong className="text-slate-800">"Save"</strong>, your current marksheet batch is safely preserved here with its full candidate data, subject marks, and instant Excel export capability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {history.length > 0 && (
            <button
              id="btn-clear-all-history"
              type="button"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'Clear All Batch History',
                  message: `Are you sure you want to permanently clear all ${history.length} saved batch record(s)? This action cannot be undone.`,
                  confirmText: 'Clear All History',
                  onConfirm: () => onClearAllHistory(),
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
          <button
            id="btn-history-new-upload"
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Process New Batch</span>
          </button>
        </div>
      </div>

      {/* Download Alert */}
      {downloadMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{downloadMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* History List or Empty State */}
      {history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-100">
            <History className="w-8 h-8 text-purple-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Saved Batches Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5">
            When you extract and review marksheets, click the <strong>"Save"</strong> button at any time. The current batch will be saved here in history, and the active workspace will clear itself ready for your next set of marksheets.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGoToUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Upload Marksheets</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((batch, index) => {
            const isExpanded = expandedBatchId === batch.id;
            const isEditing = editingBatchId === batch.id;
            const completedItems = batch.items.filter((it) => it.status === 'success' && it.data);

            return (
              <div
                key={batch.id}
                id={`history-batch-card-${batch.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Header Row */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 mt-0.5">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="text-sm font-bold text-slate-900 border border-blue-400 rounded-md px-2 py-0.5 focus:outline-hidden"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(batch.id);
                                if (e.key === 'Escape') setEditingBatchId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => saveRename(batch.id)}
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-sm font-bold text-slate-900">
                              {batch.title}
                            </h3>
                            <button
                              type="button"
                              onClick={() => startRename(batch)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer"
                              title="Rename batch"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 ml-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatSavedDate(batch.savedAt)}
                        </span>
                      </div>

                      {/* Chips / Metadata */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Layers className="w-3 h-3" />
                          {batch.completedCount} / {batch.itemCount} Marksheets
                        </span>

                        {batch.boards && batch.boards.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {batch.boards.join(', ')}
                          </span>
                        )}

                        {batch.averagePercentage !== undefined && batch.averagePercentage > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Avg: {batch.averagePercentage.toFixed(1)}%
                          </span>
                        )}

                        {batch.topStudent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Award className="w-3 h-3 text-indigo-600" />
                            Top: {batch.topStudent.name} ({batch.topStudent.percentage}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportBatchExcel(batch)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                      title="Download Excel spreadsheet for this saved batch"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRestoreBatch(batch)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                      title="Load these marksheets back into the active workspace table"
                    >
                      <FolderSync className="w-3.5 h-3.5 text-blue-600" />
                      <span>Load into Workspace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                      title={isExpanded ? 'Collapse preview' : 'Expand preview'}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Hide Details</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>View Students ({batch.itemCount})</span>
                        </>
                      )}
                    </button>

                    <button
                      id={`btn-delete-batch-${batch.id}`}
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Delete Saved Batch',
                          message: `Are you sure you want to delete "${batch.title}" from history? This cannot be undone.`,
                          confirmText: 'Delete Batch',
                          onConfirm: () => onDeleteBatch(batch.id),
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Students Table Preview */}
                {isExpanded && (
                  <div className="p-5 bg-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Previewing students recorded in this batch:</span>
                      <span>Total {completedItems.length} student records</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Student Name</th>
                            <th className="py-2.5 px-3">Roll Number</th>
                            <th className="py-2.5 px-3">Board / Exam</th>
                            <th className="py-2.5 px-3">Subjects Count</th>
                            <th className="py-2.5 px-3">Total</th>
                            <th className="py-2.5 px-3">Percentage</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-center">Document</th>
                            {onDeleteItemFromBatch && (
                              <th className="py-2.5 px-2 text-center w-12">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {batch.items.map((item, sIdx) => {
                            const data = item.data;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-2 px-3 font-mono text-slate-400">{sIdx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {data?.student_name || item.file.name}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">
                                  {data?.roll_number || '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-600 truncate max-w-xs">
                                  {data?.board || '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {data?.subjects?.length || 0} subjects
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {(() => {
                                    const c = data ? calculateTotalsAndPercentage(data) : null;
                                    const val = data?.total !== null && data?.total !== undefined ? data.total : c?.total;
                                    return val !== null && val !== undefined ? val : '—';
                                  })()}
                                </td>
                                <td className="py-2 px-3 font-bold text-blue-700">
                                  {(() => {
                                    const c = data ? calculateTotalsAndPercentage(data) : null;
                                    const val = data?.percentage !== null && data?.percentage !== undefined ? data.percentage : c?.percentage;
                                    return val !== null && val !== undefined ? `${val}%` : '—';
                                  })()}
                                </td>
                                <td className="py-2 px-3">
                                  {item.status === 'success' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                      Extracted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                      {item.status}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {onViewImage ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleViewDocument(
                                          item.id,
                                          item.file?.previewUrl,
                                          item.file?.name
                                            ? `${item.file.name}${data?.student_name ? ` (${data.student_name})` : ''}`
                                            : data?.student_name || 'Marksheet Document'
                                        )
                                      }
                                      disabled={loadingDocId === item.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition cursor-pointer disabled:opacity-50"
                                      title="View original marksheet document (stored on your browser)"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>{loadingDocId === item.id ? 'Loading...' : 'View'}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                                {onDeleteItemFromBatch && (
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => onDeleteItemFromBatch(batch.id, item.id)}
                                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                      title="Delete student from this batch"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reusable In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDanger={true}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

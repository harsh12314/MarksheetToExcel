import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  Trash2,
  Check,
  Search,
  ArrowUpDown,
  Loader2,
  Sparkles,
  RotateCw,
  Clock,
  Save
} from 'lucide-react';
import { ProcessedMarksheet, MarksheetData } from '../types';
import { normalizeSubjectName, calculateTotalsAndPercentage } from '../utils/excelExport';

function formatCleanError(err?: string): string {
  if (!err) return 'Extraction failed';
  const str = String(err);
  if (str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('quota') || str.includes('rate limit')) {
    return 'Rate limited (429)';
  }
  if (str.includes('503') || str.includes('UNAVAILABLE') || str.includes('No capacity') || str.includes('overloaded')) {
    return 'Unavailable (503)';
  }
  if (str.includes('not found') || str.includes('no longer available') || str.includes('NOT_FOUND') || str.includes('404')) {
    return 'Model unavailable';
  }
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.error?.code === 429) return 'Rate limited (429)';
      if (parsed.error?.code === 503) return 'Unavailable (503)';
      if (parsed.error?.code === 404) return 'Model unavailable';
      if (parsed.error?.message) {
        const msg = String(parsed.error.message);
        if (msg.includes('not found') || msg.includes('no longer available')) return 'Model unavailable';
        return msg.length > 25 ? msg.slice(0, 25) + '...' : msg;
      }
    } catch {
      // not json
    }
  }
  if (str.startsWith('models/')) {
    return 'Model error';
  }
  if (str.length > 25) {
    return str.slice(0, 25) + '...';
  }
  return str;
}

interface Props {
  items: ProcessedMarksheet[];
  allSubjects: string[];
  onUpdateData: (id: string, updatedData: MarksheetData) => void;
  onToggleApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onViewImage: (previewUrl: string, title: string) => void;
  onProcessSingle?: (id: string) => void;
  onSaveBatch?: () => void;
  onClearAll?: () => void;
  onDeleteMultiple?: (ids: string[]) => void;
}

export const SpreadsheetReviewTable: React.FC<Props> = ({
  items,
  allSubjects,
  onUpdateData,
  onToggleApprove,
  onDelete,
  onViewImage,
  onProcessSingle,
  onSaveBatch,
  onClearAll,
  onDeleteMultiple,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortIssuesFirst, setSortIssuesFirst] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clean up selectedIds when items change
  useEffect(() => {
    const existingIds = new Set(items.map((i) => i.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [items]);

  // Filter items
  const filtered = items.filter((item) => {
    if (!searchTerm) return true;
    const s = item.data;
    const term = searchTerm.toLowerCase();
    return (
      item.file.name.toLowerCase().includes(term) ||
      (s?.student_name && s.student_name.toLowerCase().includes(term)) ||
      (s?.roll_number && s.roll_number.toLowerCase().includes(term)) ||
      (s?.board && s.board.toLowerCase().includes(term))
    );
  });

  // Sort: issues first if toggled
  const sorted = [...filtered].sort((a, b) => {
    if (sortIssuesFirst) {
      const aErrors = a.validationIssues?.filter((i) => i.type === 'error').length || 0;
      const bErrors = b.validationIssues?.filter((i) => i.type === 'error').length || 0;
      if (aErrors !== bErrors) return bErrors - aErrors;

      const aWarnings = a.validationIssues?.length || 0;
      const bWarnings = b.validationIssues?.length || 0;
      if (aWarnings !== bWarnings) return bWarnings - aWarnings;
    }
    return 0;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length && sorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((i) => i.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onDeleteMultiple) {
      onDeleteMultiple(ids);
    } else {
      ids.forEach((id) => onDelete(id));
    }
    setSelectedIds(new Set());
  };

  const handleApproveSelected = () => {
    selectedIds.forEach((id) => {
      const it = items.find((x) => x.id === id);
      if (it && !it.approved) onToggleApprove(id);
    });
    setSelectedIds(new Set());
  };

  const handleFieldChange = (item: ProcessedMarksheet, field: keyof MarksheetData, val: any) => {
    if (!item.data) return;
    onUpdateData(item.id, {
      ...item.data,
      [field]: val === '' ? null : val,
    });
  };

  const handleSubjectMarkChange = (item: ProcessedMarksheet, normSubjectName: string, val: string) => {
    if (!item.data) return;
    const numVal = val === '' ? null : Number(val);
    const existingSubjects = [...(item.data.subjects || [])];

    // Check if subject exists
    const matchIdx = existingSubjects.findIndex(
      (sub) => normalizeSubjectName(sub.name) === normSubjectName
    );

    if (matchIdx >= 0) {
      existingSubjects[matchIdx] = {
        ...existingSubjects[matchIdx],
        marks: numVal,
      };
    } else if (val !== '') {
      // Add as new subject
      existingSubjects.push({
        name: normSubjectName,
        marks: numVal,
        max_marks: 100,
        grade: null,
      });
    }

    const updatedData: MarksheetData = {
      ...item.data,
      subjects: existingSubjects,
    };
    const { total: newTotal, percentage: newPct } = calculateTotalsAndPercentage(updatedData);
    updatedData.total = newTotal;
    updatedData.percentage = newPct;

    onUpdateData(item.id, updatedData);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search name, roll no, or file..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
              <span className="font-bold text-blue-900 text-xs">
                {selectedIds.size} selected
              </span>
              <button
                id="btn-delete-selected-rows"
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition cursor-pointer"
                title="Delete all selected marksheets"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.size})</span>
              </button>
              <button
                id="btn-approve-selected-rows"
                type="button"
                onClick={handleApproveSelected}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer ml-1"
              >
                Deselect
              </button>
            </div>
          ) : (
            <>
              {onClearAll && items.length > 0 && (
                <button
                  id="btn-table-clear-all"
                  type="button"
                  onClick={onClearAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 font-medium transition cursor-pointer"
                  title="Clear all marksheets from workspace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}

              {onSaveBatch && items.length > 0 && (
                <button
                  id="btn-table-save-batch"
                  type="button"
                  onClick={onSaveBatch}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer shadow-2xs"
                  title="Save current marksheets to history and clear workspace"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Batch</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setSortIssuesFirst(!sortIssuesFirst)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              sortIssuesFirst
                ? 'bg-amber-50 text-amber-900 border-amber-300 font-medium'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort Issues to Top</span>
          </button>
          <span className="text-slate-500 text-[11px]">
            Showing {sorted.length} of {items.length} records
          </span>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="overflow-x-auto max-h-[600px] divide-y divide-slate-200">
        <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
          <thead className="bg-slate-100/90 backdrop-blur-xs text-slate-700 font-semibold sticky top-0 z-10 shadow-2xs">
            <tr>
              <th className="py-2.5 px-2 w-10 text-center">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selectedIds.size === sorted.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                  title="Select all displayed rows"
                />
              </th>
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3 w-12 text-center">Source</th>
              <th className="py-2.5 px-3 min-w-[140px]">Student Name</th>
              <th className="py-2.5 px-3 min-w-[110px]">Roll No</th>
              <th className="py-2.5 px-3 min-w-[100px]">Board</th>
              <th className="py-2.5 px-3 min-w-[90px]">Class</th>
              {/* Dynamic Columns for all unioned subjects */}
              {allSubjects.map((sub, i) => (
                <th
                  key={i}
                  className="py-2.5 px-2.5 min-w-[90px] text-center font-medium bg-blue-50/60 text-blue-950 border-l border-slate-200"
                  title={sub}
                >
                  <div className="truncate max-w-[110px] mx-auto">{sub}</div>
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[80px] text-right font-bold">Total</th>
              <th className="py-2.5 px-3 min-w-[80px] text-right font-bold">%</th>
              <th className="py-2.5 px-3 min-w-[100px] text-center">Status</th>
              <th className="py-2.5 px-2 w-16 text-center">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {sorted.map((item, rowIdx) => {
              const s = item.data;
              const errors = item.validationIssues?.filter((i) => i.type === 'error') || [];
              const warnings = item.validationIssues?.filter((i) => i.type === 'warning') || [];

              // Map subjects
              const subjectMap: Record<string, number | null> = {};
              s?.subjects?.forEach((sub) => {
                if (sub && sub.name) {
                  subjectMap[normalizeSubjectName(sub.name)] = sub.marks;
                }
              });

              // Computed totals fallback
              const { total: calcTotal, percentage: calcPct } = s ? calculateTotalsAndPercentage(s) : { total: null, percentage: null };
              const displayTotal = s?.total !== null && s?.total !== undefined ? s.total : (calcTotal ?? '');
              const displayPct = s?.percentage !== null && s?.percentage !== undefined ? s.percentage : (calcPct ?? '');


              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50/90 transition ${
                    selectedIds.has(item.id)
                      ? 'bg-blue-50/40'
                      : item.approved
                      ? 'bg-emerald-50/20'
                      : errors.length > 0
                      ? 'bg-red-50/25'
                      : warnings.length > 0
                      ? 'bg-amber-50/25'
                      : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelectRow(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                    />
                  </td>

                  {/* Row Number */}
                  <td className="py-2 px-3 text-center text-slate-400 font-mono">
                    {rowIdx + 1}
                  </td>

                  {/* Thumbnail / Quick View */}
                  <td className="py-2 px-3 text-center">
                    {item.file.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
                        className="p-1 rounded hover:bg-slate-200 text-blue-600 transition cursor-pointer"
                        title="View Original Marksheet"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Student Name */}
                  <td className="py-1.5 px-2.5">
                    {item.status === 'processing' ? (
                      <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                        <span className="truncate">Interpreting with Gemini...</span>
                      </div>
                    ) : item.status === 'idle' ? (
                      <div className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-xs text-slate-700 font-medium truncate max-w-[130px]" title={item.file.name}>
                          {item.file.name}
                        </span>
                        {onProcessSingle && (
                          <button
                            type="button"
                            onClick={() => onProcessSingle(item.id)}
                            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shrink-0 transition cursor-pointer shadow-2xs"
                            title="Process this marksheet"
                          >
                            ⚡ Extract
                          </button>
                        )}
                      </div>
                    ) : item.status === 'rate_limited' ? (
                      <div className="flex items-center justify-between gap-1.5 text-xs py-0.5">
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold truncate max-w-[130px]" title="Gemini rate limit reached. Auto-retrying shortly.">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                          <span>{item.retryCountdown ? `Backoff (${item.retryCountdown}s)` : 'Rate limited (429)'}</span>
                        </span>
                        {onProcessSingle && (
                          <button
                            type="button"
                            onClick={() => onProcessSingle(item.id)}
                            className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shrink-0 transition cursor-pointer"
                            title="Retry extraction immediately"
                          >
                            <RotateCw className="w-2.5 h-2.5 inline mr-0.5" />
                            Retry
                          </button>
                        )}
                      </div>
                    ) : item.status === 'error' ? (
                      <div className="flex items-center justify-between gap-1.5 text-xs py-0.5">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-slate-800 font-medium truncate max-w-[130px]" title={item.file.name}>
                            {item.file.name}
                          </span>
                          <span className="text-[10px] text-red-600 font-semibold truncate max-w-[130px]" title={item.error || 'Extraction failed'}>
                            {formatCleanError(item.error)}
                          </span>
                        </div>
                        {onProcessSingle && (
                          <button
                            type="button"
                            onClick={() => onProcessSingle(item.id)}
                            className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold shrink-0 transition cursor-pointer"
                            title="Retry extraction"
                          >
                            <RotateCw className="w-2.5 h-2.5 inline mr-0.5" />
                            Retry
                          </button>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={s?.student_name || ''}
                        onChange={(e) => handleFieldChange(item, 'student_name', e.target.value)}
                        placeholder="Required"
                        className={`w-full px-2 py-1 rounded text-xs font-semibold focus:outline-hidden ${
                          !s?.student_name
                            ? 'border border-red-400 bg-red-50 text-red-700'
                            : 'border border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-900'
                        }`}
                      />
                    )}
                  </td>

                  {/* Roll Number */}
                  <td className="py-1.5 px-2.5">
                    {item.status !== 'success' ? (
                      <span className="text-xs text-slate-400 font-mono italic px-2">—</span>
                    ) : (
                      <input
                        type="text"
                        value={s?.roll_number || ''}
                        onChange={(e) => handleFieldChange(item, 'roll_number', e.target.value)}
                        placeholder="Required"
                        className={`w-full px-2 py-1 rounded text-xs font-mono font-medium focus:outline-hidden ${
                          !s?.roll_number
                            ? 'border border-red-400 bg-red-50 text-red-700'
                            : 'border border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-800'
                        }`}
                      />
                    )}
                  </td>

                  {/* Board */}
                  <td className="py-1.5 px-2.5">
                    {item.status !== 'success' ? (
                      <span className="text-xs text-slate-400 italic px-2">—</span>
                    ) : (
                      <input
                        type="text"
                        value={s?.board || ''}
                        onChange={(e) => handleFieldChange(item, 'board', e.target.value)}
                        placeholder="Board"
                        className="w-full px-2 py-1 rounded text-xs text-slate-700 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                      />
                    )}
                  </td>

                  {/* Class */}
                  <td className="py-1.5 px-2.5">
                    {item.status !== 'success' ? (
                      <span className="text-xs text-slate-400 italic px-2">—</span>
                    ) : (
                      <input
                        type="text"
                        value={s?.class_name || ''}
                        onChange={(e) => handleFieldChange(item, 'class_name', e.target.value)}
                        placeholder="Class"
                        className="w-full px-2 py-1 rounded text-xs text-slate-700 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                      />
                    )}
                  </td>

                  {/* Dynamic Subjects */}
                  {allSubjects.map((normSub, sIdx) => {
                    const markVal = subjectMap[normSub];
                    return (
                      <td key={sIdx} className="py-1.5 px-1.5 text-center border-l border-slate-100">
                        {item.status !== 'success' ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          <input
                            type="number"
                            value={markVal !== undefined && markVal !== null ? markVal : ''}
                            onChange={(e) => handleSubjectMarkChange(item, normSub, e.target.value)}
                            placeholder="—"
                            className="w-14 text-center px-1 py-1 rounded text-xs font-semibold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="py-1.5 px-2.5 text-right">
                    {item.status !== 'success' ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <input
                        type="number"
                        value={displayTotal}
                        onChange={(e) => handleFieldChange(item, 'total', e.target.value ? Number(e.target.value) : null)}
                        className="w-16 text-right px-1.5 py-1 rounded text-xs font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                      />
                    )}
                  </td>

                  {/* Percentage */}
                  <td className="py-1.5 px-2.5 text-right">
                    {item.status !== 'success' ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <input
                        type="number"
                        step="0.1"
                        value={displayPct}
                        onChange={(e) => handleFieldChange(item, 'percentage', e.target.value ? Number(e.target.value) : null)}
                        className="w-16 text-right px-1.5 py-1 rounded text-xs font-bold text-blue-700 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                      />
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-2 px-3 text-center">
                    {item.status === 'processing' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        Extracting
                      </span>
                    ) : item.status === 'rate_limited' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        {item.retryCountdown ? `${item.retryCountdown}s Backoff` : 'Rate Limited'}
                      </span>
                    ) : item.status === 'idle' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Queued
                      </span>
                    ) : item.status === 'error' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        Failed
                      </span>
                    ) : item.approved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Approved
                      </span>
                    ) : errors.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800" title={errors.map(e => e.message).join('\n')}>
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        {errors.length} Issue{errors.length > 1 ? 's' : ''}
                      </span>
                    ) : warnings.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800" title={warnings.map(w => w.message).join('\n')}>
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleApprove(item.id)}
                        className={`p-1 rounded transition cursor-pointer ${
                          item.approved
                            ? 'text-emerald-700 hover:bg-emerald-100'
                            : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={item.approved ? 'Revoke Approval' : 'Approve Record'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-delete-row-${item.id}`}
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Delete this marksheet row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Eye,
  Maximize2,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  Edit2,
  Loader2,
  RotateCw
} from 'lucide-react';
import { ProcessedMarksheet, SubjectRecord } from '../types';
import { validateMarksheet } from '../utils/validation';
import { calculateTotalsAndPercentage } from '../utils/excelExport';

interface Props {
  item: ProcessedMarksheet;
  index: number;
  onUpdateData: (id: string, updatedData: any) => void;
  onToggleApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onViewImage: (previewUrl: string, title: string) => void;
  onProcessSingle?: (id: string) => void;
}

export const MarksheetReviewCard: React.FC<Props> = ({
  item,
  index,
  onUpdateData,
  onToggleApprove,
  onDelete,
  onViewImage,
  onProcessSingle,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const data = item.data;
  const issues = item.validationIssues || (data ? validateMarksheet(data) : []);
  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  // If item is currently processing
  if (item.status === 'processing') {
    return (
      <div
        id={`marksheet-card-${item.id}`}
        className="bg-white rounded-xl border-2 border-blue-400 shadow-md p-5 animate-in fade-in duration-200"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  #{index + 1} Extracting...
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs">
                  {item.file.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gemini Multimodal AI is reading candidate information, board name, and subject-wise marks...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.file.previewUrl && (
              <button
                type="button"
                onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Original</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
              title="Cancel and remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If item is queued / idle (waiting to be processed)
  if (item.status === 'idle') {
    return (
      <div
        id={`marksheet-card-${item.id}`}
        className="bg-white rounded-xl border border-amber-300 shadow-xs p-5 hover:border-amber-400 transition"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  #{index + 1} Queued - Ready to Process
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs">
                  {item.file.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Marksheet uploaded. Click "Extract Marksheet" to analyze with Gemini OCR.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onProcessSingle && (
              <button
                type="button"
                onClick={() => onProcessSingle(item.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Extract Marksheet</span>
              </button>
            )}
            {item.file.previewUrl && (
              <button
                type="button"
                onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If item hit Gemini API rate limits (429)
  if (item.status === 'rate_limited') {
    return (
      <div
        id={`marksheet-card-${item.id}`}
        className="bg-amber-50/70 rounded-xl border border-amber-300 shadow-xs p-5 transition"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                  #{index + 1} API Rate Limited (429)
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs">
                  {item.file.name}
                </h3>
              </div>
              <p className="text-xs text-amber-800 mt-1 font-medium">
                {item.retryCountdown
                  ? `Gemini quota rate limit reached. Pausing queue to reset, auto-retrying in ${item.retryCountdown}s...`
                  : 'Gemini quota rate limit reached. The system will automatically back off and retry.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onProcessSingle && (
              <button
                type="button"
                onClick={() => onProcessSingle(item.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer"
                title="Retry now"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Now</span>
              </button>
            )}
            {item.file.previewUrl && (
              <button
                type="button"
                onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If item failed with an error
  if (item.status === 'error') {
    const displayError = (() => {
      const err = item.error || 'Failed to extract marksheet details';
      if (err.includes('429') || err.includes('RESOURCE_EXHAUSTED') || err.includes('quota') || err.includes('rate limit')) {
        return 'Gemini API rate limit reached (429). Click Retry or wait a moment.';
      }
      if (err.includes('503') || err.includes('UNAVAILABLE') || err.includes('No capacity') || err.includes('overloaded')) {
        return 'Gemini model temporarily unavailable (503). Click Retry to use a fallback model.';
      }
      if (err.startsWith('{')) {
        try {
          const parsed = JSON.parse(err);
          if (parsed.error?.message) return parsed.error.message;
        } catch {
          // not json
        }
      }
      return err;
    })();

    return (
      <div
        id={`marksheet-card-${item.id}`}
        className="bg-red-50/60 rounded-xl border border-red-300 shadow-xs p-5"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center border border-red-200 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                  #{index + 1} Extraction Failed
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs">
                  {item.file.name}
                </h3>
              </div>
              <p className="text-xs text-red-700 mt-1 font-medium max-w-md">
                {displayError}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onProcessSingle && (
              <button
                type="button"
                onClick={() => onProcessSingle(item.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            {item.file.previewUrl && (
              <button
                type="button"
                onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline field update helper
  const handleFieldChange = (field: string, value: any) => {
    if (!data) return;
    const updated = {
      ...data,
      [field]: value === '' ? null : value,
    };
    onUpdateData(item.id, updated);
  };

  // Inline subject update
  const handleSubjectChange = (subIndex: number, key: keyof SubjectRecord, val: any) => {
    if (!data || !data.subjects) return;
    const newSubjects = [...data.subjects];
    newSubjects[subIndex] = {
      ...newSubjects[subIndex],
      [key]: key === 'marks' || key === 'max_marks' ? (val === '' ? null : Number(val)) : val,
    };
    const updated = {
      ...data,
      subjects: newSubjects,
    };
    const { total: newTotal, percentage: newPct } = calculateTotalsAndPercentage(updated);
    updated.total = newTotal;
    updated.percentage = newPct;
    onUpdateData(item.id, updated);
  };

  // Add subject
  const handleAddSubject = () => {
    if (!data) return;
    const newSubjects = [
      ...(data.subjects || []),
      { name: 'New Subject', marks: null, max_marks: 100, grade: '' },
    ];
    const updated = {
      ...data,
      subjects: newSubjects,
    };
    const { total: newTotal, percentage: newPct } = calculateTotalsAndPercentage(updated);
    updated.total = newTotal;
    updated.percentage = newPct;
    onUpdateData(item.id, updated);
  };

  // Delete subject
  const handleDeleteSubject = (subIndex: number) => {
    if (!data || !data.subjects) return;
    const newSubjects = data.subjects.filter((_, idx) => idx !== subIndex);
    const updated = {
      ...data,
      subjects: newSubjects,
    };
    const { total: newTotal, percentage: newPct } = calculateTotalsAndPercentage(updated);
    updated.total = newTotal;
    updated.percentage = newPct;
    onUpdateData(item.id, updated);
  };

  const isLowConfidence = (fieldName: string) => {
    return data?.low_confidence_fields?.some(
      (f) => f.toLowerCase() === fieldName.toLowerCase() || f.includes(fieldName)
    );
  };

  return (
    <div
      id={`marksheet-card-${item.id}`}
      className={`bg-white rounded-xl border transition-all duration-150 ${
        item.approved
          ? 'border-emerald-300 ring-1 ring-emerald-200/50 shadow-xs'
          : errors.length > 0
          ? 'border-red-300 shadow-xs'
          : warnings.length > 0
          ? 'border-amber-300 shadow-xs'
          : 'border-slate-200 shadow-xs'
      }`}
    >
      {/* Header Bar */}
      <div className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <div className="flex items-center space-x-3 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-semibold text-xs">
            #{index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {data?.student_name || <span className="text-red-600 font-normal italic">Missing Student Name</span>}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {data?.roll_number ? `Roll: ${data.roll_number}` : '(No Roll No)'}
              </span>
              {item.approved ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Approved
                </span>
              ) : errors.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  {errors.length} Issue{errors.length > 1 ? 's' : ''}
                </span>
              ) : warnings.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              File: {item.file.name} • {data?.board || 'Board unspecified'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Preview button */}
          {item.file.previewUrl && (
            <button
              type="button"
              onClick={() => onViewImage(item.file.previewUrl!, item.file.name)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
              title="Inspect Original Document"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Source Preview</span>
            </button>
          )}

          {/* Toggle Approve */}
          <button
            type="button"
            onClick={() => onToggleApprove(item.id)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              item.approved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{item.approved ? 'Approved' : 'Approve'}</span>
          </button>

          {/* Delete Card */}
          <button
            id={`btn-delete-card-${item.id}`}
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
            title="Remove this marksheet"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Card Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Validation Warnings / Error Banner */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              {issues.map((iss, iIdx) => (
                <div
                  key={iIdx}
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    iss.type === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {iss.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className="font-semibold">{iss.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Thumbnail (Side-by-side) */}
            <div className="lg:col-span-3 space-y-2">
              <div
                onClick={() => item.file.previewUrl && onViewImage(item.file.previewUrl, item.file.name)}
                className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100 cursor-pointer aspect-3/4 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition"
              >
                {item.file.previewUrl ? (
                  <>
                    <img
                      src={item.file.previewUrl}
                      alt="Source document preview"
                      className="w-full h-full object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium gap-1.5 transition">
                      <Maximize2 className="w-4 h-4" />
                      <span>Click to zoom</span>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-500">Document Scan</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Click preview image to compare original source text
              </p>
            </div>

            {/* Right Fields Form & Dynamic Subjects */}
            <div className="lg:col-span-9 space-y-4">
              {/* Student Metadata Form */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Student Details (Inline Editable)
                  </span>
                  <span className="text-[11px] text-slate-400">Click any field to correct</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Student Name */}
                  <div className="space-y-1">
                    <label className="text-slate-500 flex items-center justify-between">
                      <span>Student Name *</span>
                      {isLowConfidence('student_name') && (
                        <span className="text-[10px] text-amber-600 font-medium">Low conf</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={data?.student_name || ''}
                      onChange={(e) => handleFieldChange('student_name', e.target.value)}
                      placeholder="e.g. Rahul Kumar"
                      className={`w-full px-2.5 py-1.5 rounded border text-xs font-medium text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 ${
                        !data?.student_name
                          ? 'border-red-400 bg-red-50/30'
                          : isLowConfidence('student_name')
                          ? 'border-amber-400 bg-amber-50/30'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>

                  {/* Roll Number */}
                  <div className="space-y-1">
                    <label className="text-slate-500 flex items-center justify-between">
                      <span>Roll Number *</span>
                      {isLowConfidence('roll_number') && (
                        <span className="text-[10px] text-amber-600 font-medium">Low conf</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={data?.roll_number || ''}
                      onChange={(e) => handleFieldChange('roll_number', e.target.value)}
                      placeholder="e.g. 2145890"
                      className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono font-medium text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 ${
                        !data?.roll_number
                          ? 'border-red-400 bg-red-50/30'
                          : isLowConfidence('roll_number')
                          ? 'border-amber-400 bg-amber-50/30'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>

                  {/* Registration Number */}
                  <div className="space-y-1">
                    <label className="text-slate-500">Registration No.</label>
                    <input
                      type="text"
                      value={data?.registration_number || ''}
                      onChange={(e) => handleFieldChange('registration_number', e.target.value)}
                      placeholder="e.g. R/24/09812"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-1">
                    <label className="text-slate-500">Date of Birth</label>
                    <input
                      type="text"
                      value={data?.date_of_birth || ''}
                      onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Board */}
                  <div className="space-y-1">
                    <label className="text-slate-500">Board / Council</label>
                    <input
                      type="text"
                      value={data?.board || ''}
                      onChange={(e) => handleFieldChange('board', e.target.value)}
                      placeholder="e.g. CBSE / State Board"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Class */}
                  <div className="space-y-1">
                    <label className="text-slate-500">Class / Exam</label>
                    <input
                      type="text"
                      value={data?.class_name || ''}
                      onChange={(e) => handleFieldChange('class_name', e.target.value)}
                      placeholder="Class X / Class XII"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Year */}
                  <div className="space-y-1">
                    <label className="text-slate-500">Exam Year</label>
                    <input
                      type="text"
                      value={data?.year || ''}
                      onChange={(e) => handleFieldChange('year', e.target.value)}
                      placeholder="e.g. 2024"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* School */}
                  <div className="space-y-1">
                    <label className="text-slate-500">School / Institution</label>
                    <input
                      type="text"
                      value={data?.school || ''}
                      onChange={(e) => handleFieldChange('school', e.target.value)}
                      placeholder="School Name"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Subjects Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Extracted Subjects ({data?.subjects?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subject</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Subject Name</th>
                        <th className="py-2 px-3 w-28 text-right">Marks</th>
                        <th className="py-2 px-3 w-28 text-right">Max Marks</th>
                        <th className="py-2 px-3 w-24 text-center">Grade</th>
                        <th className="py-2 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {data?.subjects && data.subjects.length > 0 ? (
                        data.subjects.map((sub, sIdx) => {
                          const isMarksInvalid =
                            sub.marks !== null &&
                            sub.marks !== undefined &&
                            (sub.marks < 0 || sub.marks > (sub.max_marks || 100));

                          return (
                            <tr key={sIdx} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-3 text-slate-400 font-mono">{sIdx + 1}</td>
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={sub.name}
                                  onChange={(e) => handleSubjectChange(sIdx, 'name', e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-hidden focus:border-blue-500"
                                />
                              </td>
                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  value={sub.marks !== null && sub.marks !== undefined ? sub.marks : ''}
                                  onChange={(e) => handleSubjectChange(sIdx, 'marks', e.target.value)}
                                  placeholder="0"
                                  className={`w-full text-right px-2 py-1 rounded border text-xs font-semibold focus:outline-hidden ${
                                    isMarksInvalid
                                      ? 'border-red-400 bg-red-50 text-red-700'
                                      : 'border-slate-200 text-emerald-700 focus:border-blue-500'
                                  }`}
                                />
                              </td>
                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  value={sub.max_marks !== null && sub.max_marks !== undefined ? sub.max_marks : ''}
                                  onChange={(e) => handleSubjectChange(sIdx, 'max_marks', e.target.value)}
                                  placeholder="100"
                                  className="w-full text-right px-2 py-1 rounded border border-slate-200 text-xs text-slate-600 focus:outline-hidden focus:border-blue-500"
                                />
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                <input
                                  type="text"
                                  value={sub.grade || ''}
                                  onChange={(e) => handleSubjectChange(sIdx, 'grade', e.target.value)}
                                  placeholder="A1"
                                  className="w-full text-center px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-800 uppercase focus:outline-hidden focus:border-blue-500"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubject(sIdx)}
                                  className="text-slate-300 hover:text-red-600 transition p-1 cursor-pointer"
                                  title="Remove subject"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">
                            No subjects found. Click "Add Subject" above to insert.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Percentage Inline row */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Grand Total</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={(() => {
                        const c = data ? calculateTotalsAndPercentage(data) : null;
                        const val = data?.total !== null && data?.total !== undefined ? data.total : c?.total;
                        return val !== null && val !== undefined ? val : '';
                      })()}
                      onChange={(e) => handleFieldChange('total', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Total"
                      className="w-24 text-right px-2 py-1 rounded border border-slate-300 text-sm font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Percentage (%)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={(() => {
                        const c = data ? calculateTotalsAndPercentage(data) : null;
                        const val = data?.percentage !== null && data?.percentage !== undefined ? data.percentage : c?.percentage;
                        return val !== null && val !== undefined ? val : '';
                      })()}
                      onChange={(e) => handleFieldChange('percentage', e.target.value ? Number(e.target.value) : null)}
                      placeholder="%"
                      className="w-24 text-right px-2 py-1 rounded border border-slate-300 text-sm font-bold text-blue-700 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Table as TableIcon,
  Columns,
  Layers,
  ArrowRight,
  Info,
  ExternalLink,
  Filter,
  Save
} from 'lucide-react';
import { ProcessedMarksheet } from '../types';
import { normalizeSubjectName, calculateTotalsAndPercentage } from '../utils/excelExport';

interface Props {
  items: ProcessedMarksheet[];
  allSubjects: string[];
  onDownloadExcel: (onlyApproved: boolean) => void;
  onSwitchToInterpretation: () => void;
  onSaveBatch?: () => void;
}

export const ExcelExportView: React.FC<Props> = ({
  items,
  allSubjects,
  onDownloadExcel,
  onSwitchToInterpretation,
  onSaveBatch,
}) => {
  const [filterApprovedOnly, setFilterApprovedOnly] = useState(false);

  const completedItems = items.filter((it) => it.status === 'success' && it.data);
  const approvedCount = completedItems.filter((it) => it.approved).length;
  const displayItems = filterApprovedOnly
    ? completedItems.filter((it) => it.approved)
    : completedItems;

  return (
    <div id="excel-export-view" className="space-y-6 animate-in fade-in duration-200">
      {/* Excel Download Hero Banner */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative grid background */}
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <FileSpreadsheet className="w-80 h-80" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-700/60 text-emerald-200 border border-emerald-500/30">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Microsoft Excel (.XLSX) Export Ready</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Download Consolidated Marksheet Spreadsheet
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Every interpreted marksheet is automatically unified into a standardized multi-column spreadsheet. Subjects from CBSE, ICSE, and State Boards are normalized so all marks align cleanly into dedicated columns.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-emerald-200 font-medium">
              <span>✓ {completedItems.length} Student Marksheets</span>
              <span>✓ {allSubjects.length} Subject Columns</span>
              <span>✓ OpenXML .xlsx (Excel & Google Sheets)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              id="btn-download-excel-main"
              type="button"
              onClick={() => onDownloadExcel(false)}
              disabled={completedItems.length === 0}
              className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-95 cursor-pointer ${
                completedItems.length > 0
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black hover:shadow-emerald-900/50'
                  : 'bg-emerald-900/50 text-emerald-300/40 cursor-not-allowed border border-emerald-700/30'
              }`}
            >
              <Download className="w-5 h-5" />
              <span>Download Excel File ({completedItems.length} Students)</span>
            </button>

            {approvedCount > 0 && approvedCount < completedItems.length && (
              <button
                type="button"
                onClick={() => onDownloadExcel(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700/50 hover:bg-emerald-700 text-white border border-emerald-500/40 transition cursor-pointer"
              >
                <span>Download Approved Only ({approvedCount})</span>
              </button>
            )}

            {onSaveBatch && items.length > 0 && (
              <button
                id="btn-excel-save-to-history"
                type="button"
                onClick={onSaveBatch}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-emerald-950 hover:bg-emerald-50 shadow-md transition cursor-pointer"
                title="Save this batch to history and clear workspace"
              >
                <Save className="w-4 h-4 text-emerald-700" />
                <span>Save to History & Clear Workspace</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSwitchToInterpretation}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-emerald-200 hover:text-white hover:bg-emerald-800/40 transition cursor-pointer"
            >
              <span>View & Edit Individual Marksheets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Preview Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Live Excel Workbook Preview: Sheet 1 ("Consolidated Marksheets")
              </h3>
              <p className="text-xs text-slate-500">
                This table reflects the exact rows and column structure that will be saved in your downloaded .xlsx file.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={filterApprovedOnly}
                onChange={(e) => setFilterApprovedOnly(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span>Show approved only ({approvedCount})</span>
            </label>

            <button
              type="button"
              onClick={() => onDownloadExcel(filterApprovedOnly)}
              disabled={displayItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .XLSX</span>
            </button>
          </div>
        </div>

        {/* Excel Spreadsheet Table Simulation */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[500px] shadow-2xs bg-white">
          <table className="min-w-full text-xs border-collapse">
            {/* Top Excel Column Identifiers (A, B, C, D...) */}
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="w-12 px-3 py-1.5 font-mono text-[10px] text-slate-500 text-center border-r border-slate-300 bg-slate-200/80">
                  #
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-left border-r border-slate-200">
                  A [S.No]
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-left border-r border-slate-200">
                  B [Roll No]
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-left border-r border-slate-200 min-w-[150px]">
                  C [Student Name]
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-left border-r border-slate-200 min-w-[180px]">
                  D [Board / Council]
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-left border-r border-slate-200 min-w-[150px]">
                  E [School / Center]
                </th>

                {/* Dynamic Subject Columns */}
                {allSubjects.map((subject, sIdx) => {
                  const colLetter = String.fromCharCode(70 + (sIdx % 20)); // F, G, H...
                  return (
                    <th
                      key={subject}
                      className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-center border-r border-slate-200 min-w-[110px] bg-emerald-50/50"
                    >
                      {colLetter} [{subject}]
                    </th>
                  );
                })}

                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-center border-r border-slate-200 min-w-[90px] bg-blue-50/50">
                  Total
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-center border-r border-slate-200 min-w-[80px] bg-blue-50/50">
                  Percentage
                </th>
                <th className="px-3 py-1.5 font-mono text-[10px] text-slate-500 text-center">
                  Status
                </th>
              </tr>

              {/* Real Human Header Row */}
              <tr className="bg-emerald-800 text-white font-bold border-b border-emerald-900">
                <th className="px-3 py-2 text-center border-r border-emerald-700 bg-emerald-900">
                  •
                </th>
                <th className="px-3 py-2 text-left border-r border-emerald-700">S.No</th>
                <th className="px-3 py-2 text-left border-r border-emerald-700">Roll Number</th>
                <th className="px-3 py-2 text-left border-r border-emerald-700">Student Name</th>
                <th className="px-3 py-2 text-left border-r border-emerald-700">Board / Council</th>
                <th className="px-3 py-2 text-left border-r border-emerald-700">School / College</th>

                {allSubjects.map((sub) => (
                  <th
                    key={sub}
                    className="px-3 py-2 text-center border-r border-emerald-700 whitespace-nowrap"
                  >
                    {sub}
                  </th>
                ))}

                <th className="px-3 py-2 text-center border-r border-emerald-700">Total Marks</th>
                <th className="px-3 py-2 text-center border-r border-emerald-700">Percentage (%)</th>
                <th className="px-3 py-2 text-center">Approval Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-sans">
              {displayItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={allSubjects.length + 9}
                    className="text-center py-12 text-slate-400 italic"
                  >
                    No completed marksheets ready for export yet.
                  </td>
                </tr>
              ) : (
                displayItems.map((item, idx) => {
                  const s = item.data!;
                  // Map student's subjects for fast lookup
                  const subMap: Record<string, number | string> = {};
                  s.subjects?.forEach((sub) => {
                    if (sub && sub.name) {
                      const norm = normalizeSubjectName(sub.name);
                      subMap[norm] = sub.marks !== null ? sub.marks : (sub.grade || 'Present');
                    }
                  });

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                      }`}
                    >
                      {/* Row index (1, 2, 3...) */}
                      <td className="px-3 py-2 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 bg-slate-100/50">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-900 border-r border-slate-200">
                        {s.roll_number || '—'}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900 border-r border-slate-200">
                        {s.student_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 border-r border-slate-200 truncate max-w-[200px]" title={s.board || ''}>
                        {s.board || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 border-r border-slate-200 truncate max-w-[180px]" title={s.school || ''}>
                        {s.school || '—'}
                      </td>

                      {/* Marks per Subject */}
                      {allSubjects.map((sub) => {
                        const val = subMap[sub];
                        return (
                          <td
                            key={sub}
                            className={`px-3 py-2 text-center border-r border-slate-200 font-mono ${
                              val !== undefined ? 'font-bold text-slate-900' : 'text-slate-300'
                            }`}
                          >
                            {val !== undefined ? val : '—'}
                          </td>
                        );
                      })}

                      {/* Total Marks */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-blue-700 border-r border-slate-200 bg-blue-50/30">
                        {(() => {
                          const { total: cTotal } = calculateTotalsAndPercentage(s);
                          const finalT = s.total !== null && s.total !== undefined ? s.total : cTotal;
                          return finalT !== null ? finalT : '—';
                        })()}
                      </td>

                      {/* Percentage */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-200 bg-emerald-50/30">
                        {(() => {
                          const { percentage: cPct } = calculateTotalsAndPercentage(s);
                          const finalP = s.percentage !== null && s.percentage !== undefined ? s.percentage : cPct;
                          return finalP !== null ? `${finalP}%` : '—';
                        })()}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.approved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 px-1">
          <span>
            Displaying {displayItems.length} student records • {allSubjects.length} aligned subject columns
          </span>
          <span className="italic">
            Tip: You can modify any student's name, roll number, or mark in the "Marksheet Interpretation" tab before downloading.
          </span>
        </div>
      </div>
    </div>
  );
};

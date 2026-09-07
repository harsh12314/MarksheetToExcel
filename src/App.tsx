import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Check,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Clock,
  Layers,
  FileText,
  Filter,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Pause,
  Play,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Save,
  History,
  BookmarkCheck,
  Tag,
} from 'lucide-react';
import { ProcessedMarksheet, MarksheetData, SavedBatch } from './types';
import { validateMarksheet } from './utils/validation';
import { generateExcelWorkbook, downloadExcelFile, normalizeSubjectName, calculateTotalsAndPercentage } from './utils/excelExport';
import { MarksheetReviewCard } from './components/MarksheetReviewCard';
import { SpreadsheetReviewTable } from './components/SpreadsheetReviewTable';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ExcelExportView } from './components/ExcelExportView';
import { BatchHistoryView } from './components/BatchHistoryView';
import { ConfirmModal } from './components/ConfirmModal';
import { SaveBatchModal } from './components/SaveBatchModal';

import { optimizeImageForOcr } from './utils/imageCompressor';
import { saveDocumentLocally, getDocumentUrl } from './utils/localDocumentStore';

export default function App() {
  // Initialize with empty workspace for real uploads (sample marksheets can be loaded on-demand)
  const [items, setItems] = useState<ProcessedMarksheet[]>([]);
  const [history, setHistory] = useState<SavedBatch[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('marksheet_batch_history_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load history from localStorage', e);
    }
    return [];
  });
  const [mainTab, setMainTab] = useState<'interpretation' | 'excel-export' | 'batch-upload' | 'history'>('interpretation');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [concurrency, setConcurrency] = useState(2); // Safe concurrency: 2 parallel workers

  // View preferences
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'issues'>('all');
  const [cardPage, setCardPage] = useState(1);
  const cardsPerPage = 8;

  // Modals & messages
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string } | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [rateLimitAlert, setRateLimitAlert] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Batch naming & saving modal
  const [batchName, setBatchName] = useState<string>('');
  const [saveBatchModalOpen, setSaveBatchModalOpen] = useState<boolean>(false);

  // Timing metrics for ETA
  const [startTime, setStartTime] = useState<number | null>(null);
  const [processedCount, setProcessedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  const itemsRef = useRef<ProcessedMarksheet[]>(items);
  itemsRef.current = items;
  const isQueueRunningRef = useRef(false);
  const activeProcessingIds = useRef<Set<string>>(new Set());

  // Revoke blob Object URLs to prevent memory leaks
  const revokeItemUrls = (itemsToRevoke: ProcessedMarksheet[]) => {
    itemsToRevoke.forEach((it) => {
      if (it.file.previewUrl && it.file.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(it.file.previewUrl);
      }
    });
  };

  // Revoke all Object URLs on unmount
  useEffect(() => {
    return () => {
      revokeItemUrls(itemsRef.current);
    };
  }, []);

  // Collect all normalized subject names across all processed items
  const allSubjects = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      it.data?.subjects?.forEach((sub) => {
        if (sub && sub.name) {
          set.add(normalizeSubjectName(sub.name));
        }
      });
    });
    return Array.from(set).sort();
  }, [items]);

  // Process a single marksheet item via Gemini API
  const processMarksheetItem = async (targetId: string) => {
    if (activeProcessingIds.current.has(targetId)) return;
    activeProcessingIds.current.add(targetId);

    const currentItem = itemsRef.current.find((it) => it.id === targetId);
    if (!currentItem) {
      activeProcessingIds.current.delete(targetId);
      return;
    }

    setItems((current) =>
      current.map((it) => (it.id === targetId ? { ...it, status: 'processing', error: undefined } : it))
    );
    setActiveWorkers((w) => w + 1);

    try {
      // 1. Optimize image payload
      let base64Payload = currentItem.file.previewUrl || '';
      let mimeType = currentItem.file.type;

      const rawFile = (currentItem.file as any).rawFile;
      if (rawFile) {
        const optimized = await optimizeImageForOcr(rawFile);
        base64Payload = optimized.base64;
        mimeType = optimized.mimeType;
      } else if (base64Payload.startsWith('blob:')) {
        try {
          const res = await fetch(base64Payload);
          const blob = await res.blob();
          base64Payload = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Failed to convert blob URL to base64 payload:', e);
        }
      }

      // 2. Call Gemini extraction endpoint
      const response = await fetch('/api/extract-marksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Payload,
          mimeType,
          fileName: currentItem.file.name,
        }),
      });

      const responseText = await response.text();
      let resJson: any = {};
      try {
        resJson = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error('Server returned non-JSON response:', responseText);
        throw new Error(
          `Server Error (${response.status}): ${
            responseText.slice(0, 150) || 'Invalid server response'
          }`
        );
      }

      const isRateLimit =
        response.status === 429 ||
        resJson.isRateLimit === true ||
        String(resJson.error).includes('429') ||
        String(resJson.error).includes('RESOURCE_EXHAUSTED') ||
        String(resJson.error).includes('rate limit');

      if (isRateLimit) {
        console.warn(`Marksheet ${currentItem.file.name} hit rate limit (429). Setting up backoff...`);
        setRateLimitAlert('Gemini rate limit reached (429). Auto-backing off queue for 12s to reset quota...');

        setItems((current) =>
          current.map((it) =>
            it.id === targetId
              ? {
                  ...it,
                  status: 'rate_limited',
                  isRateLimit: true,
                  retryCountdown: 12,
                  error: 'Rate limited (429)',
                }
              : it
          )
        );

        // Countdown timer for automatic retry
        let countdown = 12;
        const timer = setInterval(() => {
          countdown -= 1;
          setItems((current) =>
            current.map((it) =>
              it.id === targetId ? { ...it, retryCountdown: Math.max(0, countdown) } : it
            )
          );
          if (countdown <= 0) {
            clearInterval(timer);
            setRateLimitAlert(null);
            setItems((current) =>
              current.map((it) =>
                it.id === targetId
                  ? { ...it, status: 'idle', retryCountdown: undefined, isRateLimit: undefined, error: undefined }
                  : it
              )
            );
            if (!isQueueRunningRef.current) {
              startConcurrentQueue();
            }
          }
        }, 1000);
        return;
      }

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Extraction failed');
      }

      const studentList: MarksheetData[] =
        Array.isArray(resJson.students) && resJson.students.length > 0
          ? resJson.students
          : resJson.data
          ? [resJson.data]
          : [];

      if (studentList.length === 0) {
        throw new Error('No student data extracted from marksheet');
      }

      // 1. Process Student 0 for the primary target item
      const primaryStudent = studentList[0];
      const { total: calcTotal, percentage: calcPct } = calculateTotalsAndPercentage(primaryStudent);
      if ((primaryStudent.total === null || primaryStudent.total === undefined) && calcTotal !== null) {
        primaryStudent.total = calcTotal;
      }
      if ((primaryStudent.percentage === null || primaryStudent.percentage === undefined) && calcPct !== null) {
        primaryStudent.percentage = calcPct;
      }
      const primaryValidation = validateMarksheet(primaryStudent);

      // Save document to browser IndexedDB
      let finalPreviewUrl = currentItem.file.previewUrl || '';
      try {
        const rawFile = (currentItem.file as any).rawFile as File | undefined;
        if (rawFile) {
          await saveDocumentLocally(targetId, rawFile, rawFile.name);
          const persistedUrl = await getDocumentUrl(targetId);
          if (persistedUrl) {
            if (finalPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(finalPreviewUrl);
            finalPreviewUrl = persistedUrl;
          }
        }
      } catch (saveErr) {
        console.warn('[IndexedDB] Could not persist document locally:', saveErr);
      }

      setItems((current) =>
        current.map((it) =>
          it.id === targetId
            ? {
                ...it,
                status: 'success',
                data: primaryStudent,
                validationIssues: primaryValidation,
                approved: !primaryValidation.some((issue) => issue.type === 'error'),
                file: {
                  ...it.file,
                  previewUrl: finalPreviewUrl,
                },
                retryCountdown: undefined,
              }
            : it
        )
      );

      // 2. If the PDF contained MULTIPLE students (e.g. 5 students in 1 multi-page PDF), add Student 1..N to workspace
      if (studentList.length > 1) {
        const extraStudentItems: ProcessedMarksheet[] = [];

        for (let sIdx = 1; sIdx < studentList.length; sIdx++) {
          const extraStudent = studentList[sIdx];
          const { total: extraTotal, percentage: extraPct } = calculateTotalsAndPercentage(extraStudent);
          if ((extraStudent.total === null || extraStudent.total === undefined) && extraTotal !== null) {
            extraStudent.total = extraTotal;
          }
          if ((extraStudent.percentage === null || extraStudent.percentage === undefined) && extraPct !== null) {
            extraStudent.percentage = extraPct;
          }
          const extraValidation = validateMarksheet(extraStudent);

          const extraId = `${targetId}-student-${sIdx}`;
          const studentDisplayName = extraStudent.student_name
            ? `${extraStudent.student_name} (${currentItem.file.name})`
            : `${currentItem.file.name} - Student ${sIdx + 1}`;

          const rawFile = (currentItem.file as any).rawFile as File | undefined;
          if (rawFile) {
            saveDocumentLocally(extraId, rawFile, studentDisplayName).catch(() => {});
          }

          extraStudentItems.push({
            id: extraId,
            file: {
              ...currentItem.file,
              name: studentDisplayName,
              previewUrl: finalPreviewUrl,
            },
            status: 'success',
            data: extraStudent,
            validationIssues: extraValidation,
            approved: !extraValidation.some((issue) => issue.type === 'error'),
          });
        }

        const updatedWithExtra = [...itemsRef.current, ...extraStudentItems];
        itemsRef.current = updatedWithExtra;
        setItems(updatedWithExtra);
      }

      setProcessedCount((c) => c + 1);
    } catch (err: any) {
      console.error(`Extraction failed for ${currentItem.file.name}:`, err);
      const errMsg = String(err.message || err);
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('rate limit');

      if (isRateLimit) {
        setRateLimitAlert('Gemini rate limit reached (429). Auto-backing off queue for 12s...');
        setItems((current) =>
          current.map((it) =>
            it.id === targetId
              ? {
                  ...it,
                  status: 'rate_limited',
                  isRateLimit: true,
                  retryCountdown: 12,
                  error: 'Rate limited (429)',
                }
              : it
          )
        );
        let countdown = 12;
        const timer = setInterval(() => {
          countdown -= 1;
          setItems((current) =>
            current.map((it) =>
              it.id === targetId ? { ...it, retryCountdown: Math.max(0, countdown) } : it
            )
          );
          if (countdown <= 0) {
            clearInterval(timer);
            setRateLimitAlert(null);
            setItems((current) =>
              current.map((it) =>
                it.id === targetId
                  ? { ...it, status: 'idle', retryCountdown: undefined, isRateLimit: undefined, error: undefined }
                  : it
              )
            );
            if (!isQueueRunningRef.current) {
              startConcurrentQueue();
            }
          }
        }, 1000);
      } else {
        setItems((current) =>
          current.map((it) =>
            it.id === targetId
              ? {
                  ...it,
                  status: 'error',
                  error: errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg,
                }
              : it
          )
        );
      }
    } finally {
      activeProcessingIds.current.delete(targetId);
      setActiveWorkers((w) => Math.max(0, w - 1));
    }
  };

  // Process a single marksheet on-demand (e.g. user clicked retry or extract single)
  const processSingleMarksheet = async (id: string) => {
    await processMarksheetItem(id);
  };

  // Concurrent Queue Runner
  const startConcurrentQueue = async () => {
    if (isQueueRunningRef.current) {
      // Loop is already running; it will pick up any new idle items
      return;
    }

    isQueueRunningRef.current = true;
    setIsProcessing(true);
    setIsPaused(false);
    if (!startTime) setStartTime(Date.now());

    const workerLoop = async () => {
      while (true) {
        if (isPausedRef.current) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        // Find next idle item that is not in activeProcessingIds
        const next = itemsRef.current.find(
          (it) => it.status === 'idle' && !activeProcessingIds.current.has(it.id)
        );

        if (!next) {
          // No more idle items left for this worker
          break;
        }

        await processMarksheetItem(next.id);
        // Small pacing delay between items to respect Gemini RPM quota
        await new Promise((r) => setTimeout(r, 900));
      }
    };

    const poolSize = Math.max(1, Math.min(concurrency, 6));
    const workerPromises = Array.from({ length: poolSize }, () => workerLoop());

    await Promise.all(workerPromises);

    // Double check if any new idle items were added while workers were finishing
    const remainingIdle = itemsRef.current.find(
      (it) => it.status === 'idle' && !activeProcessingIds.current.has(it.id)
    );
    if (remainingIdle) {
      isQueueRunningRef.current = false;
      startConcurrentQueue();
      return;
    }

    isQueueRunningRef.current = false;
    setIsProcessing(false);
    setActiveWorkers(0);
  };

  // Handle file uploads (optimized for 100+ images)
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: ProcessedMarksheet[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(file.name || '');
      if (!isImage && !isPdf) continue;

      // Create quick object URL for UI thumbnail
      const previewUrl = URL.createObjectURL(file);

      newItems.push({
        id: `ms-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        file: {
          name: file.name,
          size: file.size,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          previewUrl,
          // Store raw file handle for on-demand compression
          rawFile: file,
        } as any,
        status: 'idle',
      });
    }

    if (newItems.length === 0) return;

    const updated = [...itemsRef.current, ...newItems];
    itemsRef.current = updated;
    setItems(updated);

    // Save documents to local IndexedDB immediately so they are available in History anytime
    newItems.forEach((it) => {
      if ((it.file as any)?.rawFile) {
        saveDocumentLocally(it.id, (it.file as any).rawFile, it.file.name);
      }
    });

    // Switch automatically to dense table view if adding a large batch (10+)
    if (updated.length >= 10 && viewMode === 'cards') {
      setViewMode('table');
    }

    // Always bring user to interpretation tab so they see progress
    setMainTab('interpretation');

    // Trigger processing
    setTimeout(() => {
      startConcurrentQueue();
    }, 50);
  };


  // Retry all failed and rate-limited items
  const handleRetryFailed = () => {
    const updated = itemsRef.current.map((it) =>
      it.status === 'error' || it.status === 'rate_limited'
        ? { ...it, status: 'idle' as const, error: undefined, isRateLimit: undefined, retryCountdown: undefined }
        : it
    );
    itemsRef.current = updated;
    setItems(updated);
    setTimeout(() => {
      startConcurrentQueue();
    }, 50);
  };

  // Manual trigger to process all remaining idle marksheets
  const handleProcessAllIdle = () => {
    startConcurrentQueue();
  };

  // Inline update item data
  const handleUpdateItemData = (id: string, updatedData: MarksheetData) => {
    const updatedIssues = validateMarksheet(updatedData);
    const hasErrors = updatedIssues.some((issue) => issue.type === 'error');

    setItems((current) =>
      current.map((it) =>
        it.id === id
          ? {
              ...it,
              data: updatedData,
              validationIssues: updatedIssues,
              approved: hasErrors ? false : it.approved,
            }
          : it
      )
    );
  };

  // Toggle approval state
  const handleToggleApprove = (id: string) => {
    setItems((current) =>
      current.map((it) => (it.id === id ? { ...it, approved: !it.approved } : it))
    );
  };

  // Approve all verified / non-error items
  const handleApproveAll = () => {
    setItems((current) =>
      current.map((it) => {
        if (it.status === 'success' && it.data) {
          return { ...it, approved: true };
        }
        return it;
      })
    );
  };

  // Delete single item from workspace
  const handleDeleteItem = (id: string) => {
    activeProcessingIds.current.delete(id);
    const toRemove = itemsRef.current.filter((it) => it.id === id);
    revokeItemUrls(toRemove);
    setItems((current) => {
      const next = current.filter((it) => it.id !== id);
      itemsRef.current = next;
      return next;
    });
    setExportSuccessMessage('Marksheet removed from workspace.');
    setTimeout(() => setExportSuccessMessage(null), 3000);
  };

  // Delete multiple selected items
  const handleDeleteMultiple = (ids: string[]) => {
    if (ids.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Delete ${ids.length} Marksheet${ids.length > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete the ${ids.length} selected marksheet record(s) from your active workspace?`,
      confirmText: `Delete (${ids.length})`,
      isDanger: true,
      onConfirm: () => {
        const idSet = new Set(ids);
        ids.forEach((id) => activeProcessingIds.current.delete(id));
        const toRemove = itemsRef.current.filter((it) => idSet.has(it.id));
        revokeItemUrls(toRemove);
        setItems((current) => {
          const next = current.filter((it) => !idSet.has(it.id));
          itemsRef.current = next;
          return next;
        });
        setExportSuccessMessage(`Deleted ${ids.length} marksheet record(s).`);
        setTimeout(() => setExportSuccessMessage(null), 3500);
      },
    });
  };

  // Clear all workspace items with custom ConfirmModal
  const handleClearAll = () => {
    if (items.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Clear Active Workspace',
      message: `Are you sure you want to clear all ${items.length} marksheets from your active session? This will reset the workspace for fresh uploads.`,
      confirmText: 'Clear All Marksheets',
      isDanger: true,
      onConfirm: () => {
        revokeItemUrls(itemsRef.current);
        setItems([]);
        itemsRef.current = [];
        setExportSuccessMessage('Workspace cleared.');
        setIsProcessing(false);
        setIsPaused(false);
        setActiveWorkers(0);
        activeProcessingIds.current.clear();
        setTimeout(() => setExportSuccessMessage(null), 3000);
      },
    });
  };

  // Export to Excel (can be triggered at any time, even while processing)
  const handleExportExcel = (onlyApproved = false) => {
    const exportTargets = items.filter(
      (it) => it.status === 'success' && it.data && (!onlyApproved || it.approved)
    );

    if (exportTargets.length === 0) {
      alert('No marksheets ready for export yet. Please wait for at least one marksheet to finish.');
      return;
    }

    const rowsToExport = exportTargets.map((it) => ({
      student: it.data!,
      filename: it.file.name,
      isApproved: it.approved,
    }));

    const cleanBatchName = batchName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = cleanBatchName ? `${cleanBatchName}.xlsx` : `Student_Marksheets_Batch_${Date.now()}.xlsx`;
    downloadExcelFile(rowsToExport, filename);

    setExportSuccessMessage(
      `Successfully exported ${exportTargets.length} marksheet(s) with ${allSubjects.length} dynamic subject columns to Excel!`
    );
    setTimeout(() => setExportSuccessMessage(null), 5000);
  };

  // Persist history to localStorage
  useEffect(() => {
    try {
      const lightweightHistory = history.map((batch) => ({
        ...batch,
        items: batch.items.map((it) => ({
          ...it,
          file: {
            ...it.file,
            previewUrl:
              it.file.previewUrl && it.file.previewUrl.length > 50000
                ? undefined
                : it.file.previewUrl,
          },
        })),
      }));
      localStorage.setItem('marksheet_batch_history_v1', JSON.stringify(lightweightHistory));
    } catch (e) {
      console.warn('Failed to save history to localStorage', e);
    }
  }, [history]);

  // Open modal to name/confirm batch when saving
  const handleSaveBatch = () => {
    if (items.length === 0) {
      alert('No marksheets in current workspace to save.');
      return;
    }
    setSaveBatchModalOpen(true);
  };

  // Commit and save the batch with the specified title
  const executeSaveBatch = (customTitle?: string) => {
    const completedItems = items.filter((it) => it.status === 'success' && it.data);
    const boardsSet = new Set<string>();
    let totalPercent = 0;
    let percentCount = 0;
    let topStudent: { name: string; percentage: number } | undefined = undefined;

    completedItems.forEach((it) => {
      if (it.data?.board) {
        const b = it.data.board.toUpperCase();
        if (b.includes('CBSE')) boardsSet.add('CBSE');
        else if (b.includes('ICSE') || b.includes('CISCE')) boardsSet.add('ICSE/CISCE');
        else if (b.includes('STATE') || b.includes('INTERMEDIATE') || b.includes('BOARD')) boardsSet.add('State Board');
        else boardsSet.add(it.data.board.slice(0, 20));
      }
      if (it.data?.percentage !== null && it.data?.percentage !== undefined) {
        totalPercent += it.data.percentage;
        percentCount += 1;
        if (!topStudent || it.data.percentage > topStudent.percentage) {
          topStudent = {
            name: it.data.student_name || it.file.name,
            percentage: it.data.percentage,
          };
        }
      }
    });

    const boardsList = Array.from(boardsSet);
    const avgPercent = percentCount > 0 ? totalPercent / percentCount : undefined;

    const batchNum = history.length + 1;
    const boardSuffix = boardsList.length > 0 ? ` (${boardsList.slice(0, 2).join(', ')})` : '';
    const fallbackTitle = batchName.trim() || `Batch #${batchNum} - ${items.length} Marksheets${boardSuffix}`;
    const finalTitle = customTitle?.trim() || fallbackTitle;

    const newBatch: SavedBatch = {
      id: `batch-${Date.now()}`,
      title: finalTitle,
      savedAt: new Date().toISOString(),
      itemCount: items.length,
      completedCount: completedItems.length,
      boards: boardsList,
      averagePercentage: avgPercent,
      topStudent,
      items: [...items],
    };

    // 1. Save to History
    setHistory((prev) => [newBatch, ...prev]);

    // 2. Clear active workspace
    setItems([]);
    itemsRef.current = [];
    setBatchName('');
    setSaveBatchModalOpen(false);
    setIsProcessing(false);
    setIsPaused(false);
    setActiveWorkers(0);
    activeProcessingIds.current.clear();
    setStartTime(null);
    setProcessedCount(0);

    // 3. Show in History
    setMainTab('history');
    setExportSuccessMessage(
      `Saved "${newBatch.title}" (${items.length} marksheets) to History. Active workspace is cleared for new uploads.`
    );
    setTimeout(() => setExportSuccessMessage(null), 6000);
  };

  // Restore saved batch from history back into workspace
  const handleRestoreBatch = (batch: SavedBatch) => {
    if (items.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Replace Current Workspace?',
        message: `Loading "${batch.title}" will replace the ${items.length} marksheet(s) currently in your workspace. Unsaved extractions will be lost. Proceed?`,
        confirmText: 'Replace & Load Batch',
        isDanger: false,
        onConfirm: () => {
          setItems(batch.items);
          itemsRef.current = batch.items;
          setBatchName(batch.title);
          setMainTab('interpretation');
          setExportSuccessMessage(
            `Restored "${batch.title}" with ${batch.items.length} marksheets into active workspace.`
          );
          setTimeout(() => setExportSuccessMessage(null), 4000);
        },
      });
      return;
    }

    setItems(batch.items);
    itemsRef.current = batch.items;
    setBatchName(batch.title);
    setMainTab('interpretation');
    setExportSuccessMessage(
      `Restored "${batch.title}" with ${batch.items.length} marksheets into active workspace.`
    );
    setTimeout(() => setExportSuccessMessage(null), 4000);
  };

  // Delete single batch from history
  const handleDeleteBatch = (batchId: string) => {
    setHistory((prev) => prev.filter((b) => b.id !== batchId));
    setExportSuccessMessage('Batch removed from history.');
    setTimeout(() => setExportSuccessMessage(null), 3000);
  };

  // Delete student record from a saved batch
  const handleDeleteItemFromBatch = (batchId: string, itemId: string) => {
    setHistory((prev) =>
      prev.map((b) => {
        if (b.id !== batchId) return b;
        const updatedItems = b.items.filter((it) => it.id !== itemId);
        const completed = updatedItems.filter((it) => it.status === 'success' && it.data);
        return {
          ...b,
          itemCount: updatedItems.length,
          completedCount: completed.length,
          items: updatedItems,
        };
      })
    );
    setExportSuccessMessage('Marksheet record removed from saved batch.');
    setTimeout(() => setExportSuccessMessage(null), 3000);
  };

  // Clear all history
  const handleClearAllHistory = () => {
    setHistory([]);
    setExportSuccessMessage('Cleared all saved batches from history.');
    setTimeout(() => setExportSuccessMessage(null), 3000);
  };

  // Rename a saved batch
  const handleRenameBatch = (batchId: string, newTitle: string) => {
    setHistory((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, title: newTitle } : b))
    );
  };

  // Statistics
  const completedCount = items.filter((it) => it.status === 'success').length;
  const errorCount = items.filter((it) => it.status === 'error').length;
  const idleCount = items.filter((it) => it.status === 'idle').length;
  const approvedCount = items.filter((it) => it.approved).length;
  const issuesCount = items.filter(
    (it) => it.validationIssues && it.validationIssues.length > 0
  ).length;

  // Calculate ETA
  let etaText = '';
  if (isProcessing && startTime && processedCount > 0 && idleCount > 0) {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const avgSecondsPerItem = elapsedSeconds / processedCount;
    const remainingSeconds = Math.round(avgSecondsPerItem * (idleCount / Math.max(1, concurrency)));
    if (remainingSeconds > 60) {
      etaText = `~${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s remaining`;
    } else {
      etaText = `~${remainingSeconds}s remaining`;
    }
  }

  // Filtered items
  const filteredItems = items.filter((it) => {
    if (activeFilter === 'pending') return !it.approved && it.status === 'success';
    if (activeFilter === 'approved') return it.approved;
    if (activeFilter === 'issues') return it.validationIssues && it.validationIssues.length > 0;
    return true;
  });

  // Card view pagination
  const totalPages = Math.ceil(filteredItems.length / cardsPerPage);
  const paginatedCardItems = filteredItems.slice(
    (cardPage - 1) * cardsPerPage,
    cardPage * cardsPerPage
  );

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Top Header */}
      <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Marksheet-to-Excel Converter
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  High-Volume Batch Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Process 100s of marksheets in parallel and download a unified consolidated Excel (.xlsx) spreadsheet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Shortcut Button */}
            {history.length > 0 && (
              <button
                id="btn-header-goto-history"
                type="button"
                onClick={() => setMainTab('history')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
                  mainTab === 'history'
                    ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
                title="View saved batches in history"
              >
                <History className="w-3.5 h-3.5 text-purple-600" />
                <span>History ({history.length})</span>
              </button>
            )}



            {/* Save Batch Button */}
            <button
              id="btn-save-batch-header"
              type="button"
              onClick={handleSaveBatch}
              disabled={items.length === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
                items.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Save current marksheets to history and clear workspace"
            >
              <Save className="w-4 h-4" />
              <span>Save Batch {items.length > 0 ? `(${items.length})` : ''}</span>
            </button>

            {/* Main Download Excel Button */}
            <button
              id="btn-download-excel-header"
              type="button"
              onClick={() => handleExportExcel(false)}
              disabled={completedCount === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
                completedCount > 0
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download Excel ({completedCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-5">
        {/* Success Alert */}
        {exportSuccessMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{exportSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Rate Limit Backoff Banner */}
        {rateLimitAlert && (
          <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
              <div>
                <span className="font-bold">API Quota Pacing Active: </span>
                <span>{rateLimitAlert}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRateLimitAlert(null)}
              className="text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Navigation Tabs (Marksheet Interpretation vs Download Excel vs Upload vs History) */}
        {(items.length > 0 || history.length > 0 || mainTab === 'history') && (
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="inline-flex rounded-xl p-1 bg-slate-200/80 text-xs font-semibold">
              <button
                id="tab-btn-interpretation"
                type="button"
                onClick={() => setMainTab('interpretation')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                  mainTab === 'interpretation'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>📋 Marksheet Interpretation</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800">
                  {completedCount}
                </span>
              </button>

              <button
                id="tab-btn-excel-export"
                type="button"
                onClick={() => setMainTab('excel-export')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                  mainTab === 'excel-export'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📥 Download Excel (.XLSX)</span>
                {completedCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      mainTab === 'excel-export'
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Ready ({completedCount})
                  </span>
                )}
              </button>

              <button
                id="tab-btn-batch-upload"
                type="button"
                onClick={() => setMainTab('batch-upload')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                  mainTab === 'batch-upload'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>📤 Upload Marksheets (100+)</span>
              </button>

              <button
                id="tab-btn-history"
                type="button"
                onClick={() => setMainTab('history')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                  mainTab === 'history'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>🕒 History</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    mainTab === 'history'
                      ? 'bg-purple-800 text-purple-100'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {history.length}
                </span>
              </button>
            </div>

            {/* Quick Actions: Save to History & One-Click Excel Download */}
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  id="btn-save-batch-action-top"
                  type="button"
                  onClick={handleSaveBatch}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                  title="Save current marksheets to history and clear workspace"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to History</span>
                </button>
              )}
              {idleCount > 0 && (
                <button
                  id="btn-process-all-idle-top"
                  type="button"
                  onClick={handleProcessAllIdle}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                  title="Extract candidate data and subject marks with Gemini AI"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {isProcessing
                      ? `Processing (${activeWorkers} active)...`
                      : `⚡ Process Marksheets (${idleCount} Queued)`}
                  </span>
                </button>
              )}
              <button
                id="btn-download-excel-action-top"
                type="button"
                onClick={() => handleExportExcel(false)}
                disabled={completedCount === 0}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
                  completedCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download Excel Sheet ({completedCount})</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {mainTab === 'history' ? (
          /* Dedicated Batch History Tab */
          <BatchHistoryView
            history={history}
            onRestoreBatch={handleRestoreBatch}
            onDeleteBatch={handleDeleteBatch}
            onClearAllHistory={handleClearAllHistory}
            onRenameBatch={handleRenameBatch}
            onDeleteItemFromBatch={handleDeleteItemFromBatch}
            onGoToUpload={() => setMainTab('batch-upload')}
            onViewImage={(url, title) => setPreviewModal({ url, title })}
          />
        ) : items.length === 0 ? (
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {/* If history exists, show quick link */}
            {history.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-purple-950">
                      You have {history.length} saved batch{history.length > 1 ? 'es' : ''} in History
                    </h4>
                    <p className="text-[11px] text-purple-700">
                      Access archived marksheets, export consolidated spreadsheets, or reload a previous batch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('history')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition cursor-pointer shrink-0"
                >
                  Open History ({history.length}) →
                </button>
              </div>
            )}

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Batch Marksheet Processing Engine (100+ Images)
              </h2>
              <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Drop hundreds of student marksheets at once. The system automatically optimizes image payloads, dispatches parallel Gemini workers, handles rate limits, validates marks, and unifies all unique subjects into a clean Excel spreadsheet.
              </p>
            </div>

            {/* Batch Name Input Field */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <label htmlFor="input-initial-batch-name" className="text-xs font-bold text-slate-800 block">
                    Batch Name (Optional)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Name this batch before dropping files, or customize it anytime before saving.
                  </p>
                </div>
              </div>
              <input
                id="input-initial-batch-name"
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={`e.g. Batch #${history.length + 1} - 10th Board Exam`}
                className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 bg-slate-50/50 focus:bg-white transition"
              />
            </div>

            {/* Multi-Dropzone */}
            <div
              id="massive-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) {
                  handleFilesAdded(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 hover:border-blue-600 hover:bg-blue-50/20 bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition shadow-xs group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition shadow-2xs">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-lg font-bold text-slate-900">
                Drop 10s or 100s of student marksheets here
              </p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                Select multiple files or entire folders. Supports scanned documents, mobile photos (JPG, PNG), and multi-page PDFs.
              </p>

            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 font-bold text-xs">
                  4x
                </div>
                <h3 className="text-xs font-semibold text-slate-900">Parallel Concurrency</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Processes multiple documents concurrently with automatic exponential backoff to maximize throughput without hitting Gemini 429 limits.
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-xs">
                  90%
                </div>
                <h3 className="text-xs font-semibold text-slate-900">Client Memory Optimization</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Auto-downscales multi-megapixel camera photos to crisp OCR bounds, preventing browser memory crashes across 100+ files.
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2 font-bold text-xs">
                  XLSX
                </div>
                <h3 className="text-xs font-semibold text-slate-900">Streaming Excel Export</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Download the consolidated spreadsheet at any point during batch processing with whatever records have completed.
                </p>
              </div>
            </div>
          </div>
        ) : mainTab === 'excel-export' ? (
          /* Dedicated Excel Export & Preview Tab */
          <ExcelExportView
            items={items}
            allSubjects={allSubjects}
            onDownloadExcel={handleExportExcel}
            onSwitchToInterpretation={() => setMainTab('interpretation')}
            onSaveBatch={handleSaveBatch}
          />
        ) : mainTab === 'batch-upload' ? (
          /* Dedicated Upload & Batch Engine Tab */
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload More Marksheets (100+ Batch Queue)</h3>
                  <p className="text-xs text-slate-500">
                    Add new marksheet scans or photos. They will automatically be compressed and queued for OCR extraction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('interpretation')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  ← Back to Marksheet Interpretation
                </button>
              </div>

              {/* Multi-Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    handleFilesAdded(e.dataTransfer.files);
                    setMainTab('interpretation');
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 hover:border-blue-600 hover:bg-blue-50/20 bg-slate-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition shadow-2xs group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-base font-bold text-slate-900">
                  Click or drag more marksheets here
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Supports batch folders, PDF documents, JPG, PNG, and camera photos.
                </p>

              </div>
            </div>
          </div>
        ) : (
          /* Active Marksheet Interpretation Dashboard */
          <div className="space-y-4">
            {/* Marksheet Interpretation Informational Header */}
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-blue-950 text-sm">
                    AI Marksheet Interpretation Active ({completedCount} Students Extracted)
                  </h3>
                  <p className="text-blue-700/90 mt-0.5">
                    Viewing candidate details, board identification, and subject marks breakdown. Click <strong>"View Original"</strong> to inspect the source document, or click <strong>"Download Excel"</strong> to get the consolidated spreadsheet.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMainTab('excel-export')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 inline mr-1" />
                  <span>Go to Excel Download →</span>
                </button>
              </div>
            </div>

            {/* Batch Name Header Bar */}
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 rounded-xl p-3 px-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-blue-950 shrink-0">Batch Name:</span>
                  <input
                    id="input-workspace-batch-name"
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder={`Batch #${history.length + 1} (${items.length} marksheets)`}
                    className="flex-1 max-w-md px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white rounded-lg border border-blue-200 hover:border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition shadow-2xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-blue-700/80 shrink-0 font-medium">
                <span>Auto-saved with history & Excel export</span>
              </div>
            </div>

            {/* Batch Status & Concurrency Control Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
              {/* Progress Summary Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900">
                      Batch Processing: {completedCount} / {items.length} Completed
                    </h2>
                    {isProcessing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        {activeWorkers} Parallel Workers Active
                      </span>
                    ) : isPaused ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <Pause className="w-3 h-3" />
                        Paused
                      </span>
                    ) : idleCount === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        All Processed
                      </span>
                    ) : null}

                    {etaText && (
                      <span className="text-xs text-slate-500 font-medium">
                        • {etaText}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {completedCount} ready • {approvedCount} approved • {errorCount} errors • {allSubjects.length} unique subjects detected
                  </p>
                </div>

                {/* Queue Controls: Pause, Resume, Concurrency, Export */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Start / Process Pending */}
                  {!isProcessing && idleCount > 0 && (
                    <button
                      id="btn-start-processing-batch"
                      type="button"
                      onClick={handleProcessAllIdle}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>⚡ Process Marksheets ({idleCount})</span>
                    </button>
                  )}

                  {/* Pause / Resume */}
                  {isProcessing && (
                    <button
                      type="button"
                      onClick={() => setIsPaused(!isPaused)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isPaused
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Resume Batch' : 'Pause'}</span>
                    </button>
                  )}

                  {/* Retry Failed */}
                  {errorCount > 0 && !isProcessing && (
                    <button
                      type="button"
                      onClick={handleRetryFailed}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Failed ({errorCount})</span>
                    </button>
                  )}

                  {/* Concurrency Selector */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
                    <Sliders className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500">Threads:</span>
                    <select
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      disabled={isProcessing}
                      className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                    >
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                      <option value={4}>4x</option>
                      <option value={5}>5x</option>
                    </select>
                  </div>

                  {/* Add more files */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Add More</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                  />

                  {/* Save Batch to History Button */}
                  <button
                    id="btn-save-batch-action"
                    type="button"
                    onClick={handleSaveBatch}
                    disabled={items.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                    title="Save current marksheets to history and clear workspace"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Batch ({items.length})</span>
                  </button>

                  {/* Primary Download Excel Button */}
                  <button
                    id="btn-download-excel-action"
                    type="button"
                    onClick={() => handleExportExcel(false)}
                    disabled={completedCount === 0}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
                      completedCount > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Export .XLSX ({completedCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                    title="Clear batch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(completedCount / Math.max(1, items.length)) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all duration-300"
                  />
                  <div
                    style={{ width: `${(errorCount / Math.max(1, items.length)) * 100}%` }}
                    className="bg-red-500 h-full transition-all duration-300"
                  />
                  <div
                    style={{ width: `${(activeWorkers / Math.max(1, items.length)) * 100}%` }}
                    className="bg-blue-500 h-full animate-pulse transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Progress: {Math.round((completedCount / items.length) * 100)}%</span>
                  <span>{idleCount} queued</span>
                </div>
              </div>
            </div>

            {/* Filter Tabs & View Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                {/* Filter Tabs */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('pending')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === 'pending'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending ({items.filter((it) => !it.approved && it.status === 'success').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('approved')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      activeFilter === 'approved'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Approved ({approvedCount})
                  </button>
                  {issuesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('issues')}
                      className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        activeFilter === 'issues'
                          ? 'bg-white text-red-700 shadow-2xs'
                          : 'text-red-600 hover:text-red-800'
                      }`}
                    >
                      Flagged ({issuesCount})
                    </button>
                  )}
                </div>

                {/* Approve All button */}
                {items.some((it) => !it.approved && it.status === 'success') && (
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve All Verified</span>
                  </button>
                )}

                {/* Save Batch button in filter bar */}
                {items.length > 0 && (
                  <button
                    id="btn-save-batch-filter-bar"
                    type="button"
                    onClick={handleSaveBatch}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                    title="Save current batch to history and clear workspace"
                  >
                    <Save className="w-3.5 h-3.5 text-blue-600" />
                    <span>Save to History</span>
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Dense Spreadsheet Table vs Detailed Cards */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Layout:</span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Dense spreadsheet grid — best for 100+ marksheets"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Spreadsheet Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Detailed side-by-side cards"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards View</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View Mode 1: Dense Spreadsheet Table (Recommended for 100s of images) */}
            {viewMode === 'table' && (
              <SpreadsheetReviewTable
                items={filteredItems}
                allSubjects={allSubjects}
                onUpdateData={handleUpdateItemData}
                onToggleApprove={handleToggleApprove}
                onDelete={handleDeleteItem}
                onViewImage={(url, title) => setPreviewModal({ url, title })}
                onProcessSingle={processSingleMarksheet}
                onSaveBatch={handleSaveBatch}
                onClearAll={handleClearAll}
                onDeleteMultiple={handleDeleteMultiple}
              />
            )}

            {/* View Mode 2: Detailed Cards with Pagination */}
            {viewMode === 'cards' && (
              <div className="space-y-4">
                {paginatedCardItems.map((item, index) => (
                  <MarksheetReviewCard
                    key={item.id}
                    item={item}
                    index={(cardPage - 1) * cardsPerPage + index}
                    onUpdateData={handleUpdateItemData}
                    onToggleApprove={handleToggleApprove}
                    onDelete={handleDeleteItem}
                    onViewImage={(url, title) => setPreviewModal({ url, title })}
                    onProcessSingle={processSingleMarksheet}
                  />
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">
                      Page {cardPage} of {totalPages} ({filteredItems.length} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={cardPage <= 1}
                        onClick={() => setCardPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded border border-slate-300 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 inline" /> Previous
                      </button>
                      <button
                        type="button"
                        disabled={cardPage >= totalPages}
                        onClick={() => setCardPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1 rounded border border-slate-300 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5 inline" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sticky Floating Export Bar */}
            {completedCount > 0 && (
              <div className="sticky bottom-4 z-20 bg-slate-900 text-white rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">
                      {completedCount} Marksheet{completedCount > 1 ? 's' : ''} Ready for Consolidated Download
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {approvedCount} approved • {allSubjects.length} unique subject columns unioned
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(false)}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Consolidated .XLSX</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Image Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          imageUrl={previewModal.url}
          title={previewModal.title}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* Reusable In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDanger={confirmModal.isDanger !== false}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Name Batch Modal */}
      <SaveBatchModal
        isOpen={saveBatchModalOpen}
        defaultName={
          batchName.trim() ||
          `Batch #${history.length + 1} - ${items.length} Marksheets`
        }
        itemCount={items.length}
        completedCount={completedCount}
        onSave={(name) => executeSaveBatch(name)}
        onCancel={() => setSaveBatchModalOpen(false)}
      />
    </div>
  );
}


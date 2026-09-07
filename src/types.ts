export interface SubjectRecord {
  name: string;
  marks: number | null;
  grade?: string | null;
  max_marks?: number | null;
}

export interface MarksheetData {
  student_name: string | null;
  roll_number: string | null;
  registration_number: string | null;
  date_of_birth: string | null;
  board: string | null;
  class_name: string | null;
  year: string | null;
  school: string | null;
  subjects: SubjectRecord[];
  total: number | null;
  percentage: number | null;
  low_confidence_fields?: string[];
}

export interface ValidationIssue {
  field: string;
  type: 'error' | 'warning' | 'info';
  message: string;
}

export interface ProcessedMarksheet {
  id: string;
  file: {
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  };
  status: 'idle' | 'processing' | 'success' | 'error' | 'rate_limited';
  data?: MarksheetData;
  rawJson?: string;
  validationIssues?: ValidationIssue[];
  error?: string;
  isRateLimit?: boolean;
  retryCountdown?: number;
  approved?: boolean;
}

export interface SavedBatch {
  id: string;
  title: string;
  savedAt: string;
  itemCount: number;
  completedCount: number;
  boards: string[];
  averagePercentage?: number;
  topStudent?: { name: string; percentage: number };
  items: ProcessedMarksheet[];
}

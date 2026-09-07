import * as XLSX from 'xlsx-js-style';
import { MarksheetData } from '../types';

/**
 * Standard alias map to normalize obvious near-duplicates
 * (e.g. Maths / Mathematics / English Core) without fuzzy matching.
 */
const SUBJECT_ALIAS_MAP: Record<string, string> = {
  // Mathematics
  'maths': 'Mathematics',
  'math': 'Mathematics',
  'mathematics': 'Mathematics',
  'mathematics standard': 'Mathematics',
  'mathematics basic': 'Mathematics',
  'applied mathematics': 'Mathematics (Applied)',
  'advance mathematics': 'Mathematics (Advanced)',

  // English
  'english': 'English',
  'eng': 'English',
  'english core': 'English',
  'english elective': 'English (Elective)',
  'english lang & lit': 'English',
  'english language': 'English',
  'english literature': 'English Literature',

  // Hindi
  'hindi': 'Hindi',
  'hindi course-a': 'Hindi',
  'hindi course-b': 'Hindi',
  'hindi core': 'Hindi',
  'hindi elective': 'Hindi (Elective)',

  // Sciences
  'physics': 'Physics',
  'phy': 'Physics',
  'physics (theory + practical)': 'Physics',
  'chemistry': 'Chemistry',
  'chem': 'Chemistry',
  'chemistry (theory + practical)': 'Chemistry',
  'biology': 'Biology',
  'bio': 'Biology',
  'science': 'Science',
  'science - theory & practical': 'Science',

  // Social Sciences
  'social science': 'Social Science',
  'social studies': 'Social Science',
  'history': 'History',
  'geography': 'Geography',
  'civics': 'Civics',
  'political science': 'Political Science',
  'economics': 'Economics',

  // Commerce
  'accountancy': 'Accountancy',
  'accounts': 'Accountancy',
  'business studies': 'Business Studies',
  'commerce': 'Commerce',

  // Computers
  'computer science': 'Computer Science',
  'computer applications': 'Computer Science',
  'informatics practices': 'Informatics Practices',
  'information technology': 'Information Technology',
};

export function normalizeSubjectName(rawName: string): string {
  if (!rawName) return 'Unknown Subject';
  const clean = rawName.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();

  if (SUBJECT_ALIAS_MAP[lower]) {
    return SUBJECT_ALIAS_MAP[lower];
  }

  // Capitalize neatly if not aliased
  return clean
    .split(' ')
    .map((word) => (word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toUpperCase()))
    .join(' ');
}

export interface StudentExcelRow {
  student: MarksheetData;
  filename?: string;
  isApproved?: boolean;
}

export function calculateTotalsAndPercentage(student: MarksheetData): {
  total: number | null;
  percentage: number | null;
  maxMarksSum: number;
} {
  let marksSum = 0;
  let maxMarksSum = 0;
  let hasValidMarks = false;

  if (Array.isArray(student.subjects)) {
    student.subjects.forEach((sub) => {
      if (typeof sub.marks === 'number' && !isNaN(sub.marks)) {
        hasValidMarks = true;
        marksSum += sub.marks;
        const max = typeof sub.max_marks === 'number' && sub.max_marks > 0 ? sub.max_marks : 100;
        maxMarksSum += max;
      }
    });
  }

  // Calculate or preserve total
  let total: number | null = null;
  if (typeof student.total === 'number' && !isNaN(student.total) && student.total > 0) {
    total = student.total;
  } else if (hasValidMarks) {
    total = marksSum;
  }

  // Calculate or preserve percentage
  let percentage: number | null = null;
  if (typeof student.percentage === 'number' && !isNaN(student.percentage) && student.percentage > 0) {
    percentage = student.percentage;
  } else if (total !== null && maxMarksSum > 0) {
    percentage = Math.round((total / maxMarksSum) * 10000) / 100;
  }

  return { total, percentage, maxMarksSum };
}

export function generateExcelWorkbook(items: StudentExcelRow[]) {
  // 1. Collect union of all normalized subjects across marksheets
  const subjectSet = new Set<string>();
  items.forEach((item) => {
    if (Array.isArray(item.student.subjects)) {
      item.student.subjects.forEach((sub) => {
        if (sub && sub.name) {
          const norm = normalizeSubjectName(sub.name);
          subjectSet.add(norm);
        }
      });
    }
  });

  const allSubjects = Array.from(subjectSet).sort();

  // 2. Build rows with fixed schema + dynamic subject columns + computed totals
  const rowData = items.map((item, idx) => {
    const s = item.student;

    // Create a lookup for student's subjects: normalized name -> marks string/number
    const studentSubjectsMap: Record<string, number | string> = {};
    if (Array.isArray(s.subjects)) {
      s.subjects.forEach((sub) => {
        if (sub && sub.name) {
          const norm = normalizeSubjectName(sub.name);
          // If marks available, use marks; otherwise note grade if available
          if (sub.marks !== null && sub.marks !== undefined) {
            studentSubjectsMap[norm] = sub.marks;
          } else if (sub.grade) {
            studentSubjectsMap[norm] = sub.grade;
          } else {
            studentSubjectsMap[norm] = 'Present';
          }
        }
      });
    }

    const rowObj: Record<string, any> = {
      'S.No': idx + 1,
      'Roll Number': s.roll_number || '',
      'Student Name': s.student_name || '',
      'Registration Number': s.registration_number || '',
      'Date of Birth': s.date_of_birth || '',
      'Board / Council': s.board || '',
      'Class / Exam': s.class_name || '',
      'Year': s.year || '',
      'School / College': s.school || '',
    };

    // Insert dynamic subject columns (leave blank if not taken)
    allSubjects.forEach((subject) => {
      rowObj[subject] = studentSubjectsMap[subject] !== undefined ? studentSubjectsMap[subject] : '';
    });

    // Compute aggregates if missing or null
    const { total: calcTotal, percentage: calcPct, maxMarksSum } = calculateTotalsAndPercentage(s);
    rowObj['Total Marks'] = calcTotal !== null ? calcTotal : '';
    rowObj['Percentage (%)'] = calcPct !== null ? calcPct : '';
    rowObj['Approval Status'] = item.isApproved ? 'Approved' : 'Pending Review';
    rowObj['Source File'] = item.filename || '';

    return {
      rowObj,
      calcTotal,
      calcPct,
      maxMarksSum,
    };
  });

  const rows = rowData.map((r) => r.rowObj);

  // 3. Create SheetJS worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 4. Inject live Excel formulas for Total Marks and Percentage (%)
  // Column layout: S.No (0) ... School (8) -> Subjects start at 9 (Col J)
  if (allSubjects.length > 0) {
    const firstSubColLetter = XLSX.utils.encode_col(9);
    const lastSubColLetter = XLSX.utils.encode_col(8 + allSubjects.length);
    const totalColIdx = 9 + allSubjects.length;
    const totalColLetter = XLSX.utils.encode_col(totalColIdx);
    const pctColIdx = 10 + allSubjects.length;
    const pctColLetter = XLSX.utils.encode_col(pctColIdx);

    rowData.forEach((r, idx) => {
      const rowNum = idx + 2; // Header is row 1, first data row is 2
      const totalCellRef = `${totalColLetter}${rowNum}`;
      const pctCellRef = `${pctColLetter}${rowNum}`;

      // Live Excel SUM formula across the subject columns if numeric marks exist
      if (r.calcTotal !== null) {
        worksheet[totalCellRef] = {
          t: 'n',
          v: r.calcTotal,
          f: `SUM(${firstSubColLetter}${rowNum}:${lastSubColLetter}${rowNum})`,
        };
      }

      // Live Excel Percentage formula: =ROUND((Total / MaxMarks)*100, 2)
      if (r.calcPct !== null && r.maxMarksSum > 0) {
        worksheet[pctCellRef] = {
          t: 'n',
          v: r.calcPct,
          f: `ROUND((${totalColLetter}${rowNum}/${r.maxMarksSum})*100, 2)`,
        };
      } else if (r.calcPct !== null) {
        worksheet[pctCellRef] = {
          t: 'n',
          v: r.calcPct,
        };
      }
    });
  }

  // Auto-size columns for readability
  const colNames = Object.keys(rows[0] || {});
  worksheet['!cols'] = colNames.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key] || '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });

  // Apply bold styling and clean aesthetic to the header row
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    worksheet['!rows'] = [{ hpt: 26 }]; // Header row height

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerCellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      const cell = worksheet[headerCellAddress];
      if (cell) {
        cell.s = {
          font: {
            name: 'Calibri',
            sz: 11,
            bold: true,
            color: { rgb: '0F172A' }, // Slate 900
          },
          fill: {
            fgColor: { rgb: 'E2E8F0' }, // Slate 200 header fill
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true,
          },
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'medium', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } },
          },
        };
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Marksheets');

  return {
    workbook,
    subjectsCount: allSubjects.length,
    rowCount: rows.length,
    allSubjects,
  };
}

export function downloadExcelFile(items: StudentExcelRow[], filename = 'Consolidated_Student_Marksheets.xlsx') {
  const { workbook } = generateExcelWorkbook(items);
  XLSX.writeFile(workbook, filename);
}

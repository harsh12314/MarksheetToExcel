import { ProcessedMarksheet } from './types';

/**
 * Helper to generate realistic sample marksheet image data URLs
 * for immediate one-click testing of multimodal Gemini extraction.
 */

export interface SampleMarksheet {
  id: string;
  title: string;
  subtitle: string;
  board: string;
  dataUrl: string;
}

export function createSampleMarksheetDataUrl(type: 'cbse' | 'state' | 'icse'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - vintage off-white / parchment texture
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Watermark
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = 'bold 84px serif';
  ctx.fillStyle = 'rgba(203, 213, 225, 0.25)';
  ctx.textAlign = 'center';
  const watermarkText = type === 'cbse' ? 'CBSE OFFICIAL' : type === 'icse' ? 'CISCE BOARD' : 'STATE BOARD';
  ctx.fillText(watermarkText, 0, 0);
  ctx.restore();

  if (type === 'icse') {
    // CISCE / ICSE Format
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px serif';
    ctx.fillText('COUNCIL FOR THE INDIAN SCHOOL CERTIFICATE EXAMINATIONS', 500, 100);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('INDIAN CERTIFICATE OF SECONDARY EDUCATION (CLASS X) - 2024', 500, 145);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('STATEMENT OF MARKS', 500, 180);

    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(80, 210);
    ctx.lineTo(920, 210);
    ctx.stroke();

    // Student Details
    ctx.textAlign = 'left';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';

    ctx.fillText('Candidate Name :', 90, 260);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('ANANYA DESHMUKH', 240, 260);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Unique ID / Roll :', 540, 260);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('7210943', 680, 260);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Date of Birth :', 90, 300);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('19/04/2008', 240, 300);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('School / Center :', 90, 340);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('BISHOP COTTON GIRLS SCHOOL, BENGALURU', 240, 340);

    // Table Header
    const tableTop = 400;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(80, tableTop, 840, 40);
    ctx.strokeRect(80, tableTop, 840, 40);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SUBJECT', 110, tableTop + 26);
    ctx.fillText('MAXIMUM', 480, tableTop + 26);
    ctx.fillText('PERCENTAGE MARKS', 630, tableTop + 26);
    ctx.fillText('GRADE', 830, tableTop + 26);

    const subjects = [
      { name: 'ENGLISH LANGUAGE & LITERATURE', max: 100, marks: 92, grade: '1' },
      { name: 'MATHEMATICS', max: 100, marks: 88, grade: '2' },
      { name: 'ECONOMICS', max: 100, marks: 95, grade: '1' },
      { name: 'COMMERCIAL STUDIES', max: 100, marks: 90, grade: '1' },
      { name: 'ENVIRONMENTAL APPLICATIONS', max: 100, marks: 94, grade: '1' },
    ];

    let currentY = tableTop + 40;
    subjects.forEach((sub, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(80, currentY, 840, 50);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(80, currentY, 840, 50);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(sub.name, 110, currentY + 31);

      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(String(sub.max), 510, currentY + 31);

      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#047857';
      ctx.fillText(String(sub.marks), 690, currentY + 31);

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(sub.grade, 845, currentY + 31);

      currentY += 50;
    });

    // Total and Result
    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(80, currentY, 840, 50);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(80, currentY, 840, 50);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('TOTAL: 459 / 500', 100, currentY + 32);
    ctx.fillText('PERCENTAGE: 91.8%', 420, currentY + 32);
    ctx.fillStyle = '#15803d';
    ctx.fillText('RESULT - PASS CERTIFICATE AWARDED', 650, currentY + 32);

    ctx.font = 'italic 14px serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Issued by Chief Executive: G. Arathoon', 90, 1150);

    return canvas.toDataURL('image/png');
  }

  if (type === 'cbse') {
    // Header
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px serif';
    ctx.fillText('CENTRAL BOARD OF SECONDARY EDUCATION', 500, 100);

    ctx.font = 'italic 18px serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('(An Autonomous Organisation under the Ministry of Education, Govt. of India)', 500, 130);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SECONDARY SCHOOL EXAMINATION (CLASS X) 2024', 500, 175);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('MARKS STATEMENT CUM CERTIFICATE', 500, 205);

    // Decorative divider
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(80, 230);
    ctx.lineTo(920, 230);
    ctx.stroke();

    // Student Information Grid
    ctx.textAlign = 'left';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';

    ctx.fillText('Candidate Name :', 90, 280);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('RAHUL KUMAR', 250, 280);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Roll No. :', 550, 280);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('2145890', 650, 280);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText("Mother's Name :", 90, 320);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SUNITA DEVI', 250, 320);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Date of Birth :', 550, 320);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('14/08/2008', 680, 320);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText("Father's Name :", 90, 360);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('RAJESH KUMAR', 250, 360);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Registration No :', 550, 360);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('R/24/09812/045', 700, 360);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('School Name :', 90, 400);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('DELHI PUBLIC SCHOOL RK PURAM NEW DELHI', 250, 400);

    // Subjects Table Header
    const tableTop = 460;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(80, tableTop, 840, 40);
    ctx.strokeRect(80, tableTop, 840, 40);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SUB CODE', 95, tableTop + 26);
    ctx.fillText('SUBJECT NAME', 210, tableTop + 26);
    ctx.fillText('MAX MARKS', 530, tableTop + 26);
    ctx.fillText('MARKS OBTAINED', 660, tableTop + 26);
    ctx.fillText('GRADE', 830, tableTop + 26);

    const subjects = [
      { code: '002', name: 'HINDI COURSE-A', max: 100, marks: 89, grade: 'A2' },
      { code: '184', name: 'ENGLISH LANG & LIT', max: 100, marks: 84, grade: 'B1' },
      { code: '041', name: 'MATHEMATICS STANDARD', max: 100, marks: 95, grade: 'A1' },
      { code: '086', name: 'SCIENCE - THEORY & PRACTICAL', max: 100, marks: 88, grade: 'A2' },
      { code: '087', name: 'SOCIAL SCIENCE', max: 100, marks: 91, grade: 'A1' },
      { code: '165', name: 'COMPUTER APPLICATIONS', max: 100, marks: 96, grade: 'A1' },
    ];

    let currentY = tableTop + 40;
    subjects.forEach((sub, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(80, currentY, 840, 45);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(80, currentY, 840, 45);

      ctx.font = '15px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(sub.code, 105, currentY + 28);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(sub.name, 210, currentY + 28);

      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(String(sub.max), 560, currentY + 28);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#047857';
      ctx.fillText(String(sub.marks), 710, currentY + 28);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(sub.grade, 840, currentY + 28);

      currentY += 45;
    });

    // Total and Result row
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(80, currentY, 840, 50);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(80, currentY, 840, 50);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('TOTAL MARKS: 543 / 600', 100, currentY + 32);
    ctx.fillText('PERCENTAGE: 90.5%', 420, currentY + 32);
    ctx.fillStyle = '#15803d';
    ctx.fillText('RESULT: PASS', 730, currentY + 32);

    // Footer signatures & seal
    ctx.font = 'italic 14px serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Date of Issue: 18th May 2024', 90, 1200);
    ctx.fillText('Verified by Exam Controller: S. Saxena', 90, 1230);

    // Stamp circle
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(750, 1200, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.fillText('CBSE SEAL', 750, 1195);
    ctx.fillText('NEW DELHI', 750, 1215);

  } else {
    // State Board Format
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px serif';
    ctx.fillText('STATE BOARD OF HIGHER SECONDARY EDUCATION', 500, 100);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('HIGHER SECONDARY CERTIFICATE EXAMINATION (CLASS XII)', 500, 145);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('ANNUAL CONSOLIDATED MARKS STATEMENT - MARCH 2024', 500, 180);

    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(80, 210);
    ctx.lineTo(920, 210);
    ctx.stroke();

    // Student Details
    ctx.textAlign = 'left';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';

    ctx.fillText('Student Name :', 90, 260);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('PRIYA SHARMA', 230, 260);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Registration No :', 540, 260);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('WB/2024/782190', 680, 260);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Roll Number :', 90, 300);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('12-SCI-4089', 230, 300);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Date of Birth :', 540, 300);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('03/11/2006', 680, 300);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Institution / School :', 90, 340);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('ST. XAVIER SENIOR SECONDARY SCHOOL, KOLKATA', 250, 340);

    // Table Header
    const tableTop = 400;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(80, tableTop, 840, 40);
    ctx.strokeRect(80, tableTop, 840, 40);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SUBJECT', 110, tableTop + 26);
    ctx.fillText('MAX MARKS', 470, tableTop + 26);
    ctx.fillText('MARKS SECURED', 630, tableTop + 26);
    ctx.fillText('STATUS', 820, tableTop + 26);

    const subjects = [
      { name: 'PHYSICS (THEORY + PRACTICAL)', max: 100, marks: 82, status: 'PASS' },
      { name: 'CHEMISTRY (THEORY + PRACTICAL)', max: 100, marks: 79, status: 'PASS' },
      { name: 'MATHEMATICS', max: 100, marks: 94, status: 'PASS' },
      { name: 'COMPUTER SCIENCE', max: 100, marks: 96, status: 'PASS' },
      { name: 'ENGLISH CORE', max: 100, marks: 86, status: 'PASS' },
    ];

    let currentY = tableTop + 40;
    subjects.forEach((sub, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(80, currentY, 840, 50);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(80, currentY, 840, 50);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(sub.name, 110, currentY + 31);

      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(String(sub.max), 500, currentY + 31);

      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#047857';
      ctx.fillText(String(sub.marks), 670, currentY + 31);

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#15803d';
      ctx.fillText(sub.status, 825, currentY + 31);

      currentY += 50;
    });

    // Total and Result
    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(80, currentY, 840, 50);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(80, currentY, 840, 50);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('GRAND TOTAL: 437 / 500', 100, currentY + 32);
    ctx.fillText('AGGREGATE PERCENTAGE: 87.4%', 400, currentY + 32);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText('DIVISION: FIRST WITH DISTINCTION', 670, currentY + 32);

    ctx.font = 'italic 14px serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Issued on: 24th June 2024', 90, 1150);
    ctx.fillText('Joint Secretary of Examinations: M. Chakraborty', 90, 1180);
  }

  return canvas.toDataURL('image/png');
}

export function getInitialSampleItems(): ProcessedMarksheet[] {
  return getSampleBatchItems(2);
}

export function getSampleBatchItems(count = 12): ProcessedMarksheet[] {
  try {
    const cbseUrl = typeof window !== 'undefined' ? createSampleMarksheetDataUrl('cbse') : '';
    const stateUrl = typeof window !== 'undefined' ? createSampleMarksheetDataUrl('state') : '';
    const icseUrl = typeof window !== 'undefined' ? createSampleMarksheetDataUrl('icse') : '';

    const list: ProcessedMarksheet[] = [
      {
        id: 'sample-cbse-rahul-01',
        file: {
          name: 'CBSE_RAHUL_KUMAR_MARKSHEET.png',
          size: 245000,
          type: 'image/png',
          previewUrl: cbseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'RAHUL KUMAR',
          roll_number: '2145890',
          registration_number: 'D/24/09812/045',
          date_of_birth: '15/08/2007',
          board: 'Central Board of Secondary Education (CBSE)',
          class_name: 'Secondary School Examination (Class X)',
          year: '2024',
          school: 'DELHI PUBLIC SCHOOL, R.K. PURAM',
          subjects: [
            { name: 'English Core', marks: 86, max_marks: 100, grade: 'A2' },
            { name: 'Mathematics Standard', marks: 94, max_marks: 100, grade: 'A1' },
            { name: 'Physics (Theory + Practical)', marks: 82, max_marks: 100, grade: 'B1' },
            { name: 'Chemistry (Theory + Practical)', marks: 79, max_marks: 100, grade: 'B1' },
            { name: 'Computer Science', marks: 96, max_marks: 100, grade: 'A1' },
          ],
          total: 437,
          percentage: 87.4,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-state-priya-02',
        file: {
          name: 'STATE_BOARD_PRIYA_SHARMA_MARKSHEET.png',
          size: 231000,
          type: 'image/png',
          previewUrl: stateUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'PRIYA SHARMA',
          roll_number: '12-SCI-4089',
          registration_number: 'MSBSHSE/2024/78291',
          date_of_birth: '22/11/2006',
          board: 'Maharashtra State Board of Secondary & Higher Secondary Education',
          class_name: 'Higher Secondary Certificate (Class XII)',
          year: '2024',
          school: 'FERGUSSON JUNIOR COLLEGE, PUNE',
          subjects: [
            { name: 'English', marks: 88, max_marks: 100, grade: 'DIST' },
            { name: 'Physics', marks: 85, max_marks: 100, grade: 'DIST' },
            { name: 'Chemistry', marks: 84, max_marks: 100, grade: 'DIST' },
            { name: 'Mathematics', marks: 91, max_marks: 100, grade: 'DIST' },
            { name: 'Information Technology', marks: 88, max_marks: 100, grade: 'DIST' },
          ],
          total: 436,
          percentage: 87.2,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-icse-ananya-03',
        file: {
          name: 'CISCE_ANANYA_DESHMUKH_MARKSHEET.png',
          size: 238000,
          type: 'image/png',
          previewUrl: icseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'ANANYA DESHMUKH',
          roll_number: '7210943',
          registration_number: 'ICSE/2024/09384',
          date_of_birth: '19/04/2008',
          board: 'Council for the Indian School Certificate Examinations (CISCE)',
          class_name: 'Indian Certificate of Secondary Education (Class X)',
          year: '2024',
          school: 'BISHOP COTTON GIRLS SCHOOL, BENGALURU',
          subjects: [
            { name: 'English Language & Literature', marks: 92, max_marks: 100, grade: '1' },
            { name: 'Mathematics', marks: 88, max_marks: 100, grade: '2' },
            { name: 'Economics', marks: 95, max_marks: 100, grade: '1' },
            { name: 'Commercial Studies', marks: 90, max_marks: 100, grade: '1' },
            { name: 'Environmental Applications', marks: 94, max_marks: 100, grade: '1' },
          ],
          total: 459,
          percentage: 91.8,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-cbse-amit-04',
        file: {
          name: 'CBSE_AMIT_PATEL_MARKSHEET.png',
          size: 242000,
          type: 'image/png',
          previewUrl: cbseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'AMIT PATEL',
          roll_number: '2145891',
          registration_number: 'D/24/09812/046',
          date_of_birth: '09/01/2007',
          board: 'Central Board of Secondary Education (CBSE)',
          class_name: 'Senior School Certificate Examination (Class XII)',
          year: '2024',
          school: 'KENDRIYA VIDYALAYA, AHMEDABAD',
          subjects: [
            { name: 'English Core', marks: 82, max_marks: 100, grade: 'B1' },
            { name: 'Mathematics', marks: 91, max_marks: 100, grade: 'A1' },
            { name: 'Physics', marks: 89, max_marks: 100, grade: 'A2' },
            { name: 'Chemistry', marks: 87, max_marks: 100, grade: 'A2' },
            { name: 'Physical Education', marks: 93, max_marks: 100, grade: 'A1' },
          ],
          total: 442,
          percentage: 88.4,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-state-sneha-05',
        file: {
          name: 'STATE_BOARD_SNEHA_REDDY_MARKSHEET.png',
          size: 228000,
          type: 'image/png',
          previewUrl: stateUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'SNEHA REDDY',
          roll_number: '12-SCI-4090',
          registration_number: 'TSBIE/2024/65412',
          date_of_birth: '14/06/2006',
          board: 'Telangana State Board of Intermediate Education',
          class_name: 'Intermediate 2nd Year (Class XII)',
          year: '2024',
          school: 'NARAYANA JUNIOR COLLEGE, HYDERABAD',
          subjects: [
            { name: 'English', marks: 92, max_marks: 100, grade: 'A' },
            { name: 'Physics', marks: 95, max_marks: 100, grade: 'A' },
            { name: 'Chemistry', marks: 94, max_marks: 100, grade: 'A' },
            { name: 'Mathematics', marks: 98, max_marks: 100, grade: 'A' },
            { name: 'Sanskrit', marks: 97, max_marks: 100, grade: 'A' },
          ],
          total: 476,
          percentage: 95.2,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-icse-rohan-06',
        file: {
          name: 'CISCE_ROHAN_VERMA_MARKSHEET.png',
          size: 236000,
          type: 'image/png',
          previewUrl: icseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'ROHAN VERMA',
          roll_number: '7210944',
          registration_number: 'ICSE/2024/09385',
          date_of_birth: '02/10/2007',
          board: 'Council for the Indian School Certificate Examinations (CISCE)',
          class_name: 'Indian Certificate of Secondary Education (Class X)',
          year: '2024',
          school: 'THE DOON SCHOOL, DEHRADUN',
          subjects: [
            { name: 'English Language', marks: 87, max_marks: 100, grade: '2' },
            { name: 'Literature in English', marks: 89, max_marks: 100, grade: '2' },
            { name: 'History & Civics', marks: 91, max_marks: 100, grade: '1' },
            { name: 'Geography', marks: 86, max_marks: 100, grade: '2' },
            { name: 'Mathematics', marks: 90, max_marks: 100, grade: '1' },
          ],
          total: 443,
          percentage: 88.6,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-cbse-kavita-07',
        file: {
          name: 'CBSE_KAVITA_IYER_MARKSHEET.png',
          size: 241000,
          type: 'image/png',
          previewUrl: cbseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'KAVITA IYER',
          roll_number: '2145892',
          registration_number: 'D/24/09812/047',
          date_of_birth: '27/03/2007',
          board: 'Central Board of Secondary Education (CBSE)',
          class_name: 'Secondary School Examination (Class X)',
          year: '2024',
          school: 'NATIONAL PUBLIC SCHOOL, CHENNAI',
          subjects: [
            { name: 'English Communicative', marks: 95, max_marks: 100, grade: 'A1' },
            { name: 'Mathematics Standard', marks: 98, max_marks: 100, grade: 'A1' },
            { name: 'Science', marks: 96, max_marks: 100, grade: 'A1' },
            { name: 'Social Science', marks: 94, max_marks: 100, grade: 'A1' },
            { name: 'French', marks: 97, max_marks: 100, grade: 'A1' },
          ],
          total: 480,
          percentage: 96.0,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-state-manish-08',
        file: {
          name: 'STATE_BOARD_MANISH_SINGH_MARKSHEET.png',
          size: 234000,
          type: 'image/png',
          previewUrl: stateUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'MANISH SINGH',
          roll_number: '12-SCI-4091',
          registration_number: 'UPMSP/2024/84210',
          date_of_birth: '11/12/2006',
          board: 'UP Board of High School and Intermediate Education',
          class_name: 'Intermediate Examination (Class XII)',
          year: '2024',
          school: 'GOVT INTER COLLEGE, VARANASI',
          subjects: [
            { name: 'General Hindi', marks: 84, max_marks: 100, grade: 'PASS' },
            { name: 'English', marks: 78, max_marks: 100, grade: 'PASS' },
            { name: 'Physics', marks: 85, max_marks: 100, grade: 'PASS' },
            { name: 'Chemistry', marks: 82, max_marks: 100, grade: 'PASS' },
            { name: 'Mathematics', marks: 88, max_marks: 100, grade: 'PASS' },
          ],
          total: 417,
          percentage: 83.4,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-icse-divya-09',
        file: {
          name: 'CISCE_DIVYA_JOSHI_MARKSHEET.png',
          size: 239000,
          type: 'image/png',
          previewUrl: icseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'DIVYA JOSHI',
          roll_number: '7210945',
          registration_number: 'ICSE/2024/09386',
          date_of_birth: '05/05/2008',
          board: 'Council for the Indian School Certificate Examinations (CISCE)',
          class_name: 'Indian Certificate of Secondary Education (Class X)',
          year: '2024',
          school: "ST. XAVIER'S HIGH SCHOOL, MUMBAI",
          subjects: [
            { name: 'English Language', marks: 91, max_marks: 100, grade: '1' },
            { name: 'Mathematics', marks: 89, max_marks: 100, grade: '2' },
            { name: 'Science (Phy/Chem/Bio)', marks: 92, max_marks: 100, grade: '1' },
            { name: 'Commercial Applications', marks: 94, max_marks: 100, grade: '1' },
            { name: 'Computer Applications', marks: 99, max_marks: 100, grade: '1' },
          ],
          total: 465,
          percentage: 93.0,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-cbse-karan-10',
        file: {
          name: 'CBSE_KARAN_MEHTA_MARKSHEET.png',
          size: 244000,
          type: 'image/png',
          previewUrl: cbseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'KARAN MEHTA',
          roll_number: '2145893',
          registration_number: 'D/24/09812/048',
          date_of_birth: '18/07/2006',
          board: 'Central Board of Secondary Education (CBSE)',
          class_name: 'Senior School Certificate Examination (Class XII)',
          year: '2024',
          school: 'MODERN SCHOOL, BARAKHAMBA ROAD, NEW DELHI',
          subjects: [
            { name: 'Accountancy', marks: 94, max_marks: 100, grade: 'A1' },
            { name: 'Business Studies', marks: 91, max_marks: 100, grade: 'A1' },
            { name: 'Economics', marks: 93, max_marks: 100, grade: 'A1' },
            { name: 'Mathematics', marks: 86, max_marks: 100, grade: 'A2' },
            { name: 'English Core', marks: 88, max_marks: 100, grade: 'A2' },
          ],
          total: 452,
          percentage: 90.4,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-state-pooja-11',
        file: {
          name: 'STATE_BOARD_POOJA_NAIR_MARKSHEET.png',
          size: 232000,
          type: 'image/png',
          previewUrl: stateUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'POOJA NAIR',
          roll_number: '12-SCI-4092',
          registration_number: 'DHSE/2024/99124',
          date_of_birth: '30/08/2006',
          board: 'Kerala Directorate of Higher Secondary Education',
          class_name: 'Higher Secondary (Class XII)',
          year: '2024',
          school: 'MODEL TECHNICAL HIGHER SECONDARY SCHOOL, KOCHI',
          subjects: [
            { name: 'English', marks: 90, max_marks: 100, grade: 'A+' },
            { name: 'Physics', marks: 92, max_marks: 100, grade: 'A+' },
            { name: 'Chemistry', marks: 89, max_marks: 100, grade: 'A' },
            { name: 'Biology', marks: 94, max_marks: 100, grade: 'A+' },
            { name: 'Malayalam', marks: 96, max_marks: 100, grade: 'A+' },
          ],
          total: 461,
          percentage: 92.2,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
      {
        id: 'sample-icse-vikram-12',
        file: {
          name: 'CISCE_VIKRAM_CHOUDHARY_MARKSHEET.png',
          size: 240000,
          type: 'image/png',
          previewUrl: icseUrl,
        },
        status: 'success',
        approved: true,
        data: {
          student_name: 'VIKRAM CHOUDHARY',
          roll_number: '7210946',
          registration_number: 'ICSE/2024/09387',
          date_of_birth: '14/02/2008',
          board: 'Council for the Indian School Certificate Examinations (CISCE)',
          class_name: 'Indian Certificate of Secondary Education (Class X)',
          year: '2024',
          school: "ST. JAMES' SCHOOL, KOLKATA",
          subjects: [
            { name: 'English Language', marks: 85, max_marks: 100, grade: '2' },
            { name: 'Mathematics', marks: 93, max_marks: 100, grade: '1' },
            { name: 'History & Civics', marks: 88, max_marks: 100, grade: '2' },
            { name: 'Science', marks: 87, max_marks: 100, grade: '2' },
            { name: 'Physical Education', marks: 96, max_marks: 100, grade: '1' },
          ],
          total: 449,
          percentage: 89.8,
          low_confidence_fields: [],
        },
        validationIssues: [],
      },
    ];

    return list.slice(0, count);
  } catch (e) {
    console.error('Failed to generate sample items:', e);
    return [];
  }
}

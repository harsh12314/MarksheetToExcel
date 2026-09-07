import { MarksheetData, ValidationIssue } from '../types';

export function validateMarksheet(data: MarksheetData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Missing student_name or roll_number -> error
  if (!data.student_name || !data.student_name.trim()) {
    issues.push({
      field: 'student_name',
      type: 'error',
      message: 'Student name is missing or empty.',
    });
  }

  if (!data.roll_number || !data.roll_number.trim()) {
    issues.push({
      field: 'roll_number',
      type: 'error',
      message: 'Roll number is missing or empty.',
    });
  }

  // Low confidence fields from Gemini
  if (data.low_confidence_fields && Array.isArray(data.low_confidence_fields)) {
    for (const field of data.low_confidence_fields) {
      // Avoid duplicate error if already reported
      if (field === 'student_name' && !data.student_name) continue;
      if (field === 'roll_number' && !data.roll_number) continue;
      issues.push({
        field,
        type: 'warning',
        message: `Gemini flagged ${field.replace(/_/g, ' ')} as lower confidence. Please verify.`,
      });
    }
  }

  // Check subjects marks within 0..max_marks
  let calculatedMarksSum = 0;
  let calculatedMaxMarksSum = 0;
  let hasValidMarks = false;

  if (Array.isArray(data.subjects)) {
    data.subjects.forEach((sub, idx) => {
      const maxMarks = sub.max_marks !== null && sub.max_marks !== undefined && sub.max_marks > 0
        ? sub.max_marks
        : 100;

      if (sub.marks !== null && sub.marks !== undefined) {
        hasValidMarks = true;
        calculatedMarksSum += sub.marks;
        calculatedMaxMarksSum += maxMarks;

        if (sub.marks < 0 || sub.marks > maxMarks) {
          issues.push({
            field: `subjects[${idx}].marks`,
            type: 'error',
            message: `${sub.name || `Subject #${idx + 1}`}: Marks (${sub.marks}) out of range (0 - ${maxMarks}).`,
          });
        }
      }
    });
  } else {
    issues.push({
      field: 'subjects',
      type: 'error',
      message: 'No subjects list found in marksheet data.',
    });
  }

  // Check sum(subjects.marks) against total
  if (data.total !== null && data.total !== undefined && hasValidMarks) {
    const diff = Math.abs(calculatedMarksSum - data.total);
    if (diff > 2) {
      issues.push({
        field: 'total',
        type: 'warning',
        message: `Sum of subject marks (${calculatedMarksSum}) differs from printed total (${data.total}).`,
      });
    }
  }

  // Check percentage against total / sum(max_marks) * 100
  if (data.percentage !== null && data.percentage !== undefined && calculatedMaxMarksSum > 0) {
    const basisTotal = data.total !== null && data.total !== undefined ? data.total : calculatedMarksSum;
    const expectedPercentage = (basisTotal / calculatedMaxMarksSum) * 100;
    const diff = Math.abs(expectedPercentage - data.percentage);
    if (diff > 2) {
      issues.push({
        field: 'percentage',
        type: 'warning',
        message: `Recorded percentage (${data.percentage}%) does not match calculated percentage (${expectedPercentage.toFixed(1)}%).`,
      });
    }
  }

  return issues;
}

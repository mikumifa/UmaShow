const BASIC_GRADE_LABELS: Record<number, string> = {
  1: 'G',
  2: 'G+',
  3: 'F',
  4: 'F+',
  5: 'E',
  6: 'E+',
  7: 'D',
  8: 'D+',
  9: 'C',
  10: 'C+',
  11: 'B',
  12: 'B+',
  13: 'A',
  14: 'A+',
  15: 'S',
  16: 'S+',
  17: 'SS',
  18: 'SS+',
};

const BASIC_GRADE_IDS = Object.fromEntries(
  Object.entries(BASIC_GRADE_LABELS).map(([id, label]) => [label, Number(id)]),
);

const U_GRADE_BASE_LABELS = ['UG', 'UF', 'UE', 'UD', 'UC', 'UB', 'UA', 'US'];

export function finalGradeLabel(finalGrade: number | undefined) {
  if (finalGrade == null) return '-';
  const basicLabel = BASIC_GRADE_LABELS[finalGrade];
  if (basicLabel) return basicLabel;

  const familyIndex = Math.floor((finalGrade - 19) / 10);
  const suffix = (finalGrade - 19) % 10;
  const familyLabel = U_GRADE_BASE_LABELS[familyIndex];
  if (!familyLabel) return `Grade ${finalGrade}`;

  return suffix === 0 ? familyLabel : `${familyLabel}${suffix}`;
}

export function parseFinalGradeLabel(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric;

  const basicId = BASIC_GRADE_IDS[normalized];
  if (basicId != null) return basicId;

  const match = normalized.match(/^(UG|UF|UE|UD|UC|UB|UA|US)([1-9])?$/);
  if (!match) return undefined;

  const familyIndex = U_GRADE_BASE_LABELS.indexOf(match[1]);
  if (familyIndex < 0) return undefined;
  const suffix = match[2] ? Number(match[2]) : 0;
  return 19 + familyIndex * 10 + suffix;
}

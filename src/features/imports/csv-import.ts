import { TZDate } from '@date-fns/tz';
import { z } from 'zod';

const columns = [
  'date',
  'start_time',
  'end_time',
  'timezone',
  'break_minutes',
  'paid_break_minutes',
  'profile',
  'classification',
  'note',
] as const;

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  timezone: z.string().min(1),
  break_minutes: z.coerce.number().int().min(0).max(1_440),
  paid_break_minutes: z.coerce.number().int().min(0).max(1_440),
  profile: z.string(),
  classification: z.string(),
  note: z.string().max(2_000),
});

export interface ValidImportRow {
  rowNumber: number;
  startedAtUtc: number;
  endedAtUtc: number;
  timezone: string;
  breakMinutes: number;
  paidBreakMinutes: number;
  note?: string;
}

export interface ImportPreview {
  valid: ValidImportRow[];
  errors: { rowNumber: number; message: string }[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

function toInstant(date: string, time: string, timezone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  return new TZDate(year!, month! - 1, day!, hour!, minute!, second!, 0, timezone).getTime();
}

export function previewCsvImport(content: string): ImportPreview {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const header = parseCsvLine(lines[0] ?? '');
  if (columns.some((column, index) => header[index] !== column)) {
    return {
      valid: [],
      errors: [{ rowNumber: 1, message: 'Las columnas no coinciden con la plantilla.' }],
    };
  }
  const preview: ImportPreview = { valid: [], errors: [] };
  for (let index = 1; index < lines.length; index += 1) {
    const raw = Object.fromEntries(
      columns.map((column, columnIndex) => [
        column,
        parseCsvLine(lines[index]!)[columnIndex] ?? '',
      ]),
    );
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      preview.errors.push({
        rowNumber: index + 1,
        message: parsed.error.issues[0]?.message ?? 'Fila inválida.',
      });
      continue;
    }
    const startedAtUtc = toInstant(parsed.data.date, parsed.data.start_time, parsed.data.timezone);
    let endedAtUtc = toInstant(parsed.data.date, parsed.data.end_time, parsed.data.timezone);
    if (endedAtUtc < startedAtUtc) endedAtUtc += 86_400_000;
    if (
      (parsed.data.break_minutes + parsed.data.paid_break_minutes) * 60_000 >
      endedAtUtc - startedAtUtc
    ) {
      preview.errors.push({
        rowNumber: index + 1,
        message: 'Las pausas superan la duración de la jornada.',
      });
      continue;
    }
    preview.valid.push({
      rowNumber: index + 1,
      startedAtUtc,
      endedAtUtc,
      timezone: parsed.data.timezone,
      breakMinutes: parsed.data.break_minutes,
      paidBreakMinutes: parsed.data.paid_break_minutes,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
  }
  return preview;
}

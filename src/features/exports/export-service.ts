import { Buffer } from 'buffer';
import ExcelJS from 'exceljs';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { formatDuration, netDurationMs, unpaidBreakDurationMs } from '@/domain/calculations';
import type { SessionWithBreaks, WorkProfile } from '@/domain/models';

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF';

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function exportDirectory(): Directory {
  const directory = new Directory(Paths.cache, 'jornada-exports');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function createFile(name: string, mimeType: string): File {
  const directory = exportDirectory();
  const file = new File(directory, name);
  file.create({ intermediates: true, overwrite: true });
  return file;
}

export function buildCsv(
  values: SessionWithBreaks[],
  profile: WorkProfile,
  includeNotes = true,
): string {
  const header = [
    'date',
    'start_time',
    'end_time',
    'timezone',
    'break_minutes',
    'paid_break_minutes',
    'profile',
    'classification',
    'note',
  ];
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: profile.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const time = new Intl.DateTimeFormat('es', {
    timeZone: profile.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const rows = values.map(({ session, breaks }) => {
    const unpaid = breaks
      .filter((item) => !item.isPaid && item.endedAtUtc)
      .reduce((sum, item) => sum + (item.endedAtUtc! - item.startedAtUtc) / 60_000, 0);
    const paid = breaks
      .filter((item) => item.isPaid && item.endedAtUtc)
      .reduce((sum, item) => sum + (item.endedAtUtc! - item.startedAtUtc) / 60_000, 0);
    return [
      formatter.format(new Date(session.startedAtUtc)),
      time.format(new Date(session.startedAtUtc)),
      session.endedAtUtc ? time.format(new Date(session.endedAtUtc)) : '',
      session.startTimezone,
      Math.round(unpaid),
      Math.round(paid),
      profile.name,
      '',
      includeNotes ? (session.note ?? '') : '',
    ];
  });
  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
}

export function buildCsvTemplate(): string {
  return '\uFEFFdate,start_time,end_time,timezone,break_minutes,paid_break_minutes,profile,classification,note\r\n';
}

export async function exportCsv(
  values: SessionWithBreaks[],
  profile: WorkProfile,
  includeNotes = true,
): Promise<string> {
  const file = createFile(`jornadas-${Date.now()}.csv`, 'text/csv');
  file.write(buildCsv(values, profile, includeNotes));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
  return file.uri;
}

export async function exportTemplate(): Promise<string> {
  const file = createFile('plantilla-jornadas.csv', 'text/csv');
  file.write(buildCsvTemplate());
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
  return file.uri;
}

export async function exportXlsx(
  values: SessionWithBreaks[],
  profile: WorkProfile,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Jornada Laboral';
  workbook.created = new Date();
  const summary = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  const sessions = workbook.addWorksheet('Jornadas', { views: [{ state: 'frozen', ySplit: 1 }] });
  const breaks = workbook.addWorksheet('Pausas', { views: [{ state: 'frozen', ySplit: 1 }] });
  const revisions = workbook.addWorksheet('Modificaciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const total = values.reduce((sum, value) => sum + netDurationMs(value), 0);
  const totalBreaks = values.reduce((sum, value) => sum + unpaidBreakDurationMs(value.breaks), 0);
  summary.addRows([
    ['Perfil', profile.name],
    ['Empresa', profile.companyName ?? ''],
    ['Total neto', formatDuration(total)],
    ['Pausas no pagas', formatDuration(totalBreaks)],
    ['Registros incompletos', values.filter((value) => !value.session.endedAtUtc).length],
  ]);
  sessions.addRow(['ID', 'Entrada UTC', 'Salida UTC', 'Zona', 'Estado', 'Neto', 'Nota']);
  for (const value of values) {
    sessions.addRow([
      value.session.id,
      new Date(value.session.startedAtUtc),
      value.session.endedAtUtc ? new Date(value.session.endedAtUtc) : '',
      value.session.startTimezone,
      value.session.status,
      netDurationMs(value) / 86_400_000,
      value.session.note ?? '',
    ]);
    for (const pause of value.breaks) {
      breaks.addRow([
        pause.id,
        value.session.id,
        new Date(pause.startedAtUtc),
        pause.endedAtUtc ? new Date(pause.endedAtUtc) : '',
        pause.isPaid ? 'Sí' : 'No',
      ]);
    }
  }
  breaks.spliceRows(1, 0, ['ID', 'Jornada', 'Inicio UTC', 'Fin UTC', 'Remunerada']);
  revisions.addRow(['Jornada', 'La auditoría cifrada se consulta dentro de la aplicación']);
  for (const sheet of workbook.worksheets) {
    const header = sheet.getRow(1);
    header.font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = Math.min(36, Math.max(14, column.width ?? 14));
    });
  }
  sessions.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm:ss';
  sessions.getColumn(3).numFmt = 'yyyy-mm-dd hh:mm:ss';
  sessions.getColumn(6).numFmt = '[h]:mm';
  const output = await workbook.xlsx.writeBuffer();
  const file = createFile(
    `jornadas-${Date.now()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  file.write(new Uint8Array(Buffer.from(output)));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return file.uri;
}

export async function exportPdf(
  values: SessionWithBreaks[],
  profile: WorkProfile,
): Promise<string> {
  const total = values.reduce((sum, value) => sum + netDurationMs(value), 0);
  const rows = values
    .map(
      ({ session, breaks }) =>
        `<tr><td>${escapeHtml(new Date(session.startedAtUtc).toLocaleString())}</td><td>${escapeHtml(session.endedAtUtc ? new Date(session.endedAtUtc).toLocaleString() : 'Incompleta')}</td><td>${formatDuration(unpaidBreakDurationMs(breaks))}</td><td>${formatDuration(netDurationMs({ session, breaks }))}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#142033}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:6px;font-size:11px}th{background:#eef3f8}</style></head><body><h1>Informe de jornadas</h1><p><b>Perfil:</b> ${escapeHtml(profile.name)}<br><b>Empresa:</b> ${escapeHtml(profile.companyName ?? '')}<br><b>Generado:</b> ${escapeHtml(new Date().toLocaleString())}</p><table><thead><tr><th>Entrada</th><th>Salida</th><th>Pausas</th><th>Neto</th></tr></thead><tbody>${rows}</tbody></table><h2>Total: ${formatDuration(total)} h</h2><p>Registros incompletos: ${values.filter(({ session }) => !session.endedAtUtc).length}</p></body></html>`;
  const result = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: '.pdf' });
  return result.uri;
}

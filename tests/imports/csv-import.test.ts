import { previewCsvImport } from '@/features/imports/csv-import';

const header =
  'date,start_time,end_time,timezone,break_minutes,paid_break_minutes,profile,classification,note';

test('valida todas las filas antes de importar y conserva errores por fila', () => {
  const preview = previewCsvImport(
    `${header}\n2026-07-16,09:00,17:00,America/Argentina/Buenos_Aires,30,15,Oficina,,Correcto\nfecha,xx,17:00,UTC,0,0,Oficina,,Inválido`,
  );
  expect(preview.valid).toHaveLength(1);
  expect(preview.errors).toEqual([expect.objectContaining({ rowNumber: 3 })]);
});

test('interpreta una salida posterior a medianoche', () => {
  const preview = previewCsvImport(
    `${header}\n2026-07-16,22:00,06:00,UTC,30,0,Noche,,Cruza medianoche`,
  );
  expect(preview.errors).toHaveLength(0);
  expect(preview.valid[0]!.endedAtUtc - preview.valid[0]!.startedAtUtc).toBe(8 * 60 * 60 * 1_000);
});

test('rechaza pausas mayores que la jornada', () => {
  const preview = previewCsvImport(`${header}\n2026-07-16,09:00,10:00,UTC,90,0,Oficina,,`);
  expect(preview.valid).toHaveLength(0);
  expect(preview.errors[0]?.message).toContain('pausas');
});

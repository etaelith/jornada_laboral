import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { getAppServices } from '@/application/app-services';
import { intervalsOverlap } from '@/domain/calculations';
import type { SessionWithBreaks } from '@/domain/models';
import {
  exportCsv,
  exportPdf,
  exportTemplate,
  exportXlsx,
  type ExportFormat,
} from '@/features/exports/export-service';
import { previewCsvImport, type ImportPreview } from '@/features/imports/csv-import';
import { createEncryptedBackup, readEncryptedBackup } from '@/features/backups/backup-service';
import { AppButton, Body, Card, ErrorState, Heading, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

function localDate(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export default function ExportScreen() {
  const theme = useTheme();
  const [from, setFrom] = useState(localDate(30));
  const [to, setTo] = useState(localDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [duplicates, setDuplicates] = useState<number[]>([]);
  const [password, setPassword] = useState('');
  const [backupPreview, setBackupPreview] =
    useState<Awaited<ReturnType<typeof readEncryptedBackup>>>();

  const loadRange = async (): Promise<{
    values: SessionWithBreaks[];
    profile: Awaited<ReturnType<typeof getAppServices>>['profile'];
  }> => {
    const services = await getAppServices();
    const start = Date.parse(`${from}T00:00:00.000Z`);
    const end = Date.parse(`${to}T23:59:59.999Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error('El rango de fechas no es válido.');
    return {
      values: await services.repository.listSessions(services.profile.id, start, end, 20_000),
      profile: services.profile,
    };
  };

  const runExport = async (format: ExportFormat) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const { values, profile } = await loadRange();
      if (format === 'CSV') await exportCsv(values, profile);
      else if (format === 'XLSX') await exportXlsx(values, profile);
      else await exportPdf(values, profile);
      setMessage(`${format} generado y abierto en el menú para compartir.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo exportar.');
    } finally {
      setBusy(false);
    }
  };

  const chooseImport = async () => {
    setError(undefined);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const content = await new File(result.assets[0]!.uri).text();
    const next = previewCsvImport(content);
    const services = await getAppServices();
    const existing = next.valid.length
      ? await services.repository.listSessions(
          services.profile.id,
          Math.min(...next.valid.map((row) => row.startedAtUtc)) - 1,
          Math.max(...next.valid.map((row) => row.endedAtUtc)) + 1,
          20_000,
        )
      : [];
    const possible = next.valid
      .filter((row) =>
        existing.some(({ session }) =>
          intervalsOverlap(
            row.startedAtUtc,
            row.endedAtUtc,
            session.startedAtUtc,
            session.endedAtUtc,
          ),
        ),
      )
      .map((row) => row.rowNumber);
    setPreview(next);
    setDuplicates(possible);
  };

  const confirmImport = async () => {
    if (!preview?.valid.length || preview.errors.length || duplicates.length) return;
    setBusy(true);
    try {
      const services = await getAppServices();
      await services.repository.runInTransaction(async () => {
        for (const row of preview.valid) {
          const created = await services.repository.createManualSession(
            services.profile.id,
            row.startedAtUtc,
            row.endedAtUtc,
            row.timezone,
            row.note,
            'IMPORT',
          );
          let cursor = row.startedAtUtc;
          if (row.breakMinutes) {
            const end = cursor + row.breakMinutes * 60_000;
            await services.repository.addManualBreak(created.session.id, cursor, end, false);
            cursor = end;
          }
          if (row.paidBreakMinutes) {
            await services.repository.addManualBreak(
              created.session.id,
              cursor,
              cursor + row.paidBreakMinutes * 60_000,
              true,
            );
          }
        }
      });
      setMessage(`${preview.valid.length} filas importadas dentro de una transacción.`);
      setPreview(undefined);
      setDuplicates([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La importación se revirtió.');
    } finally {
      setBusy(false);
    }
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      const services = await getAppServices();
      const sessions = await services.repository.listSessions(
        services.profile.id,
        0,
        Date.now() + 86_400_000,
        100_000,
      );
      await createEncryptedBackup({ profile: services.profile, sessions }, password);
      setMessage('Copia cifrada creada. La contraseña no se guardó en el archivo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la copia.');
    } finally {
      setBusy(false);
    }
  };

  const chooseBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const content = await new File(result.assets[0]!.uri).text();
      setBackupPreview(await readEncryptedBackup(content, password));
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `No se pudo verificar la copia: ${cause.message}`
          : 'Copia inválida.',
      );
    }
  };

  const restoreBackup = async (mode: 'MERGE' | 'REPLACE') => {
    if (!backupPreview) return;
    setBusy(true);
    try {
      const services = await getAppServices();
      const count = await services.repository.restoreSessions(
        services.profile.id,
        backupPreview.payload.sessions,
        mode,
      );
      setMessage(
        `${count} jornadas restauradas en modo ${mode === 'MERGE' ? 'combinar' : 'reemplazar'}.`,
      );
      setBackupPreview(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La restauración se revirtió.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading>Exportar registros</Heading>
      {error ? <ErrorState message={error} /> : null}
      {message ? (
        <Card>
          <Body>✓ {message}</Body>
        </Card>
      ) : null}
      <Card>
        <Body muted>Rango de fechas (AAAA-MM-DD)</Body>
        <TextInput
          accessibilityLabel="Fecha desde"
          value={from}
          onChangeText={setFrom}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <TextInput
          accessibilityLabel="Fecha hasta"
          value={to}
          onChangeText={setTo}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <View style={styles.actions}>
          {(['CSV', 'XLSX', 'PDF'] as const).map((format) => (
            <AppButton
              key={format}
              label={`Exportar ${format}`}
              busy={busy}
              onPress={() => void runExport(format)}
            />
          ))}
        </View>
      </Card>
      <Card>
        <Heading>Copia cifrada</Heading>
        <Body muted>
          Usá una contraseña de al menos 10 caracteres. Si la perdés, la copia no puede recuperarse.
        </Body>
        <TextInput
          accessibilityLabel="Contraseña de la copia"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña de recuperación"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <AppButton label="Crear copia cifrada" busy={busy} onPress={() => void createBackup()} />
        <AppButton
          label="Seleccionar copia para restaurar"
          variant="secondary"
          busy={busy}
          onPress={() => void chooseBackup()}
        />
        {backupPreview ? (
          <>
            <Body>Contenido verificado: {backupPreview.metadata.sessions} jornadas.</Body>
            <AppButton
              label="Combinar, omitiendo conflictos"
              onPress={() => void restoreBackup('MERGE')}
            />
            <AppButton
              label="Reemplazar registros locales"
              variant="danger"
              onPress={() =>
                Alert.alert(
                  'Reemplazar registros',
                  'Los registros locales se borrarán lógicamente y quedarán auditados.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Reemplazar',
                      style: 'destructive',
                      onPress: () => void restoreBackup('REPLACE'),
                    },
                  ],
                )
              }
            />
          </>
        ) : null}
      </Card>
      <Card>
        <Heading>Importar</Heading>
        <Body muted>
          Primero se validan todas las filas. La base solo cambia después de confirmar.
        </Body>
        <AppButton
          label="Compartir plantilla CSV"
          variant="secondary"
          onPress={() => void exportTemplate()}
        />
        <AppButton
          label="Seleccionar CSV"
          variant="secondary"
          onPress={() => void chooseImport()}
        />
        {preview ? (
          <>
            <Body>Filas válidas: {preview.valid.length}</Body>
            <Body>Errores: {preview.errors.length}</Body>
            {preview.errors.slice(0, 10).map((item) => (
              <Body key={item.rowNumber}>
                Fila {item.rowNumber}: {item.message}
              </Body>
            ))}
            <Body>
              Posibles duplicados: {duplicates.length ? duplicates.join(', ') : 'ninguno'}
            </Body>
            <AppButton
              label="Confirmar importación"
              busy={busy}
              disabled={preview.errors.length > 0 || duplicates.length > 0}
              onPress={() => void confirmImport()}
            />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  actions: { gap: 8 },
});

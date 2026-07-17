import { useCallback, useState } from 'react';
import { TZDate } from '@date-fns/tz';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { getAppServices } from '@/application/app-services';
import {
  formatDuration,
  grossDurationMs,
  netDurationMs,
  unpaidBreakDurationMs,
} from '@/domain/calculations';
import type { SessionWithBreaks, WorkProfile, WorkSessionRevision } from '@/domain/models';
import { useRepositoryData } from '@/shared/use-repository-data';
import { AppButton, Body, Card, ErrorState, Heading, LoadingState, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

const sessionFormSchema = z
  .object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora de entrada inválida.'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora de salida inválida.'),
    note: z.string().max(2_000),
  })
  .refine((value) => value.end >= value.start, {
    message: 'La salida debe ser posterior a la entrada.',
  });
type SessionForm = z.infer<typeof sessionFormSchema>;

interface DayData {
  profile: WorkProfile;
  sessions: SessionWithBreaks[];
  revisions: Record<string, WorkSessionRevision[]>;
}

function instantFor(date: string, time: string, timezone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new TZDate(year!, month! - 1, day!, hour!, minute!, 0, 0, timezone).getTime();
}

export default function DayDetailScreen() {
  const { date = '' } = useLocalSearchParams<{ date: string }>();
  const theme = useTheme();
  const [version, setVersion] = useState(0);
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const loader = useCallback(async (): Promise<DayData> => {
    void version;
    const services = await getAppServices();
    const from = instantFor(date, '00:00', services.profile.timezone);
    const to = new TZDate(from, services.profile.timezone);
    to.setDate(to.getDate() + 1);
    const sessions = await services.repository.listSessions(
      services.profile.id,
      from,
      to.getTime(),
      100,
    );
    const revisions = Object.fromEntries(
      await Promise.all(
        sessions.map(async ({ session }) => [
          session.id,
          await services.repository.listRevisions(session.id),
        ]),
      ),
    );
    return { profile: services.profile, sessions, revisions };
  }, [date, version]);
  const state = useRepositoryData(loader, [loader]);
  const { control, handleSubmit, reset } = useForm<SessionForm>({
    defaultValues: { start: '09:00', end: '17:00', note: '' },
  });

  const save = handleSubmit(async (raw) => {
    const parsed = sessionFormSchema.safeParse(raw);
    if (!parsed.success || !state.data) {
      setFormError(parsed.error?.issues[0]?.message ?? 'No se puede guardar todavía.');
      return;
    }
    try {
      const services = await getAppServices();
      const startedAtUtc = instantFor(date, parsed.data.start, state.data.profile.timezone);
      const endedAtUtc = instantFor(date, parsed.data.end, state.data.profile.timezone);
      if (editingId) {
        await services.repository.updateSession(
          editingId,
          { startedAtUtc, endedAtUtc, note: parsed.data.note },
          'Corrección manual desde el detalle diario',
        );
      } else {
        await services.repository.createManualSession(
          state.data.profile.id,
          startedAtUtc,
          endedAtUtc,
          state.data.profile.timezone,
          parsed.data.note || undefined,
        );
      }
      setEditingId(undefined);
      reset({ start: '09:00', end: '17:00', note: '' });
      setFormError(undefined);
      setVersion((value) => value + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    }
  });

  const edit = (value: SessionWithBreaks) => {
    const format = (instant: number) =>
      new Intl.DateTimeFormat('es', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: state.data?.profile.timezone,
      }).format(new Date(instant));
    setEditingId(value.session.id);
    reset({
      start: format(value.session.startedAtUtc),
      end: format(value.session.endedAtUtc ?? Date.now()),
      note: value.session.note ?? '',
    });
  };

  const remove = (id: string) =>
    Alert.alert('Eliminar jornada', 'El registro se conservará en la auditoría.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void getAppServices()
            .then(({ repository }) =>
              repository.softDeleteSession(id, 'Borrado solicitado por el usuario'),
            )
            .then(() => setVersion((value) => value + 1))
            .catch((cause: unknown) =>
              setFormError(cause instanceof Error ? cause.message : 'No se pudo eliminar.'),
            ),
      },
    ]);

  if (state.loading) return <LoadingState />;
  return (
    <Screen>
      <Heading>{date}</Heading>
      {state.error ? <ErrorState message={state.error} /> : null}
      {formError ? <ErrorState message={formError} /> : null}
      {state.data?.sessions.map((value) => (
        <Card key={value.session.id}>
          <Heading>
            {new Date(value.session.startedAtUtc).toLocaleTimeString()} –{' '}
            {value.session.endedAtUtc
              ? new Date(value.session.endedAtUtc).toLocaleTimeString()
              : 'Sin salida'}
          </Heading>
          <Body>Bruto: {formatDuration(grossDurationMs(value.session))} h</Body>
          <Body>Descontado: {formatDuration(unpaidBreakDurationMs(value.breaks))} h</Body>
          <Body>Neto: {formatDuration(netDurationMs(value))} h</Body>
          <Body muted>
            {value.session.note || 'Sin notas'} · Estado: {value.session.status}
          </Body>
          <Body muted>Modificaciones: {state.data?.revisions[value.session.id]?.length ?? 0}</Body>
          <View style={styles.actions}>
            <AppButton label="Editar" variant="secondary" onPress={() => edit(value)} />
            <AppButton label="Eliminar" variant="danger" onPress={() => remove(value.session.id)} />
          </View>
        </Card>
      ))}
      <Card>
        <Heading>{editingId ? 'Editar jornada' : 'Agregar jornada'}</Heading>
        {(['start', 'end', 'note'] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <TextInput
                accessibilityLabel={
                  name === 'start' ? 'Hora de entrada' : name === 'end' ? 'Hora de salida' : 'Nota'
                }
                placeholder={
                  name === 'start'
                    ? 'Entrada HH:mm'
                    : name === 'end'
                      ? 'Salida HH:mm'
                      : 'Nota opcional'
                }
                placeholderTextColor={theme.muted}
                multiline={name === 'note'}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            )}
          />
        ))}
        <AppButton
          label={editingId ? 'Guardar corrección' : 'Agregar jornada'}
          onPress={() => void save()}
        />
        {editingId ? (
          <AppButton
            label="Cancelar edición"
            variant="secondary"
            onPress={() => {
              setEditingId(undefined);
              reset();
            }}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});

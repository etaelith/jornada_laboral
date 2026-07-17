import { useCallback } from 'react';
import { startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { getAppServices } from '@/application/app-services';
import { formatDuration, summarizePeriod } from '@/domain/calculations';
import type { SessionWithBreaks, WorkProfile } from '@/domain/models';
import { useRepositoryData } from '@/shared/use-repository-data';
import { Body, Card, ErrorState, Heading, LoadingState, Screen } from '@/shared/ui';

interface StatsData {
  profile: WorkProfile;
  today: SessionWithBreaks[];
  week: SessionWithBreaks[];
  month: SessionWithBreaks[];
  previousMonth: SessionWithBreaks[];
}

export default function StatsScreen() {
  const loader = useCallback(async (): Promise<StatsData> => {
    const services = await getAppServices();
    const now = new Date();
    const today = startOfDay(now).getTime();
    const week = startOfWeek(now, { weekStartsOn: services.profile.weekStartsOn }).getTime();
    const month = startOfMonth(now).getTime();
    const previous = startOfMonth(subMonths(now, 1)).getTime();
    const load = (from: number, to: number) =>
      services.repository.listSessions(services.profile.id, from, to, 1_000);
    const [todayRows, weekRows, monthRows, previousRows] = await Promise.all([
      load(today, Date.now() + 1),
      load(week, Date.now() + 1),
      load(month, Date.now() + 1),
      load(previous, month),
    ]);
    return {
      profile: services.profile,
      today: todayRows,
      week: weekRows,
      month: monthRows,
      previousMonth: previousRows,
    };
  }, []);
  const state = useRepositoryData(loader, [loader]);
  if (state.loading) return <LoadingState label="Calculando estadísticas…" />;
  if (state.error || !state.data)
    return (
      <Screen>
        <ErrorState message={state.error ?? 'Sin datos'} />
      </Screen>
    );

  const { profile } = state.data;
  const today = summarizePeriod(state.data.today, profile.expectedMinutesPerDay, 1);
  const week = summarizePeriod(
    state.data.week,
    profile.expectedMinutesPerWeek,
    profile.workDays.length,
  );
  const monthTarget = profile.expectedMinutesPerDay * profile.workDays.length * 4.33;
  const month = summarizePeriod(state.data.month, monthTarget, profile.workDays.length * 4.33);
  const previous = summarizePeriod(
    state.data.previousMonth,
    monthTarget,
    profile.workDays.length * 4.33,
  );
  const comparison = month.workedMs - previous.workedMs;

  const items = [
    ['Hoy', today.workedMs],
    ['Esta semana', week.workedMs],
    ['Este mes', month.workedMs],
    ['Horas ordinarias', month.ordinaryMs],
    ['Horas extra', month.overtimeMs],
    ['Horas faltantes', month.missingMs],
    ['Promedio diario', month.averageDailyMs],
  ] as const;

  return (
    <Screen>
      <Heading>Resumen de horas</Heading>
      <View style={styles.grid}>
        {items.map(([label, value]) => (
          <Card key={label} style={styles.metric}>
            <Body muted>{label}</Body>
            <Heading>{formatDuration(value)} h</Heading>
          </Card>
        ))}
      </View>
      <Card>
        <Body muted>Comparación con el mes anterior</Body>
        <Heading>
          {comparison >= 0 ? '+' : '−'}
          {formatDuration(Math.abs(comparison))} h
        </Heading>
        <Body>{month.incompleteSessions} registros incompletos o abiertos no incluidos.</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  metric: { minHeight: 100 },
});

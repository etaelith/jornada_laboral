import { useCallback, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { addMonths, getDay, getDaysInMonth, subMonths } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAppServices } from '@/application/app-services';
import { dailyNetTotals, formatDuration, monthUtcRange } from '@/domain/calculations';
import type { SessionWithBreaks, WorkProfile } from '@/domain/models';
import { useRepositoryData } from '@/shared/use-repository-data';
import { AppButton, Body, Card, ErrorState, Heading, LoadingState, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

interface MonthData {
  profile: WorkProfile;
  sessions: SessionWithBreaks[];
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const loader = useCallback(async (): Promise<MonthData> => {
    const services = await getAppServices();
    const [from, to] = monthUtcRange(year, monthIndex, services.profile.timezone);
    return {
      profile: services.profile,
      sessions: await services.repository.listSessions(services.profile.id, from, to, 500),
    };
  }, [monthIndex, year]);
  const state = useRepositoryData(loader, [loader]);

  const totals = useMemo(
    () =>
      state.data
        ? dailyNetTotals(state.data.sessions, state.data.profile.timezone)
        : new Map<string, number>(),
    [state.data],
  );
  const cells = useMemo(() => {
    const leading = (getDay(new Date(year, monthIndex, 1)) + 6) % 7;
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: getDaysInMonth(month) }, (_, index) => index + 1),
    ];
  }, [month, monthIndex, year]);

  return (
    <Screen>
      <View style={styles.header}>
        <AppButton
          label="Mes anterior"
          variant="secondary"
          onPress={() => setMonth(subMonths(month, 1))}
        />
        <Heading>
          {new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(month)}
        </Heading>
        <AppButton
          label="Mes siguiente"
          variant="secondary"
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>
      {state.loading ? <LoadingState /> : null}
      {state.error ? <ErrorState message={state.error} /> : null}
      {!state.loading ? (
        <Card>
          <View style={styles.weekRow}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => (
              <Text key={label} style={[styles.weekday, { color: theme.muted }]}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.day} />;
              const key = dateKey(year, monthIndex, day);
              const total = totals.get(key) ?? 0;
              const hasIncomplete = state.data?.sessions.some(
                (value) =>
                  new Intl.DateTimeFormat('en-CA', {
                    timeZone: state.data?.profile.timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(new Date(value.session.startedAtUtc)) === key &&
                  !value.session.endedAtUtc,
              );
              return (
                <Link key={key} href={{ pathname: '/day/[date]', params: { date: key } }} asChild>
                  <Pressable
                    accessibilityLabel={`${key}, ${formatDuration(total)} horas${hasIncomplete ? ', incompleta' : ''}`}
                    style={[styles.day, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.dayNumber, { color: theme.text }]}>{day}</Text>
                    <Text style={[styles.dayTotal, { color: total ? theme.primary : theme.muted }]}>
                      {total ? formatDuration(total) : '—'}
                    </Text>
                    {hasIncomplete ? <Text style={{ color: theme.warning }}>! revisar</Text> : null}
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </Card>
      ) : null}
      <Body muted>
        Los símbolos “! revisar” identifican registros incompletos sin depender del color.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.285%', textAlign: 'center', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.285%', minHeight: 68, borderWidth: 0.5, padding: 4 },
  dayNumber: { fontWeight: '700' },
  dayTotal: { fontSize: 12, marginTop: 4 },
});

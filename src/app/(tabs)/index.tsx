import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/application/app-context';
import { formatDuration, netDurationMs } from '@/domain/calculations';
import { DurationCounter } from '@/features/time-tracking/duration-counter';
import { AppButton, Body, Card, ErrorState, Heading, LoadingState, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

export default function HomeScreen() {
  const app = useApp();
  const theme = useTheme();
  if (app.loading) return <LoadingState label="Abriendo registros cifrados…" />;

  const openBreak = app.openSession?.breaks.find((item) => !item.endedAtUtc);
  const handleClock = async () => {
    await Haptics.selectionAsync();
    await app.clock();
  };

  return (
    <Screen>
      <View>
        <Body muted>{new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(new Date())}</Body>
        <Heading>{app.profile?.name ?? 'Jornada laboral'}</Heading>
      </View>

      {app.error ? <ErrorState message={app.error} /> : null}

      <Card style={styles.statusCard}>
        <Text style={[styles.status, { color: app.openSession ? theme.success : theme.muted }]}>
          {app.openSession ? (openBreak ? '⏸ En pausa' : '● Trabajando') : '○ Jornada cerrada'}
        </Text>
        {app.openSession ? (
          <>
            <DurationCounter value={app.openSession} />
            <Body muted>
              Entrada: {new Date(app.openSession.session.startedAtUtc).toLocaleTimeString()}
            </Body>
          </>
        ) : (
          <Text style={[styles.counterPlaceholder, { color: theme.text }]}>0:00</Text>
        )}
        <AppButton
          label={app.openSession ? 'Marcar salida' : 'Marcar entrada'}
          busy={app.busy}
          onPress={() => void handleClock()}
        />
        {app.openSession ? (
          <AppButton
            label={openBreak ? 'Finalizar pausa' : 'Comenzar pausa'}
            variant="secondary"
            busy={app.busy}
            onPress={() => void app.pause()}
          />
        ) : null}
      </Card>

      <Card>
        <Body muted>Resumen provisional</Body>
        <Heading>{formatDuration(app.openSession ? netDurationMs(app.openSession) : 0)} h</Heading>
        <Body>Las jornadas abiertas no se cuentan como completadas en estadísticas.</Body>
      </Card>

      <View style={styles.links}>
        <Link href="/(tabs)/calendar" style={[styles.link, { color: theme.primary }]}>
          Ver calendario
        </Link>
        <Link href="/export" style={[styles.link, { color: theme.primary }]}>
          Importar o exportar
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { alignItems: 'stretch' },
  status: { fontSize: 17, fontWeight: '700' },
  counterPlaceholder: {
    fontSize: 54,
    lineHeight: 64,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  links: { gap: 14 },
  link: { minHeight: 44, fontSize: 17, fontWeight: '600', textAlignVertical: 'center' },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { formatDuration, netDurationMs } from '@/domain/calculations';
import type { SessionWithBreaks } from '@/domain/models';
import { useTheme } from '@/shared/theme';

export function DurationCounter({ value }: { value: SessionWithBreaks }) {
  const theme = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text
      accessibilityLabel={`Duración actual ${formatDuration(netDurationMs(value, now))}`}
      style={[styles.counter, { color: theme.text }]}
    >
      {formatDuration(netDurationMs(value, now))}
    </Text>
  );
}

const styles = StyleSheet.create({
  counter: { fontSize: 54, lineHeight: 64, fontVariant: ['tabular-nums'], fontWeight: '700' },
});

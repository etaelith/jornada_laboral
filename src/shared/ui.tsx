import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const theme = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
    >
      {children}
    </View>
  );
}

export function Heading({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: muted ? theme.muted : theme.text }]}>{children}</Text>;
}

export function AppButton({
  label,
  variant = 'primary',
  busy = false,
  ...props
}: PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : theme.surface;
  const color = variant === 'secondary' ? theme.text : theme.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || props.disabled}
      {...props}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: theme.border, opacity: pressed ? 0.78 : 1 },
        (busy || props.disabled) && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="progressbar" style={styles.center}>
      <ActivityIndicator color={theme.primary} size="large" />
      <Text style={[styles.body, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <Text accessibilityRole="alert" style={[styles.body, { color: theme.danger }]}>
        {message}
      </Text>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: 16, gap: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  center: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

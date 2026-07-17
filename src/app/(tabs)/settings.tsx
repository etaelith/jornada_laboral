import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp } from '@/application/app-context';
import { scheduleWeeklyReviewReminder } from '@/features/reminders/reminder-service';
import { biometricLockEnabled, setBiometricLockEnabled } from '@/security/app-lock';
import { AppButton, Body, Card, Heading, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

export default function SettingsScreen() {
  const app = useApp();
  const theme = useTheme();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const toggleBiometric = async () => {
    try {
      const enabled = await biometricLockEnabled();
      await setBiometricLockEnabled(!enabled);
      setMessage(`Bloqueo biométrico ${enabled ? 'desactivado' : 'activado'}.`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el bloqueo.');
    }
  };
  return (
    <Screen>
      <Heading>Configuración</Heading>
      {message ? (
        <Card>
          <Body>✓ {message}</Body>
        </Card>
      ) : null}
      {error ? (
        <Card>
          <Body>{error}</Body>
        </Card>
      ) : null}
      <Card>
        <Body muted>Perfil activo</Body>
        <Heading>{app.profile?.name ?? 'Cargando…'}</Heading>
        <Body>{app.profile?.timezone}</Body>
      </Card>
      <View style={styles.links}>
        <Link href="/profile" style={[styles.link, { color: theme.primary }]}>
          Editar perfil y objetivos
        </Link>
        <Link href="/export" style={[styles.link, { color: theme.primary }]}>
          Importación, exportación y backup
        </Link>
      </View>
      <Card>
        <Body>Privacidad</Body>
        <Body muted>
          La base y los campos sensibles se cifran localmente. No se envían datos a un servidor.
        </Body>
        <AppButton
          label="Activar o desactivar biometría"
          variant="secondary"
          onPress={() => void toggleBiometric()}
        />
        <AppButton
          label="Programar recordatorio semanal"
          variant="secondary"
          onPress={() =>
            void scheduleWeeklyReviewReminder()
              .then(() => setMessage('Recordatorio semanal programado.'))
              .catch((cause: unknown) =>
                setError(cause instanceof Error ? cause.message : 'No se pudo programar.'),
              )
          }
        />
      </Card>
      <Card>
        <Body>Compatibilidad</Body>
        <Body muted>
          Modo de efectos reducidos activo: sin desenfoques, partículas ni animaciones decorativas.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { gap: 12 },
  link: { minHeight: 48, fontSize: 17, fontWeight: '600', textAlignVertical: 'center' },
});

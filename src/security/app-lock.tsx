import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { AppButton, Body, Card, Heading, LoadingState, Screen } from '@/shared/ui';

const LOCK_KEY = 'jornada.biometric-lock.v1';

export async function biometricLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(LOCK_KEY)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled)
      throw new Error('No hay biometría configurada en este dispositivo.');
  }
  await SecureStore.setItemAsync(LOCK_KEY, String(enabled));
}

export function AppLock({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string>();

  const unlock = useCallback(async () => {
    setError(undefined);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear registros laborales',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (result.success) setLocked(false);
    else setError('No se pudo verificar la identidad.');
  }, []);

  useEffect(() => {
    biometricLockEnabled()
      .then(async (enabled) => {
        setLocked(enabled);
        if (enabled) await unlock();
      })
      .finally(() => setChecking(false));
  }, [unlock]);

  if (checking) return <LoadingState label="Verificando bloqueo…" />;
  if (!locked) return children;
  return (
    <Screen>
      <Card>
        <Heading>Aplicación bloqueada</Heading>
        <Body>{error ?? 'Autenticate para consultar tus registros.'}</Body>
        <AppButton label="Desbloquear" onPress={() => void unlock()} />
      </Card>
    </Screen>
  );
}

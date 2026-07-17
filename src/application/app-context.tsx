import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SessionWithBreaks, WorkProfile } from '@/domain/models';

import { getAppServices, toggleBreak, toggleWorkSession } from './app-services';

interface AppState {
  loading: boolean;
  busy: boolean;
  error?: string;
  profile?: WorkProfile;
  openSession?: SessionWithBreaks;
  refresh(): Promise<void>;
  clock(): Promise<void>;
  pause(): Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [profile, setProfile] = useState<WorkProfile>();
  const [openSession, setOpenSession] = useState<SessionWithBreaks>();

  const refresh = useCallback(async () => {
    try {
      const services = await getAppServices();
      const current = await services.repository.getOpenSession(services.profile.id);
      setProfile((await services.repository.getDefaultProfile()) ?? services.profile);
      setOpenSession(current ?? undefined);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir la aplicación.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      setError(undefined);
      try {
        await action();
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'La operación no pudo completarse.');
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const value = useMemo<AppState>(
    () => ({
      loading,
      busy,
      ...(error === undefined ? {} : { error }),
      ...(profile === undefined ? {} : { profile }),
      ...(openSession === undefined ? {} : { openSession }),
      refresh,
      clock: () => run(toggleWorkSession),
      pause: () => run(() => toggleBreak(false)),
    }),
    [busy, error, loading, openSession, profile, refresh, run],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp debe utilizarse dentro de AppProvider.');
  return value;
}

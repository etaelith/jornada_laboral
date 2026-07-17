import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRepositoryData<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      loader()
        .then((value) => {
          if (active) {
            setData(value);
            setError(undefined);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies),
  );

  return { data, error, loading };
}

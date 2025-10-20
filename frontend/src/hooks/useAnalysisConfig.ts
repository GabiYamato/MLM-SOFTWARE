import { useCallback, useEffect, useState } from 'react';
import type { AnalysisConfig } from '../types';
import { defaultAnalysisConfig } from '../types';

const STORAGE_KEY = 'mli-analysis-config-v3';

export const useAnalysisConfig = () => {
  const [config, setConfig] = useState<AnalysisConfig>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultAnalysisConfig;
      }
      const parsed = JSON.parse(raw) as Partial<AnalysisConfig>;
      return { ...defaultAnalysisConfig, ...parsed } satisfies AnalysisConfig;
    } catch (error) {
      console.warn('Failed to parse stored analysis config', error);
      return defaultAnalysisConfig;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('Unable to persist analysis config', error);
    }
  }, [config]);

  const updateConfig = useCallback(<K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetConfig = useCallback(() => setConfig(defaultAnalysisConfig), []);

  return { config, updateConfig, resetConfig } as const;
};

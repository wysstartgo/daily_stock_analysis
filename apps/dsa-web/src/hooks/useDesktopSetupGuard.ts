import { useEffect, useMemo, useState } from 'react';
import { systemConfigApi } from '../api/systemConfig';
import { evaluateDesktopSetup, type DesktopSetupStatus } from '../utils/desktopSetup';

type UseDesktopSetupGuardOptions = {
  enabled: boolean;
  pathname: string;
};

type UseDesktopSetupGuardResult = {
  isChecking: boolean;
  shouldBlockNavigation: boolean;
  shouldRedirectHome: boolean;
  setupStatus: DesktopSetupStatus | null;
};

const DEFAULT_STATUS: DesktopSetupStatus = {
  isComplete: true,
  missingKeys: [],
  missingLabels: [],
  issues: [],
};

export function useDesktopSetupGuard({
  enabled,
  pathname,
}: UseDesktopSetupGuardOptions): UseDesktopSetupGuardResult {
  const [setupStatus, setSetupStatus] = useState<DesktopSetupStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkedPathname, setCheckedPathname] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setSetupStatus(null);
      setIsChecking(false);
      setCheckedPathname(null);
      return undefined;
    }

    setIsChecking(true);
    void systemConfigApi.getConfig(false)
      .then((config) => {
        if (!active) {
          return;
        }
        setSetupStatus(evaluateDesktopSetup(config.items));
        setCheckedPathname(pathname);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setSetupStatus(DEFAULT_STATUS);
        setCheckedPathname(pathname);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setIsChecking(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, pathname]);

  const pathReady = checkedPathname === pathname;

  const shouldBlockNavigation = useMemo(() => {
    if (!enabled || !pathReady || isChecking) {
      return false;
    }
    if (!setupStatus || setupStatus.isComplete) {
      return false;
    }
    return pathname !== '/setup' && pathname !== '/settings';
  }, [enabled, isChecking, pathReady, pathname, setupStatus]);

  return {
    isChecking: enabled && (!pathReady || isChecking),
    shouldBlockNavigation,
    shouldRedirectHome: enabled && pathReady && !isChecking && pathname === '/setup' && Boolean(setupStatus?.isComplete),
    setupStatus,
  };
}

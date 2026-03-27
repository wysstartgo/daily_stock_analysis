import { useEffect } from 'react';
import { systemConfigApi } from '../api/systemConfig';
import { evaluateDesktopSetup, normalizeStockListInput } from '../utils/desktopSetup';
import type { SubmitAnalysisOptions } from '../stores/stockPoolStore';
import type { SystemConfigItem } from '../types/systemConfig';

const SESSION_KEY = 'dsa.desktop.autoAnalyzeStockList.started';
const FALSEY_VALUES = new Set(['0', 'false', 'no', 'off']);

type DesktopWindow = Window & {
  dsaDesktop?: {
    version?: string;
  };
};

type UseDesktopAutoAnalyzeStockListOptions = {
  enabled?: boolean;
  notify: boolean;
  submitAnalysis: (options?: SubmitAnalysisOptions) => Promise<void>;
};

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as DesktopWindow).dsaDesktop);
}

function getStockList(items: SystemConfigItem[]): string[] {
  const stockListItem = items.find((item) => item.key === 'STOCK_LIST');
  return normalizeStockListInput(String(stockListItem?.value ?? ''))
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
}

function isDesktopAutoAnalyzeEnabled(items: SystemConfigItem[]): boolean {
  const item = items.find((entry) => entry.key === 'DESKTOP_AUTO_ANALYZE_STOCK_LIST_ON_STARTUP');
  const rawValue = String(item?.value ?? '').trim().toLowerCase();
  if (!rawValue) {
    return true;
  }
  return !FALSEY_VALUES.has(rawValue);
}

export function useDesktopAutoAnalyzeStockList({
  enabled = true,
  notify,
  submitAnalysis,
}: UseDesktopAutoAnalyzeStockListOptions): void {
  useEffect(() => {
    if (!enabled || !isDesktopRuntime() || typeof sessionStorage === 'undefined') {
      return;
    }

    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const config = await systemConfigApi.getConfig(false);
        if (cancelled) {
          return;
        }

        const setupStatus = evaluateDesktopSetup(config.items);
        if (!setupStatus.isComplete) {
          return;
        }
        if (!isDesktopAutoAnalyzeEnabled(config.items)) {
          return;
        }

        const stockList = getStockList(config.items);
        sessionStorage.setItem(SESSION_KEY, 'true');

        for (const stockCode of stockList) {
          if (cancelled) {
            return;
          }

          await submitAnalysis({
            stockCode,
            originalQuery: stockCode,
            selectionSource: 'import',
            notify,
          });
        }
      } catch (error) {
        console.warn('Desktop auto-analyze bootstrap skipped:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, notify, submitAnalysis]);
}

export default useDesktopAutoAnalyzeStockList;

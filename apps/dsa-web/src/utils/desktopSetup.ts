import type { SystemConfigItem } from '../types/systemConfig';
import { getFieldTitleZh } from './systemConfigI18n';

const REQUIRED_LLM_KEYS = [
  'LITELLM_CONFIG',
  'LLM_CHANNELS',
  'AIHUBMIX_KEY',
  'OPENAI_API_KEY',
  'OPENAI_API_KEYS',
  'GEMINI_API_KEY',
  'GEMINI_API_KEYS',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEYS',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_API_KEYS',
] as const;

type DesktopSetupIssue = {
  key: 'STOCK_LIST' | 'LLM_PROVIDER';
  label: string;
};

export type DesktopSetupStatus = {
  isComplete: boolean;
  missingKeys: Array<DesktopSetupIssue['key']>;
  missingLabels: string[];
  issues: DesktopSetupIssue[];
};

export type DesktopSetupProvider = 'openai' | 'gemini' | 'custom';

export type DesktopSetupFormValues = {
  stockList: string;
  provider: DesktopSetupProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export type DesktopSetupUpdateItem = {
  key: string;
  value: string;
};

function hasConfiguredValue(item: SystemConfigItem | undefined): boolean {
  if (!item) {
    return false;
  }

  return Boolean(item.rawValueExists || String(item.value ?? '').trim());
}

function getItemValue(itemMap: Map<string, SystemConfigItem>, key: string): string {
  const item = itemMap.get(key);
  if (!item) {
    return '';
  }
  return String(item.value ?? '').trim();
}

export function normalizeStockListInput(value: string): string {
  return value
    .split(/[\s,，]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .join(',');
}

export function inferDesktopSetupProvider(items: SystemConfigItem[]): DesktopSetupProvider {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const geminiConfigured = hasConfiguredValue(itemMap.get('GEMINI_API_KEY')) || hasConfiguredValue(itemMap.get('GEMINI_MODEL'));
  if (geminiConfigured) {
    return 'gemini';
  }

  const openaiBaseUrl = getItemValue(itemMap, 'OPENAI_BASE_URL');
  if (openaiBaseUrl) {
    return 'custom';
  }

  return 'openai';
}

export function buildDesktopSetupInitialValues(items: SystemConfigItem[]): DesktopSetupFormValues {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const provider = inferDesktopSetupProvider(items);

  if (provider === 'gemini') {
    return {
      stockList: getItemValue(itemMap, 'STOCK_LIST'),
      provider,
      model: getItemValue(itemMap, 'GEMINI_MODEL'),
      apiKey: getItemValue(itemMap, 'GEMINI_API_KEY'),
      baseUrl: '',
    };
  }

  return {
    stockList: getItemValue(itemMap, 'STOCK_LIST'),
    provider,
    model: getItemValue(itemMap, 'OPENAI_MODEL'),
    apiKey: getItemValue(itemMap, 'OPENAI_API_KEY'),
    baseUrl: getItemValue(itemMap, 'OPENAI_BASE_URL'),
  };
}

export function buildDesktopSetupUpdateItems(values: DesktopSetupFormValues): DesktopSetupUpdateItem[] {
  const normalizedStockList = normalizeStockListInput(values.stockList);
  const model = values.model.trim();
  const apiKey = values.apiKey.trim();
  const baseUrl = values.baseUrl.trim();

  if (values.provider === 'gemini') {
    return [
      { key: 'STOCK_LIST', value: normalizedStockList },
      { key: 'GEMINI_API_KEY', value: apiKey },
      { key: 'GEMINI_MODEL', value: model },
      { key: 'OPENAI_API_KEY', value: '' },
      { key: 'OPENAI_MODEL', value: '' },
      { key: 'OPENAI_BASE_URL', value: '' },
    ];
  }

  return [
    { key: 'STOCK_LIST', value: normalizedStockList },
    { key: 'OPENAI_API_KEY', value: apiKey },
    { key: 'OPENAI_MODEL', value: model },
    { key: 'OPENAI_BASE_URL', value: baseUrl },
    { key: 'GEMINI_API_KEY', value: '' },
    { key: 'GEMINI_MODEL', value: '' },
  ];
}

export function evaluateDesktopSetup(items: SystemConfigItem[]): DesktopSetupStatus {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const issues: DesktopSetupIssue[] = [];

  if (!hasConfiguredValue(itemMap.get('STOCK_LIST'))) {
    issues.push({
      key: 'STOCK_LIST',
      label: getFieldTitleZh('STOCK_LIST'),
    });
  }

  const hasLlmConfig = REQUIRED_LLM_KEYS.some((key) => hasConfiguredValue(itemMap.get(key)));
  if (!hasLlmConfig) {
    issues.push({
      key: 'LLM_PROVIDER',
      label: 'AI 模型配置',
    });
  }

  return {
    isComplete: issues.length === 0,
    missingKeys: issues.map((issue) => issue.key),
    missingLabels: issues.map((issue) => issue.label),
    issues,
  };
}

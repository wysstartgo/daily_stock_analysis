import { describe, expect, it } from 'vitest';
import {
  buildDesktopSetupUpdateItems,
  evaluateDesktopSetup,
  inferDesktopSetupProvider,
  normalizeStockListInput,
} from '../desktopSetup';
import type { SystemConfigItem } from '../../types/systemConfig';

function item(
  key: string,
  value: string,
  overrides: Partial<SystemConfigItem> = {},
): SystemConfigItem {
  return {
    key,
    value,
    rawValueExists: value.trim().length > 0,
    isMasked: false,
    ...overrides,
  };
}

describe('evaluateDesktopSetup', () => {
  it('marks setup incomplete when stock list and LLM config are both missing', () => {
    const result = evaluateDesktopSetup([]);

    expect(result.isComplete).toBe(false);
    expect(result.missingKeys).toEqual(['STOCK_LIST', 'LLM_PROVIDER']);
    expect(result.missingLabels).toEqual(['自选股列表', 'AI 模型配置']);
  });

  it('treats masked API keys and stock list as configured', () => {
    const result = evaluateDesktopSetup([
      item('STOCK_LIST', '600519,AAPL'),
      item('OPENAI_API_KEY', '******', {
        rawValueExists: true,
        isMasked: true,
      }),
    ]);

    expect(result.isComplete).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });

  it('accepts channel-based LLM config as a valid model setup source', () => {
    const result = evaluateDesktopSetup([
      item('STOCK_LIST', '600519'),
      item('LLM_CHANNELS', 'primary,backup'),
    ]);

    expect(result.isComplete).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });

  it('infers custom provider when openai-compatible base url is configured', () => {
    const provider = inferDesktopSetupProvider([
      item('OPENAI_API_KEY', 'secret'),
      item('OPENAI_MODEL', 'qwen-max'),
      item('OPENAI_BASE_URL', 'https://custom.example.com/v1'),
    ]);

    expect(provider).toBe('custom');
  });

  it('normalizes pasted stock input into comma-separated values', () => {
    expect(normalizeStockListInput('600519\nAAPL, hk00700  TSLA')).toBe('600519,AAPL,hk00700,TSLA');
  });

  it('maps custom provider form values into existing OPENAI-compatible env keys', () => {
    const updates = buildDesktopSetupUpdateItems({
      stockList: '600519\nAAPL',
      provider: 'custom',
      model: 'qwen-max',
      apiKey: 'secret-key',
      baseUrl: 'https://custom.example.com/v1',
    });

    expect(updates).toEqual([
      { key: 'STOCK_LIST', value: '600519,AAPL' },
      { key: 'OPENAI_API_KEY', value: 'secret-key' },
      { key: 'OPENAI_MODEL', value: 'qwen-max' },
      { key: 'OPENAI_BASE_URL', value: 'https://custom.example.com/v1' },
      { key: 'GEMINI_API_KEY', value: '' },
      { key: 'GEMINI_MODEL', value: '' },
    ]);
  });
});

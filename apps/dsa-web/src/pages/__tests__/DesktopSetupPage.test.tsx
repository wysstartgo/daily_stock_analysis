import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesktopSetupPage from '../DesktopSetupPage';

const getConfigMock = vi.fn();
const validateMock = vi.fn();
const updateMock = vi.fn();
const testLLMChannelMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../api/systemConfig', () => ({
  systemConfigApi: {
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    validate: (...args: unknown[]) => validateMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    testLLMChannel: (...args: unknown[]) => testLLMChannelMock(...args),
  },
}));

describe('DesktopSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({
      configVersion: 'v1',
      maskToken: '******',
      items: [
        { key: 'STOCK_LIST', value: '', rawValueExists: false, isMasked: false },
        { key: 'OPENAI_API_KEY', value: '', rawValueExists: false, isMasked: false },
        { key: 'OPENAI_MODEL', value: '', rawValueExists: false, isMasked: false },
        { key: 'OPENAI_BASE_URL', value: '', rawValueExists: false, isMasked: false },
        { key: 'GEMINI_API_KEY', value: '', rawValueExists: false, isMasked: false },
        { key: 'GEMINI_MODEL', value: '', rawValueExists: false, isMasked: false },
      ],
    });
    validateMock.mockResolvedValue({ valid: true, issues: [] });
    updateMock.mockResolvedValue({
      success: true,
      configVersion: 'v2',
      appliedCount: 4,
      skippedMaskedCount: 0,
      reloadTriggered: true,
      updatedKeys: ['STOCK_LIST', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL'],
      warnings: [],
    });
    testLLMChannelMock.mockResolvedValue({
      success: true,
      message: 'LLM channel test succeeded',
      error: null,
      resolvedProtocol: 'openai',
      resolvedModel: 'qwen-max',
      latencyMs: 320,
    });
  });

  it('renders minimal setup fields and saves a custom provider into OPENAI-compatible keys', async () => {
    render(
      <MemoryRouter>
        <DesktopSetupPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '初始化桌面端配置' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('自选股列表'), {
      target: { value: '600519\nAAPL' },
    });
    fireEvent.change(screen.getByLabelText('模型提供方'), {
      target: { value: 'custom' },
    });
    fireEvent.change(screen.getByLabelText('模型名称'), {
      target: { value: 'qwen-max' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'secret-key' },
    });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://custom.example.com/v1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存并进入主界面' }));

    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledWith({
        items: [
          { key: 'STOCK_LIST', value: '600519,AAPL' },
          { key: 'OPENAI_API_KEY', value: 'secret-key' },
          { key: 'OPENAI_MODEL', value: 'qwen-max' },
          { key: 'OPENAI_BASE_URL', value: 'https://custom.example.com/v1' },
          { key: 'GEMINI_API_KEY', value: '' },
          { key: 'GEMINI_MODEL', value: '' },
        ],
      });
    });

    expect(updateMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates to advanced settings without allowing the main page yet', async () => {
    render(
      <MemoryRouter>
        <DesktopSetupPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '初始化桌面端配置' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '进入高级配置' }));

    expect(navigateMock).toHaveBeenCalledWith('/settings?from=setup', { replace: true });
  });

  it('tests the selected provider connection before saving', async () => {
    render(
      <MemoryRouter>
        <DesktopSetupPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '初始化桌面端配置' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('自选股列表'), {
      target: { value: '600519' },
    });
    fireEvent.change(screen.getByLabelText('模型提供方'), {
      target: { value: 'custom' },
    });
    fireEvent.change(screen.getByLabelText('模型名称'), {
      target: { value: 'qwen-max' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'secret-key' },
    });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://custom.example.com/v1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => {
      expect(testLLMChannelMock).toHaveBeenCalledWith({
        name: 'desktop-setup',
        protocol: 'openai',
        baseUrl: 'https://custom.example.com/v1',
        apiKey: 'secret-key',
        models: ['qwen-max'],
        enabled: true,
        timeoutSeconds: 20,
      });
    });

    expect(await screen.findByText('连接成功 · qwen-max · 320 ms')).toBeInTheDocument();
  });

  it('keeps an OpenAI base url when saving the OpenAI provider', async () => {
    render(
      <MemoryRouter>
        <DesktopSetupPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '初始化桌面端配置' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('自选股列表'), {
      target: { value: '600519' },
    });
    fireEvent.change(screen.getByLabelText('模型名称'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'secret-key' },
    });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://api.openai-proxy.example.com/v1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存并进入主界面' }));

    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledWith({
        items: [
          { key: 'STOCK_LIST', value: '600519' },
          { key: 'OPENAI_API_KEY', value: 'secret-key' },
          { key: 'OPENAI_MODEL', value: 'gpt-4o-mini' },
          { key: 'OPENAI_BASE_URL', value: 'https://api.openai-proxy.example.com/v1' },
          { key: 'GEMINI_API_KEY', value: '' },
          { key: 'GEMINI_MODEL', value: '' },
        ],
      });
    });
  });
});

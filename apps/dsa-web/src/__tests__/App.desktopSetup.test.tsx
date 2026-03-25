import type React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const getConfigMock = vi.fn();
const useAuthMock = vi.fn();
const setCurrentRouteMock = vi.fn();

vi.mock('../api/systemConfig', () => ({
  systemConfigApi: {
    getConfig: (...args: unknown[]) => getConfigMock(...args),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => useAuthMock(),
}));

vi.mock('../components/common', () => ({
  ApiErrorAlert: ({ error }: { error?: { message?: string } }) => <div>{error?.message ?? 'api error'}</div>,
  Shell: ({ children }: { children?: React.ReactNode }) => <div>{children ?? <Outlet />}</div>,
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div>首页工作台</div>,
}));

vi.mock('../pages/SettingsPage', () => ({
  default: () => <div>系统设置页</div>,
}));

vi.mock('../pages/DesktopSetupPage', () => ({
  default: () => <div>初始化向导页</div>,
}));

vi.mock('../pages/BacktestPage', () => ({
  default: () => <div>回测页</div>,
}));

vi.mock('../pages/LoginPage', () => ({
  default: () => <div>登录页</div>,
}));

vi.mock('../pages/NotFoundPage', () => ({
  default: () => <div>未找到页面</div>,
}));

vi.mock('../pages/ChatPage', () => ({
  default: () => <div>问股页</div>,
}));

vi.mock('../pages/PortfolioPage', () => ({
  default: () => <div>组合页</div>,
}));

vi.mock('../stores/agentChatStore', () => ({
  useAgentChatStore: {
    getState: () => ({
      setCurrentRoute: setCurrentRouteMock,
    }),
  },
}));

describe('App desktop setup guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    Object.defineProperty(window, 'dsaDesktop', {
      configurable: true,
      value: { version: '0.1.0' },
    });
    useAuthMock.mockReturnValue({
      authEnabled: false,
      loggedIn: true,
      isLoading: false,
      loadError: null,
      refreshStatus: vi.fn(),
    });
  });

  it('redirects to /setup when desktop config is incomplete', async () => {
    getConfigMock.mockResolvedValue({
      configVersion: 'v1',
      maskToken: '******',
      items: [
        { key: 'STOCK_LIST', value: '', rawValueExists: false, isMasked: false },
      ],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('初始化向导页')).toBeInTheDocument();
    });
  });

  it('allows the home page when desktop config is already complete', async () => {
    getConfigMock.mockResolvedValue({
      configVersion: 'v1',
      maskToken: '******',
      items: [
        { key: 'STOCK_LIST', value: '600519', rawValueExists: true, isMasked: false },
        { key: 'OPENAI_API_KEY', value: '******', rawValueExists: true, isMasked: true },
      ],
    });

    render(<App />);

    expect(await screen.findByText('首页工作台')).toBeInTheDocument();
    expect(screen.queryByText('初始化向导页')).not.toBeInTheDocument();
  });

  it('redirects configured users away from /setup back to the home page', async () => {
    window.history.pushState({}, '', '/setup');
    getConfigMock.mockResolvedValue({
      configVersion: 'v1',
      maskToken: '******',
      items: [
        { key: 'STOCK_LIST', value: '600519', rawValueExists: true, isMasked: false },
        { key: 'OPENAI_API_KEY', value: '******', rawValueExists: true, isMasked: true },
      ],
    });

    render(<App />);

    expect(await screen.findByText('首页工作台')).toBeInTheDocument();
    expect(screen.queryByText('初始化向导页')).not.toBeInTheDocument();
  });

  it('allows the settings page while setup is incomplete', async () => {
    window.history.pushState({}, '', '/settings?from=setup');
    getConfigMock.mockResolvedValue({
      configVersion: 'v1',
      maskToken: '******',
      items: [
        { key: 'STOCK_LIST', value: '', rawValueExists: false, isMasked: false },
      ],
    });

    render(<App />);

    expect(await screen.findByText('系统设置页')).toBeInTheDocument();
    expect(screen.queryByText('初始化向导页')).not.toBeInTheDocument();
  });
});

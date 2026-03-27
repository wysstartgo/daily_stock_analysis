import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiErrorAlert, Button, Input, Select } from '../components/common';
import { createParsedApiError, getParsedApiError, type ParsedApiError } from '../api/error';
import { systemConfigApi } from '../api/systemConfig';
import {
  buildDesktopSetupInitialValues,
  buildDesktopSetupUpdateItems,
  normalizeStockListInput,
  type DesktopSetupFormValues,
  type DesktopSetupProvider,
} from '../utils/desktopSetup';

type FieldErrors = Partial<Record<'stockList' | 'model' | 'apiKey' | 'baseUrl', string>>;

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom / OpenAI-Compatible' },
];

const EMPTY_VALUES: DesktopSetupFormValues = {
  stockList: '',
  provider: 'openai',
  model: '',
  apiKey: '',
  baseUrl: '',
};

type TestConnectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; text: string }
  | { status: 'error'; text: string };

function validateForm(values: DesktopSetupFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!normalizeStockListInput(values.stockList)) {
    errors.stockList = '请至少填写一只股票代码。';
  }
  if (!values.model.trim()) {
    errors.model = '请填写模型名称。';
  }
  if (!values.apiKey.trim()) {
    errors.apiKey = '请填写 API Key。';
  }
  if (values.provider === 'custom' && !values.baseUrl.trim()) {
    errors.baseUrl = '自定义兼容服务需要填写 Base URL。';
  }

  return errors;
}

const DesktopSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [configVersion, setConfigVersion] = useState('');
  const [maskToken, setMaskToken] = useState('******');
  const [values, setValues] = useState<DesktopSetupFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testConnectionState, setTestConnectionState] = useState<TestConnectionState>({ status: 'idle' });
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  const [saveError, setSaveError] = useState<ParsedApiError | null>(null);

  useEffect(() => {
    document.title = '初始化桌面端配置 - 绣虎';
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    void systemConfigApi.getConfig(false)
      .then((config) => {
        if (!active) {
          return;
        }
        setConfigVersion(config.configVersion);
        setMaskToken(config.maskToken || '******');
        setValues(buildDesktopSetupInitialValues(config.items));
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoadError(getParsedApiError(error));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const baseUrlHint = useMemo(() => {
    if (values.provider === 'custom') {
      return '填写兼容 OpenAI API 的服务地址，例如 https://custom.example.com/v1';
    }
    return '可选。可填写官方或代理 / 网关地址；留空时沿用服务默认地址。';
  }, [values.provider]);

  const updateField = <K extends keyof DesktopSetupFormValues>(key: K, value: DesktopSetupFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
    setFieldErrors((previous) => ({
      ...previous,
      [key]: undefined,
    }));
    setSaveError(null);
    setTestConnectionState({ status: 'idle' });
  };

  const handleProviderChange = (provider: string) => {
    const nextProvider = provider as DesktopSetupProvider;
    setValues((previous) => ({
      ...previous,
      provider: nextProvider,
      baseUrl: nextProvider === 'gemini' ? '' : previous.baseUrl,
    }));
    setFieldErrors((previous) => ({
      ...previous,
      baseUrl: undefined,
    }));
    setSaveError(null);
    setTestConnectionState({ status: 'idle' });
  };

  const handleTestConnection = async () => {
    const errors = validateForm(values);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setTestConnectionState({
        status: 'error',
        text: '请先补齐当前 provider 的必要字段后再测试连接。',
      });
      return;
    }

    setTestConnectionState({ status: 'loading' });

    try {
      const result = await systemConfigApi.testLLMChannel({
        name: 'desktop-setup',
        protocol: values.provider === 'gemini' ? 'gemini' : 'openai',
        baseUrl: values.provider === 'custom' ? values.baseUrl.trim() : values.provider === 'openai' ? values.baseUrl.trim() : '',
        apiKey: values.apiKey.trim(),
        models: [values.model.trim()],
        enabled: true,
        timeoutSeconds: 20,
      });

      if (!result.success) {
        setTestConnectionState({
          status: 'error',
          text: result.error || result.message || '连接失败，请检查配置后重试。',
        });
        return;
      }

      const parts = ['连接成功'];
      if (result.resolvedModel) {
        parts.push(result.resolvedModel);
      }
      if (result.latencyMs) {
        parts.push(`${result.latencyMs} ms`);
      }
      setTestConnectionState({
        status: 'success',
        text: parts.join(' · '),
      });
    } catch (error: unknown) {
      setTestConnectionState({
        status: 'error',
        text: getParsedApiError(error).message,
      });
    }
  };

  const handleSave = async () => {
    const errors = validateForm(values);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const items = buildDesktopSetupUpdateItems(values);

    try {
      const validateResult = await systemConfigApi.validate({ items });
      if (!validateResult.valid) {
        setSaveError(createParsedApiError({
          title: '初始化配置校验失败',
          message: '请先修正配置项后再继续。',
          category: 'http_error',
          status: 400,
        }));
        return;
      }

      await systemConfigApi.update({
        configVersion,
        maskToken,
        reloadNow: true,
        items,
      });

      navigate('/', { replace: true });
    } catch (error: unknown) {
      setSaveError(getParsedApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan/20 border-t-cyan" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="w-full max-w-xl">
          <ApiErrorAlert error={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[1.8rem] border border-[#00d4ff]/25 bg-card/88 p-6 shadow-soft-card-strong backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan/80">Desktop Setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">初始化桌面端配置</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-text">
            首次使用前，请先完成最小配置。完成后才能进入主界面；后续更新安装包或重新安装时，这些配置会继续保留在系统应用数据目录中。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.8rem] border settings-border bg-card/78 p-6 shadow-soft-card">
            <h2 className="text-lg font-semibold text-foreground">自选股最小配置</h2>
            <p className="mt-2 text-sm leading-6 text-muted-text">
              支持逗号、空格或换行分隔，例如：`600519, AAPL, hk00700`
            </p>
            <div className="mt-4">
              <label htmlFor="setup-stock-list" className="mb-2 block text-sm font-medium text-foreground">
                自选股列表
              </label>
              <textarea
                id="setup-stock-list"
                className="input-terminal min-h-[160px] w-full resize-y border-border/55 bg-card/94 hover:border-border/75"
                value={values.stockList}
                onChange={(event) => updateField('stockList', event.target.value)}
              />
              {fieldErrors.stockList ? (
                <p className="mt-2 text-xs text-danger">{fieldErrors.stockList}</p>
              ) : (
                <p className="mt-2 text-xs text-secondary-text">保存时会自动标准化为逗号分隔格式。</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] border settings-border bg-card/78 p-6 shadow-soft-card">
            <h2 className="text-lg font-semibold text-foreground">AI 模型最小配置</h2>
            <p className="mt-2 text-sm leading-6 text-muted-text">
              这里先配置一套可用主模型。更复杂的多渠道、fallback 或高级参数可在完整设置页继续补充。
            </p>
            <div className="mt-4 space-y-4">
              <Select
                id="setup-provider"
                label="模型提供方"
                value={values.provider}
                onChange={handleProviderChange}
                options={PROVIDER_OPTIONS}
              />
              <Input
                id="setup-model"
                label="模型名称"
                value={values.model}
                onChange={(event) => updateField('model', event.target.value)}
                error={fieldErrors.model}
                placeholder={values.provider === 'gemini' ? '例如 gemini-2.5-flash' : '例如 gpt-4o-mini / qwen-max'}
              />
              <Input
                id="setup-api-key"
                label="API Key"
                type="password"
                allowTogglePassword
                iconType="key"
                value={values.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                error={fieldErrors.apiKey}
              />
              {values.provider !== 'gemini' ? (
                <Input
                  id="setup-base-url"
                  label="Base URL"
                  value={values.baseUrl}
                  onChange={(event) => updateField('baseUrl', event.target.value)}
                  error={fieldErrors.baseUrl}
                  hint={baseUrlHint}
                  placeholder={values.provider === 'custom' ? 'https://custom.example.com/v1' : 'https://api.openai.com/v1'}
                />
              ) : null}
              <div className="rounded-xl border settings-border bg-muted/15 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="settings-secondary"
                    onClick={() => void handleTestConnection()}
                    isLoading={testConnectionState.status === 'loading'}
                    loadingText="测试中..."
                  >
                    测试连接
                  </Button>
                  <span className="text-xs text-muted-text">
                    会用当前 provider、model、API Key 和 Base URL 发起一次最小请求，不会写入配置。
                  </span>
                </div>
                {testConnectionState.status === 'success' ? (
                  <p className="mt-3 text-sm text-emerald-300">{testConnectionState.text}</p>
                ) : null}
                {testConnectionState.status === 'error' ? (
                  <p className="mt-3 text-sm text-danger">{testConnectionState.text}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.8rem] border settings-border bg-card/82 p-6 shadow-soft-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">下一步</h2>
              <p className="mt-2 text-sm leading-6 text-muted-text">
                先完成最小可用配置；如需渠道编排、更多 Provider 或高级参数，再进入完整设置页继续配置。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="settings-secondary"
                onClick={() => navigate('/settings?from=setup', { replace: true })}
              >
                进入高级配置
              </Button>
              <Button
                variant="settings-primary"
                onClick={() => void handleSave()}
                isLoading={isSaving}
                loadingText="保存中..."
              >
                保存并进入主界面
              </Button>
            </div>
          </div>
          {saveError ? (
            <div className="mt-4">
              <ApiErrorAlert error={saveError} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default DesktopSetupPage;

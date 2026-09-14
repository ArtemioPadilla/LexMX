/**
 * /setup island (plan Fase 4): provider onboarding as a wizard on the
 * Inceptor kit (Stepper, Form + react-hook-form + zod, Card, Badge, Button).
 * Replaces ProviderSetup.tsx. Credentials never leave the browser: the
 * manager stores them encrypted (src/lib/security). Test ids keep the e2e
 * contract (`provider-setup`, `provider-openai`, `provider-api-key`,
 * `provider-save`, `provider-success`…).
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2Icon, CircleAlertIcon, Loader2Icon, LockIcon, SparklesIcon } from 'lucide-react';
import { providerRegistry, type ProviderMetadata } from '@/lib/llm/provider-registry';
import { providerManager } from '@/lib/llm/provider-manager';
import { ProviderFactory } from '@/lib/llm/providers';
import type { LLMModel, ProviderConfig } from '@/types/llm';
import { schemaFor, defaultValuesFor, toProviderConfig, DEFAULT_WEBLLM_MODEL } from '@/schemas/provider-config';
import { useTranslation } from '@/i18n';
import { TEST_IDS } from '@/utils/test-ids';
import { getUrl } from '@/utils/urls';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/ui/stepper';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Callout } from '@/components/ui/callout';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import WebLLMModelGrid from '@/components/providers/WebLLMModelGrid';
import ProviderModelGrid from '@/components/providers/ProviderModelGrid';
import ErrorBoundary from './ErrorBoundary';

type Step = 'choose' | 'configure' | 'test' | 'done';
const STEPS: Step[] = ['choose', 'configure', 'test', 'done'];

/** Legacy e2e ids: provider id → data-testid. */
const PROVIDER_TEST_ID: Record<string, string> = {
  webllm: TEST_IDS.provider.webllmButton,
  openai: TEST_IDS.provider.openaiButton,
  anthropic: TEST_IDS.provider.claudeButton,
  google: TEST_IDS.provider.geminiButton,
};

type TestStatus = 'untested' | 'testing' | 'success' | 'error';

interface FieldSpec {
  name: string;
  labelKey: string;
  secret?: boolean;
  placeholder?: string;
  descriptionKey?: string;
}

function fieldsFor(providerId: string): FieldSpec[] {
  switch (providerId) {
    case 'webllm':
      return [];
    case 'bedrock':
      return [
        { name: 'region', labelKey: 'setup.fields.region', placeholder: 'us-east-1' },
        { name: 'apiKey', labelKey: 'setup.fields.apiKey', secret: true, descriptionKey: 'setup.fields.orIam' },
        { name: 'accessKeyId', labelKey: 'setup.fields.accessKeyId' },
        { name: 'secretAccessKey', labelKey: 'setup.fields.secretAccessKey', secret: true },
      ];
    case 'azure':
      return [
        { name: 'azureResourceName', labelKey: 'setup.fields.azureResourceName', placeholder: 'mi-recurso' },
        { name: 'azureDeploymentName', labelKey: 'setup.fields.azureDeploymentName' },
        { name: 'apiKey', labelKey: 'setup.fields.apiKey', secret: true, descriptionKey: 'setup.fields.orAzureAd' },
        { name: 'azureTenantId', labelKey: 'setup.fields.azureTenantId' },
        { name: 'azureClientId', labelKey: 'setup.fields.azureClientId' },
        { name: 'azureClientSecret', labelKey: 'setup.fields.azureClientSecret', secret: true },
      ];
    case 'vertex':
      return [
        { name: 'gcpProjectId', labelKey: 'setup.fields.gcpProjectId' },
        { name: 'gcpLocation', labelKey: 'setup.fields.gcpLocation', placeholder: 'us-central1' },
        { name: 'apiKey', labelKey: 'setup.fields.apiKey', secret: true, descriptionKey: 'setup.fields.orServiceAccount' },
        { name: 'gcpServiceAccountKey', labelKey: 'setup.fields.gcpServiceAccountKey', secret: true },
      ];
    case 'ollama':
    case 'openai-compatible':
      return [
        { name: 'endpoint', labelKey: 'setup.fields.endpoint', placeholder: providerId === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1' },
        { name: 'apiKey', labelKey: 'setup.fields.apiKeyOptional', secret: true },
      ];
    default:
      return [{ name: 'apiKey', labelKey: 'setup.fields.apiKey', secret: true, placeholder: providerId === 'openai' ? 'sk-…' : providerId === 'anthropic' ? 'sk-ant-…' : 'AIza…' }];
  }
}

function modelsFor(providerId: string): LLMModel[] {
  if (providerId === 'webllm' || providerId === 'mock') return [];
  try {
    const cfg = providerRegistry.createDefaultConfig(providerId);
    return cfg ? ProviderFactory.createProvider(cfg).models ?? [] : [];
  } catch {
    return [];
  }
}

export default function SetupWizard() {
  return (
    <ErrorBoundary name="SetupWizard">
      <SetupWizardInner />
    </ErrorBoundary>
  );
}

function SetupWizardInner() {
  const { t } = useTranslation();
  const providers = useMemo(() => providerRegistry.getSupportedProviders().filter((p) => p.id !== 'mock'), []);
  const [step, setStep] = useState<Step>('choose');
  const [selected, setSelected] = useState<string[]>([]);
  const [configured, setConfigured] = useState<Map<string, ProviderConfig>>(new Map());
  const [current, setCurrent] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestStatus>>({});
  const [existing, setExisting] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    providerManager
      .initialize()
      .then(() => providerManager.getEnabledProviders())
      .then((configs) => {
        if (!cancelled) setExisting(configs.map((c) => c.id));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const stepLabels = STEPS.map((s) => t(`setup.wizard.steps.${s}`));
  const pending = selected.filter((id) => !configured.has(id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function startConfigure() {
    const next = selected.find((id) => !configured.has(id)) ?? null;
    setCurrent(next);
    setStep(next ? 'configure' : 'test');
  }

  function onSaved(config: ProviderConfig) {
    const map = new Map(configured).set(config.id, config);
    setConfigured(map);
    const next = selected.find((id) => !map.has(id)) ?? null;
    setCurrent(next);
    if (!next) setStep('test');
  }

  async function runTests() {
    const ids = [...configured.keys()];
    setTests(Object.fromEntries(ids.map((id) => [id, 'testing' as TestStatus])));
    await Promise.all(
      ids.map(async (id) => {
        let status: TestStatus = 'error';
        try {
          const provider = providerManager.getProvider(id);
          status = provider?.testConnection ? (await provider.testConnection()) ? 'success' : 'error' : 'success';
        } catch {
          status = 'error';
        }
        setTests((prev) => ({ ...prev, [id]: status }));
      }),
    );
  }

  useEffect(() => {
    if (step === 'test' && configured.size > 0) void runTests();
  }, [step]);

  return (
    <div data-testid={TEST_IDS.provider.container} className="space-y-6 p-6">
      <Stepper steps={stepLabels} current={STEPS.indexOf(step)} aria-label={t('setup.title')} className="overflow-x-auto pb-2" />

      {step === 'choose' && (
        <section aria-labelledby="choose-title" className="space-y-4">
          <div>
            <h2 id="choose-title" className="text-xl font-semibold">{t('setup.wizard.providers.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup.wizard.providers.subtitle')}</p>
          </div>
          {existing.length > 0 && (
            <Callout title={t('setup.wizard.existing.title')} variant="success" className="text-sm">
              {t('setup.wizard.existing.body', { list: existing.join(', ') })}
            </Callout>
          )}
          <ul className="grid gap-3 sm:grid-cols-2" data-testid={TEST_IDS.provider.selector}>
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} checked={selected.includes(p.id)} onToggle={() => toggle(p.id)} recommended={p.id === 'webllm'} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon className="h-3 w-3" aria-hidden="true" />
              {t('setup.wizard.localOnly')}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" data-testid={TEST_IDS.provider.skipButton} onClick={() => { setSelected(['webllm']); setCurrent('webllm'); setStep('configure'); }}>
                {t('setup.wizard.welcome.useWebLLM')}
              </Button>
              <Button disabled={selected.length === 0} onClick={startConfigure}>
                {t('setup.wizard.providers.configure', { count: selected.length })}
              </Button>
            </div>
          </div>
        </section>
      )}

      {step === 'configure' && current && (
        <section aria-labelledby="configure-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="configure-title" className="text-xl font-semibold">
              {t('setup.wizard.configure.title', { provider: providers.find((p) => p.id === current)?.name ?? current })}
            </h2>
            <Badge variant="secondary">{configured.size + 1} / {selected.length}</Badge>
          </div>
          <ProviderForm key={current} providerId={current} onSaved={onSaved} onSkip={() => { setSelected((s) => s.filter((id) => id !== current)); const next = pending.filter((id) => id !== current)[0] ?? null; setCurrent(next); if (!next) setStep(configured.size > 0 ? 'test' : 'choose'); }} />
        </section>
      )}

      {step === 'test' && (
        <section aria-labelledby="test-title" className="space-y-4">
          <h2 id="test-title" className="text-xl font-semibold">{t('setup.wizard.test.title')}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border" aria-live="polite">
            {[...configured.values()].map((c) => {
              const status = tests[c.id] ?? 'untested';
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className={cn('inline-flex items-center gap-1 text-xs', status === 'success' && 'text-primary', status === 'error' && 'text-destructive', status === 'testing' && 'text-muted-foreground')}>
                    {status === 'testing' && <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {status === 'success' && <CheckCircle2Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {status === 'error' && <CircleAlertIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t(`setup.wizard.test.status.${status}`)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('choose')}>{t('setup.wizard.back')}</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void runTests()} disabled={Object.values(tests).includes('testing')}>{t('setup.validation.testConnection')}</Button>
              <Button onClick={() => setStep('done')}>{t('setup.wizard.test.finish')}</Button>
            </div>
          </div>
        </section>
      )}

      {step === 'done' && (
        <section aria-labelledby="done-title" className="space-y-4 text-center" data-testid={TEST_IDS.provider.successMessage}>
          <SparklesIcon className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h2 id="done-title" className="text-xl font-semibold">{t('setup.wizard.complete.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('setup.wizard.complete.subtitle', { count: configured.size })}</p>
          <ul className="mx-auto max-w-md list-inside list-disc text-left text-sm text-muted-foreground">
            <li>{t('setup.wizard.complete.steps.firstQuery')}</li>
            <li>{t('setup.wizard.complete.steps.explore')}</li>
            <li>{t('setup.wizard.complete.steps.changeProviders')}</li>
          </ul>
          <Button size="lg" onClick={() => { window.location.href = getUrl('chat'); }}>{t('setup.wizard.complete.startUsing')}</Button>
        </section>
      )}
    </div>
  );
}

function ProviderCard({ provider, checked, onToggle, recommended }: { provider: ProviderMetadata; checked: boolean; onToggle: () => void; recommended: boolean }) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        data-testid={PROVIDER_TEST_ID[provider.id]}
        onClick={onToggle}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'border-primary bg-accent' : 'border-border hover:bg-muted/60',
        )}
      >
        <span aria-hidden="true" className="mt-0.5 text-xl leading-none">{provider.icon.startsWith('/') ? '☁️' : provider.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            {recommended && <Badge className="text-[0.65rem]">{t('setup.wizard.recommended')}</Badge>}
            <Badge variant="outline" className="text-[0.65rem]">{t(`setup.cost.${provider.costLevel}`)}</Badge>
            <Badge variant="secondary" className="text-[0.65rem]">{provider.type === 'local' ? t('setup.comparison.types.local') : t('setup.comparison.types.cloud')}</Badge>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{provider.description}</span>
        </span>
      </button>
    </li>
  );
}

function ProviderForm({ providerId, onSaved, onSkip }: { providerId: string; onSaved: (c: ProviderConfig) => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ progress: number; message: string } | null>(null);
  const models = useMemo(() => modelsFor(providerId), [providerId]);
  const fields = fieldsFor(providerId);
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schemaFor(providerId)),
    defaultValues: defaultValuesFor(providerId),
  });
  const selectedModel = form.watch('model');

  async function submit(values: Record<string, string>) {
    setError(null);
    setSaving(true);
    try {
      const base = providerRegistry.createDefaultConfig(providerId);
      if (!base) throw new Error(`Unknown provider ${providerId}`);
      const config = toProviderConfig(base, values);
      if (providerId === 'webllm') {
        providerManager.setWebLLMProgressCallback((p, m) => setProgress({ progress: p, message: m }));
      }
      await providerManager.configureProvider(config);
      onSaved(config);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(/invalid|required/i.test(raw) ? `${t('setup.validation.invalidKey')} (${raw})` : `${t('setup.validation.connectionError')}: ${raw}`);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-4">
        {providerId === 'webllm' && (
          <div className="space-y-2" data-testid={TEST_IDS.provider.modelSelector}>
            <p className="text-sm text-muted-foreground">{t('setup.wizard.webllm.features.private')} · {t('setup.wizard.webllm.features.offline')}</p>
            <WebLLMModelGrid selectedModelId={selectedModel || DEFAULT_WEBLLM_MODEL} onModelSelect={(id) => form.setValue('model', id, { shouldDirty: true })} showDataWarning />
          </div>
        )}

        {fields.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={`${providerId}-${f.name}`}>{t(f.labelKey)}</FormLabel>
                <FormControl>
                  {f.secret ? (
                    <PasswordInput id={`${providerId}-${f.name}`} autoComplete="off" placeholder={f.placeholder} data-testid={f.name === 'apiKey' ? TEST_IDS.provider.apiKeyInput : undefined} {...field} />
                  ) : (
                    <Input id={`${providerId}-${f.name}`} autoComplete="off" placeholder={f.placeholder} {...field} />
                  )}
                </FormControl>
                {f.descriptionKey && <FormDescription>{t(f.descriptionKey)}</FormDescription>}
                {form.formState.errors[f.name]?.message ? (
                  <p role="alert" className="text-sm font-medium text-destructive">{t(String(form.formState.errors[f.name]?.message))}</p>
                ) : null}
              </FormItem>
            )}
          />
        ))}

        {models.length > 0 && (
          <div className="space-y-2" data-testid={TEST_IDS.provider.modelSelector}>
            <p className="text-sm font-medium">{t('setup.fields.model')}</p>
            <ProviderModelGrid models={models} selectedModelId={selectedModel} onModelSelect={(id) => form.setValue('model', id, { shouldDirty: true })} columns={2} />
          </div>
        )}

        {progress && (
          <div role="status" className="rounded-md border border-border bg-muted p-3 text-xs">
            <div className="mb-1 flex justify-between"><span>{progress.message}</span><span>{Math.round(progress.progress)}%</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progress.progress)}%` }} /></div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <LockIcon className="h-3 w-3" aria-hidden="true" />
          {t('setup.wizard.localOnly')}
        </p>
        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={onSkip}>{t('setup.wizard.skipProvider')}</Button>
          <Button type="submit" disabled={saving} data-testid={TEST_IDS.provider.saveButton}>
            {saving ? t('setup.validation.testing') : t('setup.wizard.save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

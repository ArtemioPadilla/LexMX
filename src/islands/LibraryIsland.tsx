/**
 * /biblioteca (plan § 11.4 C, "Biblioteca"): what is installed on this
 * device: corpus version, documents, chunks, storage used, and the actions
 * to check for a new corpus release or remove the local copy. Everything
 * here is local; nothing is sent anywhere.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { DatabaseIcon, RefreshCwIcon, Trash2Icon, ExternalLinkIcon } from 'lucide-react';
import { documentLoader, type CorpusMetadata } from '@/lib/corpus/document-loader';
import { CorpusInstaller } from '@/lib/corpus/corpus-installer';
import { IndexedDBVectorStore } from '@/lib/storage/indexeddb-vector-store';
import { $corpusInstall, reportCorpusInstall } from '@/stores/corpus';
import { useTranslation } from '@/i18n';
import { getUrl } from '@/utils/urls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from './ErrorBoundary';

interface Storage { usage: number; quota: number }

const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default function LibraryIsland() {
  return (
    <ErrorBoundary name="Library">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const { t } = useTranslation();
  const install = useStore($corpusInstall);
  const [meta, setMeta] = useState<CorpusMetadata | null | undefined>(undefined);
  const [installed, setInstalled] = useState<{ version: string | null; documents: string[]; chunks: number } | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    await documentLoader.initialize();
    setMeta(documentLoader.getMetadata());
    const store = new IndexedDBVectorStore();
    try {
      await store.initialize();
      setInstalled({ version: (await store.getMeta<string>('corpusVersion')) ?? null, documents: (await store.getMeta<string[]>('installedDocuments')) ?? [], chunks: await store.count() });
    } catch {
      setInstalled({ version: null, documents: [], chunks: 0 });
    }
    try {
      const est = await navigator.storage?.estimate();
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
    } catch {
      setStorage(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function checkUpdates() {
    setBusy('update');
    try {
      const store = new IndexedDBVectorStore();
      await store.initialize();
      documentLoader.clearCache();
      await new CorpusInstaller(documentLoader, store, reportCorpusInstall).ensureInstalled();
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeLocal() {
    if (!window.confirm(t('library.confirmRemove'))) return;
    setBusy('remove');
    try {
      const store = new IndexedDBVectorStore();
      await store.initialize();
      await store.clear();
      await store.setMeta('corpusVersion', null);
      await store.setMeta('installedDocuments', []);
      reportCorpusInstall({ phase: 'empty', installed: 0, total: 0, chunks: 0 });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (meta === undefined) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const served = documentLoader.getCorpusVersion();
  const upToDate = installed?.version && served && installed.version === served;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [t('library.documents'), `${installed?.documents.length ?? 0} / ${meta?.totalDocuments ?? 0}`],
          [t('library.chunks'), (installed?.chunks ?? 0).toLocaleString()],
          [t('library.storage'), storage ? `${fmtBytes(storage.usage)} · ${t('library.of')} ${fmtBytes(storage.quota)}` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={upToDate ? 'default' : 'outline'}><DatabaseIcon className="mr-1 h-3 w-3" aria-hidden="true" />{upToDate ? t('library.upToDate') : installed?.version ? t('library.updateAvailable') : t('library.notInstalled')}</Badge>
        {meta?.buildDate && <span className="text-xs text-muted-foreground">{t('library.published')}: {new Date(meta.buildDate).toLocaleDateString()}</span>}
        {install.phase === 'installing' && <span className="text-xs text-muted-foreground" aria-live="polite">{install.installed}/{install.total} · {install.message}</span>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void checkUpdates()}><RefreshCwIcon className={`mr-1 h-4 w-4 ${busy === 'update' ? 'animate-spin' : ''}`} aria-hidden="true" />{t('library.checkUpdates')}</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null || !installed?.chunks} onClick={() => void removeLocal()}><Trash2Icon className="mr-1 h-4 w-4 text-destructive" aria-hidden="true" />{t('library.remove')}</Button>
        </div>
      </div>

      {!meta || meta.documents.length === 0 ? (
        <Callout title={t('library.noCorpus')} variant="warning" className="text-sm">{t('library.noCorpusBody')}</Callout>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {meta.documents.map((d) => {
            const isInstalled = installed?.documents.includes(d.id);
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <a className="font-medium hover:underline" href={getUrl(`document/${d.id}`)}>{d.title}</a>
                  <span className="block text-xs text-muted-foreground">{d.type} · {d.primaryArea} · {fmtBytes(d.size)}{d.lastUpdated ? ` · ${d.lastUpdated}` : ''}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={isInstalled ? 'secondary' : 'outline'} className="text-[0.65rem]">{isInstalled ? t('library.installed') : t('library.pending')}</Badge>
                  <a className="text-muted-foreground hover:text-foreground" href={getUrl(`document/${d.id}`)} aria-label={d.title}><ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('library.localNote')}</p>
    </div>
  );
}

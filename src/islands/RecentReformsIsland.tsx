/**
 * "Novedades desde tu última visita" (plan § 11.4 C): documents of the
 * published corpus whose last reform is newer than the previous visit
 * (`lexmx_last_visit`), with a link to the document page. Local only.
 */
import { useEffect, useState } from 'react';
import { CalendarClockIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { getUrl } from '@/utils/urls';
import { Badge } from '@/components/ui/badge';
import ErrorBoundary from './ErrorBoundary';

export const LAST_VISIT_KEY = 'lexmx_last_visit';
const FIRST_VISIT_WINDOW_DAYS = 90;

interface Entry { id: string; title: string; lastReform?: string | null; primaryArea?: string }

export function recentReforms(entries: Entry[], lastVisit: string | null, now = new Date()): Entry[] {
  const since = lastVisit ? new Date(lastVisit) : new Date(now.getTime() - FIRST_VISIT_WINDOW_DAYS * 86_400_000);
  return entries
    .filter((e) => e.lastReform && !Number.isNaN(new Date(e.lastReform).getTime()) && new Date(e.lastReform) > since)
    .sort((a, b) => String(b.lastReform).localeCompare(String(a.lastReform)))
    .slice(0, 8);
}

export default function RecentReformsIsland() {
  return (
    <ErrorBoundary name="RecentReforms">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Entry[] | null>(null);
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lastVisit: string | null = null;
      try {
        lastVisit = localStorage.getItem(LAST_VISIT_KEY);
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
      } catch {
        lastVisit = null;
      }
      try {
        const res = await fetch(getUrl('legal-corpus/metadata.json'));
        const meta = res.ok ? ((await res.json()) as { documents?: Entry[] }) : null;
        if (!cancelled) {
          setSince(lastVisit);
          setItems(recentReforms(meta?.documents ?? [], lastVisit));
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="news-title" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 id="news-title" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClockIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('news.title')}
          <span className="text-sm font-normal text-muted-foreground">
            {since ? t('news.sinceVisit', { date: new Date(since).toLocaleDateString() }) : t('news.lastDays', { days: FIRST_VISIT_WINDOW_DAYS })}
          </span>
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <a href={getUrl(`document/${d.id}`)} className="min-w-0 truncate font-medium hover:underline">{d.title}</a>
              <Badge variant="secondary" className="shrink-0 text-[0.65rem]">{t('news.reformed')} {d.lastReform}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{t('news.source')}</p>
      </div>
    </section>
  );
}

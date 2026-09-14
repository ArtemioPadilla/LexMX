/**
 * OCR tool (plan § 11.4 C): drop a scanned PDF or a photo and get editable
 * text, entirely on the device (Tesseract.js in a Web Worker). The model
 * files load once from the library CDN; the image never leaves the browser.
 */
import { useRef, useState } from 'react';
import { CopyIcon, DownloadIcon, ScanTextIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { OcrLanguage, OcrProgress } from '@/lib/ingestion/ocr';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Textarea } from '@/components/ui/textarea';
import { ProgressBar } from '@/components/ui/progress-bar';
import { downloadBlob } from '@/lib/export/docx';
import ErrorBoundary from './ErrorBoundary';

export default function OcrIsland() {
  return (
    <ErrorBoundary name="Ocr">
      <Inner />
    </ErrorBoundary>
  );
}

const LANGUAGES: Array<{ id: OcrLanguage; label: string }> = [
  { id: 'spa', label: 'Español' },
  { id: 'spa+eng', label: 'Español + English' },
  { id: 'eng', label: 'English' },
  { id: 'por', label: 'Português' },
];

function Inner() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<OcrLanguage>('spa');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setError(null);
    setText('');
    setFileName(file.name);
    setProgress({ status: 'loading', progress: 0 });
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const { contentExtractor } = await import('@/lib/ingestion/document-content-extractors');
        const result = await contentExtractor.extractFromArrayBuffer(await file.arrayBuffer(), 'application/pdf', {
          ocr: 'always',
          ocrLanguage: language,
          onOcrProgress: setProgress,
        });
        setText(result.text);
      } else {
        const { recognizeImage } = await import('@/lib/ingestion/ocr');
        setText(await recognizeImage(file, { language, onProgress: setProgress }));
      }
    } catch (e) {
      setError(t('ocr.error', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <section className="space-y-4" aria-labelledby="ocr-title">
      <div>
        <h2 id="ocr-title" className="flex items-center gap-2 text-xl font-semibold"><ScanTextIcon className="h-5 w-5 text-primary" aria-hidden="true" />{t('ocr.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('ocr.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="ocr-lang">{t('ocr.language')}</label>
        <select id="ocr-lang" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={language} disabled={busy} onChange={(e) => setLanguage(e.target.value as OcrLanguage)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && !busy) void run(f); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors ${dragging ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50'}`}
      >
        <p>{t('ocr.drop')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('ocr.choose')}</p>
        <input ref={inputRef} type="file" className="sr-only" accept="image/*,application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = ''; }} />
      </div>
      {progress && (
        <div className="space-y-1" role="status" aria-live="polite">
          <p className="text-xs text-muted-foreground">{t('ocr.running', { name: fileName })} · {progress.status}{progress.page ? ` (${progress.page}/${progress.pages})` : ''} · {pct}%</p>
          <ProgressBar value={pct} label={t('ocr.running', { name: fileName })} />
        </div>
      )}
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
      {text && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{t('ocr.result')} · {fileName}</p>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}><CopyIcon className="mr-1 h-4 w-4" aria-hidden="true" />{copied ? t('ocr.copied') : t('ocr.copy')}</Button>
              <Button size="sm" variant="outline" onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${fileName.replace(/\.[^.]+$/, '')}.txt`)}><DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('ocr.download')}</Button>
            </div>
          </div>
          <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" aria-label={t('ocr.result')} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('ocr.privacyNote')}</p>
    </section>
  );
}

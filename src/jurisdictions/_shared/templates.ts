import type { DocumentTemplate } from '../types';

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Nombres de marcador presentes en el cuerpo, en orden de aparición y sin repetir. */
export function templatePlaceholders(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER)) if (m[1] && !out.includes(m[1])) out.push(m[1]);
  return out;
}

export interface RenderedTemplate {
  markdown: string;
  /** Marcadores sin valor: se dejan visibles como `[campo]` para no ocultar huecos. */
  missing: string[];
}

export function renderTemplate(template: DocumentTemplate, values: Record<string, string | number | undefined>): RenderedTemplate {
  const missing: string[] = [];
  const markdown = template.body.replace(PLACEHOLDER, (_all, name: string) => {
    const v = values[name];
    if (v === undefined || v === null || String(v).trim() === '') {
      if (!missing.includes(name)) missing.push(name);
      return `[${template.fields.find((f) => f.name === name)?.label ?? name}]`;
    }
    return String(v);
  });
  return { markdown, missing };
}

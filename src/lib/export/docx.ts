/**
 * Markdown → Word (.docx) export for filled templates.
 *
 * `docx` is imported lazily so the library only loads when the user actually
 * clicks "Word"; the /plantillas page ships without it.
 */

export async function markdownToDocx(markdown: string, title: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } =
    await import('docx');

  const runs = (text: string) =>
    text
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((part) =>
        part.startsWith('**') && part.endsWith('**')
          ? new TextRun({ text: part.slice(2, -2), bold: true })
          : new TextRun({ text: part }),
      );

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  const lines = markdown.replace(/\r/g, '').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      children.push(
        new Paragraph({
          text: heading[2]!,
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }),
      );
      continue;
    }

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('|')) {
        const cells = (lines[i] ?? '')
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map(
            (cells) =>
              new TableRow({
                children: cells.map(
                  (c) => new TableCell({ children: [new Paragraph({ children: runs(c) })] }),
                ),
              }),
          ),
        }),
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      children.push(new Paragraph({ children: runs(bullet[1]!), bullet: { level: 0 } }));
      continue;
    }

    children.push(new Paragraph({ children: runs(line), spacing: { after: 160 } }));
  }

  const doc = new Document({ title, creator: 'LexMX', sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

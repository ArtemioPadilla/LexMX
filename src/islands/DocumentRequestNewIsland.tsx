/** /requests/new: the form saves a local copy and opens a pre-filled GitHub issue for maintainers. */
import { useState } from 'react';
import type { DocumentRequest } from '@/types/legal';
import { buildIssueUrl } from '@/lib/report-issue';
import { getUrl } from '@/utils/urls';
import { addLocalRequest, queueEntryToRequest, readLocal, requestIssueBody, voterId, writeLocal } from '@/lib/document-requests/request-store';
import DocumentRequestForm from './DocumentRequestForm';
import ErrorBoundary from './ErrorBoundary';
import { Callout } from '@/components/ui/callout';
import { Button } from '@/components/ui/button';

export default function DocumentRequestNewIsland() {
  return (
    <ErrorBoundary name="DocumentRequestNew">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const [done, setDone] = useState<{ url: string; title: string } | null>(null);

  if (done) {
    return (
      <Callout title="Solicitud registrada" variant="success" className="text-sm">
        <p>«{done.title}» quedó guardada en este navegador y aparece en la lista. Para que el equipo la revise, publícala como issue en GitHub:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => window.open(done.url, '_blank', 'noopener,noreferrer')}>Abrir issue en GitHub</Button>
          <Button variant="outline" onClick={() => { window.location.href = getUrl('requests'); }}>Ver solicitudes</Button>
        </div>
      </Callout>
    );
  }

  return (
    <DocumentRequestForm
      onSubmit={async (partial) => {
        const base = queueEntryToRequest({ id: `req-${Date.now().toString(36)}`, title: partial.title ?? 'Documento' });
        const request: DocumentRequest = { ...base, ...partial, id: base.id, requestedBy: voterId(), verified: false, createdAt: base.createdAt, updatedAt: base.updatedAt } as DocumentRequest;
        writeLocal(addLocalRequest(readLocal(), request));
        const url = buildIssueUrl({ title: `Solicitud de documento: ${request.title}`, body: requestIssueBody(request), labels: ['document-request', 'corpus'] });
        setDone({ url, title: request.title });
      }}
    />
  );
}

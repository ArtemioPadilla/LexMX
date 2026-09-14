/** /requests: published queue + local votes and comments, no server required. */
import { useEffect, useState } from 'react';
import type { DocumentRequest } from '@/types/legal';
import { getUrl } from '@/utils/urls';
import { addComment, applyVote, fetchQueue, mergeRequests, readLocal, voterId, writeLocal } from '@/lib/document-requests/request-store';
import DocumentRequestList from './DocumentRequestList';
import ErrorBoundary from './ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentRequestsIsland() {
  return (
    <ErrorBoundary name="DocumentRequests">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const [requests, setRequests] = useState<DocumentRequest[] | null>(null);
  const [me, setMe] = useState('');

  async function refresh() {
    const queue = await fetchQueue(getUrl('document-requests.json'));
    setRequests(mergeRequests(queue, readLocal()));
  }

  useEffect(() => {
    setMe(voterId());
    void refresh();
  }, []);

  if (!requests) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <DocumentRequestList
      requests={requests}
      currentUserId={me}
      onVote={async (id, vote) => {
        writeLocal(applyVote(readLocal(), id, me, vote));
        await refresh();
      }}
      onComment={async (id, text) => {
        writeLocal(addComment(readLocal(), id, me, text));
        await refresh();
      }}
    />
  );
}

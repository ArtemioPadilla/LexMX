-- 0006 · Corpus abierto en pgvector (plan § 11.9): API pública y MCP hospedado.
-- Opcional: quien no quiera nube usa el MCP local. Los shards siguen siendo
-- públicos; esta tabla es lectura pública y la escribe solo el pipeline con
-- la service key. Dimensión 384 = Xenova/multilingual-e5-small, la misma que
-- usa el cliente (scripts/corpus/build-embeddings.ts).

create extension if not exists vector;

create table if not exists public.corpus_chunks (
  id text primary key,                           -- `${doc.id}_chunk_${i}`
  doc_id text not null,
  jurisdiction text not null default 'mx',
  scope text not null default 'mx-federal',      -- shard: mx-federal, mx-jal…
  title text not null,
  hierarchy smallint not null check (hierarchy between 1 and 7),
  legal_area text,
  article text,
  content text not null,
  embedding vector(384) not null,
  source_url text,
  corpus_version text not null,
  updated_at timestamptz not null default now()
);
create index if not exists corpus_chunks_doc_idx on public.corpus_chunks (doc_id);
create index if not exists corpus_chunks_scope_idx on public.corpus_chunks (scope);
create index if not exists corpus_chunks_embedding_idx on public.corpus_chunks
  using hnsw (embedding vector_cosine_ops);
alter table public.corpus_chunks enable row level security;
create policy "corpus_chunks: public read" on public.corpus_chunks for select using (true);

-- Búsqueda semántica con filtro de shard; misma semántica que el cliente
-- (coseno sobre vectores normalizados).
create or replace function public.match_chunks(
  query_embedding vector(384),
  match_count int default 8,
  scopes text[] default null,
  min_similarity float default 0.0)
returns table (id text, doc_id text, title text, article text, content text, similarity float)
language sql stable as $$
  select c.id, c.doc_id, c.title, c.article, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.corpus_chunks c
  where (scopes is null or c.scope = any (scopes))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

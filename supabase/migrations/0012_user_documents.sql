-- 0012 — Synchronisation complète : documents par compte + suppressions
-- ---------------------------------------------------------------------------
-- Les données « locales » de l'app (profils, poches, objectifs d'épargne,
-- règles récurrentes, notes, plafonds, préférences d'accueil…) sont
-- synchronisées telles quelles, clé par clé, dans public.user_documents :
-- une ligne par (utilisateur, clé localStorage), valeur = texte brut.
-- Dernier écrit gagne (updated_at posé par le trigger côté serveur).
--
-- Les suppressions d'opérations sont propagées via transactions.deleted_at
-- (colonne déjà présente depuis 0001) : ce script ajoute l'index utile.
-- ---------------------------------------------------------------------------

create table if not exists public.user_documents (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  /** Valeur brute (chaîne localStorage) ; null = document supprimé. */
  value      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

drop trigger if exists trg_user_documents_updated_at on public.user_documents;
create trigger trg_user_documents_updated_at
  before update on public.user_documents
  for each row execute function public.touch_updated_at();

alter table public.user_documents enable row level security;

drop policy if exists "user_documents_select_own" on public.user_documents;
create policy "user_documents_select_own"
  on public.user_documents for select using (auth.uid() = user_id);

drop policy if exists "user_documents_insert_own" on public.user_documents;
create policy "user_documents_insert_own"
  on public.user_documents for insert with check (auth.uid() = user_id);

drop policy if exists "user_documents_update_own" on public.user_documents;
create policy "user_documents_update_own"
  on public.user_documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_documents_delete_own" on public.user_documents;
create policy "user_documents_delete_own"
  on public.user_documents for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_documents to authenticated;
grant all on public.user_documents to service_role;

-- Suppressions d'opérations : lecture rapide des lignes supprimées d'un compte.
create index if not exists idx_transactions_deleted
  on public.transactions (created_by_user_id, deleted_at)
  where deleted_at is not null;

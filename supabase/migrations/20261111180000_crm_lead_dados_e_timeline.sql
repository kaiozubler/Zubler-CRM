-- Dados que a equipe preenche à mão no CRM (não vêm do app MediCopilot).
-- `chave` é o id do card da pipe (ex.: "clinica:<uuid>" ou "contratacao:<uuid>").

-- Cadastro manual do lead: completa o que o app não tem.
create table if not exists public.crm_lead_dados (
  chave text primary key,
  dados jsonb not null default '{}'::jsonb,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

-- Timeline: ligações, reuniões, notas etc. registradas pela equipe.
create table if not exists public.crm_timeline (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  tipo text not null default 'nota'
    check (tipo in ('nota', 'ligacao', 'reuniao', 'email', 'whatsapp', 'proposta', 'edicao', 'outro')),
  titulo text not null,
  descricao text,
  data timestamptz not null default now(),
  autor_email text,
  criado_em timestamptz not null default now()
);
create index if not exists crm_timeline_chave_data on public.crm_timeline (chave, data desc);

-- Só quem entra no CRM (contas criadas em Cloud → Users) lê e grava.
alter table public.crm_lead_dados enable row level security;
alter table public.crm_timeline enable row level security;

drop policy if exists "equipe le e grava" on public.crm_lead_dados;
create policy "equipe le e grava" on public.crm_lead_dados
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe le" on public.crm_timeline;
create policy "equipe le" on public.crm_timeline
  for select to authenticated using (true);

drop policy if exists "equipe registra" on public.crm_timeline;
create policy "equipe registra" on public.crm_timeline
  for insert to authenticated with check (autor_email = auth.jwt() ->> 'email');

-- Cada um apaga só o que registrou.
drop policy if exists "autor apaga" on public.crm_timeline;
create policy "autor apaga" on public.crm_timeline
  for delete to authenticated using (autor_email = auth.jwt() ->> 'email');

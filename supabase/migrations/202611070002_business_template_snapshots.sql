alter table public.businesses
  add column if not exists business_category_template_id text,
  add column if not exists business_template_snapshot jsonb not null default '{}'::jsonb;

comment on column public.businesses.business_category_template_id is
  'Identifier of the master category template selected at registration; informational only and not a live foreign key.';
comment on column public.businesses.business_template_snapshot is
  'Immutable-at-application-time copy of template configuration; later master edits do not overwrite this business snapshot.';

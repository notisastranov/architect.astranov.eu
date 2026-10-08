create table if not exists usage_wallet (
  user_id text primary key,
  email text,
  balance_cents integer not null default 0,
  pass_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists usage_ledger (
  id bigserial primary key,
  user_id text not null,
  kind text not null,
  cents integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists deposit_requests (
  id bigserial primary key,
  user_id text not null,
  email text,
  cents integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

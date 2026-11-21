-- Public daily display-name board. Separate from the field comparison.
-- This file does not read or write attempts, runs, dedup, day_agg,
-- technical_event, rate_window, field_gate, or collection_status.
-- It does not enable pg_cron, does not schedule a job, and does not set a password.
-- Public boards are served for 30 days. retain_board_names() drops the
-- name on rows older than 90 days and leaves private.board_agg in place.
-- That function is not scheduled here.

create schema if not exists private;

do $$
declare
  v_super boolean;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  select rolsuper into v_super from pg_roles where rolname = current_user;
  if not exists (select 1 from pg_roles where rolname = 'board_runtime') then
    create role board_runtime login noinherit;
  elsif v_super or pg_has_role(current_user, 'board_runtime', 'member') then
    alter role board_runtime login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'board_retention') then
    create role board_retention login noinherit connection limit 2;
  elsif v_super or pg_has_role(current_user, 'board_retention', 'member') then
    alter role board_retention login noinherit connection limit 2;
  end if;
end $$;

grant usage on schema private to board_runtime, board_retention;

create table private.board_term (
  kind text not null check (kind in ('imp', 'impword', 'sub', 'word', 'compound')),
  term text not null,
  primary key (kind, term)
);
alter table private.board_term enable row level security;

insert into private.board_term (kind, term) values
  ('imp', 'admin'),
  ('imp', 'brainclash'),
  ('imp', 'dailydose'),
  ('imp', 'moderator'),
  ('imp', 'oficial'),
  ('imp', 'official'),
  ('imp', 'soporte'),
  ('imp', 'staff'),
  ('imp', 'support'),
  ('impword', 'mod'),
  ('impword', 'mods'),
  ('compound', 'cooladmin'),
  ('compound', 'modsquad'),
  ('compound', 'modteam'),
  ('compound', 'staffer'),
  ('sub', '1488'),
  ('sub', 'assclown'),
  ('sub', 'asshat'),
  ('sub', 'asshole'),
  ('sub', 'asslicker'),
  ('sub', 'asswipe'),
  ('sub', 'badass'),
  ('sub', 'bastard'),
  ('sub', 'bigcock'),
  ('sub', 'bigdick'),
  ('sub', 'bitch'),
  ('sub', 'blowjob'),
  ('sub', 'bollocks'),
  ('sub', 'boobs'),
  ('sub', 'bullshit'),
  ('sub', 'cabron'),
  ('sub', 'cabrona'),
  ('sub', 'capullo'),
  ('sub', 'chinga'),
  ('sub', 'chingada'),
  ('sub', 'chingado'),
  ('sub', 'chingar'),
  ('sub', 'cockhead'),
  ('sub', 'cocksucker'),
  ('sub', 'cojones'),
  ('sub', 'coonass'),
  ('sub', 'culero'),
  ('sub', 'cumdump'),
  ('sub', 'cumshot'),
  ('sub', 'cunt'),
  ('sub', 'dickbutt'),
  ('sub', 'dickface'),
  ('sub', 'dickhead'),
  ('sub', 'dickweed'),
  ('sub', 'dildo'),
  ('sub', 'dumbass'),
  ('sub', 'dumbshit'),
  ('sub', 'eatshit'),
  ('sub', 'fagg'),
  ('sub', 'faggy'),
  ('sub', 'faggot'),
  ('sub', 'fock'),
  ('sub', 'fuck'),
  ('sub', 'fvck'),
  ('sub', 'gilipollas'),
  ('sub', 'handjob'),
  ('sub', 'hentai'),
  ('sub', 'hitler'),
  ('sub', 'horny'),
  ('sub', 'hostia'),
  ('sub', 'jackass'),
  ('sub', 'jizz'),
  ('sub', 'joder'),
  ('sub', 'kissmyass'),
  ('sub', 'kkk'),
  ('sub', 'mamaguevo'),
  ('sub', 'maricon'),
  ('sub', 'mierda'),
  ('sub', 'nazi'),
  ('sub', 'nigga'),
  ('sub', 'nigg'),
  ('sub', 'nigger'),
  ('sub', 'nignog'),
  ('sub', 'niqqer'),
  ('sub', 'nlgger'),
  ('sub', 'nude'),
  ('sub', 'orgasm'),
  ('sub', 'pendeja'),
  ('sub', 'pendejo'),
  ('sub', 'penis'),
  ('sub', 'phuck'),
  ('sub', 'phuk'),
  ('sub', 'pinche'),
  ('sub', 'pinga'),
  ('sub', 'polla'),
  ('sub', 'pornhub'),
  ('sub', 'pornstar'),
  ('sub', 'pussy'),
  ('sub', 'raghead'),
  ('sub', 'rapist'),
  ('sub', 'retard'),
  ('sub', 'semen'),
  ('sub', 'sexual'),
  ('sub', 'sexy'),
  ('sub', 'shit'),
  ('sub', 'shitface'),
  ('sub', 'shithead'),
  ('sub', 'shitty'),
  ('sub', 'slut'),
  ('sub', 'spick'),
  ('sub', 'titty'),
  ('sub', 'tranny'),
  ('sub', 'twat'),
  ('sub', 'vagina'),
  ('sub', 'wanker'),
  ('sub', 'wanking'),
  ('sub', 'wetback'),
  ('sub', 'whore'),
  ('word', 'anal'),
  ('word', 'ass'),
  ('word', 'beaner'),
  ('word', 'beyotch'),
  ('word', 'biatch'),
  ('word', 'chinc'),
  ('word', 'chink'),
  ('word', 'cock'),
  ('word', 'cono'),
  ('word', 'coon'),
  ('word', 'coonz'),
  ('word', 'culo'),
  ('word', 'cum'),
  ('word', 'cvnt'),
  ('word', 'dick'),
  ('word', 'dyk'),
  ('word', 'dyke'),
  ('word', 'fag'),
  ('word', 'faget'),
  ('word', 'fagit'),
  ('word', 'fagot'),
  ('word', 'fagz'),
  ('word', 'fck'),
  ('word', 'fcker'),
  ('word', 'fcking'),
  ('word', 'fckn'),
  ('word', 'fgt'),
  ('word', 'fkn'),
  ('word', 'fuggin'),
  ('word', 'fuk'),
  ('word', 'fuking'),
  ('word', 'fukk'),
  ('word', 'fukker'),
  ('word', 'gook'),
  ('word', 'hitlr'),
  ('word', 'jewboy'),
  ('word', 'jewfag'),
  ('word', 'kike'),
  ('word', 'kikez'),
  ('word', 'kunt'),
  ('word', 'kyke'),
  ('word', 'mamon'),
  ('word', 'mamona'),
  ('word', 'marica'),
  ('word', 'nggr'),
  ('word', 'nibba'),
  ('word', 'nig'),
  ('word', 'nigah'),
  ('word', 'niga'),
  ('word', 'nigar'),
  ('word', 'nigha'),
  ('word', 'niglet'),
  ('word', 'nigr'),
  ('word', 'nigur'),
  ('word', 'nikka'),
  ('word', 'niqqa'),
  ('word', 'paki'),
  ('word', 'paky'),
  ('word', 'perra'),
  ('word', 'phag'),
  ('word', 'phaggot'),
  ('word', 'phagot'),
  ('word', 'pito'),
  ('word', 'porn'),
  ('word', 'pron'),
  ('word', 'puta'),
  ('word', 'puto'),
  ('word', 'raghead'),
  ('word', 'raghed'),
  ('word', 'rape'),
  ('word', 'sex'),
  ('word', 'sexo'),
  ('word', 'shemal'),
  ('word', 'shemale'),
  ('word', 'shemali'),
  ('word', 'sht'),
  ('word', 'shtty'),
  ('word', 'slvt'),
  ('word', 'spic'),
  ('word', 'spik'),
  ('word', 'tit'),
  ('word', 'trannie'),
  ('word', 'trany'),
  ('word', 'verga'),
  ('word', 'wank'),
  ('word', 'wetback'),
  ('word', 'wetbak'),
  ('word', 'zorra');

create table private.board_post (
  id uuid primary key default gen_random_uuid(),
  day_key date not null,
  auth_uid uuid not null,
  display_name text,
  scores int[] not null,
  total int not null,
  posted_at timestamptz not null default now(),
  removed_at timestamptz,
  name_hidden_at timestamptz,
  -- Random display label for a nameless row. New each day, stored only on this row.
  -- Not derived from auth_uid. Do not copy it onto a weekly board or any table keyed by a stable id (PR 112).
  player_tag int,
  unique (day_key, auth_uid),
  check (player_tag is null or (player_tag between 1000 and 9999)),
  check (display_name is null or char_length(display_name) between 3 and 20),
  check (cardinality(scores) = 5),
  check (scores[1] between 0 and 1000 and scores[2] between 0 and 1000 and scores[3] between 0 and 1000 and scores[4] between 0 and 1000 and scores[5] between 0 and 1000),
  check (total = scores[1] + scores[2] + scores[3] + scores[4] + scores[5])
);
alter table private.board_post enable row level security;
create index board_post_day_idx on private.board_post (day_key);
create unique index board_post_day_tag_uidx on private.board_post (day_key, player_tag) where player_tag is not null;

create table private.board_agg (
  day_key date primary key,
  n int not null,
  sum_total bigint not null,
  sum_scores int[] not null
);
alter table private.board_agg enable row level security;

create table private.board_rate (
  bucket text primary key,
  window_start timestamptz not null,
  n int not null
);
alter table private.board_rate enable row level security;

create or replace function private.board_squeeze(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(translate(translate(replace(lower(translate(
    btrim(regexp_replace(translate(coalesce(p, ''), chr(8203) || chr(8204) || chr(8205) || chr(65279), ''), '[[:space:]]+', ' ', 'g')),
    'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇÝŸàáâãäåèéêëìíîïòóôõöùúûüñçýÿ',
    'aaaaaaeeeeiiiiooooouuuuncyyaaaaaaeeeeiiiiooooouuuuncyy')), 'ß', 'ss'), '@$+|!', 'asati'), '013456789', 'oieasgtbg'), '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');
$$;

create or replace function private.board_squeeze_digits(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(regexp_replace(translate(replace(lower(translate(
    btrim(regexp_replace(translate(coalesce(p, ''), chr(8203) || chr(8204) || chr(8205) || chr(65279), ''), '[[:space:]]+', ' ', 'g')),
    'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇÝŸàáâãäåèéêëìíîïòóôõöùúûüñçýÿ',
    'aaaaaaeeeeiiiiooooouuuuncyyaaaaaaeeeeiiiiooooouuuuncyy')), 'ß', 'ss'), '@$+|!', 'asati'), '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');
$$;

-- Whole tokens excused from the squeeze check. Same spellings as name-filter.js ALLOW.
create table private.board_allow (
  token text primary key
);
insert into private.board_allow (token) values
('actitud'),
('analia'),
('analog'),
('analogy'),
('analysis'),
('analyst'),
('aptitud'),
('aptitude'),
('ashkenazi'),
('assess'),
('attitude'),
('badminton'),
('banal'),
('banality'),
('basement'),
('beatitude'),
('benedick'),
('canal'),
('certitude'),
('cockatoo'),
('cockburn'),
('cockerel'),
('cockrell'),
('cockroach'),
('cocktail'),
('commodore'),
('competitor'),
('conn'),
('constitution'),
('coppola'),
('cumming'),
('cummings'),
('dickens'),
('dickerson'),
('dickinson'),
('dickson'),
('dikshit'),
('document'),
('dykes'),
('enigma'),
('esperanza'),
('essex'),
('exactitude'),
('fagotti'),
('fagotto'),
('fortitude'),
('granny'),
('gratitud'),
('gratitude'),
('hancock'),
('hitchcock'),
('hoshitani'),
('identity'),
('ignazio'),
('ineptitude'),
('latitud'),
('latitude'),
('leacock'),
('lightwater'),
('mammon'),
('middlesex'),
('model'),
('modelo'),
('moderna'),
('moderno'),
('modest'),
('modestia'),
('modesto'),
('modificar'),
('modulo'),
('multitude'),
('nazia'),
('nazir'),
('nigel'),
('niger'),
('nigeria'),
('night'),
('nightingale'),
('paget'),
('peacock'),
('penistone'),
('petite'),
('phuket'),
('pollack'),
('pollard'),
('promptitude'),
('pussycat'),
('rectitude'),
('saget'),
('scunthorpe'),
('semenov'),
('semenya'),
('sexton'),
('shitake'),
('shiteh'),
('shitterton'),
('shittu'),
('spikes'),
('stafford'),
('staffordshire'),
('stitch'),
('sussex'),
('therapist'),
('titan'),
('titania'),
('titanic'),
('titian'),
('titmouse'),
('tito'),
('titulo'),
('titus'),
('wessex'),
('woodcock'),
('yoshito');

create table private.board_phrase (
  phrase text primary key,
  reason text not null check (reason in ('allow', 'impersonation'))
);
insert into private.board_phrase (phrase, reason) values
  ('dick van dyke', 'allow'),
  ('brain clash', 'impersonation'),
  ('daily dose', 'impersonation');

create or replace function private.board_leet(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(coalesce(p, ''), '013456789', 'oieasgtbg');
$$;

create or replace function private.board_repeats(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '(.)\1+', '\1', 'g');
$$;

create or replace function private.board_long_hit(p_text text, p_loose boolean)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from private.board_term t
    where t.kind = 'sub'
      and (
        position(t.term in p_text) > 0
        or (
          (
            p_loose
            or private.board_repeats(regexp_replace(p_text, '[^a-z0-9]', '', 'g'))
               <> regexp_replace(p_text, '[^a-z0-9]', '', 'g')
          )
          and (
            private.board_repeats(regexp_replace(p_text, '[^a-z0-9]', '', 'g')) = private.board_repeats(t.term)
            or (
              char_length(private.board_repeats(t.term)) >= 4
              and position(
                private.board_repeats(t.term)
                in private.board_repeats(regexp_replace(p_text, '[^a-z0-9]', '', 'g'))
              ) > 0
            )
          )
        )
      )
  );
$$;

create or replace function private.board_word_hit(p_stem text, p_full text, p_trail text, p_loose boolean)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_stem ~ '^x{3,}$' or p_full ~ '^x{3,}$' or exists (
    select 1
    from private.board_term t
    where t.kind = 'word'
      and (
        p_stem = t.term or p_full = t.term
        or p_stem = t.term || 's' or p_full = t.term || 's'
        or (p_trail ~ '^[0-9]+$' and p_trail <> '' and p_stem = t.term)
        or (p_loose and (position(t.term in p_stem) > 0 or position(t.term in p_full) > 0))
      )
  );
$$;

create or replace function private.board_imp_hit(p_stem text, p_full text, p_trail text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from private.board_term t
    where t.kind = 'compound'
      and (position(t.term in p_stem) > 0 or position(t.term in p_full) > 0)
  ) or exists (
    select 1 from private.board_term t
    where (t.kind = 'imp' or t.kind = 'impword')
      and (
        p_stem = t.term or p_full = t.term
        or (p_trail ~ '^[0-9]+$' and p_trail <> '' and p_stem = t.term)
      )
  );
$$;

create or replace function private.board_letters_sq(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '([a-z])\1+', '\1', 'g');
$$;

create or replace function private.board_canon(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(coalesce(p, ''), 'q', 'g'), 'v', 'u');
$$;

create or replace function private.board_boob(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_text, '') ~ 'bo{2,}b(s|z|ies)?';
$$;

create or replace function private.board_attached(p_text text, p_term text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  tail text;
  rest text;
  plural text;
begin
  if p_text is null or p_term is null or p_text = '' or p_term = '' or p_text = p_term then
    return false;
  end if;
  foreach tail in array array['boys', 'boy', 'lord', 'eyes', 'eye', 'face', 'man', 'ies', 'es', 's'] loop
    if left(p_text, char_length(p_term) + char_length(tail)) = p_term || tail
       and substring(p_text from char_length(p_term) + char_length(tail) + 1) ~ '^[0-9]*$' then
      return true;
    end if;
  end loop;
  rest := substring(p_text from char_length(p_term) + 1);
  if left(p_text, char_length(p_term)) = p_term and rest ~ '^[0-9]+$' then
    return true;
  end if;
  if right(p_term, 1) = 'y' then
    plural := left(p_term, char_length(p_term) - 1) || 'ies';
    if left(p_text, char_length(plural)) = plural
       and substring(p_text from char_length(plural) + 1) ~ '^[0-9]*$' then
      return true;
    end if;
  end if;
  return false;
end;
$$;

create or replace function private.board_padded(p_text text, p_term text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_text = 'the' || p_term
    or p_text = p_term || 'lover'
    or p_text ~ ('^x+' || p_term || 'x+$');
$$;

create or replace function private.board_term_reason(p_term text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from private.board_term t
      where t.term = p_term and (t.kind = 'imp' or t.kind = 'compound' or t.kind = 'impword')
    ) then 'impersonation'
    else 'profanity'
  end;
$$;

create or replace function private.board_long_term(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select t.term
  from (
    select term, private.board_canon(term) as c
    from private.board_term
    where kind = 'sub' or kind = 'compound' or kind = 'imp'
  ) t
  where (
      position(t.c in p_text) > 0
      or private.board_attached(p_text, t.c)
      or (
        t.term <> 'boobs'
        and private.board_letters_sq(p_text) <> p_text
        and (
          private.board_letters_sq(p_text) = private.board_letters_sq(t.c)
          or (
            char_length(private.board_letters_sq(t.c)) >= 4
            and position(private.board_letters_sq(t.c) in private.board_letters_sq(p_text)) > 0
          )
        )
      )
    )
  limit 1;
$$;

create or replace function private.board_short_term(p_text text, p_loose boolean)
returns text
language sql
stable
set search_path = ''
as $$
  select t.term
  from (
    select term, private.board_canon(term) as c
    from private.board_term
    where kind = 'word' or kind = 'impword'
  ) t
  where (
      p_text = t.c
      or private.board_attached(p_text, t.c)
      or private.board_padded(p_text, t.c)
      or (p_loose and position(t.c in p_text) > 0)
      or (
        private.board_letters_sq(p_text) <> p_text
        and (
          private.board_letters_sq(p_text) = private.board_letters_sq(t.c)
          or private.board_attached(private.board_letters_sq(p_text), private.board_letters_sq(t.c))
          or private.board_padded(private.board_letters_sq(p_text), private.board_letters_sq(t.c))
          or (p_loose and position(private.board_letters_sq(t.c) in private.board_letters_sq(p_text)) > 0)
        )
      )
    )
  limit 1;
$$;

create or replace function private.board_judge(p_text text, p_loose boolean)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_term text;
begin
  if p_text is null or p_text = '' then
    return '';
  end if;
  if p_text ~ '^x{3,}$' or private.board_letters_sq(p_text) ~ '^x{3,}$' then
    return 'profanity';
  end if;
  v_term := private.board_long_term(p_text);
  if v_term is not null then
    return private.board_term_reason(v_term);
  end if;
  v_term := private.board_short_term(p_text, p_loose);
  if v_term is not null then
    return private.board_term_reason(v_term);
  end if;
  return '';
end;
$$;

create or replace function private.board_glue(p_text text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_why text;
  v_sq text;
  v_term text;
begin
  v_why := private.board_judge(p_text, false);
  if v_why <> '' then
    return v_why;
  end if;
  v_sq := private.board_letters_sq(p_text);
  select t.term into v_term
  from private.board_term t
  where (t.kind = 'sub' or t.kind = 'compound' or t.kind = 'imp')
    and t.term <> 'boobs'
    and v_sq = private.board_letters_sq(private.board_canon(t.term))
  limit 1;
  if v_term is not null then
    return private.board_term_reason(v_term);
  end if;
  select t.term into v_term
  from private.board_term t
  where (t.kind = 'word' or t.kind = 'impword')
    and (
      v_sq = private.board_letters_sq(private.board_canon(t.term))
      or private.board_attached(v_sq, private.board_letters_sq(private.board_canon(t.term)))
    )
  limit 1;
  if v_term is not null then
    return private.board_term_reason(v_term);
  end if;
  return '';
end;
$$;

create or replace function private.board_join_reason(p_text text, p_mark text, p_loose boolean)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_term text;
  v_tsq text;
  v_pos int;
  v_from int;
  v_at int;
  v_sq text := '';
  v_smap int[] := '{}';
  v_i int;
  v_ch text;
  v_start int;
  v_end int;
begin
  if p_text is null or p_text = '' then
    return '';
  end if;
  if p_mark is null or position('A' in p_mark) = 0 then
    return private.board_judge(p_text, p_loose);
  end if;
  if (p_text ~ '^x{3,}$' or private.board_letters_sq(p_text) ~ '^x{3,}$')
     and p_mark !~ '^A+$' then
    return 'profanity';
  end if;
  for v_term in
    select t.term from private.board_term t
    where t.kind = 'sub' or t.kind = 'compound' or t.kind = 'imp'
  loop
    v_from := 0;
    loop
      v_pos := position(private.board_canon(v_term) in substring(p_text from v_from + 1));
      exit when v_pos = 0;
      v_at := v_from + v_pos;
      if substring(p_mark from v_at for char_length(v_term)) !~ '^A+$' then
        return private.board_term_reason(v_term);
      end if;
      v_from := v_at;
    end loop;
    if private.board_attached(p_text, private.board_canon(v_term)) and p_mark !~ '^A+$' then
      return private.board_term_reason(v_term);
    end if;
  end loop;
  for v_i in 1..char_length(p_text) loop
    v_ch := substring(p_text from v_i for 1);
    if v_sq <> '' and v_ch = right(v_sq, 1) and v_ch ~ '^[a-z]$' then
      continue;
    end if;
    v_sq := v_sq || v_ch;
    v_smap := array_append(v_smap, v_i);
  end loop;
  if v_sq <> p_text then
    for v_term in
      select t.term from private.board_term t
      where t.kind = 'sub' or t.kind = 'compound' or t.kind = 'imp'
    loop
      v_tsq := private.board_letters_sq(private.board_canon(v_term));
      if v_term = 'boobs' then
        continue;
      end if;
      if v_sq = v_tsq and p_mark !~ '^A+$' then
        return private.board_term_reason(v_term);
      end if;
      if char_length(v_tsq) < 4 then
        continue;
      end if;
      v_from := 0;
      loop
        v_pos := position(v_tsq in substring(v_sq from v_from + 1));
        exit when v_pos = 0;
        v_at := v_from + v_pos;
        v_start := v_smap[v_at];
        v_end := v_smap[v_at + char_length(v_tsq) - 1];
        if substring(p_mark from v_start for v_end - v_start + 1) !~ '^A+$' then
          return private.board_term_reason(v_term);
        end if;
        v_from := v_at;
      end loop;
    end loop;
  end if;
  for v_term in
    select t.term from private.board_term t
    where t.kind = 'word' or t.kind = 'impword'
  loop
    if (p_text = private.board_canon(v_term) or private.board_attached(p_text, private.board_canon(v_term)) or private.board_padded(p_text, private.board_canon(v_term)))
       and p_mark !~ '^A+$' then
      return private.board_term_reason(v_term);
    end if;
    if p_loose then
      v_from := 0;
      loop
        v_pos := position(private.board_canon(v_term) in substring(p_text from v_from + 1));
        exit when v_pos = 0;
        v_at := v_from + v_pos;
        if substring(p_mark from v_at for char_length(v_term)) !~ '^A+$' then
          return private.board_term_reason(v_term);
        end if;
        v_from := v_at;
      end loop;
    end if;
    if v_sq <> p_text then
      v_tsq := private.board_letters_sq(private.board_canon(v_term));
      if (v_sq = v_tsq or private.board_attached(v_sq, v_tsq) or private.board_padded(v_sq, v_tsq))
         and p_mark !~ '^A+$' then
        return private.board_term_reason(v_term);
      end if;
    end if;
  end loop;
  return '';
end;
$$;

create or replace function private.board_name_status(p_name text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := coalesce(p_name, '');
  v_norm text;
  v_scan text;
  v_tag text := '';
  v_piece text;
  v_raw text[] := '{}';
  v_stem text[] := '{}';
  v_full text[] := '{}';
  v_trail text[] := '{}';
  v_syn boolean[] := '{}';
  v_i int;
  v_j int;
  v_k int;
  v_st text;
  v_fu text;
  v_tr text;
  v_phrase text;
  v_phrase_sq text;
  v_joined_phrase text;
  v_joined_sq text;
  v_ptok text[] := '{}';
  v_joined text := '';
  v_sq text;
  v_spaced boolean;
  v_parts int;
  v_hit text;
  v_whole text[] := '{}';
  v_len int[] := '{}';
  v_run text := '';
  v_mark text := '';
  v_run_n int := 0;
  v_run_last int := 0;
  v_run_single boolean := true;
  v_why text;
begin
  v := translate(v, chr(8203) || chr(8204) || chr(8205) || chr(65279), '');
  v := btrim(regexp_replace(v, '[[:space:]]+', ' ', 'g'));
  if v = '' then
    return jsonb_build_object('ok', true, 'skip', true);
  end if;
  v_norm := normalize(v, NFKC);
  if char_length(v_norm) < 3 or char_length(v_norm) > 20 then
    return jsonb_build_object('ok', false, 'reason', 'length');
  end if;
  v_piece := regexp_replace(v_norm, '[[:space:]]+', '', 'g');
  if position('@' in v_piece) > 0 or v_piece ~* 'https?:|www\.|//' then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  if v_piece ~* '(^|[^[:alnum:]])[[:alnum:]-]+\.(com|net|org|io|gg|co|me|tv|app|dev|xyz|info|ly|link|site|us|uk|mx|es|gl)([^[:alnum:]]|$)' then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  if char_length(regexp_replace(v_norm, '\D', '', 'g')) >= 7 then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  v_scan := lower(translate(v_norm,
    'ıİіїӏаАеЕоОрРсСуУхХѕһαΑεΕοΟρΡιΙκΚτΤυΥχΧΝæÆœŒ',
    'iiiiiaaeeooppccyyxxshaaeeooppiikkttuuxxnaaoo'));
  v_scan := replace(translate(v_scan,
    'àáâãäåèéêëìíîïòóôõöùúûüñçýÿ',
    'aaaaaaeeeeiiiiooooouuuuncyy'), 'ß', 'ss');
  v_scan := translate(v_scan,
    $conf$ηΗνυΥᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘʀꜱᴛᴜᴠᴡʏᴢᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᶰᶦ$conf$,
    $conf$nnvuuabcdefghijklmnoprstuvwyzabcdefghijklmnoprstuvwxyzni$conf$);
  v_scan := translate(v_scan, 'qvѳѲѵѴǫǪᴏ', 'guuuuuggg');

  v_joined := '';
  v_tag := '';
  v_spaced := true;
  v_parts := 0;
  for v_piece in
    select m[1] from regexp_matches(v_scan, '[a-z0-9]+', 'g') as m
  loop
    v_parts := v_parts + 1;
    if v_piece !~ '^[a-z]$' then v_spaced := false; end if;
    if v_piece ~ '^[0-9]+$' then
      v_st := v_piece; v_tr := '';
    elsif v_piece ~ '[a-z]' and v_piece ~ '[0-9]$' then
      v_tr := substring(v_piece from '[0-9]+$');
      v_st := private.board_leet(regexp_replace(v_piece, '[0-9]+$', ''));
    else
      v_st := private.board_leet(v_piece); v_tr := '';
    end if;
    v_joined := v_joined || v_st || v_tr;
    if v_piece ~ '^[0-9]+$' then
      v_tag := v_tag || v_piece;
    else
      v_fu := private.board_leet(replace(replace(case when v_tr = '' then v_piece else regexp_replace(v_piece, '[0-9]+$', '') end, '1', 'l'), 'i', 'l'));
      v_tag := v_tag || v_fu || v_tr;
    end if;
    v_stem := array_append(v_stem, v_st);
    v_full := array_append(v_full, v_st || v_tr);
    v_whole := array_append(v_whole, private.board_leet(v_piece));
    v_len := array_append(v_len, char_length(v_piece));
  end loop;
  if v_parts < 2 then v_spaced := false; end if;
  if v_tag ~ '(player|jugador)[0-9]{4}([^0-9]|$)' then
    return jsonb_build_object('ok', false, 'reason', 'tag');
  end if;
  if v_norm !~ '^[[:alnum:]]([[:alnum:]''’ -]*[[:alnum:]])?$' then
    return jsonb_build_object('ok', false, 'reason', 'chars');
  end if;
  v_phrase := array_to_string(v_stem, ' ');
  if exists (select 1 from private.board_phrase p where p.reason = 'allow' and (p.phrase = v_phrase or private.board_canon(p.phrase) = v_phrase)) then
    return jsonb_build_object('ok', true, 'skip', false, 'name', v);
  end if;
  v_run := '';
  v_run_n := 0;
  v_run_last := 0;
  for v_i in 1..coalesce(array_length(v_stem, 1), 0) loop
    if v_run_n > 0 and v_run_last > 3 and v_len[v_i] > 3 then
      v_ptok := array_append(v_ptok, v_run);
      v_run := '';
      v_run_n := 0;
    end if;
    v_run := v_run || v_stem[v_i];
    v_run_n := v_run_n + 1;
    v_run_last := v_len[v_i];
  end loop;
  if v_run_n > 0 then
    v_ptok := array_append(v_ptok, v_run);
  end if;
  select string_agg(private.board_letters_sq(s), ' ' order by ord) into v_phrase_sq
  from unnest(v_stem) with ordinality as u(s, ord);
  v_joined_phrase := array_to_string(v_ptok, ' ');
  select string_agg(private.board_letters_sq(s), ' ' order by ord) into v_joined_sq
  from unnest(v_ptok) with ordinality as u(s, ord);
  if exists (
    select 1 from private.board_phrase p
    where p.reason = 'impersonation'
      and (
        v_phrase ~ ('(^| )' || p.phrase || '($| )')
        or coalesce(v_phrase_sq, '') ~ ('(^| )' || p.phrase || '($| )')
        or coalesce(v_joined_phrase, '') ~ ('(^| )' || p.phrase || '($| )')
        or coalesce(v_joined_sq, '') ~ ('(^| )' || p.phrase || '($| )')
      )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'impersonation');
  end if;
  for v_i in 1..coalesce(array_length(v_stem, 1), 0) loop
    if exists (select 1 from private.board_allow a where private.board_canon(a.token) = v_full[v_i]) then
      if v_i > 1 and v_i < array_length(v_stem, 1) then
        v_why := private.board_glue(v_stem[v_i - 1] || v_stem[v_i + 1]);
        if v_why <> '' then
          return jsonb_build_object('ok', false, 'reason', v_why);
        end if;
      end if;
      continue;
    end if;
    if v_i > 1 and v_stem[v_i] = 'dyke' and (v_stem[v_i - 1] = 'van' or v_stem[v_i - 1] = 'uan') then
      continue;
    end if;
      v_why := private.board_judge(v_full[v_i], false);
    if v_why = '' and v_whole[v_i] is distinct from v_full[v_i] then
      v_why := private.board_judge(v_whole[v_i], false);
    end if;
    if v_why = '' and (private.board_boob(v_full[v_i]) or private.board_boob(v_whole[v_i])) then
      v_why := 'profanity';
    end if;
    if v_why <> '' then
      return jsonb_build_object('ok', false, 'reason', v_why);
    end if;
  end loop;
  v_run := '';
  v_mark := '';
  v_run_n := 0;
  v_run_last := 0;
  v_run_single := true;
  for v_i in 1..coalesce(array_length(v_stem, 1), 0) loop
    if v_run_n > 0 and v_run_last > 3 and v_len[v_i] > 3 then
      if v_run_n >= 2 then
        v_why := private.board_join_reason(v_run, v_mark, v_run_single);
        if v_why = '' then
          v_why := private.board_join_reason(private.board_leet(v_run), v_mark, v_run_single);
        end if;
        if v_why = '' and (private.board_boob(v_run) or private.board_boob(private.board_leet(v_run))) then
          v_why := 'profanity';
        end if;
        if v_why <> '' then
          return jsonb_build_object('ok', false, 'reason', v_why);
        end if;
      end if;
      v_run := '';
      v_mark := '';
      v_run_n := 0;
      v_run_single := true;
    end if;
    v_run := v_run || v_stem[v_i];
    if exists (select 1 from private.board_allow a where private.board_canon(a.token) = v_full[v_i]) then
      v_mark := v_mark || repeat('A', char_length(v_stem[v_i]));
    else
      v_mark := v_mark || repeat('.', char_length(v_stem[v_i]));
    end if;
    v_run_n := v_run_n + 1;
    if v_len[v_i] <> 1 then
      v_run_single := false;
    end if;
    v_run_last := v_len[v_i];
  end loop;
  if v_run_n >= 2 then
    v_why := private.board_join_reason(v_run, v_mark, v_run_single);
    if v_why = '' then
      v_why := private.board_join_reason(private.board_leet(v_run), v_mark, v_run_single);
    end if;
    if v_why = '' and (private.board_boob(v_run) or private.board_boob(private.board_leet(v_run))) then
      v_why := 'profanity';
    end if;
    if v_why <> '' then
      return jsonb_build_object('ok', false, 'reason', v_why);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'skip', false, 'name', v);
end;
$$;

create or replace function private.board_scores_ok(p_scores int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_scores is not null
    and cardinality(p_scores) = 5
    and p_scores[1] between 0 and 1000
    and p_scores[2] between 0 and 1000
    and p_scores[3] between 0 and 1000
    and p_scores[4] between 0 and 1000
    and p_scores[5] between 0 and 1000;
$$;

create or replace function private.board_add_agg(p_day date, p_n int, p_total int, p_scores int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.board_agg (day_key, n, sum_total, sum_scores)
  values (p_day, p_n, p_total, p_scores)
  on conflict (day_key) do update set
    n = private.board_agg.n + excluded.n,
    sum_total = private.board_agg.sum_total + excluded.sum_total,
    sum_scores = array[
      private.board_agg.sum_scores[1] + excluded.sum_scores[1],
      private.board_agg.sum_scores[2] + excluded.sum_scores[2],
      private.board_agg.sum_scores[3] + excluded.sum_scores[3],
      private.board_agg.sum_scores[4] + excluded.sum_scores[4],
      private.board_agg.sum_scores[5] + excluded.sum_scores[5]
    ];
end;
$$;

-- Picks a free 4-digit tag for one day. Uses random() only. Does not read auth_uid.
create or replace function private.board_pick_tag(p_day date)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tag int;
  v_try int;
begin
  if p_day is null then
    return null;
  end if;
  for v_try in 1..40 loop
    v_tag := 1000 + floor(random() * 9000)::int;
    if not exists (
      select 1 from private.board_post
      where day_key = p_day and player_tag = v_tag
    ) then
      return v_tag;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function private.board_post(p_uid uuid, p_day date, p_name text, p_scores int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name jsonb;
  v_clean text;
  v_total int;
  v_row private.board_post%rowtype;
  v_delta int[];
  v_tag int;
  v_try int;
begin
  if p_uid is null or p_day is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if not private.board_scores_ok(p_scores) then
    return jsonb_build_object('ok', false, 'error', 'scores');
  end if;
  if p_name is null or btrim(p_name) = '' then
    v_clean := null;
  else
    v_name := private.board_name_status(p_name);
    if coalesce((v_name ->> 'ok')::boolean, false) is not true
       or coalesce((v_name ->> 'skip')::boolean, false) then
      return jsonb_build_object('ok', false, 'error', 'name_rejected', 'reason', coalesce(v_name ->> 'reason', 'chars'));
    end if;
    v_clean := v_name ->> 'name';
  end if;
  v_total := p_scores[1] + p_scores[2] + p_scores[3] + p_scores[4] + p_scores[5];
  select * into v_row from private.board_post where day_key = p_day and auth_uid = p_uid;
  if v_row.id is not null then
    if v_row.removed_at is not null or v_row.name_hidden_at is not null then
      return jsonb_build_object('ok', true, 'hidden', true);
    end if;
    if v_clean is null then
      v_clean := v_row.display_name;
    end if;
    v_delta := array[
      p_scores[1] - v_row.scores[1],
      p_scores[2] - v_row.scores[2],
      p_scores[3] - v_row.scores[3],
      p_scores[4] - v_row.scores[4],
      p_scores[5] - v_row.scores[5]
    ];
    update private.board_post
      set display_name = v_clean,
          player_tag = case when v_clean is null then player_tag else null end,
          scores = p_scores,
          total = v_total
      where id = v_row.id;
    perform private.board_add_agg(p_day, 0, v_total - v_row.total, v_delta);
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_total, 'token', v_row.id);
  end if;
  if v_clean is null then
    for v_try in 1..8 loop
      v_tag := private.board_pick_tag(p_day);
      if v_tag is null then
        return jsonb_build_object('ok', false, 'error', 'tag_exhausted');
      end if;
      begin
        insert into private.board_post (day_key, auth_uid, display_name, player_tag, scores, total)
        values (p_day, p_uid, null, v_tag, p_scores, v_total)
        returning id into v_row.id;
        exit;
      exception when unique_violation then
        v_tag := null;
        select * into v_row from private.board_post where day_key = p_day and auth_uid = p_uid;
        if v_row.id is not null then
          exit;
        end if;
      end;
    end loop;
    if v_row.id is null then
      return jsonb_build_object('ok', false, 'error', 'tag_exhausted');
    end if;
  else
    insert into private.board_post (day_key, auth_uid, display_name, scores, total)
    values (p_day, p_uid, v_clean, p_scores, v_total)
    returning id into v_row.id;
  end if;
  perform private.board_add_agg(p_day, 1, v_total, p_scores);
  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total, 'token', v_row.id);
end;
$$;

create or replace function private.board_public(p_day date, p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_section text := coalesce(p_section, '');
  v_rows jsonb;
  v_total int;
begin
  if v_section not in ('overall', 'world', 'history', 'sports', 'word', 'think') then
    return jsonb_build_object('ok', false, 'error', 'invalid_section', 'served', false, 'rows', '[]'::jsonb);
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 30 then
    return jsonb_build_object('ok', true, 'served', false, 'day', p_day, 'section', v_section, 'rows', '[]'::jsonb, 'total', 0);
  end if;
  with ranked as (
    select id, display_name, player_tag,
      case v_section
        when 'world' then scores[1]
        when 'history' then scores[2]
        when 'sports' then scores[3]
        when 'word' then scores[4]
        when 'think' then scores[5]
        else total
      end as score,
      rank() over (
        order by
          case v_section
            when 'world' then scores[1]
            when 'history' then scores[2]
            when 'sports' then scores[3]
            when 'word' then scores[4]
            when 'think' then scores[5]
            else total
          end desc,
          display_name asc,
          id asc
      ) as place
    from private.board_post
    where day_key = p_day
      and removed_at is null
      and name_hidden_at is null
  ),
  top as (
    select * from ranked
    order by place, id
    limit 100
  )
  select coalesce(jsonb_agg(jsonb_build_object('rank', place, 'name', display_name, 'tag', player_tag, 'score', score, 'token', id) order by place, id), '[]'::jsonb),
         (select count(*)::int from ranked)
    into v_rows, v_total
  from top;
  return jsonb_build_object('ok', true, 'served', true, 'day', p_day, 'section', v_section, 'rows', v_rows, 'total', coalesce(v_total, 0));
end;
$$;

create or replace function private.board_me(p_day date, p_section text, p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_section text := coalesce(p_section, '');
  v_row record;
begin
  if v_section not in ('overall', 'world', 'history', 'sports', 'word', 'think') or p_token is null then
    return jsonb_build_object('ok', false, 'found', false);
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 30 then
    return jsonb_build_object('ok', true, 'found', false, 'total', 0);
  end if;
  with ranked as (
    select id, display_name, player_tag,
      case v_section
        when 'world' then scores[1]
        when 'history' then scores[2]
        when 'sports' then scores[3]
        when 'word' then scores[4]
        when 'think' then scores[5]
        else total
      end as score,
      rank() over (
        order by
          case v_section
            when 'world' then scores[1]
            when 'history' then scores[2]
            when 'sports' then scores[3]
            when 'word' then scores[4]
            when 'think' then scores[5]
            else total
          end desc,
          display_name asc,
          id asc
      ) as place
    from private.board_post
    where day_key = p_day
      and removed_at is null
      and name_hidden_at is null
  )
  select place, display_name, player_tag, score, id, (select count(*)::int from ranked) as total
    into v_row
  from ranked
  where id = p_token;
  if v_row.place is null then
    return jsonb_build_object('ok', true, 'found', false, 'total', coalesce(v_row.total, 0));
  end if;
  return jsonb_build_object('ok', true, 'found', true, 'rank', v_row.place, 'total', v_row.total, 'name', v_row.display_name, 'tag', v_row.player_tag, 'score', v_row.score, 'token', v_row.id);
end;
$$;

create or replace function private.board_admin_list(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_day is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input', 'rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', display_name, 'tag', player_tag, 'score', total, 'scores', scores
  ) order by total desc, display_name asc), '[]'::jsonb)
    into v_rows
  from private.board_post
  where day_key = p_day and removed_at is null and name_hidden_at is null;
  return jsonb_build_object('ok', true, 'day', p_day, 'rows', v_rows);
end;
$$;

create or replace function private.board_rename(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name jsonb;
  v_clean text;
begin
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  v_name := private.board_name_status(p_name);
  if coalesce((v_name ->> 'ok')::boolean, false) is not true or coalesce((v_name ->> 'skip')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'name_rejected', 'reason', coalesce(v_name ->> 'reason', 'length'));
  end if;
  v_clean := v_name ->> 'name';
  update private.board_post
    set display_name = v_clean, player_tag = null
    where id = p_id and removed_at is null and name_hidden_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'name', v_clean);
end;
$$;

create or replace function private.board_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  update private.board_post
    set display_name = null, removed_at = now()
    where id = p_id and removed_at is null and name_hidden_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'removed', true);
end;
$$;

create or replace function private.board_bump(p_bucket text, p_window interval, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into private.board_rate (bucket, window_start, n)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    window_start = case
      when private.board_rate.window_start <= now() - p_window then now()
      else private.board_rate.window_start
    end,
    n = case
      when private.board_rate.window_start <= now() - p_window then 1
      else private.board_rate.n + 1
    end
  returning n into v_n;
  return v_n <= p_max;
end;
$$;

create or replace function private.board_consume_rate(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('board-rate', 0));
  if not private.board_bump('global', interval '60 seconds', 120) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if p_uid is not null and not private.board_bump('uid:' || p_uid::text, interval '60 seconds', 20) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.board_check_name(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.board_name_status(p_name);
end;
$$;

create or replace function private.retain_board_names()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update private.board_post
    set display_name = null, player_tag = null, name_hidden_at = now()
    where display_name is not null
      and posted_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  delete from private.board_rate where window_start < now() - interval '7 days';
  return v_n;
end;
$$;

revoke all on table private.board_term, private.board_allow, private.board_phrase, private.board_post, private.board_agg, private.board_rate
  from public, anon, authenticated, app_writer, field_runtime, board_runtime, board_retention;
revoke all on function
  private.board_letters_sq(text),
  private.board_canon(text),
  private.board_boob(text),
  private.board_attached(text, text),
  private.board_padded(text, text),
  private.board_term_reason(text),
  private.board_long_term(text),
  private.board_short_term(text, boolean),
  private.board_judge(text, boolean),
  private.board_glue(text),
  private.board_join_reason(text, text, boolean),
  private.board_squeeze(text),
  private.board_squeeze_digits(text),
  private.board_leet(text),
  private.board_repeats(text),
  private.board_long_hit(text, boolean),
  private.board_word_hit(text, text, text, boolean),
  private.board_imp_hit(text, text, text),
  private.board_name_status(text),
  private.board_scores_ok(int[]),
  private.board_pick_tag(date),
  private.board_add_agg(date, int, int, int[]),
  private.board_post(uuid, date, text, int[]),
  private.board_public(date, text),
  private.board_me(date, text, uuid),
  private.board_admin_list(date),
  private.board_rename(uuid, text),
  private.board_remove(uuid),
  private.board_bump(text, interval, int),
  private.board_consume_rate(uuid),
  private.board_check_name(text),
  private.retain_board_names()
  from public, anon, authenticated, app_writer, field_runtime;
revoke all on function private.retain_board_names() from board_runtime;
grant execute on function
  private.board_post(uuid, date, text, int[]),
  private.board_public(date, text),
  private.board_me(date, text, uuid),
  private.board_admin_list(date),
  private.board_rename(uuid, text),
  private.board_remove(uuid),
  private.board_consume_rate(uuid),
  private.board_check_name(text)
  to board_runtime;
grant execute on function private.retain_board_names() to board_retention;

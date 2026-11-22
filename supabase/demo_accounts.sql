-- Optional demo socials (Facebook / Instagram / TikTok).
-- NOT part of template defaults. Do not run on a live merchant store.
-- Safe to re-run: only fills EMPTY facebook/instagram/tiktok channel URLs on restore_state.
-- No DROP / TRUNCATE. RLS unchanged.

do $$
declare
  demo jsonb := jsonb_build_object(
    'facebook', jsonb_build_object('value', 'https://facebook.com', 'visible', true),
    'instagram', jsonb_build_object('value', 'https://instagram.com', 'visible', true),
    'tiktok', jsonb_build_object('value', 'https://www.tiktok.com', 'visible', true)
  );
begin
  if to_regclass('public.restore_state') is null then
    raise notice 'restore_state not found — skipped';
    return;
  end if;
  update public.restore_state
  set data = jsonb_set(
    coalesce(data, '{}'::jsonb),
    '{settings,channels}',
    coalesce(data#>'{settings,channels}', '{}'::jsonb) || demo,
    true
  )
  where id = 'main'
    and coalesce(data#>>'{settings,channels,facebook,value}', '') = ''
    and coalesce(data#>>'{settings,channels,instagram,value}', '') = ''
    and coalesce(data#>>'{settings,channels,tiktok,value}', '') = '';
end $$;

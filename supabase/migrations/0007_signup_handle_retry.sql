-- Duplicate shop-slug signups no longer abort auth signup.
--
-- Fixes (see AUDIT.md §2): handle_new_user() did a plain insert; a taken
-- `handle` violated the unique constraint and aborted the whole trigger,
-- which aborts auth.users insert too — the user sees a cryptic "Couldn't
-- create your shop" error and no account is created at all. On a unique
-- violation, retry with a numeric suffix (shop-slug-2, shop-slug-3, ...)
-- instead of failing signup outright.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base_handle text;
  v_handle      text;
  v_suffix      integer := 1;
begin
  -- Shopper accounts don't own a shop — skip the merchant profile.
  if coalesce(new.raw_user_meta_data->>'account_type', 'merchant') <> 'merchant' then
    return new;
  end if;

  v_base_handle := coalesce(new.raw_user_meta_data->>'shop_slug', 'shop-' || left(new.id::text, 8));
  v_handle := v_base_handle;

  loop
    begin
      insert into merchants (id, name, handle, location, whatsapp, instagram, facebook)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop'),
        v_handle,
        coalesce(new.raw_user_meta_data->>'city', ''),
        coalesce(new.raw_user_meta_data->>'whatsapp', ''),
        coalesce(new.raw_user_meta_data->>'instagram', ''),
        coalesce(new.raw_user_meta_data->>'facebook', '')
      )
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      v_handle := v_base_handle || '-' || v_suffix;
      if v_suffix > 50 then
        v_handle := v_base_handle || '-' || left(new.id::text, 6);
        insert into merchants (id, name, handle, location, whatsapp, instagram, facebook)
        values (
          new.id,
          coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop'),
          v_handle,
          coalesce(new.raw_user_meta_data->>'city', ''),
          coalesce(new.raw_user_meta_data->>'whatsapp', ''),
          coalesce(new.raw_user_meta_data->>'instagram', ''),
          coalesce(new.raw_user_meta_data->>'facebook', '')
        )
        on conflict (id) do nothing;
        exit;
      end if;
    end;
  end loop;

  return new;
end;
$$;

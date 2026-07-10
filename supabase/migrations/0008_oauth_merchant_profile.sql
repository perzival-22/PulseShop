-- Google OAuth: don't let the trigger guess a merchant profile.
--
-- handle_new_user() decides merchant-vs-shopper from raw_user_meta_data,
-- defaulting to 'merchant' when account_type is absent. Email/password
-- signups always set account_type explicitly (see auth.ts). Google OAuth
-- gives us no way to set custom metadata before the identity is created, so
-- every Google signup would hit that default and silently get a generic
-- "My Shop" merchant row created for it — including shopper signups. Instead,
-- OAuth signups (any provider other than 'email') get no merchant row at all;
-- the app explicitly creates one via create_merchant_profile() once the user
-- finishes the "set up your shop" onboarding step.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base_handle text;
  v_handle      text;
  v_suffix      integer := 1;
begin
  -- OAuth signups (Google, etc.) never carry our custom metadata — merchant
  -- profile creation for these is explicit, via create_merchant_profile().
  if coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email' then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- Explicit merchant-profile creation for accounts that signed up via an
-- identity provider (Google) and finished the post-login "set up your shop"
-- onboarding step. There is no INSERT policy on merchants for regular
-- clients — this is the only path other than the trigger above.
-- ---------------------------------------------------------------------------
create or replace function create_merchant_profile(
  p_shop_name text,
  p_shop_slug text,
  p_city      text,
  p_whatsapp  text,
  p_instagram text,
  p_facebook  text
) returns merchants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_handle text := p_shop_slug;
  v_handle      text := p_shop_slug;
  v_suffix      integer := 1;
  v_row         merchants;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from merchants where id = auth.uid()) then
    raise exception 'a shop already exists for this account';
  end if;
  if length(trim(coalesce(p_shop_name, ''))) = 0 then
    raise exception 'shop name is required';
  end if;

  loop
    begin
      insert into merchants (id, name, handle, location, whatsapp, instagram, facebook)
      values (
        auth.uid(), trim(p_shop_name), v_handle, coalesce(p_city, ''),
        coalesce(p_whatsapp, ''), coalesce(p_instagram, ''), coalesce(p_facebook, '')
      )
      returning * into v_row;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      v_handle := v_base_handle || '-' || v_suffix;
      if v_suffix > 50 then
        v_handle := v_base_handle || '-' || left(auth.uid()::text, 6);
        insert into merchants (id, name, handle, location, whatsapp, instagram, facebook)
        values (
          auth.uid(), trim(p_shop_name), v_handle, coalesce(p_city, ''),
          coalesce(p_whatsapp, ''), coalesce(p_instagram, ''), coalesce(p_facebook, '')
        )
        returning * into v_row;
        exit;
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

grant execute on function create_merchant_profile(text, text, text, text, text, text) to authenticated;

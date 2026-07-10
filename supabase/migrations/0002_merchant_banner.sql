-- Storefront banner image for the merchant's shop header.
alter table merchants add column if not exists banner_url text default '';

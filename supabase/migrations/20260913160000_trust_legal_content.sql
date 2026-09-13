-- Lightweight internal CMS for Verticals' trust/legal/resources content
-- (Trust Center, Security, Privacy, Terms, Cookies, Subprocessors,
-- Resources articles). Admin-only writes via RLS (same admin UID pattern
-- as `templates`/`report_shared_viewers`); public reads go through the
-- public-content edge function (service role, publish-safe columns only)
-- rather than a public RLS SELECT policy - draft_content must never be
-- reachable by an anon/authenticated client directly, only by the one
-- admin account or the service role.

create table if not exists public.legal_pages (
  slug text primary key check (slug in ('trust', 'security', 'privacy', 'terms', 'cookies', 'subprocessors')),
  title text not null default '',
  seo_title text,
  seo_description text,
  last_updated date,
  draft_content text,
  published_content text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.legal_pages enable row level security;

drop policy if exists "Admin manages legal pages" on public.legal_pages;
create policy "Admin manages legal pages"
on public.legal_pages for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

create table if not exists public.subprocessors (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  purpose text,
  data_involved text,
  link text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subprocessors enable row level security;

drop policy if exists "Admin manages subprocessors" on public.subprocessors;
create policy "Admin manages subprocessors"
on public.subprocessors for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

create table if not exists public.resource_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null check (category in ('Privacy', 'Security', 'Data', 'AI', 'Guides', 'Product', 'Business')),
  short_description text,
  draft_content text,
  published_content text,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.resource_articles enable row level security;

drop policy if exists "Admin manages resource articles" on public.resource_articles;
create policy "Admin manages resource articles"
on public.resource_articles for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

create index if not exists resource_articles_status_idx on public.resource_articles (status) where status = 'published';
create index if not exists resource_articles_category_idx on public.resource_articles (category);

-- Seed one row per fixed slug so the Lab editor always has a row to
-- upsert into (avoids "insert vs update" branching in the UI). Trust,
-- Security, Cookies and Subprocessors start genuinely blank (no content
-- has ever existed for them) - they stay status='draft' with null content
-- so their public pages render the neutral placeholder until real content
-- is pasted into Lab.
insert into public.legal_pages (slug, title)
values
  ('trust', 'Trust Center'),
  ('security', 'Security'),
  ('cookies', 'Cookie Policy'),
  ('subprocessors', 'Subprocessors')
on conflict (slug) do nothing;

-- Privacy and Terms already have real (informal, "not legally reviewed")
-- text live on the site today (src/marketing/pages/PrivacyPage.jsx and
-- TermsPage.jsx, both being deleted in favor of the DB-driven LegalPage.jsx
-- component this migration backs) - carried over here as-is, converted to
-- Markdown, so cutting over to the CMS isn't a regression from what's
-- already public. This is a migration of existing text, not new legal
-- copy being authored. Both remain freely editable/replaceable from Lab.
insert into public.legal_pages (slug, title, seo_title, seo_description, last_updated, draft_content, published_content, status, published_at)
values (
  'privacy',
  'Privacy Policy',
  'Privacy Policy | Verticals',
  'How Verticals collects, stores and protects the information in your account.',
  current_date,
  $md$## What we collect

When you create a Verticals account, we collect the information needed to set it up and sign you in - your name, email address and, if you sign in with Google, the basic profile information Google provides for identity purposes. We don't request access to your Google Drive or Sheets unless you separately choose to connect an export feature that needs it.

The forms, records and reports you create in Verticals - and the business or personal data you choose to enter into them - are stored so the product can work: to show you your own records, generate your reports, and keep your workspace available across sessions and devices.

## How we use it

Your information is used to operate your account and the features you use - authentication, storing and displaying your records, generating reports, and responding if you contact us. We don't sell your data, and we don't share the records you create with other users or third parties except where you deliberately share something yourself (for example, sharing a report link, or publishing a form for others to fill in).

## Where it's stored

Verticals is built on Supabase for authentication, database storage and file storage. Your data is stored and processed through that infrastructure as part of running the product.

## Cookies and local storage

Verticals uses browser storage for things like keeping you signed in and remembering interface preferences (such as light/dark mode). This is functional storage needed for the app to work, not third-party advertising tracking.

## Your rights

You can export your records and reports from within the app. You can request a copy of your account data, or request that your account and its data be deleted, by contacting us. We aim to handle GDPR and NDPA-relevant requests - access, export, correction and deletion - in that spirit.

## Contact

Questions about this policy or your data can be sent to [hello@verticalsapp.com](mailto:hello@verticalsapp.com).
$md$,
  $md$## What we collect

When you create a Verticals account, we collect the information needed to set it up and sign you in - your name, email address and, if you sign in with Google, the basic profile information Google provides for identity purposes. We don't request access to your Google Drive or Sheets unless you separately choose to connect an export feature that needs it.

The forms, records and reports you create in Verticals - and the business or personal data you choose to enter into them - are stored so the product can work: to show you your own records, generate your reports, and keep your workspace available across sessions and devices.

## How we use it

Your information is used to operate your account and the features you use - authentication, storing and displaying your records, generating reports, and responding if you contact us. We don't sell your data, and we don't share the records you create with other users or third parties except where you deliberately share something yourself (for example, sharing a report link, or publishing a form for others to fill in).

## Where it's stored

Verticals is built on Supabase for authentication, database storage and file storage. Your data is stored and processed through that infrastructure as part of running the product.

## Cookies and local storage

Verticals uses browser storage for things like keeping you signed in and remembering interface preferences (such as light/dark mode). This is functional storage needed for the app to work, not third-party advertising tracking.

## Your rights

You can export your records and reports from within the app. You can request a copy of your account data, or request that your account and its data be deleted, by contacting us. We aim to handle GDPR and NDPA-relevant requests - access, export, correction and deletion - in that spirit.

## Contact

Questions about this policy or your data can be sent to [hello@verticalsapp.com](mailto:hello@verticalsapp.com).
$md$,
  'published',
  now()
)
on conflict (slug) do nothing;

insert into public.legal_pages (slug, title, seo_title, seo_description, last_updated, draft_content, published_content, status, published_at)
values (
  'terms',
  'Terms of Service',
  'Terms of Service | Verticals',
  'The terms that apply to using Verticals.',
  current_date,
  $md$## Using Verticals

Verticals is provided as a web-based platform for collecting records, managing workflows and generating reports. By creating an account or using the product, you agree to use it lawfully and not to misuse it - including attempting to access other users' data, disrupt the service, or use it to store or share unlawful content.

## Your account and your data

You're responsible for the accuracy of the information you enter into Verticals and for keeping your account credentials secure. The records, forms and reports you create remain yours - Verticals stores and organises them so you can use the product, and doesn't claim ownership of your content.

## Public forms

If you publish a form for others to submit responses to, you're responsible for what you collect through it and for how you use the responses. Publicly shared forms are accessible to anyone with the link; don't use them to collect information you aren't entitled to collect.

## Availability

We aim to keep Verticals available and reliable, but the service is provided as-is, without guaranteeing it will be uninterrupted or error-free. We recommend exporting important records and reports periodically using the export tools built into the product.

## Changes

These terms may be updated from time to time as the product changes. Continued use of Verticals after an update means you accept the current terms.

## Contact

Questions about these terms can be sent to [hello@verticalsapp.com](mailto:hello@verticalsapp.com).
$md$,
  $md$## Using Verticals

Verticals is provided as a web-based platform for collecting records, managing workflows and generating reports. By creating an account or using the product, you agree to use it lawfully and not to misuse it - including attempting to access other users' data, disrupt the service, or use it to store or share unlawful content.

## Your account and your data

You're responsible for the accuracy of the information you enter into Verticals and for keeping your account credentials secure. The records, forms and reports you create remain yours - Verticals stores and organises them so you can use the product, and doesn't claim ownership of your content.

## Public forms

If you publish a form for others to submit responses to, you're responsible for what you collect through it and for how you use the responses. Publicly shared forms are accessible to anyone with the link; don't use them to collect information you aren't entitled to collect.

## Availability

We aim to keep Verticals available and reliable, but the service is provided as-is, without guaranteeing it will be uninterrupted or error-free. We recommend exporting important records and reports periodically using the export tools built into the product.

## Changes

These terms may be updated from time to time as the product changes. Continued use of Verticals after an update means you accept the current terms.

## Contact

Questions about these terms can be sent to [hello@verticalsapp.com](mailto:hello@verticalsapp.com).
$md$,
  'published',
  now()
)
on conflict (slug) do nothing;

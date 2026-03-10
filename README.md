# Admin Panel (Supabase Staging)

This project is a Google-authenticated admin area for your existing Supabase dataset.

## What it includes

- Dashboard with creative statistics from `profiles`, `images`, and `captions`
- `Users / Profiles` page: **READ** profiles
- `Images` page: **CREATE / READ / UPDATE / DELETE** images
- `Captions` page: **READ** captions

## Security model

- Google OAuth login required
- Every `/admin/*` route is server-guarded by `requireSuperadmin()`
- Only users where `profiles.is_superadmin === true` can access the admin area
- Unauthorized users are redirected to `/not-authorized`
- No RLS policies are modified by this app

## Env setup

This repo expects:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`.env.local` has already been copied from the previous project so both projects use the same Supabase environment.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Bootstrap question: "Won’t I lock myself out?"

Yes, initially you can be locked out if your profile is not yet marked superadmin.

Practical solution (without changing RLS policies):

1. Sign in once so your row exists in `profiles`.
2. Use an existing privileged path (Supabase Dashboard SQL editor or another existing superadmin account) to run:

```sql
update profiles
set is_superadmin = true
where id = '<your-auth-user-id>';
```

3. Sign in again and access `/admin`.

This keeps authorization in data (`profiles.is_superadmin`) and does not require enabling/disabling RLS.

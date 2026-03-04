# Supabase Setup Guide

To enable real-time syncing for your Amybox app, follow these steps:

## 1. Create a Project
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Once created, go to **Project Settings > API**.
3. Copy the `Project URL` and `anon public` Key. You will need these for Vercel.

## 2. Create the Database Table
1. Go to the **SQL Editor** in your Supabase dashboard.
2. Paste and run the following SQL command to create the `boxes` table:

```sql
create table public.boxes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  move_id text not null,
  box_number integer not null,
  destination_room text not null,
  items text[] default '{}'::text[],
  photo_url text
);

-- Enable Realtime
alter publication supabase_realtime add table boxes;

-- (Optional) Enable Row Level Security if you want to restrict access later
-- alter table public.boxes enable row level security;
-- create policy "Allow public access for now" on public.boxes for all using (true);
```

## 3. Deploy to Vercel
1. Push your code to GitHub.
2. Import the project in Vercel.
3. Add the following Environment Variables in Vercel:
   - `NEXT_PUBLIC_GEMINI_API_KEY`: Your Google Gemini API Key.
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.

## 4. Done!
Your app will now sync data in real-time across all devices that share the same Move ID.

# Shelf Voice (web app, v2)

Next.js on Vercel + Supabase (login, database, file storage). Search legal free books, save them to a shared
cache, read them aloud, track progress, and ask questions about a passage.

## What it does
- **Search:** Project Gutenberg and Internet Archive (public domain / Creative Commons), searched server-side so there are no browser CORS blocks.
- **Save:** the server downloads the text (or EPUB/PDF as a fallback), stores it once in Supabase, and links it to your library. If someone else already saved that book, it is instant.
- **Add your own:** upload .txt, .epub or .pdf. Uploads are **private to you** and never shared.
- **Listen:** browser text-to-speech, paragraph-level progress synced to your account.
- **Ask:** questions about the passage you paused on, answered by Claude. The API key stays on the server and each user has a daily cap.
- **Scout:** Claude searches the wider web for official free copies and refuses pirate sources.

## Setup (about 20 minutes)
1. **Supabase:** create a project. In SQL Editor, paste and run `supabase/schema.sql`.
2. **Supabase > Authentication > URL Configuration:** set Site URL to your Vercel URL (add `http://localhost:3000` too for local testing). Email sign-in is on by default.
3. **Env vars:** copy `.env.example` to `.env.local` and fill it in (Supabase URL, anon key, service role key, Anthropic key).
4. **Run locally:** `npm install && npm run dev`, open http://localhost:3000.
5. **Deploy:** push to GitHub, import the repo in Vercel, add the same env vars in Project Settings, deploy.

## Known limits
- Scanned PDFs (images of pages) have no text. They are rejected with a clear message until OCR is added.
- Browser voices vary by device. Premium cloud voices are a possible later upgrade.
- Shared cache is limited to Gutenberg and Internet Archive public-domain/CC items. Do not add code that shares user uploads.
- Vercel functions time out at 60 seconds. Very large PDFs from the Archive may fail; uploads are unaffected because they go straight to Storage.

## v2 additions
- Goodreads-style layout: Home, My Books, Discover, Search and More, with a book page and a player.
- Shelves (Want to Listen, Listening, Finished), star ratings, bookmarks.
- Friends with requests and an activity feed, groups with discussions, listening challenges, daily goal and streak.
- Discover rows built from your own shelves; Ask History; account deletion.

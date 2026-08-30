# Fartbrains.app

Rebuild this app from scratch.

This is a brand new build. Do NOT reuse architecture assumptions from the previous version unless explicitly requested. The old build had too much drift, partial features, and misleading implementation state. I want a clean, minimal, reliable V1.

APP NAME:

Idea Vault

WHO IT IS FOR:

Single user only, private personal use

CORE PURPOSE:

A private desktop-style idea vault where I can save ideas manually or capture them from URLs, summarize them with AI, and organize them in folders so I do not lose valuable ideas.

PRIMARY USE CASES:

1. I type a note manually and save it

2. I paste a webpage URL and the app extracts useful text/content and summarizes it

3. I paste transcript/text from Instagram, TikTok, YouTube, or elsewhere and the app summarizes and stores it

4. I browse all saved ideas later in a clean folder/file style interface

5. I search through old ideas quickly

IMPORTANT PRODUCT RULES:

- Build from scratch

- Keep V1 simple and reliable

- No fake integrations

- No pretending features work unless they are fully wired

- Do not over-engineer

- Do not add extension support, shortcuts, background workers, or advanced scraping in V1

- Focus on stable note capture, URL capture, AI summary, folders, and storage

- This is a private app, not multi-tenant SaaS

REQUIRED V1 FEATURES:

1. Authentication

- Simple private login for one user

- Use Supabase Auth

- Protect the app so other people cannot access ideas

2. Core data model

Create these main entities:

- folders

- ideas

Folder fields:

- id

- name

- created_at

Idea fields:

- id

- folder_id

- title

- raw_note

- source_url

- source_type (manual, webpage, transcript, audio)

- extracted_text

- ai_summary

- tags

- is_favorite

- created_at

- updated_at

3. Main pages

- Dashboard / All Ideas

- Folder view

- New Idea modal or panel

- Idea detail view

- Settings page

4. Capture flows

A. Manual Note

- title

- note body

- optional folder

- save instantly

B. Web URL Capture

- paste URL

- fetch page content or extract readable text server-side

- store source URL + extracted text

- generate AI summary

- allow editing before save if needed

C. Transcript Paste Capture

- large textarea where I can paste transcript/text from Instagram/TikTok/YouTube/etc.

- generate AI summary

- save both transcript and summary

5. Search and organization

- search bar

- folders in sidebar

- favorites

- recent ideas

- all ideas

6. Idea detail view

Show:

- title

- original note or extracted text

- summary

- source URL

- folder

- created date

- edit ability

- delete ability

7. UI direction

- desktop-style layout

- clean, modern, minimal

- slightly inspired by file explorer / notes app

- left sidebar for folders/navigation

- main content area for idea list

- right panel or modal for idea detail

- polished but simple, not flashy

8. Tech stack

Use:

- Next.js

- TypeScript

- shadcn/ui

- Supabase for auth/database/storage

- OpenAI for summaries

9. AI behavior

For summaries:

- concise but useful

- capture main idea, key points, and possible action items

- store the raw extracted text separately from the summary

- do not overwrite raw content

10. Build discipline

Before implementation, first provide:

- app structure

- database schema

- page list

- API/server actions list

- what will and will not be in V1

Then build in this order:

1. auth + app shell

2. database schema

3. folders + ideas CRUD

4. manual note capture

5. URL capture

6. transcript paste capture

7. AI summary generation

8. search/favorites/polish

STRICT RULES:

- Do not claim an integration works unless it is fully implemented

- Do not add placeholder “future” systems and describe them like they exist

- Do not add multi-user architecture

- Do not add billing, Stripe, teams, analytics, or notifications

- Do not add browser extension or iOS shortcut support in V1

- Keep the codebase clean and understandable

OUTPUT FORMAT:

First give me:

1. V1 scope

2. file/folder structure

3. database schema

4. app flow

5. implementation order

Then begin building.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fartbrains.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3b7c6670-e618-4911-95aa-5636ac438f11).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# XHS Dashboard — Xiaohongshu Team Management Platform

An internal operations platform for a Xiaohongshu (Little Red Book) content team managing multiple overseas Chinese student accounts. Built to replace spreadsheets and manual tracking with a unified, real-time tool.

**Live demo:** [xhs-tau.vercel.app](https://xhs-tau.vercel.app)

---

## Overview

The team runs several XHS accounts targeting Chinese students applying to universities in the UK, US, Australia, and Canada. This platform centralises everything the team needs: scheduling posts, monitoring account growth, researching competitors, and collecting viral content for inspiration.

A background crawler service (running locally via macOS LaunchAgent) handles all data fetching automatically — team members simply use the web UI and results appear in real time.

---

## Features

### Account Management
- Track multiple XHS accounts with follower counts, engagement stats, and team member assignments
- Per-account post history and performance overview

### Content Management & Calendar
- Create and schedule posts with image uploads (stored in Supabase Storage)
- Kanban-style status workflow: Draft → Scheduled → Published
- Monthly calendar view with drag-free scheduling

### Material Library
- **Viral posts** — save and annotate high-performing posts from XHS; crawler auto-fetches title, cover, full image carousel, caption, tags, and engagement metrics
- **Benchmark accounts** — track competitor profiles; crawler fetches account info + 10 most recent posts with full details
- **Topic bank** — curate content directions with reference links; crawler enriches with engagement data
- **Title bank & banned words** — shared reference lists for the writing team

### Analytics & Monitoring
- Follower growth trend charts for own accounts and benchmark accounts (daily snapshots)
- Viral post rankings by likes / saves / comments
- Country and topic distribution breakdowns

---

## Architecture

```
Vercel (React frontend)
    │
    ├─ reads/writes ──→ Supabase (Postgres + Storage + Realtime)
    │                       │
    └─ sets fetch_status     │ polls every 5s for pending jobs
       = "pending"           │
                        macOS LaunchAgent
                        (MediaCrawler + Playwright)
                             │
                        crawls XHS, uploads images
                        to Supabase Storage, writes
                        results back to DB
```

The crawler runs as a persistent background service on a local Mac. The frontend never calls XHS directly — it queues jobs in Supabase and subscribes to changes via Realtime, so any team member's browser updates automatically when a crawl completes.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite (no router, no CSS framework) | Lightweight, fast iteration |
| Database | Supabase (Postgres) | Realtime subscriptions, built-in Storage, simple auth |
| Crawler | [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) + Playwright | Handles XHS anti-bot measures |
| Scheduler | APScheduler | 12-hour full sync, 5-second job polling |
| Deployment | Vercel | Zero-config CI/CD from GitHub |
| Auto-start | macOS LaunchAgent | Crawler restarts on login, auto-recovers from crashes |

---

## Project Structure

```
├── src/
│   ├── App.jsx                  # Root layout, navigation, account/member state
│   └── components/
│       ├── AccountsPage.jsx     # Account list, stats, assignments
│       ├── ContentManager.jsx   # Post grid, create/edit, image upload
│       ├── CalendarPage.jsx     # Monthly calendar view
│       ├── MaterialPage.jsx     # Viral posts, benchmarks, topics, titles
│       ├── AnalyticsPage.jsx    # Trend charts, rankings
│       ├── ViralPostDrawer.jsx  # Post detail drawer (image carousel, stats, download)
│       ├── PostDetailDrawer.jsx # Internal post detail
│       └── shared.jsx           # Hooks, atoms, constants
├── crawler/
│   ├── server.py                # Main crawler service (polling loop + full sync)
│   ├── config.py                # Supabase credentials, account mapping
│   ├── com.xhs.dashboard.crawler.plist  # macOS LaunchAgent definition
│   └── setup_autostart.sh       # One-command autostart installer
├── schema.sql                   # Core DB schema
└── analytics_schema.sql         # Analytics history tables
```

---

## Local Setup

**Prerequisites:** Node 18+, Python 3.11+, [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) installed at `~/MediaCrawler`

```bash
# Frontend
npm install
cp .env.example .env          # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev

# Crawler (first time — scan QR code to log in to XHS)
cd ~/MediaCrawler
.venv/bin/python main.py --platform xhs --lt qrcode --type creator

# Install crawler as a background service (runs on every login)
chmod +x crawler/setup_autostart.sh
./crawler/setup_autostart.sh
```

---

## Design Decisions

**No authentication layer** — this is a closed internal tool shared with 4–8 known team members. Adding login would add friction without meaningful security benefit for this use case.

**Supabase as job queue** — XHS blocks direct API calls from non-Chinese IPs (and from HTTPS pages calling HTTP endpoints). By having the frontend write `fetch_status = 'pending'` to Supabase and the local crawler poll for jobs, all XHS traffic originates from a local machine with valid session cookies, completely bypassing these restrictions.

**Image re-hosting** — XHS CDN images use hotlink protection and HTTP-only URLs, both of which break when embedded in a Vercel-hosted page. The crawler downloads every image and re-uploads it to Supabase Storage, returning stable HTTPS public URLs.

**No TypeScript, no CSS framework** — the entire UI is inline styles with `useIsMobile()` for responsive breakpoints. Chosen deliberately to keep the codebase approachable for future contributors without a frontend background.

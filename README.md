# XHS Dashboard — Xiaohongshu Team Management Platform
# XHS 管理台 — 小红书团队运营平台

[English](#english) · [中文](#中文)

---

## English

### Overview

An internal operations platform for a Xiaohongshu (Little Red Book) content team managing multiple overseas Chinese student accounts. Built to replace spreadsheets and manual tracking with a unified, real-time tool.

The team runs several XHS accounts targeting Chinese students applying to universities in the UK, US, Australia, and Canada. This platform centralises everything the team needs: scheduling posts, monitoring account growth, researching competitors, and collecting viral content for inspiration.

A background crawler service (running locally via macOS LaunchAgent) handles all data fetching automatically — team members simply use the web UI and results appear in real time.

### Features

**Account Management**
- Track multiple XHS accounts with follower counts, engagement stats, and team member assignments
- Per-account post history and performance overview

**Content Management & Calendar**
- Create and schedule posts with image uploads (stored in Supabase Storage)
- Kanban-style status workflow: Draft → Scheduled → Published
- Monthly calendar view with scheduling overview

**Material Library**
- **Viral posts** — save and annotate high-performing posts from XHS; crawler auto-fetches title, cover, full image carousel, caption, tags, and engagement metrics
- **Benchmark accounts** — track competitor profiles; crawler fetches account info + 10 most recent posts with full details
- **Topic bank** — curate content directions with reference links; crawler enriches with engagement data
- **Title bank & banned words** — shared reference lists for the writing team

**Analytics & Monitoring**
- Follower growth trend charts for own accounts and benchmark accounts (daily snapshots)
- Viral post rankings by likes / saves / comments
- Country and topic distribution breakdowns

### Architecture

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

### Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite (no router, no CSS framework) | Lightweight, fast iteration |
| Database | Supabase (Postgres) | Realtime subscriptions, built-in Storage |
| Crawler | MediaCrawler + Playwright | Handles XHS anti-bot measures |
| Scheduler | APScheduler | 12-hour full sync, 5-second job polling |
| Deployment | Vercel | Zero-config CI/CD from GitHub |
| Auto-start | macOS LaunchAgent | Crawler restarts on login, auto-recovers from crashes |

### Project Structure

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

### Design Decisions

**No authentication layer** — this is a closed internal tool shared with 4–8 known team members. Adding login would add friction without meaningful security benefit for this use case.

**Supabase as job queue** — XHS blocks direct API calls from non-Chinese IPs and from HTTPS pages calling HTTP endpoints. By having the frontend write `fetch_status = 'pending'` to Supabase and the local crawler poll for jobs, all XHS traffic originates from a local machine with valid session cookies, bypassing these restrictions entirely.

**Image re-hosting** — XHS CDN images use hotlink protection and HTTP-only URLs, both of which break when embedded in a Vercel-hosted page. The crawler downloads every image and re-uploads it to Supabase Storage, returning stable HTTPS public URLs.

**No TypeScript, no CSS framework** — the entire UI uses inline styles with a single `useIsMobile()` hook for responsive breakpoints. Chosen deliberately to keep the codebase approachable for future contributors without a frontend background.

---

## 中文

### 项目简介

小红书团队内部管理平台，供 4-8 名团队成员日常使用。团队运营多个面向海外留学申请群体（英美澳加）的小红书账号，本平台将内容排期、账号监控、竞品分析、素材管理整合在一个工具里，替代原有的表格协作方式。

爬虫服务以 macOS LaunchAgent 形式在本地后台常驻运行，团队成员只需在网页上操作，数据会通过 Supabase Realtime 自动同步到所有人的界面。

### 功能模块

**账号管理**
- 管理多个小红书账号，记录粉丝数、互动数据、负责人分配
- 查看每个账号的发帖历史和数据概览

**内容管理 & 内容日历**
- 创建帖子草稿，上传图片（存储于 Supabase Storage），设置发布时间
- 草稿 → 已排期 → 已发布 状态流转
- 月视图日历，直观查看排期全貌

**素材库**
- **爆款收藏** — 保存高互动帖子，爬虫自动抓取标题、封面、完整图片、正文、标签、互动数据
- **对标账号** — 跟踪竞品账号，自动获取账号信息及最近10条帖子完整内容
- **选题库** — 记录内容方向，可关联参考帖子，爬虫自动回填互动数据
- **标题库 & 违禁词** — 团队共用的写作参考库

**数据监控**
- 自有账号与对标账号粉丝增长趋势折线图（每日自动快照）
- 爆款帖子按点赞/收藏/评论排行
- 地区分布与标签分布分析

### 系统架构

```
Vercel（React 前端）
    │
    ├─ 读写 ──────────→ Supabase（Postgres + Storage + Realtime）
    │                           │
    └─ 写入 fetch_status         │ 每5秒轮询待处理任务
       = "pending"              │
                        macOS LaunchAgent
                        （MediaCrawler + Playwright）
                                │
                        爬取小红书数据，图片上传至
                        Supabase Storage，结果写回数据库
```

前端不直接请求小红书接口，而是将任务写入 Supabase 排队，本地爬虫轮询处理后将结果写回，前端通过 Realtime 订阅实时更新——所有人的界面同步刷新，无需手动刷新页面。

### 技术栈

| 层级 | 选型 | 原因 |
|------|------|------|
| 前端 | React + Vite（无路由库、无 CSS 框架） | 轻量，迭代快 |
| 数据库 | Supabase（Postgres） | Realtime 订阅、内置 Storage |
| 爬虫 | MediaCrawler + Playwright | 应对小红书反爬机制 |
| 定时任务 | APScheduler | 12小时全量同步，5秒轮询 |
| 部署 | Vercel | GitHub 自动 CI/CD |
| 自启动 | macOS LaunchAgent | 开机自动启动，崩溃自动重启 |

### 关键设计决策

**不做登录验证** — 纯内部工具，用户范围固定，加登录只会增加使用摩擦，不带来实质安全收益。

**Supabase 作为任务队列** — 小红书屏蔽境外 IP 的直接 API 请求，也不允许 HTTPS 页面调用 HTTP 接口。通过前端写 `pending` 状态、本地爬虫轮询处理的方式，所有小红书流量都来自持有有效 Cookie 的本地机器，完全绕过限制。

**图片重新托管** — 小红书 CDN 有防盗链机制且只支持 HTTP，直接嵌入 Vercel 页面会失效。爬虫将每张图片下载后上传至 Supabase Storage，返回稳定的 HTTPS 公开链接。

**纯 inline styles，无 CSS 框架** — 全局只用一个 `useIsMobile()` hook 处理响应式，降低非前端背景成员的上手门槛。

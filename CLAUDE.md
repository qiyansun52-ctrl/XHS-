# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

小红书团队内部管理平台，供 4-8 名非技术背景成员使用。团队运营若干个海外留学生人设账号（目标受众：准备申请英美澳加的中国学生）。核心功能：内容排期、账号数据监控、团队分工、素材管理。

## 常用命令

```bash
npm run dev       # 本地开发服务器（Vite，热更新）
npm run build     # 生产构建，输出到 dist/
npm run preview   # 预览构建产物
```

环境变量需在 `.env` 中配置：
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 架构概览

### 页面路由（无路由库）

`App.jsx` 通过 `useState("accounts")` 控制当前视图，四个页面：
- `"accounts"` → `AccountsPage`
- `"content"` → `ContentManager`
- `"calendar"` → `CalendarPage`
- `"material"` → `MaterialPage`

导航组件（桌面侧边栏 / 手机底部 tab 栏）直接调用 `setView`。

### 数据流

- **accounts / members**：由 `App.jsx` 从 Supabase 加载，通过 props 向下传递。accounts 完全由数据库驱动，无硬编码兜底。
- **posts**：各用到的页面自行加载（`ContentManager`、`AccountsPage`、`CalendarPage` 各自维护独立的 posts state）。
- **素材库数据**（`benchmark_accounts` / `topics` / `titles` / `banned_words`）：`MaterialPage` 内各 Tab 组件自行加载，互不共享。
- **Realtime**：`App.jsx` 订阅 `accounts` 表；各页面订阅自己关心的表（目前主要是 `posts`）。

### 组件层级

```
App.jsx
├── AccountsPage         账号列表 + 汇总统计 + 折线图
│   ├── AccountDetail    单账号详情（内嵌，非独立路由）
│   │   └── AddAccountModal  新增/编辑账号（同一个组件，account prop 控制模式）
│   └── AccountInfoModal 只读展示账号所有字段（除手机号/密码）
├── ContentManager       帖子网格（3:4卡片）+ 新建帖子弹窗
├── CalendarPage         月视图日历（桌面）/ 日期列表（手机）
├── MaterialPage         素材库，4个 Tab（对标账号/选题/标题/违禁词）
└── PostDetailDrawer     帖子详情抽屉（多页面复用）
```

`shared.jsx` 是唯一的共享层，导出：
- `useIsMobile()` — 断点 768px，所有响应式判断统一用这个
- `Avatar`, `Badge`, `StatPill`, `ChartTip` — UI 原子组件
- `STATUS`, `ROLE_LABELS`, `PRESET_COLORS`, `FLAG_OPTIONS` — 常量
- `fmt(n)`, `getWeekly(acc)` — 工具函数（`getWeekly` 当前用伪随机数模拟历史数据）

### 模态框 / 抽屉模式

- **弹窗**：桌面居中，手机底部 sheet（`alignItems: "flex-end"` + `borderRadius: "16px 16px 0 0"`）
- **底部安全区**：`paddingBottom: "calc(Xpx + env(safe-area-inset-bottom))"`
- **PostDetailDrawer**：桌面 480px 右侧固定，手机 92dvh 底部 sheet

### AddAccountModal 双模式

同一个组件处理新增和编辑：
- 传入 `account` prop → 编辑模式，预填表单，保存调用 `onUpdate`
- 不传 `account` → 新增模式，保存调用 `onAdd`

### 图片上传流程

1. `crypto.randomUUID()` 客户端生成 post ID
2. 上传到 Supabase Storage：`post-images/{post_id}/{filename}`
3. 获取 publicUrl 写入 `posts.images[]`
4. 最后 insert post 记录（避免先有鸡先有蛋问题）

## 设计规范

| 用途 | 色值 |
|------|------|
| 页面背景 | `#0a0a0a` |
| 侧边栏背景 | `#0e0e0e` |
| 卡片背景 | `#111` |
| 边框（默认） | `#1e1e1e` |
| 边框（表单） | `#2a2a2a` |
| 主色调 | `#FF2442`（小红书红）|
| 成功绿 | `#26DE81` |
| 警告橙 | `#FF9F43` |
| 文字主色 | `#e0e0e0` |
| 文字次要 | `#666` / `#555` |

字体：DM Sans，通过 `<link>` 在 `App.jsx` 内联引入 Google Fonts。

## 数据库（Supabase）

完整建表 SQL 见 `schema.sql`。所有表都需启用 RLS：

```sql
alter table [表名] enable row level security;
create policy "team_access" on [表名] for all using (true) with check (true);
```

### 核心表

| 表名 | PK 类型 | 说明 |
|------|---------|------|
| `accounts` | serial | 含 `phone`、`xhs_password` 敏感字段，UI 不展示 |
| `posts` | uuid | `scheduled_at` 存为 text（`"2025-04-07T10:30"` 格式） |
| `members` | uuid | 角色：`operator` / `owner` / `admin` |
| `account_assignments` | — | account_id → member_id 一对一 |
| `post_stats` / `post_comments` | uuid | 帖子互动数据，供爬虫写入 |
| `benchmark_accounts` | uuid | 素材库：对标账号 |
| `topics` | uuid | 素材库：选题方向，含 tag 字段 |
| `titles` | uuid | 素材库：标题灵感 |
| `banned_words` | uuid | 素材库：违禁词，word 字段唯一 |

Storage bucket：`post-images`（public）

## 爬虫（`crawler/`）

基于 MediaCrawler 的数据同步脚本，目前不影响前端功能：
- `import_stats.py` — 读取 MediaCrawler 导出 JSON，写入 `post_stats` 和 `account_stats_history`
- `run.sh` — 本地一键运行（需先配置 `config.py`）
- `.github/workflows/daily-crawl.yml` — GitHub Actions 每天北京时间 09:00 / 21:00 触发

## 重要约束

- **不用 TypeScript**，保持纯 JavaScript
- **不用 CSS 框架**，全部 inline styles
- **不用路由库**，`useState` 控制视图切换
- 错误提示必须用中文
- 修改时不要删除已有功能，只在现有基础上新增

# XHS 管理台 — Claude Code 上下文

## 项目简介

这是一个小红书团队内部管理平台，供 4-8 名非技术背景的团队成员使用。
团队运营 6 个小红书账号，账号定位是已完成本科海外留学、收到研究生 offer 的留学生人设，目标受众是准备申请英国、美国、澳大利亚、加拿大的中国学生。
平台核心目标：统一管理内容排期、监控账号流量数据、协调团队分工。

## 技术栈

- **前端**：React 18 + Vite + Recharts + Lucide React
- **数据库**：Supabase（PostgreSQL + Realtime + Storage）
- **部署**：Vercel（前端）
- **样式**：纯 CSS-in-JS（inline styles），无 CSS 框架
- **语言**：JavaScript（非 TypeScript）

## 项目结构

```
xhs-dashboard/
├── index.html
├── vite.config.js
├── package.json
├── .env                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── schema.sql                    # Supabase 建表 SQL
└── src/
    ├── main.jsx                  # React 入口
    ├── supabase.js               # Supabase client
    ├── App.jsx                   # 主应用（当前所有逻辑在此文件）
    └── components/               # 拆分后的组件目录
```

## 设计规范

### 颜色

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

### 6 个账号的固定颜色

```js
{ id: 1, name: "Emily_英国读研",  color: "#FF2442", flag: "🇬🇧" }
{ id: 2, name: "Sophia_伦敦日记", color: "#FF7A7A", flag: "🇬🇧" }
{ id: 3, name: "Chloe_澳洲留学", color: "#FF9F43", flag: "🇦🇺" }
{ id: 4, name: "Amy_加拿大UBC",  color: "#54A0FF", flag: "🇨🇦" }
{ id: 5, name: "Grace_美国读研", color: "#A29BFE", flag: "🇺🇸" }
{ id: 6, name: "Anna_申请顾问", color: "#00CFCF", flag: "🌏" }
```

### 字体

DM Sans（Google Fonts），通过 `<link>` 引入。

## 数据库（Supabase）

### 已建的表

```sql
-- 帖子内容
create table posts (
  id           uuid primary key default gen_random_uuid(),
  account_id   integer not null,
  title        text not null,
  caption      text,
  scheduled_at text,
  status       text default 'draft' check (status in ('draft', 'scheduled', 'published')),
  tags         text[],
  img_count    integer default 0,
  images       text[] default '{}',
  uploader_id  uuid references members(id),
  created_at   timestamp with time zone default now()
);
```

### accounts 表（动态账号，替代原硬编码 ACCOUNTS）

```sql
create table if not exists accounts (
  id serial primary key,
  name text not null,
  avatar text,
  flag text default '🌏',
  color text default '#FF2442',
  xhs_link text,
  phone text,           -- 敏感，不在 UI 中展示
  xhs_password text,    -- 敏感，不在 UI 中展示
  bio text,
  followers integer default 0,
  views bigint default 0,
  likes bigint default 0,
  saves bigint default 0,
  created_at timestamp with time zone default now()
);
alter table accounts enable row level security;
create policy "team_access" on accounts for all using (true) with check (true);

-- Seed 6 original accounts
insert into accounts (id, name, avatar, flag, color, followers, views, likes, saves) values
(1, 'Emily_英国读研',  'E', '🇬🇧', '#FF2442', 12400, 234000, 18900, 8900),
(2, 'Sophia_伦敦日记', 'S', '🇬🇧', '#FF7A7A', 8200,  156000, 12300, 5600),
(3, 'Chloe_澳洲留学', 'C', '🇦🇺', '#FF9F43', 15600, 312000, 24500, 11200),
(4, 'Amy_加拿大UBC',  'A', '🇨🇦', '#54A0FF', 6800,  98000,  7600,  3400),
(5, 'Grace_美国读研', 'G', '🇺🇸', '#A29BFE', 19200, 445000, 35800, 16700),
(6, 'Anna_申请顾问',  'A', '🌏',  '#00CFCF', 9400,  178000, 14200, 7800)
on conflict (id) do nothing;
select setval('accounts_id_seq', (select max(id) from accounts));
```

### 待建 / 已新增的表

```sql
-- 团队成员
create table members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text default 'operator' check (role in ('operator', 'owner', 'admin')),
  created_at timestamp with time zone default now()
);

-- 账号负责人分配
create table account_assignments (
  account_id integer not null,
  member_id  uuid references members(id),
  primary key (account_id)
);

-- 帖子数据（点赞/收藏/评论/浏览）
create table post_stats (
  post_id  uuid references posts(id) on delete cascade,
  likes    integer default 0,
  saves    integer default 0,
  comments integer default 0,
  views    integer default 0,
  primary key (post_id)
);

-- 评论
create table post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade,
  commenter  text,
  content    text,
  created_at timestamp with time zone default now()
);
```

### Storage

- Bucket 名：`post-images`（public）
- 上传路径格式：`{post_id}/{filename}`

## 当前已实现的功能

- 侧边栏导航（流量监控 / 内容管理）
- 流量监控页：6个账号总览卡片、账号详情卡、近7日折线图
- 内容管理页：帖子列表、草稿/排期/发布状态流转、新建帖子弹窗
- Supabase 实时同步（所有人操作立即同步）
- Vercel 部署

## 重要约束

- **不要使用 TypeScript**，保持纯 JavaScript
- **不要引入 CSS 框架**（Tailwind、MUI 等），用 inline styles
- **不要添加路由库**，用 `useState` 控制页面切换即可
- 图片存储用 Supabase Storage，bucket 名为 `post-images`
- 所有用户操作实时同步，用 Supabase Realtime channel
- 非技术用户使用，UI 要简单，**错误提示要中文**
- **修改代码时不要删除已有功能**，只在现有基础上新增

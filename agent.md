# Agent 任务说明

## 当前任务：功能大升级

在现有代码基础上新增以下功能模块，**不要删除或破坏已有功能**。

---

## 任务 1：图片上传 + 帖子卡片重设计

### 1a. Supabase Storage 配置
在 Supabase 创建一个 public bucket，名为 `post-images`。
上传路径格式：`{post_id}/{filename}`

### 1b. posts 表新增字段
```sql
alter table posts add column if not exists images text[] default '{}';
alter table posts add column if not exists uploader_id uuid references members(id);
```

### 1c. 新建帖子弹窗升级
- 新增图片上传区域，支持拖拽或点击上传，最多 9 张
- 上传中显示进度，上传完成显示缩略图预览
- 新增「上传人」下拉选择框（从 members 表读取）
- 图片上传到 Supabase Storage，URL 存入 posts.images 数组

### 1d. 帖子列表改为网格卡片布局
- 每行 3 列，卡片比例 3:4（小红书标准）
- 卡片内容：封面图（images[0]，无图时显示占位色块）、左下角账号头像+名字、右上角状态角标（草稿/待发布/已发布）、底部标题（最多2行，超出省略）
- 悬浮卡片显示预计发布时间
- 点击卡片打开详情抽屉（从右侧滑入）

---

## 任务 2：帖子详情抽屉

点击任意帖子卡片，从页面右侧滑入详情面板（宽度 480px），包含：

**顶部信息**
- 图片轮播（支持左右切换，显示 1/N）
- 账号头像 + 名字 + 发布状态

**帖子信息区**
- 标题
- 完整文案
- 话题标签列表
- 上传人姓名
- 预计发布时间
- 状态操作按钮（草稿→排期→发布）

**数据区**（仅 published 状态显示）
- 浏览 / 点赞 / 收藏 / 评论 四个数字
- 数据来自 post_stats 表

**评论区**（仅 published 状态显示）
- 评论列表，每条显示：评论人、内容、时间
- 数据来自 post_comments 表

---

## 任务 3：账号管理页

新增侧边栏导航项「账号管理」，页面包含：

**账号列表**（6张卡片，2列网格）
每张卡片显示：头像、账号名、国旗、粉丝数、负责人姓名（未分配显示「待分配」）

**账号详情页**（点击卡片进入）
- 顶部：账号头像、名字、国旗、负责人（可点击更换，从 members 表选择）
- 数据总览：粉丝/浏览/点赞/收藏
- 近7日趋势折线图
- 已发布帖子列表（小卡片，点击跳转帖子详情）
- 草稿/待发布帖子列表

---

## 任务 4：团队成员系统

### 4a. 注册页
新增侧边栏底部「+ 加入团队」入口，打开注册弹窗：
- 输入姓名
- 选择角色：运营 / 主理人 / 管理员
- 点击「加入」，写入 members 表
- 注册成功后姓名显示在侧边栏底部

### 4b. members 表
```sql
create table members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text default 'operator' check (role in ('operator', 'owner', 'admin')),
  created_at timestamp with time zone default now()
);

alter table members enable row level security;
create policy "team_access" on members for all using (true) with check (true);
```

### 4c. account_assignments 表
```sql
create table account_assignments (
  account_id integer not null,
  member_id  uuid references members(id),
  primary key (account_id)
);

alter table account_assignments enable row level security;
create policy "team_access" on account_assignments for all using (true) with check (true);
```

---

## 任务 5：完整新增 SQL

在 Supabase SQL Editor 执行以下完整 SQL：

```sql
-- members
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text default 'operator' check (role in ('operator', 'owner', 'admin')),
  created_at timestamp with time zone default now()
);
alter table members enable row level security;
create policy "team_access" on members for all using (true) with check (true);

-- account_assignments
create table if not exists account_assignments (
  account_id integer not null,
  member_id  uuid references members(id),
  primary key (account_id)
);
alter table account_assignments enable row level security;
create policy "team_access" on account_assignments for all using (true) with check (true);

-- post_stats
create table if not exists post_stats (
  post_id  uuid references posts(id) on delete cascade,
  likes    integer default 0,
  saves    integer default 0,
  comments integer default 0,
  views    integer default 0,
  primary key (post_id)
);
alter table post_stats enable row level security;
create policy "team_access" on post_stats for all using (true) with check (true);

-- post_comments
create table if not exists post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade,
  commenter  text,
  content    text,
  created_at timestamp with time zone default now()
);
alter table post_comments enable row level security;
create policy "team_access" on post_comments for all using (true) with check (true);

-- posts 新增字段
alter table posts add column if not exists images text[] default '{}';
alter table posts add column if not exists uploader_id uuid references members(id);
```

---

## 执行顺序

1. 先在 Supabase 执行任务 5 的 SQL
2. 在 Supabase Storage 创建 `post-images` bucket（设为 public）
3. 按任务 1 → 2 → 3 → 4 顺序修改代码
4. 每完成一个任务测试一次，确认不影响已有功能

## 输出要求

- 给出完整的 `App.jsx` 替换文件，不要只给片段
- 如果文件过长需要拆分，按功能拆成多个组件文件放在 `src/components/` 下
- 所有新增 Supabase 查询都要有 error handling，错误提示用中文
- 图片上传失败要有明确提示

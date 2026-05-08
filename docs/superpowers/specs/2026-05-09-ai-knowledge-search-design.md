# AI Knowledge Search Center Design

## Summary

Build a standalone AI Search Center for the XHS operations dashboard. The first version should behave like an "AI素材研究员": a question-answering research assistant that helps the team find useful materials and historical experience, supports optional image input, cites its sources, and lets users save a lightweight research note.

This is the first AI workflow in the product. It should optimize for trust, sourceability, and practical reuse rather than broad automation.

## Product Positioning

The current dashboard is a record and collaboration system for accounts, posts, schedules, analytics, and materials. The AI Search Center turns that stored knowledge into an answerable team memory.

The first version focuses on two jobs:

- Find materials: surface relevant viral posts, benchmark account posts, topics, title ideas, and useful references from the material library.
- Find experience: surface relevant historical team posts, titles, captions, tags, account positioning, and past content patterns.

"Find conclusions" and trend-analysis agents are intentionally separate future work. They depend on the material and experience layer, but should not be merged into this first version.

## Users And Use Cases

Primary users are non-technical content operators managing overseas-student-facing Xiaohongshu accounts.

Core questions the first version should answer:

- "帮我找适合英国留学申请焦虑方向的素材。"
- "我们过去写过哪些文书相关内容比较容易出收藏？"
- "结合这张图，帮我找相似参考，并给标题、内容、tag 建议。"
- "只参考团队历史内容，给我几个可以复用的标题结构。"

The assistant should feel like a research partner: concise enough for fast use, but grounded enough that users can inspect the evidence.

## Product Shape

Add a new top-level page named `AI 搜索中心`. It should sit beside the existing modules: account management, content management, calendar, material library, and analytics.

The page uses a mixed answer format:

- A primary question box accepts text and optional image upload.
- The answer starts with a short conclusion.
- The answer then expands into recommendations, citations, image analysis, and saved-note actions.
- Users can continue asking follow-up questions in the same context.

The page should not be a Material Library tab. It is a new product capability that can later grow into a broader content copilot.

## Agent Behavior

The first version should be a bounded question-answering agent, not an open-ended automation agent.

Recommended flow:

1. Receive the user's question and optional uploaded image.
2. Classify the request as material search, experience search, image-based reference search, or a mixed request.
3. If an image is present, run image understanding first and extract structured signals.
4. Retrieve relevant knowledge from the material library and team historical content.
5. Rank retrieved sources by relevance, source quality, performance, freshness, and whether the result comes from team history.
6. Generate a structured answer with source citations.
7. Let the user save the answer as a lightweight research note.

The assistant should be knowledge-first. If internal evidence is thin, it can add a small amount of general creative advice, but it must say that the internal knowledge base has limited matching evidence.

## Answer Structure

Every first-version answer should use a predictable structure:

- `简明结论`: 2-4 sentences answering the user's question directly.
- `推荐方向`: title directions, content angles, and tag suggestions.
- `参考素材`: cited material-library sources such as viral posts, benchmark posts, topics, and title ideas.
- `历史经验`: cited team-history sources such as previous posts, titles, captions, tags, and account context.
- `图片分析`: shown when the user uploads an image, including subject, scene, emotion, style, and suitable content directions.
- `保存结论`: a lightweight action that saves the current answer and citations.

The key product rule is strong citation. Important claims should point to one or more sources whenever possible.

## Knowledge Scope

First-version indexed sources:

- `viral_posts`: title, caption, cover image, images, likes, saves, comments, views, country, tags, source URL.
- `benchmark_accounts`: account name, bio, destination, content type, recent posts, follower count, fetch status.
- `topics`: description, tag, reference URL, reference metrics.
- `titles`: title text and any available metadata.
- `banned_words`: used for risk reminders, not as primary search results.
- `posts`: team historical posts, titles, captions, tags, scheduled/published status, images, account, uploader, and performance data if available.
- `accounts`: account name, avatar, country/flag, bio, color, and positioning context.

Documents such as SOPs, retrospectives, and operating notes are out of scope for this first version. They can become a second knowledge source later.

## Knowledge Index

Add a unified AI retrieval layer instead of making the frontend search every business table directly.

Recommended concept: `knowledge_items`.

Each indexed item should include:

- `id`
- `source_type`: `viral_post`, `benchmark_post`, `topic`, `title`, `team_post`, or similar.
- `source_id`
- `title`
- `content`
- `summary`
- `tags`
- `country`
- `account_id`
- `metrics`
- `image_urls`
- `embedding`
- `embed_status`
- `created_at`
- `updated_at`

The original business tables remain the source of truth. `knowledge_items` is an AI index that can be rebuilt.

## Retrieval Strategy

Use hybrid retrieval rather than vector search alone.

The retrieval layer should combine:

- Semantic search for fuzzy content intent such as "申请焦虑", "文书卡住", or "被拒复盘".
- Structured filters for country, account, source type, status, freshness, and performance.
- Source-aware ranking so strong team-history matches can appear alongside material-library results.

Recommended ranking priorities:

1. Query relevance.
2. Source quality and completeness.
3. Performance metrics such as likes, saves, comments, and views.
4. Freshness.
5. Team-history relevance.

The response should return both the final answer and the source objects needed to render citations.

## Image Workflow

First-version image support should use VLM-to-text analysis, not image vector search.

When a user uploads an image:

1. Upload the image to Supabase Storage.
2. Send the image URL to the AI API.
3. Ask the VLM to produce structured image signals:
   - subject
   - scene
   - mood
   - visual style
   - content direction
   - searchable keywords
4. Use those signals to retrieve related knowledge items.
5. Generate title, content, and tag suggestions grounded in the image analysis and retrieved references.

This keeps the first version useful without requiring a separate image embedding pipeline.

## Lightweight Note Saving

The first version should support saving the assistant's answer as a research note.

Recommended concept: `ai_research_notes`.

Each note should store:

- original user question
- uploaded image URL, if any
- short conclusion
- title suggestions
- content suggestions
- tag suggestions
- image analysis summary, if any
- citation list
- full answer payload
- created time
- creator/member id when available
- optional user note

Saved notes should not create official posts or update schedules. They are research artifacts that can be reused later.

## Technical Architecture

Use the existing stack:

- React + Vite frontend with inline styles.
- Supabase Postgres, Storage, and Realtime.
- Python crawler/AI service as the AI API layer.
- Existing pgvector direction for embeddings.

Recommended components:

- `AI Search Center` frontend page: question input, image upload, answer rendering, citations, note saving.
- `AI API` endpoint such as `POST /ai/research`: task understanding, image analysis, retrieval, generation, structured response.
- `knowledge_items` index table: unified retrieval surface.
- `ai_research_notes` table: saved answer records.
- index worker: keeps `knowledge_items` and embeddings in sync with source tables.

Suggested request flow:

1. User enters a question and optionally uploads an image.
2. Frontend uploads image to Supabase Storage when present.
3. Frontend calls `POST /ai/research`.
4. AI API analyzes the question and image.
5. AI API retrieves from `knowledge_items`.
6. AI API generates a structured answer with citations.
7. Frontend renders the result.
8. User can save the result to `ai_research_notes`.

## Error Handling

All user-facing errors should be in Chinese.

Expected states:

- AI service unavailable: "AI 服务暂时不可用，请稍后再试。"
- Knowledge index not ready: "知识库正在准备中，稍后再搜索。"
- Image analysis failed: continue with text-only retrieval and show "图片分析失败，已先基于文字问题回答。"
- Weak retrieval results: clearly state "内部资料匹配较少，以下建议包含少量通用创作建议。"
- Save failed: keep the answer visible and show "保存失败，请稍后重试。"

The UI should avoid losing a generated answer after a save or network error.

## Non-Goals For Version One

Do not include these in the first version:

- automatic official post creation
- automatic scheduling
- task assignment
- trend or conclusion agent
- document/SOP upload knowledge base
- image vector search
- broad open-ended chatbot behavior
- complex permissions
- multi-agent automation

## Success Criteria

The first version is successful if:

- Users can ask natural-language questions and get useful material and team-history references.
- Answers cite source records clearly enough for users to inspect the evidence.
- Uploaded images produce usable title, content, and tag suggestions.
- Weak internal evidence is acknowledged instead of hidden.
- Users can save a research note without creating formal content records.
- The feature fits the current dashboard style and does not disrupt existing material-library or content-management workflows.

## Future Extensions

Good next steps after the first version:

- turn saved research notes into reusable team knowledge
- add document knowledge sources such as SOPs and retrospectives
- add one-click conversion from research note to topic or title idea
- add content drafting after the research workflow proves useful
- add trend/conclusion agents as a separate analytics product
- add account-persona matching after the retrieval layer is stable

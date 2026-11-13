# 特性契约：点赞 / 收藏 + 品牌「树洞」手写字体

> 本文件是三个并行工作分支（api / web / brand）共同的唯一契约来源。
> 任何一方都不得单方面修改契约；如需变更，先改本文件并通知其他分支。

## 1. 目标

1. 每条树洞留言支持**点赞**与**收藏**，计数与状态由后端内存存储维护，刷新后保持。
2. 提供「只看收藏」筛选，支持快速找回收藏的留言。
3. 重新设计品牌标题「树洞」，风格参考手写马克笔书法（倾斜、粗笔画、花朵/藤蔓涂鸦、细波浪下划线、小写英文副标题）。

## 2. 后端契约（分支 `feat/interactions-api`）

### 2.1 Post 结构（新增 4 个字段）

```json
{
  "id": "2f1c9a4e-5b6d-4f80-9a11-7c3d2e5b8f01",
  "content": "今天把攒了很久的话写下来了。",
  "createdAt": 1731456000000,
  "channel": "shade",
  "likes": 3,
  "favorites": 1,
  "liked": false,
  "favorited": true
}
```

- `likes` / `favorites`：累计计数，非负整数；
- `liked` / `favorited`：**当前访客**是否已点赞 / 收藏（布尔）；
- 新建的帖子 `likes = 0`、`favorites = 0`、`liked = false`、`favorited = false`；
- 计数字段必须由服务端派生（Set 大小），不接受客户端传入。

### 2.2 访客标识

- 请求头 `X-Visitor-Id`，字符串；去首尾空白后长度 1–64 才有效；
- 缺失 / 空白 / 超长 → 归一到 `'anonymous'`；
- 同一个 `visitorId` 重复调用点赞接口表示**取消点赞**（toggle 语义，服务端幂等安全）。

### 2.3 接口

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/posts?channel=...` | 列表，含访客态 `liked/favorited` | 200 `{ posts }` | 400 `INVALID_CHANNEL` |
| GET | `/api/posts/:id` | 单条，含访客态 | 200 `{ post }` | 404 `NOT_FOUND` |
| POST | `/api/posts/:id/like` | 切换点赞状态 | 200 `{ post }` | 404 `NOT_FOUND` |
| POST | `/api/posts/:id/favorite` | 切换收藏状态 | 200 `{ post }` | 404 `NOT_FOUND` |

- 两个 toggle 接口均无请求体；响应为归一化后的完整 Post（已按请求头计算访客态）；
- 错误结构沿用 `{ error: { code, message } }`，`message` 为中文可读文案。

### 2.4 store 接口（`server/store.js`）

```js
createPostStore() → {
  list({ channel, visitorId } = {}),   // 返回含 liked/favorited 的 Post 数组
  get(id, visitorId),                  // 未命中 undefined
  create({ content, channel }),        // 返回含 0 计数的新 Post
  remove(id),                          // boolean
  toggleLike(id, visitorId),           // 命中返回 Post，未命中 undefined
  toggleFavorite(id, visitorId),       // 同上
  reset()
}
```

- 导出 `DEFAULT_VISITOR = 'anonymous'`、`normalizeVisitorId(value)`；
- 内部为每条目维护 `likedBy` / `favoritedBy` 两个 `Set`，`likes` / `favorites` 为 `Set.size`；
- `list/get/create/toggle*` 一律返回**深拷贝可写副本**，外部修改不得污染内部状态；
- `remove` 后对应访客集合一并丢弃（随条目 GC）。

### 2.5 后端测试要求

- 更新既有断言（`Object.keys(post)` 现在是 8 个字段；`toEqual` 需补 4 个字段）；
- 新增覆盖：点赞 toggle 两次回到原值、不同访客互不影响、缺失 `X-Visitor-Id` 归一到 `anonymous`、超长 visitorId 归一、404 分支、列表/详情按访客返回不同 `liked`、计数不为负。

## 3. 前端契约（分支 `feat/interactions-web`）

### 3.1 数据访问层 `src/api/posts.js`

- 新增 `toggleLike(id)` / `toggleFavorite(id)`：`POST /posts/:id/like|favorite`，成功返回 Post，失败抛 `ApiError`（复用 `ensureOk`）；
- 所有请求（`list` / `create` / `remove` / `toggle*`）都要带 `X-Visitor-Id` 头，取值来自 `src/utils/visitor.js` 的 `getVisitorId()`；
- `src/utils/visitor.js` 导出 `getVisitorId()`：模块内惰性生成一次（`crypto.randomUUID()`，不可用时退化为随机字符串），**不使用 localStorage / sessionStorage**。

### 3.2 store `src/stores/posts.js`

- `normalizePost` 补齐：`likes`/`favorites` 取非负整数（非法回退 0），`liked`/`favorited` 取布尔（非法回退 false）；
- state 新增 `favoritesOnly: false`；
- getters：
  - `visiblePosts`：先按 `activeChannel` 过滤，再在 `favoritesOnly` 为真时只保留 `post.favorited`；
  - `favoriteCount`：`posts` 中 `favorited` 为真的数量；
- actions：
  - `toggleLike(id)` / `toggleFavorite(id)`：乐观更新 → 请求失败回滚并写 `error`（中文文案），同一帖子请求进行中时忽略重复点击；
  - `setFavoritesOnly(value)` / `toggleFavoritesOnly()`。

### 3.3 组件

- **PostCard**（保持纯 props 组件，不依赖 store）：
  - 卡片底部新增操作区 `<div class="post__actions">`，内含两个 `<button type="button">`：
    - 点赞：`class="post__action post__action--like"`，激活加 `is-active`，`aria-pressed`，`aria-label="点赞"`，内部 `.post__action-icon`（内联 SVG 心形/叶形）+ `.post__action-count`；
    - 收藏：`class="post__action post__action--favorite"`，同结构，`aria-label="收藏"`；
  - 计数为 0 时也要渲染（显示 0），便于测试与无障碍朗读；
  - `defineEmits(['like', 'favorite'])`，点击分别 `emit('like', post.id)` / `emit('favorite', post.id)`；
  - 正文插值输出、换行保留等既有行为不得改变。
- **PostList**：
  - 顶部标题栏右侧新增收藏筛选按钮：`class="favorites-toggle"`，激活时加 `is-active`，`aria-pressed`，文案「只看收藏 · N」；
  - 把 `@like` / `@favorite` 接到 store 的对应 action；
  - 空状态文案区分「还没有收藏」与频道为空；
  - 样式写入新文件 `src/assets/interactions.css`，在 `PostList.vue` 的 `<script setup>` 顶部 `import '../assets/interactions.css'`。

### 3.4 前端测试要求

- `tests/helpers/fakeBackend.js` 扩展 like/favorite 路由与访客态；
- `tests/api/posts.spec.js`：新增 toggle 成功 / 404 / 网络错误、请求头带 `X-Visitor-Id`；
- `tests/stores/posts.spec.js`：乐观更新、失败回滚、重复点击防抖、收藏筛选、`favoriteCount`；
- `tests/components/PostCard.spec.js`：按钮渲染、aria、计数、点击 emit、激活样式；
- 新增 `tests/components/PostList.spec.js`：收藏筛选交互与空状态。

## 4. 品牌字体（分支 `feat/brand-wordmark`）

### 4.1 视觉目标

参考「春光与诗」手写标题：马克笔粗笔画、字身倾斜错落、笔画末端圆润；配手绘小花朵、细藤蔓/波浪下划线；下方一行小号英文副标题。整体配色沿用站点森绿系（墨色 `#2C4327` 左右，点缀 `--leaf-500`）。

### 4.2 实现要求

- 新增 `src/components/BrandWordmark.vue`：
  - 根节点 `[data-brand="wordmark"]`，内部 `h1` 文本仍为「树洞」两字（保证可访问性与 SEO），每字一个 `span.wordmark__char`；
  - 两字各自倾斜（约 -8deg / +5deg）、基线错落、字号不同（第二字略大），有轻微重叠；
  - 内联 SVG 涂鸦（`aria-hidden="true"`）：右上角五瓣小花、左侧小点、下方细波浪下划线、一条穿过字脚的细藤蔓；
  - 下方英文副标题（小号、字距放大、全小写）：`let the wind keep your words`；
  - 手写质感：字体栈 `'ZCOOL KuaiLe', 'Ma Shan Zheng', 'STXingkai', 'KaiTi', cursive`；同时用 SVG `feTurbulence` + `feDisplacementMap` 滤镜（scale ≈ 1.5）做轻微笔触抖动，注意 `prefers-reduced-motion` 下保持静态即可；
  - 响应式：375px 宽下不溢出、不换行成两块；`clamp()` 控制字号。
- 字体加载：优先**自托管子集字体**（可用 Google Fonts CSS 的 `text=树洞` 参数拿到极小 woff2，下载到 `src/assets/fonts/`，用 `@font-face` 引用）；若网络不可用，则退化为本地字体栈，且不得阻塞首屏渲染（异步 `media="print" onload` 或 `@font-face` + `font-display: swap`）。
- `src/components/SiteHero.vue`：用 `BrandWordmark` 替换原 `.hero__title` 巨型文字；保留徽标、副标题「把心事交给安静的风」、已收下声音条数；样式写入新文件 `src/assets/brand.css`，在 SiteHero 的 `<script setup>` 中 `import '../assets/brand.css'`（**不要改 `src/assets/styles.css`**，避免与其他分支冲突）。
- 新增 `tests/components/BrandWordmark.spec.js`：渲染两字、`data-brand`、装饰 SVG 为 `aria-hidden`、英文副标题存在。
- `index.html`：如使用远程字体则异步引入；同时更新 `meta description` 中过时的「只保存在你自己的浏览器里」表述（内容现在保存在服务端）。

## 5. 文件归属（避免合并冲突）

| 分支 | 只允许改动 |
| --- | --- |
| `feat/interactions-api` | `server/store.js`、`server/app.js`、`tests/server/*` |
| `feat/interactions-web` | `src/api/posts.js`、`src/utils/visitor.js`、`src/stores/posts.js`、`src/components/PostCard.vue`、`src/components/PostList.vue`、`src/assets/interactions.css`、`tests/api/*`、`tests/stores/posts.spec.js`、`tests/components/PostCard.spec.js`、`tests/components/PostList.spec.js`、`tests/helpers/fakeBackend.js` |
| `feat/brand-wordmark` | `src/components/BrandWordmark.vue`、`src/components/SiteHero.vue`、`src/assets/brand.css`、`src/assets/fonts/*`、`index.html`、`tests/components/BrandWordmark.spec.js` |

- 任何分支都**不要**改 `package.json`、`vite.config.js`、`vitest.config.js`、`src/App.vue`、`src/main.js`、`README.md`、`src/assets/styles.css`；
- 注释与文案统一使用中文，风格与现有代码一致（说明「为什么」，不复述代码）。

## 6. 质量门槛

- `npm run test` 全绿（在各自 worktree 内执行，依赖复用主仓 `node_modules`）；
- 组件测试挂载时必须提供 Pinia（`createTestingPinia` 或 `createPinia`）；
- 所有可点击控件都要有 `:focus-visible` 可见焦点样式；
- 不出现第三方社交平台名称。

# 树洞 · Tree Hole

> 把心事交给安静的风。

一个匿名心事发布小站。当前主版本为 **Node.js + Vue 3 + Pinia + Hono** 的全栈实现，以 **TDD** 方式构建，数据通过 **REST API** 保存在服务端**内存**中（不再使用浏览器 LocalStorage）；`legacy-static/` 保留了最初的纯静态版本。

页面与代码中不出现任何第三方社交平台名称，统一使用「树洞 / Tree Hole」。

---

## 功能

| 能力 | 说明 |
| --- | --- |
| 发布 | 多行输入 + 「投进树洞」按钮，空白内容不可提交，上限 300 字并实时计数（接近上限变橙红），支持 `Ctrl + Enter` 快捷发布，提交中按钮禁用防重复 |
| 频道 | 发布时选择投向「树荫 / 深夜 / 微风」，顶栏页签（全部 + 各频道）可切换过滤，卡片上展示频道徽标 |
| 浏览 | 时间线按发布先后**倒序**展示，每条包含匿名标识、正文（保留换行）与相对时间（刚刚 / x 分钟前 / x 小时前 / x 天前 / 具体日期） |
| 服务端持久化 | 内容提交到 Hono 服务写入内存，刷新或重新打开页面内容仍在 |
| 容错 | 后端不可用或返回异常时自动降级为空列表并给出柔和提示 + 「再试一次」，不会白屏；发布失败保留草稿 |
| 空状态 | 无内容时展示树影插画与引导文案；某频道暂无内容时提示切换频道 |
| 响应式 | 移动优先，桌面与手机（≤480px）自适应 |
| 快捷导航 | 滚动后浮现底部悬浮栏：回到洞顶 / 写一条（聚焦输入框）/ 关于 |

## 界面设计

- **品牌头部**：超大圆体「树洞」渐变字 + 手绘感下划线，副标题「把心事交给安静的风」，下方胶囊显示已收下的声音条数。
- **频道顶栏**：绿底白字 App 式页签，当前频道白色胶囊高亮，右侧实时显示当前频道条数。
- **发布卡片**：便签式浅绿输入区，聚焦时白底 + 绿色光晕；右下渐变胶囊按钮带纸飞机图标与扫光动效。
- **卡片流**：白色大圆角卡片、叶脉纹理头像、右上浅绿时间与频道胶囊，hover 轻微上浮。
- **氛围**：三层柔光色块缓慢漂移，漂浮叶片轻微摆动；动效均遵循 `prefers-reduced-motion`。

## 运行方式

```powershell
npm install        # 安装依赖（vue / pinia / hono / @hono/node-server）
npm run dev        # 一键启动 API(8787) + Vite(5173)，浏览器打开 http://localhost:5173
npm run test       # 运行全部测试（Vitest，前端 + 后端）
npm run build      # 构建前端产物到 dist/
npm run preview    # 预览构建产物（需自行把 /api 反代到后端）
```

也可以分开启动：

```powershell
npm run dev:api    # 仅 Hono API，默认 http://127.0.0.1:8787
npm run dev:web    # 仅前端 Vite（/api 已代理到 8787）
```

> `PORT` 可覆盖后端端口（如 `$env:PORT=9000; npm run dev:api`），此时需同步设置 `API_ORIGIN` 让 Vite 代理指向新端口。
> 旧静态版无需安装：直接双击 `legacy-static/index.html`。

## 目录结构

```
.
├── index.html                 # Vite 入口
├── package.json / vite.config.js / vitest.config.js
├── scripts/dev.mjs            # 一键并行启动 API 与 Vite（零额外依赖）
├── server/                    # 后端（Hono + 内存存储）
│   ├── app.js                 # 路由 / 校验 / 统一错误结构（可用 app.request 直接测）
│   ├── store.js               # 内存帖子仓库工厂（now / idFactory 可注入）
│   └── index.js               # 进程入口：读 PORT、serve、打印日志
├── src/
│   ├── main.js                # 创建应用，挂载 Pinia
│   ├── App.vue                # 布局骨架 + 首次加载数据
│   ├── api/posts.js           # 数据访问层（唯一与后端通信处，统一 ApiError）
│   ├── assets/styles.css      # 森绿主题样式（沿用旧版设计令牌）
│   ├── stores/
│   │   ├── posts.js           # 帖子状态：异步加载/发布、错误降级、频道过滤（Pinia）
│   │   └── toast.js           # 轻提示状态与自动隐藏
│   ├── components/
│   │   ├── SiteHero.vue       # 品牌头部
│   │   ├── ChannelBar.vue     # 频道页签
│   │   ├── Composer.vue       # 发布表单（字数 / 频道 / 快捷键 / 提交态）
│   │   ├── PostList.vue       # 时间线、错误提示与空状态
│   │   ├── PostCard.vue       # 单条留言卡片（纯 props 组件，不依赖 store）
│   │   ├── AppDock.vue        # 底部悬浮导航
│   │   └── AppToast.vue       # 轻提示
│   └── utils/time.js          # 相对时间纯函数
├── tests/                     # Vitest 测试（先于实现编写）
│   ├── setup.js               # 测试环境修复（jsdom 环境下 Web Storage 兼容）
│   ├── helpers/fakeBackend.js # 与 Hono 契约一致的 fetch 假后端
│   ├── server/                # 后端：store 单测 + app.request 接口测试（node 环境）
│   ├── api/                   # 数据访问层：成功 / 4xx / 5xx / 网络异常
│   ├── stores/                # posts / toast
│   └── components/            # Composer / ChannelBar / PostCard / App 集成
└── legacy-static/             # 旧版纯静态实现（保留存档）
```

## REST API

基础路径 `/api`，请求响应均为 JSON（204 除外），错误统一为 `{ "error": { "code": "...", "message": "..." } }`。

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 健康检查 | 200 `{ status: "ok" }` | — |
| GET | `/api/posts?channel=shade\|night\|breeze\|all` | 列表，`createdAt` 倒序；省略或 `all` 为全部 | 200 `{ posts: Post[] }` | 400 `INVALID_CHANNEL` |
| POST | `/api/posts` | 新建，body `{ content, channel? }`；服务端生成 `id`/`createdAt`，去首尾空白并截断 300 字 | 201 `{ post }` + `Location` | 400 `INVALID_CONTENT` / `INVALID_CHANNEL` / `INVALID_JSON` |
| GET | `/api/posts/:id` | 单条查询 | 200 `{ post }` | 404 `NOT_FOUND` |
| DELETE | `/api/posts/:id` | 删除 | 204 | 404 `NOT_FOUND` |

Post 结构：

```json
{
  "id": "2f1c9a4e-5b6d-4f80-9a11-7c3d2e5b8f01",
  "content": "今天把攒了很久的话写下来了。",
  "createdAt": 1731456000000,
  "channel": "shade"
}
```

`channel` 取值：`shade`（树荫）/ `night`（深夜）/ `breeze`（微风），缺省为 `shade`。

> **内存存储**：数据仅存活于后端进程内，重启 `npm run dev:api` 会清空；多实例之间不共享。替换为真实数据库时只需实现同样的 `createPostStore()` 接口。

## 架构与数据流

```
用户输入 → Composer（校验/计数/提交态）→ posts store.publish()
  → api.createPost() → fetch POST /api/posts → Hono app → store.create()
  → 返回 Post → unshift 到内存数组 → visiblePosts 重算 → PostList 重绘

首次进入 → App.vue store.load() → GET /api/posts（始终全量）→ 规范化 + 倒序 → 渲染
频道切换 → store.setChannel(id) → visiblePosts 前端过滤（不发请求，保证计数完整）
```

- **`src/api/posts.js`** 是唯一与后端通信的地方，`fetch` 可注入，便于测试；
- **posts store** 不直接触碰 `fetch`/存储细节，只处理状态与错误文案；
- **PostCard** 是纯 props 展示组件，正文用插值（纯文本）输出，天然防注入。

## TDD 实践说明

按「先写测试（红）→ 最小实现（绿）」推进，测试共 **10 个套件 / 113 个用例**：

| 层 | 测试内容 |
| --- | --- |
| `server/store` | 创建/查询/删除、倒序与同时间戳排序、`idFactory` 注入、`reset` |
| `server/app` | 健康检查、列表过滤、201 + Location、去空白/截断、400（内容/频道/JSON）、404、统一错误结构 |
| `api/posts` | 请求拼装、频道查询参数、`BAD_RESPONSE`、4xx/5xx 与网络异常统一为 `ApiError` |
| `stores/posts` | 异步加载与降级、脏数据剔除、发布插入头部、空白不发请求、失败不插假数据、防重复提交、频道过滤 |
| `stores/toast` | 显示/自动隐藏、连续 show 复用定时器、立即隐藏 |
| `components/Composer` | 按钮禁用态、实时计数、警示样式、提交请求并清空、失败保留草稿、提交中禁用、快捷键 |
| `components/ChannelBar` | 页签渲染与高亮、aria-selected、计数实时性 |
| `components/PostCard` | 纯文本插值防注入、换行保留、频道回退 |
| `components/App` | 集成：挂载即拉数据、计数联动、空频道文案、错误提示、重新挂载（模拟刷新）后数据仍在 |

> 环境备注：`tests/setup.js` 为 jsdom 注入内存版 Web Storage（兼容 Node 26 的实验性 `localStorage` 行为）；
> 后端测试通过 `// @vitest-environment node` 切换环境，用 `app.request()` 直接打接口、不监听端口。

## 作业要求对应

| 作业要求 | 实现情况 |
| --- | --- |
| 以 TDD 方式实现 | 测试先于实现编写（红 → 绿），Vitest + @vue/test-utils + jsdom，10 套件 / 113 用例 |
| 使用 Node.js + Vue 3 和 Pinia | Vite 工程，SFC 组件 + Pinia store |
| 用后端服务替换 LocalStorage | Hono REST API + 内存存储（`server/`），前端已无任何 `localStorage` 引用 |
| 不含第三方社交平台字样 | 全站使用「树洞 / Tree Hole」 |
| Git 版本管理并推送 GitHub | 全部提交已推送远程仓库 |

## 许可

仅用于课程练习。

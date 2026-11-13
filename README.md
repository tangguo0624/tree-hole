# 树洞 · Tree Hole

> 把心事交给安静的风。

一个匿名心事发布小站。本仓库包含两个版本：

- **Vue 版（当前主版本）**：Node.js + Vue 3 + Pinia + Vite，以 **TDD** 方式构建，数据仍使用浏览器 `LocalStorage` 持久化；
- **纯静态版（`legacy-static/`）**：最初的作业交付物，原生 HTML/CSS/JavaScript，双击即可运行，无任何构建与依赖。

页面与代码中不出现任何第三方社交平台名称，统一使用「树洞 / Tree Hole」。

---

## 功能

| 能力 | 说明 |
| --- | --- |
| 发布 | 多行输入 + 「投进树洞」按钮，空白内容不可提交，上限 300 字并实时计数（接近上限变橙红），支持 `Ctrl + Enter` 快捷发布 |
| 频道 | 发布时选择投向「树荫 / 深夜 / 微风」，顶栏页签（全部 + 各频道）可切换过滤，卡片上展示频道徽标 |
| 浏览 | 时间线按发布先后**倒序**展示，每条包含匿名标识、正文（保留换行）与相对时间（刚刚 / x 分钟前 / x 小时前 / x 天前 / 具体日期） |
| 本地持久化 | 数据写入浏览器 `LocalStorage`，刷新或重新打开页面内容仍在 |
| 容错 | 本地数据损坏或存储不可用时自动降级为空列表并给出柔和提示，不会白屏 |
| 空状态 | 无内容时展示树影插画与引导文案；某频道暂无内容时提示切换频道 |
| 响应式 | 移动优先，桌面与手机（≤480px）自适应 |
| 快捷导航 | 滚动后浮现底部悬浮栏：回到洞顶 / 写一条（聚焦输入框）/ 关于 |

## 界面设计

- **品牌头部**：超大圆体「树洞」渐变字 + 手绘感下划线，副标题「把心事交给安静的风」，下方胶囊显示已收下的声音条数。
- **频道顶栏**：绿底白字 App 式页签，当前频道白色胶囊高亮，右侧实时显示当前频道条数。
- **发布卡片**：便签式浅绿输入区，聚焦时白底 + 绿色光晕；右下渐变胶囊按钮带纸飞机图标与扫光动效。
- **卡片流**：白色大圆角卡片、叶脉纹理头像、右上浅绿时间与频道胶囊，hover 轻微上浮。
- **氛围**：三层柔光色块缓慢漂移，漂浮叶片轻微摆动；动效均遵循 `prefers-reduced-motion`。

## 运行方式（Vue 版）

```powershell
npm install        # 安装依赖
npm run dev        # 开发服务器（Vite）
npm run test       # 运行全部测试（Vitest）
npm run build      # 构建产物到 dist/
npm run preview    # 预览构建产物
```

旧静态版无需安装：直接双击 `legacy-static/index.html`。

## 目录结构

```
.
├── index.html                 # Vite 入口
├── package.json / vite.config.js / vitest.config.js
├── src/
│   ├── main.js                # 创建应用，挂载 Pinia
│   ├── App.vue                # 布局骨架：背景装饰 / 品牌 / 频道栏 / 发布区 / 时间线 / 页脚
│   ├── assets/styles.css      # 森绿主题样式（沿用旧版设计令牌）
│   ├── stores/
│   │   ├── posts.js           # 帖子状态：读取/校验/降级、发布、频道过滤（Pinia）
│   │   └── toast.js           # 轻提示状态与自动隐藏
│   ├── components/
│   │   ├── SiteHero.vue       # 品牌头部
│   │   ├── ChannelBar.vue     # 频道页签
│   │   ├── Composer.vue       # 发布表单（字数 / 频道 / 快捷键）
│   │   ├── PostList.vue       # 时间线与空状态
│   │   ├── PostCard.vue       # 单条留言卡片（纯 props 组件，不依赖 store）
│   │   ├── AppDock.vue        # 底部悬浮导航
│   │   └── AppToast.vue       # 轻提示
│   └── utils/time.js          # 相对时间纯函数
├── tests/                     # Vitest 测试（先于实现编写）
│   ├── setup.js               # 测试环境修复（Node 实验性 localStorage 遮蔽问题）
│   ├── utils/time.spec.js
│   ├── stores/posts.spec.js
│   ├── stores/toast.spec.js
│   └── components/*.spec.js   # Composer / ChannelBar / PostCard / App 集成
└── legacy-static/             # 旧版纯静态实现（保留存档）
```

## TDD 实践说明

按「先写测试（红）→ 最小实现（绿）」推进，测试共 7 个套件 / 45 个用例：

| 层 | 测试内容 |
| --- | --- |
| `utils/time` | 相对时间边界（刚刚 / 分钟 / 小时 / 天 / 日期）、补零 |
| `stores/posts` | 空数据、倒序、旧数据补 channel、损坏数据降级、脏数据剔除、发布校验/截断/去空白、存储失败标记 `storageBroken`、频道过滤 |
| `stores/toast` | 显示/自动隐藏、连续 show 复用定时器、立即隐藏 |
| `components/Composer` | 按钮禁用态、实时计数、警示样式、提交写入 store 并清空、频道切换 |
| `components/ChannelBar` | 页签渲染与高亮、aria-selected、计数实时性 |
| `components/PostCard` | 纯文本插值防注入、换行保留、频道回退 |
| `components/App` | 集成：发布渲染、计数联动、空频道文案、重新挂载模拟刷新的持久化 |

> 环境备注：Node 26 的实验性全局 `localStorage`（未启用文件时恒为 undefined）会遮蔽 jsdom 实现，
> `tests/setup.js` 注入内存版 Web Storage 解决，浏览器中不受影响。

## 架构与数据流

```
用户输入 → Composer（校验/计数）→ posts store.publish()
  → 内存数组 unshift → savePosts() 写 LocalStorage → visiblePosts 重算 → PostList 重绘
频道切换 → store.setChannel(id) → visiblePosts 过滤
```

- **posts store** 是唯一读写 `localStorage` 的地方；组件不直接触碰存储。
- **PostCard** 是纯 props 展示组件，正文用插值（纯文本）输出，天然防注入。
- 存储键 `treehole.posts.v1`，值结构：

```json
[
  {
    "id": "2f1c9a4e-5b6d-4f80-9a11-7c3d2e5b8f01",
    "content": "今天把攒了很久的话写下来了。",
    "createdAt": 1731456000000,
    "channel": "shade"
  }
]
```

`channel` 取值：`shade`（树荫）/ `night`（深夜）/ `breeze`（微风），缺省视为 `shade`；旧数据读取时自动补全。

## 作业要求对应

| 作业要求 | 实现情况 |
| --- | --- |
| 以 TDD 方式实现 | 测试先于实现编写（红 → 绿），Vitest + @vue/test-utils + jsdom，45 个用例 |
| 使用 Node.js + Vue 3 和 Pinia | Vite 工程，SFC 组件 + Pinia store |
| 使用 Local Storage 实现数据存储 | `treehole.posts.v1` 键，含校验与异常降级 |
| 不含第三方社交平台字样 | 全站使用「树洞 / Tree Hole」 |
| Git 版本管理并推送 GitHub | 全部提交已推送远程仓库 |

## 许可

仅用于课程练习。

# 部署到自己的二级域名（Vercel）

本项目是纯静态 SPA + hash 路由，仓库已有现成 `vercel.json`（安全响应头齐全），走 Vercel 最省事。

## 为什么 Vercel 适合
- 已有 `vercel.json`，安全头（CSP 等）开箱即用。
- hash 路由无需服务端 rewrite，零配置即可托管。
- 绑定二级域名后自动签发 HTTPS。

## 步骤

### 1. 导入项目
Vercel Dashboard -> Add New Project -> Import 你 fork 的仓库。
- Framework Preset：**Vite**
- Build Command：`pnpm build`
- Output Directory：`dist`
- Install Command：`pnpm install`（Vercel 会自动识别 pnpm-lock.yaml）

### 2. 绑定二级域名
Project -> Settings -> Domains -> 添加 `type.你的域名`。
在你域名的 DNS 服务商加一条记录（Vercel 会给出具体目标值）：

```
类型   名称    值
CNAME  type    cname.vercel-dns.com   (以 Vercel 面板显示为准)
```

保存后等待生效，HTTPS 证书自动签发。

### 3. `/api/stats`（站点访问统计）的取舍
`functions/api/stats.ts` 是 **Cloudflare Pages 边缘函数**，Vercel 上跑不了。两个选择：

- **第一版（推荐）**：隐藏站点统计入口即可——去掉 `src/ui/SiteStats.tsx` 的路由/入口引用。
  `functions/` 目录留着不影响 Vite 构建。练习功能完全不受影响。
- **可选后续**：移植为 Vercel Function `api/stats.ts`：
  - handler 改为 `export default function handler(req, res)`（或 Edge Function 的 `export default (req) => Response`）
  - 缓存从 CF 的 `caches.default` 改用响应头 `Cache-Control: s-maxage=600`
  - 环境变量（CF_API_TOKEN 等）在 Vercel 项目 Settings -> Environment Variables 配置

### 4. CI 处理
- 你 fork 后没有 Cloudflare 的 secret，现有 `.github/workflows/ci.yml` 里的 `deploy` job 不会触发，可不管。
- 推荐：用 **Vercel 的 Git 集成自动部署**（push 即部署 Preview / Production），
  GitHub Actions 只保留 `check`（typecheck·lint·test·build）作为质量门禁。
- 如需彻底切换，可删掉 ci.yml 里的 `deploy` job（保留 `check` / `coverage`）。

## 验证
- Vercel 给的 Preview 链接可访问。
- 绑定后 `https://type.<你的域名>` 正常打开。
- hash 路由各页可直达（如 `.../#/stats`、`.../#/settings`）。
- 浏览器 DevTools -> Network -> 文档响应头里能看到 CSP 等安全头生效。

## 备选：自托管在你自己的服务器
若不想用 Vercel，`pnpm build` 出 `dist/` 后用 Nginx / Caddy 托管即可（hash 路由无需 SPA fallback，
但建议仍配 `try_files ... /index.html`）。把 `public/_headers` 里的安全头翻译进服务器配置。
同样地，`/api/stats` 需另行实现或去掉。

---

## 仓库侧已完成（本次改动）
- 已删除 `.github/workflows/ci.yml` 的 Cloudflare `deploy` job；CI 现在只做质量门禁（typecheck·lint·test·build·coverage）。部署交给 Vercel 的 Git 集成。
- 已隐藏 About 页的 “Site stats” 入口卡片（`/api/stats` 是 CF Pages 函数，Vercel 上不可用；直接访问该路由会显示友好降级提示，不会崩）。
- `vercel.json`（安全响应头）保持不变，开箱可用。

## 只能你本人完成的步骤（需要你的 Vercel 账号 + 域名 DNS）
1. 登录 vercel.com → Add New Project → Import 你 fork 的仓库（Framework=Vite，Build=`pnpm build`，Output=`dist`）。
2. Settings → Domains 添加 `type.你的域名`；按 Vercel 给的目标在你的 DNS 加一条 CNAME；等待签发 HTTPS。
3. push 到 main 即自动部署。
（我无法代做：本会话里连接的 Vercel 账号不可用（get_auth_user 返回 not_found），且二级域名 DNS 在你处。）

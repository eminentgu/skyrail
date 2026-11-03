**[Skyrail](../README.zh-CN.md) / [文档中心](README.zh-CN.md)**

# 文档网站维护

[English](DOCUMENTATION.md)

公开文档由仓库 Markdown 和明确的页面清单生成。静态网站增加产品首页、双语导航、本地搜索、页内目录、主题切换与图片放大，不包含产品运行数据。

## 本地预览

```sh
npm ci
npm run docs:build
npm run docs:preview
```

打开命令输出的 loopback 地址，通常为 `http://127.0.0.1:4319/skyrail/`。预览使用与 GitHub 项目站点相同的 `/skyrail/` 路径。构建其他站点时，以 `SITE_URL` 设置包含完整路径的规范地址。

## 单一来源，两种阅读方式

用户内容在成对中英文 Markdown 中维护。`website/catalog.mjs` 定义发布页面、标题和导航分组，`website/copy.mjs` 保存首页与网站界面翻译。`website/site.css` 和 `website/site.js` 提供静态阅读体验。

构建器把 Markdown 文档链接改写为网站路由，代码等非文档链接仍指向 GitHub。尚无翻译的技术记录明确标为原始语言，保留全部历史文本。生成目录为 `docs-dist/`，不提交到 Git。

## 图片维护

公开配图放在 `docs/assets/`。使用空白工作区实拍或虚构测试数据，不拍私人对话与个人桌面。测试截图标明“示例数据”，提供有意义的替代文字，中英文同步，SVG 保留标题与说明。

图解覆盖安装、权限、远程连接、控制权交接与手机手势。插图用于解释产品，不代表系统操作已经通过验收。参见[素材说明](assets/README.md)。

## GitHub Pages

仓库“Settings → Pages → Source”选择“GitHub Actions”。Pages 工作流在 PR 中构建和检查文档，只有推送到 `main` 或从 `main` 显式手动运行才部署到 `github-pages` 环境。

部署产物仅包含静态输出，采用 GitHub Pages artifact 与 deploy actions，部署权限仅授予对应 job。现有 main 必需检查继续生效，CI 也会构建并验证文档。

不要选择“Deploy from a branch → main / (root)”：仓库根目录的 `index.html` 是 Vite 开发入口，直接发布会导致 `/apps/client/src/main.tsx` 返回 404。切换 Source 后，在“Actions → Documentation → Run workflow”选择 `main` 重新部署。

自定义域名在 Pages 设置中配置。工作流从 Pages 读取实际站点 URL，再生成资源路径、canonical 和 sitemap，因此同时支持项目路径和自定义域名根路径。

## 发布前验证

```sh
npm run docs:check
npm test
npm run build
```

文档检查在临时目录构建，验证内部路由与资源、中英文配对、搜索数据、元信息，并确认不包含本地运行数据。浏览器验收覆盖明暗主题、手机宽度、语言切换、搜索、代码复制、导航和图片放大。

网站输出 canonical / alternate 链接、Open Graph 信息、sitemap、robots 和 `llms.txt`，用于提供检索上下文，不承诺搜索或 AI 收录结果。

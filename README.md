# CA Docs

ConnectionAgent（`ca-*`）生态的公开文档门户。默认中文，同时提供英文页面。

- 中文站：<https://odango-chan.github.io/ca-docs/>
- English: <https://odango-chan.github.io/ca-docs/en/>

CA Docs 是一个**跨仓视图**，不是第二份机器契约事实源。OpenAPI、JSON Schema 与实现仍由各组件所属仓库维护；本仓负责把这些信息提取、校验并组织成易读的能力与 API 文档。

## 当前接入

### ca-5gc-sim

确定性 5GC 参考模拟器。

站点从 private `odango-chan/ca-5gc-sim` 的权威 Schema 与 HTTP 实现中提取：

- Fact semantic 清单
- Operation semantic 清单
- OpenAPI 路由
- Server 实际注册路由
- OpenAPI / 实现漂移

公开站只发布文档需要的派生信息，不复制 private 源码内容。

## 数据同步

GitHub Pages 构建通过仓库 Secret `CA_DOCS_SOURCE_TOKEN` 读取 private `ca-5gc-sim`。

建议使用 Fine-grained personal access token：

- Repository access：仅 `odango-chan/ca-5gc-sim`
- Repository permissions：`Contents: Read-only`
- Secret 名：`CA_DOCS_SOURCE_TOKEN`

同步成功时，构建产物标记为 **Live upstream**；token 不可用或上游读取失败时，会回退到仓库中已验证的 snapshot，并在页面上明确显示 **Fallback snapshot**。上游同步失败不会阻断公开站部署。

## 本地开发

```bash
npm install
npm run dev
```

没有 `CA_DOCS_SOURCE_TOKEN` 时，本地开发使用 checked-in snapshot。

如需直接刷新 private 上游：

```bash
CA_DOCS_SOURCE_TOKEN=... npm run dev
```

## 构建

```bash
npm run build
```

静态输出位于 `dist/`。

## Source-of-truth 原则

- OpenAPI / JSON Schema / 实现事实保留在能力所属仓库。
- CA Docs 在构建时派生 semantic 与 route inventory。
- 手写文档只解释意图、职责边界与使用方式，不重新定义 wire contract。
- 当实现与发布契约发生漂移时，门户展示差异，而不是自动隐藏差异。

## 部署

`.github/workflows/pages.yml` 在以下场景构建并部署 GitHub Pages：

- push 到 `main`
- 手动 `workflow_dispatch`
- 每 6 小时定时刷新

中文位于根路径，英文位于 `/en/`，两种语言共享同一份机器生成能力数据。

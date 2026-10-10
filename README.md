# CA Docs

ConnectionAgent（`ca-*`）生态的公开文档门户。默认中文，同时提供英文页面。

- 中文站：<https://odango-chan.github.io/ca-docs/>
- English: <https://odango-chan.github.io/ca-docs/en/>

CA Docs 是一个**跨仓视图**，不是第二份机器契约事实源。OpenAPI、JSON Schema 与实现仍由各组件所属仓库维护；本仓只发布文档需要的安全派生信息。

## 当前接入

### ca-5gc-sim

确定性 5GC 参考模拟器。目前从 private `odango-chan/ca-5gc-sim` 提取：

- Fact semantic 清单
- Operation semantic 清单
- OpenAPI 路由
- Server 实际注册路由
- OpenAPI / 实现漂移
- 对应上游 commit

公开仓不会复制 private 源码正文。

## 同步与发布模型

private token 只用于独立的 **Sync Upstream Contracts** workflow，不再交给 GitHub Pages 构建任务。

```text
private ca-5gc-sim
        │  CA_DOCS_SOURCE_TOKEN (Contents: Read-only)
        ▼
Sync Upstream Contracts
        │
        ├─ 提取 / 校验安全派生数据
        ▼
data/generated/ca-5gc-sim.json
        │  提交到 public ca-docs
        ▼
Deploy CA Docs
        │  不需要 private token
        ▼
GitHub Pages
```

同步 workflow 每 6 小时运行一次。只有派生 snapshot 发生变化时才提交；该提交会自动触发 Pages 部署。

这样可以保证：

- Pages 构建不接触 private token。
- public 仓始终保留最近一次成功同步的数据，可复现构建。
- private 上游暂时不可用时，站点仍可从已发布 snapshot 正常构建。
- 上游变化在 public snapshot 中有明确 commit 轨迹。

## Token

仓库 Secret：`CA_DOCS_SOURCE_TOKEN`

推荐 Fine-grained personal access token：

- Repository access：仅 `odango-chan/ca-5gc-sim`
- Repository permissions：`Contents: Read-only`

## 本地开发

```bash
npm install
npm run dev
```

没有 token 时使用 checked-in published snapshot。

需要直接刷新 private 上游时：

```bash
CA_DOCS_SOURCE_TOKEN=... npm run dev
```

严格同步（上游读取失败即失败，不允许 fallback）：

```bash
CA_DOCS_SOURCE_TOKEN=... CA_DOCS_SYNC_STRICT=1 npm run sync
```

## Source-of-truth 原则

- OpenAPI / JSON Schema / 实现事实保留在能力所属仓库。
- CA Docs 只保存面向文档的安全派生 snapshot。
- 手写内容解释意图、职责边界与使用方式，不重新定义 wire contract。
- 实现与发布契约发生漂移时，门户展示差异，而不是自动隐藏差异。

## 部署

- `.github/workflows/sync-upstream.yml`：每 6 小时或手动同步 private 上游，并在 snapshot 变化时提交。
- `.github/workflows/pages.yml`：push 到 `main` 或手动触发时，仅从 public snapshot 构建并部署 Pages。

中文位于根路径，英文位于 `/en/`，两种语言共享同一份机器生成能力数据。

# Sandbox Docs 公开文档契约

Sandbox Docs 是跨仓文档入口，不是机器契约或实现的第二份事实源。每个 owner 仓决定哪些内容适合公开，并通过 `docs/public-docs.yaml` 明确声明；门户只读取声明的文件，生成带来源版本的公开快照。

## 1. 组件注册表

过渡期注册表位于 `data/components.yaml`。它决定来源仓、公开站使用的组件 ID、显示名称和同步方式。

```yaml
- id: env-fabric
  repository: odango-chan/env-fabric
  status: active
  sync: manifest
  manifest: docs/public-docs.yaml
  title:
    zh: env-fabric 网络边界中介
    en: env-fabric network boundary mediation
```

`id` 是站点路由标识；`repository` 是内容的 owner 仓。两者可以不同，但必须在注册表中明确记录。只有 `status: active` 的组件会参与同步；manifest 驱动的组件使用 `sync: manifest`。

## 2. Owner manifest

每个来源仓的 `docs/public-docs.yaml` 采用 `PublicDocsManifest` 契约：

```yaml
apiVersion: connectionagent.io/v1alpha1
kind: PublicDocsManifest
component: env-fabric
title:
  zh: env-fabric 网络边界中介
  en: env-fabric network boundary mediation
sources:
  - kind: openapi
    path: schemas/v1alpha1/service-fabric.openapi.yaml
    role: business-api
    publish: [metadata, operations, fields]
  - kind: json-schema
    path: schemas/v1alpha1/network-observation-result.schema.yaml
    role: network-observation-result
    publish: [metadata, fields]
  - kind: markdown
    path: docs/public/overview.zh-CN.md
    role: overview
    language: zh
    publish: [metadata, body]
```

机器约束位于 `schemas/v1alpha1/public-docs-manifest.schema.yaml`。Manifest 中每个来源都必须显式声明 `publish`；缺省不表示“全部公开”。

## 3. 支持的来源类型

### OpenAPI

可派生 API 标题与说明、Method / Path、operationId、请求/响应契约摘要，以及显式允许发布的示例。门户不应自行补写未在 OpenAPI 中声明的请求字段。

### JSON Schema

可派生稳定的数据结构、字段类型、必填约束、枚举和固定值。具体展示以 manifest 的 `publish` 白名单为准。

### Markdown

用于 owner 明确维护、适合外部读者阅读的长文档。建议放在 `docs/public/`，并为中英文页面分别声明来源：

```yaml
- kind: markdown
  path: docs/public/overview.zh-CN.md
  role: overview
  language: zh
  publish: [metadata, body]
- kind: markdown
  path: docs/public/overview.en.md
  role: overview-en
  language: en
  publish: [metadata, body]
```

Markdown 正文会显示在对应语言的组件页面中。正文开头的一级标题作为该文档的显示标题，其余内容按长文档样式排版。相对链接和图片按来源文件所在目录及固定的来源 commit 解析；发布页保留来源仓、commit 和文件路径，便于追溯。

**发布审查是 owner 的责任。** `publish: [metadata, body]` 会把完整 Markdown 正文复制到 public 快照，随后任何人都可以读取。发布前必须确认正文、代码块、示例、图片及链接不含密钥、个人数据或不适合公开的内部信息。

门户会转义原始 HTML，并阻止不安全的链接协议；这不能代替 owner 对发布内容的审查。

### Implementation check

仅用于检查声明与实现之间的关系。门户可发布实现检查的派生摘要，例如某个已声明源码文件在固定 commit 中存在；不得将 private 源码正文发布到快照。

允许的 `publish` 值只有 `metadata` 和 `implementation-summary`。

## 4. Publish 白名单

| 值 | 可发布内容 |
| --- | --- |
| `metadata` | 标题、版本、来源路径等元信息 |
| `operations` | API Method / Path / operationId 等接口清单 |
| `fields` | 请求/响应或 Schema 字段摘要 |
| `enums` | 显式允许公开的枚举和固定值 |
| `examples` | owner 明确允许公开的示例 |
| `body` | owner 明确允许公开的 Markdown 正文 |
| `implementation-summary` | 实现检查的派生结果，不含源码正文 |

未知来源类型、越界路径、非法 manifest 或不允许的 publish 组合必须使同步失败。

## 5. 同步、版本与失败处理

同步流程：

```text
owner repository
  -> resolve branch/tag to immutable commit
  -> read docs/public-docs.yaml at that commit
  -> validate manifest and read only declared paths
  -> generate sanitized snapshot with source provenance
  -> commit snapshot to ca-docs
  -> build and deploy static pages from committed snapshots
```

Manifest 和所有来源文件必须读取自同一个不可变 commit，避免快照内容与记录的来源版本不一致。同步失败时严格模式必须失败；不能把旧快照标成最新。Pages 构建只读取已提交的 public snapshot，不接触 private token。

## 6. 权限

`CA_DOCS_SOURCE_TOKEN` 只用于同步 workflow。它只需要对已接入的 private 来源仓有 `Contents: Read-only` 权限，不应授予写权限，也不应传给 GitHub Pages 构建任务。

当前接入来源包括 `sandbox`、`ca-benchmarks`、`ca-benchmark-engine`、`env-fabric`、`tool-common` 和 `env-5gc-sim`。新增 private 来源前，应先把仓库加入 token 的 Repository access，再将其设为 active。

## 7. 页面模型

manifest 声明的来源类型决定组件页面的内容：

- OpenAPI 来源提供 API 操作清单；
- JSON Schema 来源提供数据契约；
- Markdown 来源提供 owner 维护的长文档；
- implementation-check 来源提供有限的派生摘要。

门户不自动搬运整个 `docs/`，不公开源码正文，不创建第二份机器契约，也不要求所有组件使用同一种页面结构。

# CA 公开文档契约

CA Docs 不应该知道每个 private 仓库的内部目录细节，更不应该为每个仓库写一套完全不同的同步逻辑。

目标是让每个 `ca-*` 组件明确声明：**哪些信息可以公开、这些信息从哪里来、CA Docs 应该怎么展示。**

## 组件清单

当前公共站先在 `data/components.yaml` 维护组件注册表。

每个组件至少有：

```yaml
id: ca-runtime
repository: odango-chan/ca-runtime
status: planned | active
title:
  zh: Runtime
  en: Runtime
```

接入后再声明 `docs`。

## 支持的来源类型

### openapi

用于有 HTTP API 的组件。

```yaml
- kind: openapi
  source: schemas/v1alpha1/runtime.openapi.yaml
```

CA Docs 可以从中生成：

- Method / Path
- operationId
- 请求体字段摘要
- 响应码
- 公开示例
- OpenAPI 与实现差异

### json-schema

用于稳定的数据契约、枚举和结构。

```yaml
- kind: json-schema
  source: schemas/v1alpha1/capability-contract.schema.yaml
  role: capability-contract
```

常见用途：

- Capability / ProviderBinding
- Observation
- Run Record / Run Event
- Fact / Operation semantic
- 配置对象

### markdown

用于组件自己维护、适合直接公开的说明。

```yaml
- kind: markdown
  source: docs/public/overview.md
  role: overview
```

只允许组件明确标记为 public 的文档进入公开站。CA Docs 不应自动把整个 `docs/` 目录搬出来。

### implementation-check

只用于做实现与声明的对照，不用于公开源码。

例如：

```yaml
- kind: implementation-check
  source: internal/httpapi/server.go
  role: http-route-registration
```

CA Docs 可以发布“实现了哪些路由 / 是否与 OpenAPI 一致”这类派生结果，但不复制 private 源码正文。

## 推荐：组件仓库自己提供 public-docs.yaml

`data/components.yaml` 是当前过渡方案。

后续每个组件建议在自己的仓库提供：

```text
docs/public-docs.yaml
```

例如：

```yaml
apiVersion: connectionagent.io/v1alpha1
kind: PublicDocsManifest

component: ca-service-fabric

sources:
  - kind: openapi
    path: schemas/v1alpha1/service-fabric.openapi.yaml

  - kind: json-schema
    path: schemas/v1alpha1/network-observation-query.schema.yaml
    role: network-observation

  - kind: json-schema
    path: schemas/v1alpha1/boundary-fault-receipt.schema.yaml
    role: boundary-fault

  - kind: markdown
    path: docs/public/overview.md
    role: overview
```

这样“什么能公开”由源仓库自己决定，CA Docs 只消费 manifest。

## 不做什么

- 不自动公开 private 仓库的全部 `docs/`。
- 不把源码正文复制到 public 仓。
- 不让 CA Docs 成为第二份机器契约。
- 不要求所有组件都必须提供 OpenAPI。
- 不把 Runtime、Provider、Fabric、MCP 强行塞成同一种页面结构。

## 页面模型

公共站最终按组件展示：

```text
组件
├─ Overview
├─ APIs           # 有 OpenAPI 时
├─ Contracts      # JSON Schema / 稳定数据结构
├─ Capabilities   # 适用时
├─ Examples       # 明确允许公开的示例
└─ Boundaries     # 组件职责与跨仓关系
```

具体栏目由 manifest 的 source 类型决定。

## Token

当更多 private 仓接入同步后，`CA_DOCS_SOURCE_TOKEN` 需要对这些仓库至少有：

```text
Contents: Read-only
```

只需要读取被 manifest 明确声明的文件。

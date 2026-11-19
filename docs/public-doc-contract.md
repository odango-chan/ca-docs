# CA Docs 公共发布契约

CA Docs 是跨仓文档与契约发布门户，不是机器契约或实现的第二份事实源。每个 Owner 仓决定哪些内容适合公开，并通过 `docs/public-docs.yaml` 明确声明；门户只读取声明的来源，生成带不可变来源版本的公开快照。

## 1. 唯一支持的 Manifest

所有已接入 Owner 必须使用 `PublicDocsManifest v1alpha2`：

```yaml
apiVersion: connectionagent.io/v1alpha2
kind: PublicDocsManifest
component: env-fabric
title:
  zh: env-fabric 网络边界中介
  en: env-fabric network boundary mediation
sources:
  - kind: openapi
    path: schemas/v1alpha2/service-fabric.openapi.yaml
    role: business-api
    publish: [metadata, operations, fields, raw]
  - kind: json-schema
    path: schemas/v1alpha2/network-observation-result.schema.yaml
    role: network-observation-result
    publish: [metadata, fields]
  - kind: markdown
    path: docs/public/overview.zh-CN.md
    role: overview
    language: zh
    publish: [metadata, body]
releases: []
```

机器约束位于 `schemas/v1alpha2/public-docs-manifest.schema.yaml`。

CA Docs 2.0 是一次不兼容升级：只接受 `connectionagent.io/v1alpha2`，不实现 v1alpha1 parser、双格式分支、旧格式 fallback 或旧快照迁移。Owner 必须在启用新同步管线前完成迁移。这里的 Manifest 版本不影响 Owner 自己发布的 Contract Version；例如 IngressCatalog v1alpha1 仍是有效的独立契约版本。

`component` 必须匹配站点注册表中的组件 ID；若源仓名称不同，注册表可显式声明 `sourceIdentity`。站点路由 ID 和源仓契约身份不能靠猜测互相转换。

## 2. 两类发布内容

### Living Documentation

`sources` 用于持续更新的架构说明、指南、OpenAPI 摘要、Schema 摘要和实现检查。

- 每个来源必须声明 kind、path、role 和 publish 白名单；
- 同一轮同步的 manifest 和 sources 都读取自同一个固定 commit；
- OpenAPI / JSON Schema 原文只有在显式声明 `publish: [raw]` 时才复制到公开站点；
- Markdown 正文只有在显式声明 `publish: [body]` 时才复制；
- 实现检查只发布派生摘要，不发布源码正文；
- 每个来源记录源路径、来源 commit 和 SHA-256。

### Released Contracts

`releases` 用于正式发布或冻结的不可变契约版本。示意：

```yaml
releases:
  - releaseId: ca-skills-release-2026-11
    releaseRecord:
      path: docs/releases/ca-sl-v1alpha5.md
      ref: 0123456789abcdef0123456789abcdef01234567
    contracts:
      - contractId: ca-sl
        version: v1alpha5
        lifecycleStatus: FROZEN
        source:
          ref: 89abcdef0123456789abcdef0123456789abcdef
        artifacts:
          - kind: specification
            path: docs/spec/skill-language-spec.v1alpha5.md
            mediaType: text/markdown
            publish: [download, render]
```

规则：

- `releaseId` 是 Owner Release Record 的唯一标识；
- `contractId + version` 是单个契约的稳定身份；
- 一个 Owner Release 可以发布多个独立 Contract Version；
- 每个 Contract Version 的全部 artifacts 来自它自己声明的完整 source commit；
- Release Record 也固定到自己的完整 commit；
- 每个 artifact 必须明确声明 kind、path、mediaType 和 publish；
- `download` 是必需的公开能力，`render` 允许门户对该 artifact 提供结构化展示；
- 同一个 Contract ID + Version 不允许出现不同内容摘要；
- 同一版本发布后不可覆盖，修订内容必须使用新的 Contract Version；
- 生命周期状态和具体实现的 Qualification Claim 分开管理。

Manifest 显式列出的 release record 和 artifacts 就是 Owner 对这些文件的公开授权。发布前必须审查正文、代码块、示例、图片、链接和机器契约，不得包含密钥、个人数据、内部地址、生产凭据或未授权的第三方内容。

## 3. 支持的 Living Source 类型

### OpenAPI

可派生 API 标题、Method / Path、operationId、请求/响应 Schema 引用和字段摘要。若需 Scalar 直接加载原始定义，必须在 publish 中显式加入 `raw`。Scalar 只用于 OpenAPI / Swagger HTTP API，不将 MCP 或其他非 HTTP 契约伪装成 OpenAPI。

### JSON Schema

可派生稳定的数据结构、字段类型、必填约束、枚举、固定值、条件规则和引用。原始 Schema 只有在显式加入 `raw` 后才公开。跨文件引用必须来自同一 Owner commit；发布的 Schema Explorer 不得静默丢弃未解析引用。

### Markdown

用于 Owner 明确维护、适合外部读者阅读的长文档。建议放在 `docs/public/`，中英文页面分别声明来源：

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

### Implementation check

仅用于检查声明与实现之间的关系。门户只发布派生摘要，例如源码文件存在或由明确声明的 extractor 提取路由；不得将 private 源码正文写入 public snapshot。

当前支持的 extractor：

- `go-http-routes`：从 Go `http.ServeMux.HandleFunc("METHOD /path", ...)` 注册中提取 method/path。

允许的 publish 值只有 `metadata` 和 `implementation-summary`。

## 4. Publish 白名单

| 值 | 可发布内容 |
| --- | --- |
| `metadata` | 标题、版本、来源路径等元信息 |
| `operations` | API Method / Path / operationId 等接口清单 |
| `fields` | OpenAPI / JSON Schema 字段摘要 |
| `enums` | 显式允许公开的枚举和固定值 |
| `examples` | Owner 明确允许公开的示例 |
| `body` | Owner 明确允许公开的 Markdown 正文 |
| `implementation-summary` | 实现检查的派生结果，不含源码正文 |
| `raw` | 完整 OpenAPI / JSON Schema 原文，按 commit 固定复制到公开站点 |

未知来源类型、越界路径、非法 manifest 或不允许的 publish 组合必须使同步失败。

## 5. 同步、不可变快照与失败处理

```text
Owner repository
  -> resolve branch to immutable commit
  -> read docs/public-docs.yaml at that commit
  -> validate PublicDocsManifest v1alpha2
  -> read only declared sources from the pinned commit
  -> publish explicitly allowlisted raw API/schema files
  -> fetch Released Contract artifacts from their own pinned commits
  -> calculate SHA-256 and write immutable public files
  -> generate source snapshot + Contract Catalog
  -> build and deploy static pages from committed public assets
```

- 同步失败不能把旧快照标记为最新；
- 本地无 Token 时只使用仓库中已提交的快照，不读取或转换旧格式数据；
- 严格同步模式下，任一 Owner 的 manifest、来源文件、引用或发布冲突失败都会使整轮同步失败；
- 已发布路径已存在时，内容摘要必须一致，否则拒绝覆盖；
- Pages 构建只读取 CA Docs 仓库内已提交的 public snapshot，不接触 private token。

## 6. 权限

`CA_DOCS_SOURCE_TOKEN` 只用于同步 workflow。它只需要对已接入的 private 来源仓有 `Contents: Read-only` 权限，不应授予写权限，也不应传给 GitHub Pages 构建任务。

Public snapshot 中的任何内容都会成为公开内容。Private Owner 文件只有通过 manifest 显式授权后才可进入 public 目录。

## 7. 页面模型

- OpenAPI 来源提供接口摘要；明确授权 raw 后可以由 Scalar 渲染；
- JSON Schema 来源提供数据契约摘要；明确授权 raw 后可以由 Schema Explorer 解析完整引用；
- Markdown 来源提供 Owner 维护的长文档；
- implementation-check 来源提供有限的派生摘要；
- Released Contracts 提供不可变版本页面、原始文件下载和 provenance。

门户不自动搬运整个 `docs/` 或源码目录，不创建第二份机器契约，不将同步成功或 Schema 校验通过标记为产品 Qualified。

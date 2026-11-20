# CA Docs 2.0 架构设计与仓库改造计划

**文档状态：** DESIGN PROPOSAL  
**日期：** 2026-11-19  
**目标仓库：** `odango-chan/ca-docs`  
**目标产品：** CA Docs — ConnectionAgent 官方文档与契约门户

---

## 1. 目标与核心决策

将现有 `ca-docs` 从以 Sandbox 为中心的文档站，演进为整个 ConnectionAgent（CA）生态的官方文档、契约发布和 API Reference 门户。

### 1.1 核心职责

- Owner 仓库继续定义、评审、维护和发布契约。
- CA Docs 负责发现、索引、展示、版本导航和来源追溯。
- Compiler、Runtime、Host、Provider 等继续消费各自 Owner 发布的机器契约。
- CA Docs 不成为新的契约 Owner，不修改或重新解释机器契约。

**唯一事实来源仍然是契约 Owner 仓库中的正式发布内容。** CA Docs 中保存的是由 Owner 明确授权、从不可变源版本复制而来的公开发布快照，不是可独立编辑的第二份契约。

### 1.2 关键设计决策

1. 保留现有 Astro + GitHub Pages，不另建文档服务，不引入数据库。
2. 保留 `docs/public-docs.yaml` 作为 Owner 发布声明的固定路径，但直接采用新的 `PublicDocsManifest v1alpha2`；不实现 v1alpha1 兼容层。
3. 将“持续更新的组件文档”和“不可变的正式契约发布”分成两条发布通道。
4. 保存完整 OpenAPI 原文，以 Scalar 提供交互式 API Reference；现有摘要展示可以保留为目录/概览，不再充当唯一 API 展示。
5. 保存完整 JSON Schema 原文，并提供结构化 Schema 浏览。
6. 正式发布版本使用不可变 URL 和 append-only 快照；`latest` 只是可变索引，不是版本内容。
7. “契约已冻结/已发布”和“产品已符合/已验收”必须分开表达。

---

## 2. 现状审查（2026-11-19）

### 2.1 已有基础

当前 `ca-docs` 已经具备：

- Astro 5 静态站点和 GitHub Pages 部署；
- 中英文页面；
- `data/components.yaml` 组件注册表；
- `docs/public-docs.yaml` Owner 授权发布清单；
- `PublicDocsManifest` Schema 校验；
- Private 源仓只读 Token 同步；
- 固定 source commit 的来源追溯；
- Markdown、OpenAPI、JSON Schema 和 implementation-check 的基础解析；
- `data/generated/` 中的公开快照。

现有同步器同时包含 manifest 驱动路径和 `ca-5gc-sim`、`tool-common` 等历史专用适配器。2.0 应统一到新的 manifest 驱动管线，并删除已被替代的专用适配器；现有有价值的页面和内容保留，但不保留旧数据格式或旧同步实现。

### 2.2 当前缺口

| 领域 | 当前状态 | 2.0 改造 |
|---|---|---|
| 产品定位 | Sandbox Docs | CA Docs，Sandbox 是其中一个领域 |
| 组件目录 | 有注册表，但只接入少量组件 | 覆盖 CA 生态核心 Owner |
| 文档同步 | 主要按组件生成可更新快照 | 保留现有通道，补充正式发布通道 |
| OpenAPI | 转换成接口/字段摘要 | 保留完整 OpenAPI 原文并用 Scalar 渲染 |
| JSON Schema | 部分转换成字段摘要 | 保留原文、解析引用、提供 Schema Explorer |
| 契约版本 | 没有统一发布目录 | Contract ID + Contract Version + immutable source |
| 历史版本 | 组件快照可能被后续同步替换 | 已发布版本 append-only |
| 契约关系 | 以独立文档和接口为主 | 增加显式的 Owner / Capability / API / Schema 关联 |
| 新鲜度 | 有来源 commit，但缺少统一 stale 视图 | 显示源 commit、同步时间和新鲜度 |
| API 调用 | 没有统一安全边界 | 默认只读文档；Try It 必须显式配置公共测试环境 |

当前部分 `data/generated/` 快照所记录的上游 commit 仍为 2026-10-21。2.0 必须把“来源版本”和“同步新鲜度”作为一等信息展示，不能让旧快照看起来像实时状态。

### 2.3 已核对的 Owner 发布现状

| Owner 仓库 | 已确认的发布事实 | CA Docs 接入策略 |
|---|---|---|
| `ca-skills` | CA-SL v1alpha5 有正式 Release Record；语言状态 FROZEN / RELEASED；规范 commit 为 `0abfd0e1ab99f481a4ae01f3f47efc54783dd5e5`；IngressCatalog v1alpha1 使用独立 commit `9412be9894ef36acf846c757a5870dc0c48b33ac` | 第一批正式契约接入；两个契约保持独立版本身份 |
| `ca-skill-compiler` | README 声明产品版本 v2.0.2、目标语言 v1alpha5；Compiler 自有机器契约位于 `contracts/v1alpha5/` | 接入 Compiler API/Schema；发布前核对不可变 tag/commit 和正式 Release 记录 |
| `ca-client-tools` | 仓库公开；截至其 2026-11-18 的 `docs/RELEASE.md`，v1.0.0 仍是 preparation，记录当时尚无 tag 和 GitHub Release | 可先接入公开架构/使用文档；正式版本发布后再进入 Released Contracts；不得提前标记为 RELEASED |
| `ca-agent` | Private Owner 仓；有 Host Artifact Store 等跨仓契约文档；仓库尚无 CA Docs manifest | 只发布 Owner 明确授权的契约；先核对契约文档状态和引用方的 pinned identity |
| `tool-common` | Private Owner 仓；已有 public-docs manifest 和 OpenAPI 来源 | 沿用 manifest；刷新上游快照并增加原始 OpenAPI 发布 |
| `env-5gc-sim` | Private Owner 仓；已有 manifest、OpenAPI、Schema 和实现检查来源 | 沿用现有适配器，迁移到统一发布管线 |
| `env-fabric` | Private Owner 仓；已在组件注册表中 | 沿用 manifest，增加正式 API/Schema 发布能力 |
| `ca-provider-5gc` | 当前注册为 planned | 等待 Owner 契约和发布边界明确后接入 |
| `ca-runtime` | 当前注册为 planned；Private Owner 仓 | 盘点 Runtime API、Procedure、Outcome、Evidence 和部署契约的正式 Owner / Release 身份后接入 |
| `tool-mcp-gw` | Private Owner 仓；当前组件注册表尚未纳入 | 盘点 MCP Server Tool Catalog、Host Integration Profile 和 SDK 契约后接入 |
| `ai-gateway` | Public Owner 仓；本轮尚未核对其 Release 与 API 契约清单 | 纳入后续 API / Component 接入审查，不提前假设已有正式 OpenAPI |
| `ca-mcp` | 组件注册表中为 planned；当前未发现对应已安装仓库 | 先明确仓库和契约 Owner，再纳入 |
| `ca-agent-demo` | Private 集成示例仓，不作为公共契约 Owner | 只发布经授权的示例、E2E 流程和验收说明；共享契约仍归正式 Owner 仓 |
| `env-openamsm` | Private 5GC 环境 / NF 集成仓；本轮未盘点公开契约清单 | 只在确认外部协议文档、实现接口和发布权限后纳入 |

**特别注意：** `ca-agent/docs/design/host-artifact-store-v1.md` 当前正文写有 “Accepted for implementation (draft PR)”，而 `ca-client-tools/docs/host-integration.md` 将其描述为 published and pinned。两处状态表述存在冲突。CA Docs 不应自行选择其中一个状态；该契约进入正式目录前必须由 Owner 统一状态、Release Record 和精确 commit。

---

## 3. 网站信息架构

站点产品名统一为 **CA Docs**，副标题为 **ConnectionAgent Documentation & Contract Registry**。

建议主导航：

| 导航 | 内容 | 说明 |
|---|---|---|
| Overview | 生态概览、快速入口、最新发布 | 面向首次访问者 |
| Architecture | 总体架构、组件边界、消息流、运行模型 | 跨仓架构解释 |
| Contracts | Contract Catalog、版本、状态、来源 | 正式契约目录 |
| API Reference | OpenAPI 可视化 | Scalar 渲染 |
| Components | 每个 Owner 的职责、文档、接口和契约 | 组件视图 |
| Guides | 开发、集成、部署和运行指南 | 面向使用者 |
| Releases | 新版本、历史版本、变更摘要 | 发布视图 |

### 3.1 Contract Catalog

按契约类别和 Owner 两种方式浏览：

- CA-SL / Language Specification
- Capability / ToolCatalog / CapabilityContracts
- IngressCatalog / Event / Wait
- Compiler APIs / Artifact APIs
- Agent Host / Runtime / Host Integration
- Provider / SBI / MCP
- Common JSON Schema

契约详情必须显示：

- Contract ID；
- Contract Version；
- Owner；
- Lifecycle Status（例如 DRAFT、ACCEPTED、FROZEN、DEPRECATED）；
- Qualification Status（例如 QUALIFIED、NOT_QUALIFIED、NOT_RUN）；
- 首次发布和当前发布版本；
- 源仓、源 tag/ref、完整 source commit；
- 原始文件路径和 SHA-256；
- 上下游显式关联；
- 变更记录及历史版本。

Lifecycle Status 和 Qualification Status 是不同维度。例如 CA-SL v1alpha5 的语言语义可以是 FROZEN / RELEASED，而 Compiler、Studio、Host、Runtime 或真实 5GC 的产品符合性仍然是 NOT_QUALIFIED。不得把“规范冻结”渲染成“产品端到端通过”。

### 3.2 Component 页面

每个组件页面采用统一入口，但不强迫所有组件拥有相同内容：

- Overview / Responsibilities；
- Architecture / Integration；
- API Reference；
- Contracts / Schemas；
- Guides / Examples；
- Release History；
- Source & Provenance。

缺少某一类内容时不显示空白栏目，也不生成虚假的“已支持”状态。

---

## 4. 发布架构：两条通道、一个门户

### 4.1 通道 A：Living Documentation

用于架构说明、使用指南、运行手册和持续更新的组件说明。

- 由 Owner 的 `docs/public-docs.yaml` 声明公开文件；
- 可从指定分支同步，但每次必须解析到不可变 commit；
- 更新时可以替换“当前文档快照”；
- 页面显示 source commit、source path 和同步时间；
- 不把它冒充正式契约版本。

Living Documentation 的输出仍可写入 `data/generated/<component>.json`，但所有快照都必须由新同步管线从 Owner 当前授权源重新生成；不读取或迁移旧格式快照，也不保留历史适配器。

### 4.2 通道 B：Released Contracts

用于已经正式发布或冻结的机器契约和规范文档。

- 每个发布项必须有 Contract ID、Contract Version 和明确 Owner；
- 必须指向不可变 source commit；可以同时记录 Git tag，但不能只依赖可移动 tag；
- 必须列出明确的发布文件白名单；
- 同步时原样保存 OpenAPI / JSON Schema 等机器文件；
- 每个文件记录 SHA-256、源仓、source commit 和 source path；
- 已发布的版本路径不可被覆盖；
- 新版本追加新目录，旧版本保持可访问；
- 同一版本出现不同内容摘要时必须失败，不能静默覆盖；
- 撤回或废弃通过状态和 tombstone 表达，不物理删除历史来源。

`latest` 只指向某个已经发布的 immutable version。更新 latest 不得修改历史版本内容。

### 4.3 为什么不把两条通道合并

组件文档通常跟随 main 持续演进；正式契约必须按版本冻结。两者的更新频率、审查要求、URL 稳定性和回滚语义不同。混用会造成“main 的最新内容被误认为正式发布契约”的问题。

---

## 5. Owner 发布声明与快照格式

### 5.1 Manifest 版本策略

`PublicDocsManifest v1alpha2` 是 CA Docs 2.0 唯一接受的发布声明格式，统一承载两类声明：

- `sources`：Living Documentation；
- `releases`：Released Contracts。

不实现 v1alpha1 解析器、双版本分支或旧格式 fallback。所有已接入 Owner 必须在启用新同步管线前一次性迁移到 v1alpha2；缺少或不符合 v1alpha2 的 manifest 直接阻止该 Owner 的同步。迁移期间不允许旧格式数据被当作新格式输入，也不允许把缺失的 `releases` 推断为“全部公开”。

这里的 v1alpha1 / v1alpha2 指 **CA Docs 的 PublicDocsManifest 格式版本**，不影响 Owner 自己发布的契约版本。例如 `IngressCatalog v1alpha1` 仍是一个独立、有效的正式契约版本，不能因为 Manifest 不再兼容 v1alpha1 而删除或改写。

### 5.2 发布声明示意

以下是目标结构示意，不是对现有 Owner 文件的直接复制：

```yaml
apiVersion: connectionagent.io/v1alpha2
kind: PublicDocsManifest
component: ca-skills

sources:
  - kind: markdown
    path: docs/authoring.md
    role: authoring-guide
    language: en
    publish: [metadata, body]

releases:
  - releaseId: ca-skills-release-record-v1alpha5
    publicationStatus: PUBLISHED
    releaseRecord:
      path: docs/releases/ca-sl-v1alpha5.md
      ref: <release-record-commit>
    contracts:
      - contractId: ca-sl
        version: v1alpha5
        lifecycleStatus: FROZEN
        source:
          ref: 0abfd0e1ab99f481a4ae01f3f47efc54783dd5e5
        artifacts:
          - kind: specification
            path: docs/skill-language-spec.v1alpha5.zh-CN.md
            mediaType: text/markdown
            publish: [body, download]
```

说明：

- `releaseId` 是 Owner 发布记录的唯一标识，不等同于 Contract ID；
- `contractId + version` 标识机器契约或规范的版本身份；
- 一个 Owner Release 可以包含多个独立版本的契约；
- 每个 Contract Version 分别固定自己的 `source.ref`，因此同一个 Owner Release 可以引用不同的历史 commit；
- `releaseRecord.ref` 和每个 `source.ref` 都必须解析为完整 commit SHA；
- 一个契约版本可以由多个文件组成；
- `releaseRecord` 是 Owner 的人类可读发布记录；
- `lifecycleStatus` 与针对具体实现的 Qualification Claim 分开；
- `publish` 是公开授权白名单，不是“自动公开全部字段”。

正式实施前需要将示意结构落实为 JSON Schema，并明确允许的 artifact kind、media type、路径约束、重复 ID 和版本冲突规则。

### 5.3 不要求所有仓库先统一 Release 流程

CA Docs 不强迫每个 Owner 立即采用相同的 tag 命名、GitHub Release 或产品版本策略。

- 已有 Release Record 的 Owner：声明其精确 commit 和契约文件；
- 已有 tag 的 Owner：记录 tag，并在同步时解析和固定 commit；
- 尚无正式 Release 的 Owner：可以发布 Living Documentation，但不得出现在正式 Released Contracts；
- 只有当 Owner 完成正式发布并提供明确来源后，才进入正式契约目录。

CA Docs 的 manifest 解决“允许公开什么、在哪里、属于哪个契约版本”，不替代 Owner 的 Release 评审和发布决策。

---

## 6. OpenAPI 可视化：Scalar

### 6.1 技术方案

在现有 Astro 5 站点集成官方 Astro 组件 `@scalar/astro`。

Scalar 只负责 OpenAPI / Swagger 描述的 HTTP API。MCP、Provider 进程协议、NDJSON、Go SDK 和其他非 OpenAPI 契约必须使用对应的协议契约页面与 Schema 展示，不能为了统一 UI 而伪造 OpenAPI。3GPP SBI OpenAPI 只有在 Owner 明确授权公开、且版本来源和规范版权边界清楚时才进入 API Reference。

参考：
- <https://scalar.com/products/api-references/integrations/astro>
- <https://scalar.com/products/api-references/configuration>

页面直接加载 CA Docs 中已发布的 OpenAPI 原始文件，不在浏览器端请求 Owner 仓库，也不从 private 仓库动态拉取内容。

### 6.2 页面模型

建议路由：

```text
/api/
  /<component>/
    /<api-id>/
      /<contract-version>/
```

例如：

```text
/api/ca-client-tools/provider/v2/
/api/env-fabric/service-fabric/v1alpha1/
```

实际路径以 Owner 正式发布的 Contract ID 和 Version 为准；示例不代表这些 API 已经发布。

API 页面包含：

- Scalar 交互式 API Reference；
- API Contract ID / Version；
- Owner 与 Release 状态；
- source commit / source path；
- 原始 OpenAPI 文件下载；
- 对应 JSON Schema 和相关契约的跳转；
- 版本切换入口。

### 6.3 API 文档安全规则

- 默认只展示，不默认启用 Try It；
- 不把内网、localhost、真实生产 NF 地址作为公开调用目标；
- 只有明确配置公共测试环境、CORS 和允许的 server URL 后，才启用 Try It；
- 不代理用户的 API 请求，不在 CA Docs 存储业务凭据；
- OpenAPI 文件必须由 Owner 明确授权公开；
- 不自动改写 Owner 的原始 OpenAPI 文件；校验失败时阻止发布并给出路径/行号；
- Scalar 依赖版本必须固定，并验证 GitHub Pages 的 base path、静态资源加载和深链接刷新；
- 若使用 CDN，必须固定版本；同时评估将前端资源本地打包，避免站点运行依赖未固定的 latest CDN。

### 6.4 现有 API 摘要的处理

现有 OpenAPI 摘要仍可用于首页计数、接口目录、跨组件搜索和差异检测，但不再代替完整 OpenAPI Reference。迁移期间两者并行，验收通过后再决定是否精简旧页面。

---

## 7. JSON Schema Explorer 与契约关系

### 7.1 Schema Explorer

保留每个发布版本的 JSON Schema 原文，并提供只读结构化视图：

- 字段路径、类型和描述；
- required / optional；
- const / enum；
- `$ref` 跳转；
- `oneOf` / `anyOf` / `allOf`；
- 数组元素、嵌套对象；
- 默认值和明确允许公开的 examples；
- Schema 文件下载及来源信息。

Schema 解析必须基于同一发布版本的完整文件闭包。缺失引用、循环引用处理错误或不支持的关键关键字必须给出诊断，不能静默丢字段。

### 7.2 契约关系索引

后续增加明确声明的关系：

- Skill → Capability；
- Capability → Callable / Tool；
- Callable → Owner；
- Operation → Request / Response Schema；
- API → Contract；
- Compiler Artifact → Language / Ingress Contract；
- Host / Runtime → Provider Integration Contract。

关系必须来自 Owner 明确声明的稳定 ID、机器契约引用或已审核的映射，不允许仅根据文件名、自然语言或相似字符串推断。

第一阶段先提供“相关契约”链接，不急于建设复杂的全生态自动图谱。只有关系来源和版本绑定稳定后，再提供关系图。

---

## 8. 版本与状态模型

### 8.1 三种身份不能混为一谈

| 身份 | 示例 | 说明 |
|---|---|---|
| Owner 产品版本 | Compiler v2.0.2 | 仓库产品/发布版本 |
| Contract Version | `compiler-build-request/v1alpha5` | 单个机器契约版本 |
| Language Version | `connectionagent.io/v1alpha5` | CA-SL 语言版本 |

同一个 Owner Release 可以发布多个不同 Contract Version；产品版本升级也不意味着所有契约版本都变化。

### 8.2 状态维度

| 维度 | 示例 | 含义 |
|---|---|---|
| Publication | PUBLISHED / PREVIEW / WITHDRAWN | CA Docs 是否对外展示 |
| Lifecycle | DRAFT / ACCEPTED / FROZEN / DEPRECATED | Owner 定义的契约生命周期 |
| Qualification Claim | QUALIFIED / NOT_QUALIFIED / NOT_RUN | 针对明确实现、运行环境或 conformance target 的符合性状态 |

Qualification Claim 必须同时记录被评估的 subject、目标契约版本、评估范围和证据来源。它不属于 Contract ID / Version 的固有属性。例如 CA-SL v1alpha5 语言语义可以 FROZEN / RELEASED，但 Compiler、Studio、Host、Runtime 或真实 5GC 的符合性分别保持 NOT_QUALIFIED，直到各自有对应证据。

不得将同步成功、Schema 校验通过、Compiler 静态检查通过等同于 E2E PASS。

### 8.3 不可变 URL

正式版本使用稳定路径，例如：

```text
/contracts/ca-skills/ca-sl/v1alpha5/
/contracts/ca-skills/ingresscatalog/v1alpha1/
/contracts/ca-skill-compiler/compiler-build-request/v1alpha5/
```

每个 URL 永久指向同一个内容摘要。新版本新增路径，历史版本不被覆盖。最新版本只在目录索引中更新。

---

## 9. 目标仓库结构

建议在现有目录基础上渐进演进，不一次性重排整个站点：

```text
ca-docs/
├── data/
│   ├── components.yaml              # Owner/组件注册表
│   ├── generated/                   # Living Documentation 当前快照
│   └── catalog/
│       ├── components.json
│       ├── contracts.json
│       └── releases.json
├── public/
│   └── contracts/                   # 不可变、公开的原始契约快照
│       └── <component>/<contract-id>/<version>/
│           ├── artifact files
│           └── provenance.json
├── schemas/
│   └── v1alpha2/
│       └── public-docs-manifest.schema.yaml
├── scripts/
│   ├── sync.mjs                     # Living docs 同步入口
│   ├── sync-manifest.mjs
│   ├── sync-releases.mjs            # 正式契约同步入口
│   ├── validate-openapi.mjs
│   ├── validate-json-schema.mjs
│   └── build-catalog.mjs
├── src/
│   ├── components/
│   │   ├── ScalarReference.astro
│   │   ├── SchemaExplorer.astro
│   │   └── ContractProvenance.astro
│   ├── lib/
│   │   └── catalog/
│   └── pages/
│       ├── contracts/
│       ├── api/
│       ├── components/
│       └── releases/
└── docs/
    ├── public-doc-contract.md
    └── ca-docs-2.0-architecture.zh-CN.md
```

`public/contracts/` 中的内容是公开站点静态资源，提交后即为公开内容。任何 private Owner 文件只有通过 manifest 显式授权后才可进入此目录。

---

## 10. 仓库接入顺序

### Phase 0 — CA Docs 基础设计

- [x] 核对现有 Astro / GitHub Pages / manifest / snapshot 机制
- [x] 明确 Living Docs 与 Released Contracts 双通道
- [x] 明确 Contract ID / Version / Owner / provenance / status 模型
- [x] 明确 OpenAPI Scalar 方向
- [ ] 评审并冻结本设计

### Phase 1 — 发布契约基础设施

- [ ] 定义并测试唯一受支持的 `PublicDocsManifest v1alpha2`
- [ ] 将所有已接入 Owner 的 manifest 一次性迁移到 v1alpha2
- [ ] 删除 v1alpha1 parser、legacy fallback 和历史专用同步适配器
- [ ] 从 Owner 授权源重新生成全部 `data/generated/` 快照，不迁移旧快照格式
- [ ] 实现不可变 source ref 解析
- [ ] 实现 release/artifact 白名单和路径安全校验
- [ ] 实现 SHA-256 计算和 provenance 记录
- [ ] 实现 append-only 快照写入与同版本冲突拒绝
- [ ] 生成 Contract / Release Catalog
- [ ] 为撤回、废弃和 latest 指针定义行为
- [ ] 增加私有源读取失败、过期快照和同步时间的明确诊断

### Phase 2 — CA Docs 产品定位与导航

- [ ] Sandbox Docs → CA Docs 品牌和首页
- [ ] 导航增加 Contracts / API Reference / Releases
- [ ] Sandbox 现有内容迁移到 Architecture / Components
- [ ] 保留中文默认和英文页面
- [ ] 增加全站搜索或契约目录过滤
- [ ] 显示源仓、commit、版本和同步时间

### Phase 3 — API 与 Schema 可视化

- [ ] 集成固定版本的 `@scalar/astro`
- [ ] 按 API Contract ID / Version 生成 API 页面
- [ ] Scalar 加载 CA Docs 本地发布的 OpenAPI 文件
- [ ] OpenAPI 3.0/3.1 校验和错误定位
- [ ] 默认关闭 Try It，提供明确的公共测试环境 allowlist
- [ ] 实现 JSON Schema Explorer
- [ ] 实现原始文件下载、版本切换和 provenance 展示
- [ ] 验证 GitHub Pages base path、深链接和移动端布局

### Phase 4 — 首批 Owner 接入

1. `ca-skills`：CA-SL v1alpha5、IngressCatalog v1alpha1、诊断注册表；
2. `ca-skill-compiler`：Compiler v1alpha5 BuildRequest / BuildResult / DependencyInspection / Artifact 等自有契约；
3. `ca-client-tools`：先发布公开架构和集成文档；正式发布后再接入 v1.0.0 对应版本资产；
4. `ca-agent`：先统一 Host Artifact Store 等跨仓契约状态和发布身份，再显式授权公开；
5. `tool-common`、`env-fabric`、`env-5gc-sim`：统一迁移到 v1alpha2 发布管线，删除历史专用适配器，并保留现有页面内容；
6. `ca-provider-5gc`：等 Owner 契约和正式发布身份明确后接入；
7. `ca-runtime`、`tool-mcp-gw`、`ai-gateway`：完成 Owner / Release / API 契约盘点后接入；
8. `ca-agent-demo`、`env-openamsm`：只承载经授权的示例、集成说明和协议参考，不取代共享契约 Owner。

### Phase 5 — 生态关系与完善

- [ ] Capability / Callable / Owner / API / Schema 关联导航
- [ ] 跨版本差异摘要
- [ ] Deprecated / superseded 契约提示
- [ ] 发布新版本时自动更新 latest 索引
- [ ] 生成供工具和其他站点消费的机器可读 Contract Catalog
- [ ] 增加发布审计与回滚/撤回流程

---

## 11. CI 与发布验收

### 11.1 Owner 同步验收

- manifest Schema 校验通过；
- 同一个 Contract Version 的所有 artifact 文件都来自该版本声明的同一个 immutable commit；release record 自身也固定来源 commit；不同 Contract Version 可以分别指向不同 commit；
- release ref 可解析且完整 commit 可记录；
- 文件路径不允许绝对路径、`..`、反斜杠或越界；
- 未声明文件不会被读取或发布；
- private 源文件必须有显式 public 授权；
- 同一 Contract ID + Version 不允许出现不同内容摘要；
- 缺失引用、缺失源文件和 API 解析失败必须阻止发布；
- 同步失败不能把旧快照标记为最新。

### 11.2 站点构建验收

- 所有已发布 API 页面均能加载对应本地 OpenAPI 文件；
- Scalar 页面不访问 Owner private 仓；
- Schema Explorer 对引用闭包有确定性结果；
- 所有版本 URL 在刷新和直接访问时可用；
- 原始契约下载内容 SHA-256 与 provenance 一致；
- 中英文导航、GitHub Pages base path 和移动端布局通过；
- 页面显示 Lifecycle 与 Qualification 两种状态，且不互相推导。

### 11.3 端到端发布验收

从 Owner 的不可变发布源开始，验证：

```text
Owner Release
  -> manifest validation
  -> exact commit resolution
  -> artifact copy + SHA-256
  -> immutable snapshot
  -> catalog generation
  -> Astro build
  -> GitHub Pages
  -> browser verification
```

至少使用一个真实 OpenAPI、一个有跨文件引用的 JSON Schema、一个 Markdown 规范和一个 private Owner 来源作为验收样本。

---

## 12. 安全、权限与运行约束

- CA Docs 保持静态站点；不增加数据库、后台账号系统或在线契约编辑器。
- Private source token 仅用于同步 workflow，Contents: Read-only；Pages 构建不接触该 token。
- Public snapshot 中的任何内容都视为公开内容；不能因源仓是 private 就认为发布后仍然私有。
- 所有公开内容必须由 Owner 明确授权；不自动公开整个 `docs/`、`schemas/` 或源码目录。
- 禁止同步密钥、Token、个人数据、内部地址、生产凭据和未授权样例。
- OpenAPI Try It 默认关闭，不通过 CA Docs 代理生产或内网请求。
- 静态内容只做安全渲染，不执行 Owner 仓库代码。
- 版本快照、provenance 和 SHA-256 必须一起提交，保证可追溯和可复现。

---

## 13. 明确不做的事情

- 不把 CA Docs 变成新的 Contract Owner 或 Package Registry。
- 不允许在 CA Docs 页面编辑并回写 Owner 契约。
- 不复制或重写 Compiler、Runtime、Host 的校验逻辑。
- 不自动推断 Capability、Tool、Owner 和 Schema 的业务关系。
- 不将 GitHub main 最新内容标记为正式 Release。
- 不因为 Schema 校验通过就声称产品 Qualified。
- 不默认提供在线 API 调用、生产调试或私有网络代理。
- 不要求所有仓库在第一阶段统一产品版本、tag 命名或发布工具。

---

## 14. 实施顺序与首个交付边界

第一个可交付版本不追求一次接入全部 CA 仓库，但所有当前已接入 Owner 必须在切换时完成统一迁移，不保留双轨同步。建议先完成：

1. 唯一受支持的 v1alpha2 发布 manifest、全量 Owner manifest 迁移与不可变快照机制；
2. Contract Catalog 和 Release Catalog；
3. Scalar 的一个真实 API 页面；
4. 一个完整 JSON Schema 引用闭包页面；
5. CA-SL v1alpha5 与 IngressCatalog v1alpha1 两个真实正式契约页面；
6. 至少一个 private Owner 的显式公开发布验证；
7. 保留现有 Sandbox / Benchmark 页面并完成新旧导航回归。

完成这些后，再批量接入其他 Owner。这样可以先验证发布模型，而不是一次性制造大量只有摘要、没有正式版本身份的文档页面。

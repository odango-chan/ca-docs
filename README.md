# Sandbox Docs

Sandbox 平台的公开文档门户，提供平台架构、组件职责、Benchmark 与可靠性评估、运行手册和公开接口参考。中文为默认语言，同时提供英文页面。

- 中文站：<https://odango-chan.github.io/ca-docs/>
- English: <https://odango-chan.github.io/ca-docs/en/>

## 从哪里开始

- **[Sandbox 总体架构](https://odango-chan.github.io/ca-docs/architecture/system/)**：平台分层、组件职责、事实权威，以及真实 5GC 请求的跨组件路径。
- **[Sandbox 源仓架构详解](https://odango-chan.github.io/ca-docs/components/sandbox/)**：由 Sandbox 治理仓维护的完整架构与 Benchmark 框架说明。
- **[Benchmark 与可靠性评估](https://odango-chan.github.io/ca-docs/benchmark/)**：CUT、冻结任务、执行尝试、证据有效性和 Verdict 的边界。
- **[Benchmark 资产与用例语义](https://odango-chan.github.io/ca-docs/components/ca-benchmarks/)**：Package、Case、RunVariant、首批 13 个 Case 和 Mode 适用范围。
- **[Benchmark 执行生命周期](https://odango-chan.github.io/ca-docs/components/ca-benchmark-engine/)**：EvaluationTask、ExecutionAttempt、Validity 和 EvaluationResult 的语义。
- **[真实 5GC 运行手册](https://odango-chan.github.io/ca-docs/runbooks/real-5gc/)**：启动前检查、运行步骤、故障定位与验收流程。
- **[真实 5GC 接口与证据手册](https://odango-chan.github.io/ca-docs/interfaces/real-5gc-evidence/)**：接口契约、关联键、事实来源和 PASS 判定要求。
- **[组件接口总览](https://odango-chan.github.io/ca-docs/api/)**：按组件查阅公开接口。

## 文档边界与事实来源

Sandbox Docs 是跨仓文档视图，不是实现或机器契约的第二份事实源。

- Sandbox 治理仓维护平台架构、组件关系、迁移状态与跨仓约束。
- Benchmark 资产仓定义评估问题、Case 语义和所需证据。
- Benchmark Engine 维护任务冻结、执行、有效性、结果与查询投影契约。
- 其他组件 owner 仓维护实现、OpenAPI、JSON Schema 和领域事实。
- 本站发布经过校验的公开派生数据，并补充平台级解释、运行流程和导航。
- 同步成功不等于端到端验收通过；设计已发布也不代表相关能力已经实现或验证。

## 公开内容如何接入

组件通过自身仓库中的 `docs/public-docs.yaml` 声明允许公开的 OpenAPI、JSON Schema、Markdown 或实现检查结果。Sandbox Docs 只读取显式列出的来源，不会自动公开 private 仓库的整个 `docs/` 目录或复制私有源码正文。

当前接入的 owner 来源包括：

| 来源仓库 | 发布内容 |
| --- | --- |
| `sandbox` | 平台架构与 Benchmark 框架 |
| `ca-benchmarks` | Benchmark 资产与 Case 语义 |
| `ca-benchmark-engine` | 评估生命周期与结果语义 |
| `env-fabric` | OpenAPI 与数据契约摘要 |
| `tool-common` | OpenAPI、公开 Markdown 与实现检查摘要 |
| `env-5gc-sim` | 模拟器 OpenAPI、Schema 与实现检查摘要 |

发布 Markdown 正文前，owner 必须确认内容适合公开。写入 `data/generated/` 的快照本身就是 public 仓内容；私有来源不意味着发布后的正文仍然私有。

过渡期组件注册表位于 `data/components.yaml`；manifest 约束见 [docs/public-doc-contract.md](docs/public-doc-contract.md)。

## 同步与发布

private 上游同步与 GitHub Pages 部署分离：

1. Sync workflow 使用 `CA_DOCS_SOURCE_TOKEN` 读取已接入仓库中明确声明的公开来源。
2. 所有来源先解析到不可变 commit，再读取该 commit 下的 manifest 和指定文件。
3. 校验后的派生数据写入 `data/generated/`，并记录来源仓库、commit 和路径。
4. 只有快照变化时才提交更新。
5. Pages 从 public 仓库内已提交的快照构建，不需要 private token。

同步使用严格模式：任何来源读取或校验失败都会使同步失败，不会静默用旧快照冒充最新内容。已发布的快照仍可用于复现最近一次成功发布的站点。

### Token 权限

`CA_DOCS_SOURCE_TOKEN` 应使用 Fine-grained PAT，并只授予已接入 private 来源仓库的 **Contents: Read-only** 权限。当前应包含：

- `sandbox`
- `ca-benchmarks`
- `ca-benchmark-engine`
- `env-fabric`
- `tool-common`
- `env-5gc-sim`

若新增 private owner 仓，需先将其加入 token 的 Repository access，再启用对应同步配置。不要将 token 写入文件、提交或交给 Pages 构建任务。

## 本地开发

```bash
npm install
npm run dev
npm test
npm run build
```

默认使用仓库内已提交的公开快照。需要刷新 private 上游时，按项目配置提供 `CA_DOCS_SOURCE_TOKEN`；严格同步可使用：

```bash
CA_DOCS_SOURCE_TOKEN=... CA_DOCS_SYNC_STRICT=1 npm run sync
```

仓库名称仍为 `ca-docs`，但公开站的产品定位是 **Sandbox Docs**。

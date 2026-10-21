# Sandbox Docs

Sandbox 平台的公开文档门户，提供平台架构、组件职责、可靠性评估、运行手册与公开接口参考。中文为默认语言，同时提供英文页面。

- 中文站：<https://odango-chan.github.io/ca-docs/>
- English: <https://odango-chan.github.io/ca-docs/en/>

## 文档边界

Sandbox Docs 是跨仓文档视图，不是实现或机器契约的第二份事实源。

- Sandbox 治理仓维护平台架构、组件关系、迁移状态与跨仓约束。
- 各组件 owner 仓维护实现、OpenAPI、JSON Schema 和领域事实。
- 本站发布经过校验的公开派生数据，并补充平台级解释、运行流程和导航。
- 公开声明与实现不一致时，记录差异并交由 owner 修正；同步成功不等于端到端验收通过。

## 从哪里开始

- **[Sandbox 总体架构](https://odango-chan.github.io/ca-docs/architecture/system/)**：平台分层、组件职责、事实权威，以及真实 5GC 请求的跨组件路径。
- **[Benchmark 与可靠性评估](https://odango-chan.github.io/ca-docs/benchmark/)**：被测对象、冻结任务、执行尝试、证据有效性和 Verdict 的边界。
- **[真实 5GC 运行手册](https://odango-chan.github.io/ca-docs/runbooks/real-5gc/)**：启动前检查、运行步骤、故障定位与验收流程。
- **[真实 5GC 接口与证据手册](https://odango-chan.github.io/ca-docs/interfaces/real-5gc-evidence/)**：接口契约、关联键、事实来源和 PASS 判定要求。
- **[组件接口总览](https://odango-chan.github.io/ca-docs/api/)**：按组件查阅公开接口。

## 公开内容如何接入

组件通过自身仓库中的 `docs/public-docs.yaml` 声明允许公开的 OpenAPI、JSON Schema、Markdown 或实现检查结果。Sandbox Docs 校验声明并生成带来源版本的快照，不会自动公开 private 仓库中的整个 `docs/` 目录或复制私有源码正文。

过渡期的组件注册表位于 `data/components.yaml`；manifest 契约见 [docs/public-doc-contract.md](docs/public-doc-contract.md)。

## 同步与发布

private 上游同步与 GitHub Pages 部署是分离的：

1. Sync workflow 使用 `CA_DOCS_SOURCE_TOKEN` 读取已接入仓库中明确声明的公开来源。
2. 校验后的派生数据写入 `data/generated/`，并记录来源版本。
3. 只有快照变化时才提交更新。
4. Pages 从 public 仓库内已提交的快照构建，不需要 private token。

同步失败时，严格模式必须失败，不能静默使用旧数据伪装成最新结果；站点仍可从最近一次已发布快照重建。

## 本地开发

```bash
npm install
npm run dev
npm test
npm run build
```

默认使用仓库内已提交的公开快照。需要刷新 private 上游时，按项目配置提供 `CA_DOCS_SOURCE_TOKEN`；不要将 token 写入文件、提交或交给 Pages 构建任务。

## 事实来源原则

- 平台架构与跨仓治理：`odango-chan/sandbox`。
- 组件接口、Schema 与实现行为：相应组件 owner 仓。
- 评估资产和判定语义：Benchmark 资产仓与 Engine 契约。
- 真实环境状态：对应环境的事实 owner；文档门户不替代独立验收证据。

仓库名称仍为 `ca-docs`，但公开站的产品定位是 **Sandbox Docs**。

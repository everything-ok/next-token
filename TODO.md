# HUI：产品概览与路线图

> 面向 AI coding agent 的简洁技术表达工具。

## 1. 目的与定位

HUI 通过 skills、规则、插件和本地 hooks，引导 coding agent 使用更紧凑的技术表达：减少寒暄、重复、填充词和模糊措辞；保留技术术语、代码、API 名称、命令、错误文本和安全提示。

HUI 是写作与交互风格控制工具，不是 token、成本、延迟、性能、准确率或账单测量工具。量化边界见 [`docs/HONEST-NUMBERS.md`](docs/HONEST-NUMBERS.md)。

| 名称 | 值 | 用途 |
|---|---|---|
| 产品名 | `HUI` | 插件、skills、`/hui`、hooks、状态栏和全局命令 |
| npm 分发名 | `next-token` | `npx -y next-token -- ...` 安装入口 |
| 运行环境 | Node.js >= 18 | 安装器和本地工具 |
| canonical 来源 | `skills/` | 发布到各 host 的技能源码 |

## 2. 当前已实现能力

| 领域 | 能力 | 行为与边界 |
|---|---|---|
| 表达模式 | `lite`、`full`、`ultra`、`wenyan-lite`、`wenyan-full`、`wenyan-ultra` | `/hui` 默认启用 `full`；影响后续回复，不重写已有 transcript、context 或 cache。 |
| 清晰度回退 | 安全告警、不可逆操作、歧义多步骤、澄清请求 | 这些场景恢复正常清晰表达；代码、commit、PR 描述保持正常写法。 |
| 本地文本示例 | `/hui demo` | 返回固定“本地文本示例”；不调用模型，不读取或写入 mode、session、history、statusline 状态。Claude Code hook 支持。 |
| 提交与审查 | `/hui-commit`、`/hui-review` | 生成 Conventional Commits 文案或单行 review finding；不自动 stage、commit、approve 或改代码。 |
| 文件改写 | `/hui-compress <file>` | 改写受支持的自然语言文件；保留备份并验证受保护结构。 |
| 会话摘要 | `/hui-session`、`/hui-session --compact` | Claude Code 专用。默认读取当前 transcript 摘要；`--compact` 只创建经验证的相邻副本，原文件不改。 |
| 本地会话用量 | `/hui-stats` | Claude Code 专用。读取本地 JSONL 中回复轮次、输出 token、cache-read token；支持 `--all`、`--since Nh|Nd`。不推算节省、成本或基线。 |
| 项目规则初始化 | `/hui-init` | 为支持的 agent 写入 repo 规则；支持 dry-run 和指定 host。 |
| 协作角色 | huicrew | `investigator` 只读定位、`builder` 限 1–2 文件修改、`reviewer` 审查 diff/file。 |
| MCP 扩展 | `hui-shrink` | 可选 stdio proxy；仅改写 `tools/list`、`prompts/list`、`resources/list` 的 description 等 prose 字段。请求体和 `tools/call` 结果不改。 |

### `/hui-compress` 保护范围

支持 `.md`、`.txt`、`.rst`、`.typ`、`.typst`、`.tex` 与无扩展名自然语言文件；拒绝代码、配置文件和备份文件。

改写时保护并校验：

- fenced/inline code
- URL、链接、文件路径、命令
- 技术术语、库名、API 名
- 标题、日期、版本号、数字
- Markdown 列表与表格结构

输出仍需人工复核。文件改写不承诺 token、成本、延迟或准确率结果。

## 3. 平台与集成等级

平台清单、自动检测结果和当前可安装项以以下命令为准：

```bash
node bin/install.js --list
```

| 集成等级 | 平台/方式 | 可用能力 |
|---|---|---|
| 完整本地集成 | Claude Code | hooks、持久模式、状态栏 badge、`/hui-session`、`/hui-stats`、本地文本示例。 |
| 原生/可移植命令 | Gemini CLI、OpenCode、OpenClaw、Hermes Agent | 模式与 skills/rules 集成；具体命令由 host 能力决定。 |
| skills 或规则文件集成 | Codex、Cursor、Windsurf、Cline、GitHub Copilot、Continue、Kilo、Roo、Augment、Aider Desk、Amp、IBM Bob、Crush、Devin、Droid、ForgeCode、Block Goose、iFlow、Kiro、Mistral Vibe、OpenHands、Qwen、Rovo Dev、Tabnine、Trae、Warp、Replit、Junie、Qoder、Antigravity 等 | 通过 skills、规则文件或会话内 `/hui` 使用；不保证拥有 hooks、状态栏、transcript 或本地日志能力。 |

说明：

- “可安装”不等于所有功能完整支持。
- 部分平台为 soft provider，需使用 `--only <id>` 显式选择。
- `/hui-session` 与本地 `/hui-stats` 依赖 Claude Code 已验证的 hooks、transcript 与 JSONL 日志契约；不应在其他 host 宣称等价支持。

## 4. 安装与使用

### 安装器

先预览，再写入：

```bash
npx -y next-token -- --dry-run --all
npx -y next-token -- --all
```

常用维护命令：

```bash
npx -y next-token -- --list
npx -y next-token -- --doctor
npx -y next-token -- --only claude
npx -y next-token -- --dry-run --uninstall
npx -y next-token -- --uninstall
```

从源码目录运行时，可用 `node bin/install.js` 替代 `npx -y next-token --`。

### 日常命令

```text
/hui                    启用 full 模式
/hui lite               启用 lite 模式
/hui ultra              启用 ultra 模式
/hui wenyan             启用文言模式
/hui demo               显示固定本地文本示例
stop hui                停用；也可输入 normal mode

/hui-commit             生成简短 commit 文案
/hui-review             生成一行 review finding
/hui-compress notes.md  改写指定自然语言文件
/hui-stats              查看当前 Claude Code 本地会话用量
/hui-stats --all        汇总本地历史快照
/hui-stats --since 7d   汇总最近 7 天本地历史快照
/hui-session            摘要当前 Claude Code transcript
/hui-session --compact  创建验证后的 sibling compact 副本
/hui-help               查看命令卡片
/hui-init --dry-run     预览项目规则初始化
```

## 5. 可以期待的效果与明确边界

### 可以期待

- 技术回复更直接，减少寒暄、重复、套话和犹豫措辞。
- 技术术语、代码、命令和错误信息保持原样。
- 高风险或容易误解的内容优先清晰度，不强行压缩。
- 文件改写提供备份和结构校验。
- Claude Code 可显示当前 HUI mode badge，并查看本地日志中观察到的会话用量。

### 不应推断

- 没有统一 token 节省、美元成本、延迟、性能或准确率保证。
- `/hui-stats` 不是账单工具；不提供“未使用 HUI 时”的对照基线。
- 不同模型、提示词、上下文、缓存、工具调用、套餐和 host 可能产生不同 usage。
- `/hui-compress` 不替代人工审阅，也不适合代码或配置文件。
- `evals/` 与 `benchmarks/` 用于开发比较和回归研究，不能外推为用户侧经济收益或质量承诺。

## 6. 隐私、本地性与安全

- HUI 不做持续 telemetry。
- 安装阶段的 `npx`、插件 CLI、skills CLI 或远程安装方式可能访问对应 registry、仓库或 host 服务；是否联网取决于用户选择的安装路径和平台工具。
- `/hui-stats` 只读取本地 Claude Code session JSONL；其结果只代表可读取的本地记录。
- `/hui-session --compact` 不覆盖原 transcript。
- `hui-compress` 只处理用户显式指定且符合安全策略的文件；敏感路径和不支持类型会被拒绝。
- `hui-shrink` 默认不启用；上游 MCP 命令必须由用户显式配置。它不改请求体和 tool call 返回值。

## 7. 质量与维护

仓库提供以下检查入口：

```bash
npm test
npm run release:preflight
npm run sync-assets
npm run check-assets
```

| 检查 | 目的 |
|---|---|
| `npm test` | Node、Python 和 package smoke 测试。 |
| `release:preflight` | 发布前离线完整性检查。 |
| `sync-assets` | 从 canonical `skills/` 同步 host mirrors 与 `dist/hui.skill`。 |
| `check-assets` | 检查生成镜像是否漂移。 |

维护规则：

1. `skills/` 是技能内容唯一 canonical 来源；不要直接修改生成镜像。
2. 新增 provider 时，同时更新安装器 provider matrix、安装文档、能力说明和测试。
3. 功能描述必须能追溯到当前源码、命令定义或 canonical skill。
4. 不将临时本机环境、固定测试数量、一次性运行结果或发布状态写成长期产品事实。
5. 涉及 token、成本、性能和质量的文案以 [`docs/HONEST-NUMBERS.md`](docs/HONEST-NUMBERS.md) 为边界来源。

## 8. 后续计划

### 近期

- [ ] 发布与版本化流程：npm、GitHub release、tag 与可验证分发资产。
- [x] `--migrate-from-hui`：默认检查，`--force` 应用受管 orphan hook、重复 hook 与失效 statusline 修复；不覆盖用户 entries。
- [x] 安装 manifest：记录 standalone Claude hooks 的受控文件摘要；uninstall 仅删除摘要匹配文件，保留用户改动。详见 `docs/installer-lifecycle.md`。
- [x] 规则冲突扫描：`hui-init --check-conflicts [--json]` 检查受管 target 中非 HUI 规则，不写文件。
- [x] 压缩安全流程：全量/增量改写使用原子 backup/replace，支持 `--preview` 与 `--restore`，并作严格结构验证。
- [x] MCP response 边界：`hui-shrink` 根据 JSON-RPC request ID/method 只改 list response，不改 `tools/call`。

### 中期

- [ ] Eval quality gate：统一输出结构保留、fidelity 和异常样本信息。
- [ ] 可选 LLM fidelity judge：结构化结果、版本化 rubric、仅手动或受保护流程运行。
- [ ] HUI profiles：minimal、technical、documentation、Chinese-wenyan 等预设，统一渲染到不同 host 格式。
- [x] 规则冲突检测：扫描 HUI 受管 rule target；只报告现有非 HUI 规则和可选 target 范围，不自动覆盖。
- [ ] 声明式分发 manifest：减少 host mirror、zip、installer asset 与 capability 漏同步。

### 探索项

- [ ] 跨模型 provider adapter：在安全预算与受保护 secrets 前提下扩展 eval runner。
- [ ] 可选本地 effectiveness 研究：仅在版本化评测数据、明确假设和置信度说明齐备后探索；不得转化为未经验证的用户侧 savings 承诺。

## 9. 当前限制与已知问题

| 范围 | 限制 / 风险 |
|---|---|
| Host 能力 | 非 Claude Code host 可能没有 hooks、状态栏、slash command 注册、transcript 或本地日志。 |
| 平台检测 | 自动检测受 PATH、扩展目录、host 版本和 soft provider 策略限制；必要时使用 `--only <id>`。 |
| 本地会话工具 | `/hui-stats` 与 `/hui-session` 依赖 Claude Code JSONL/hook 契约；host 格式变化可能影响可用性。 |
| 文件改写 | 仅支持自然语言文件；即使通过结构校验，语义仍需用户复核。 |
| MCP proxy | pre-1.0；只改发现类响应的指定 prose 字段，字段集与规则可能调整。 |
| 分发镜像 | host mirrors、plugin 和 zip 必须从 canonical skills 同步；漏同步会导致不同平台文案或行为漂移。 |
| 外部依赖 | 远程安装、自动检测与 provider 集成依赖 npm、registry、GitHub、CLI 和网络可用性。 |

## 11. 所有权与发布身份

- tracked source、package/plugin metadata、funding、installer links、skills provenance 和本地 Git remote 使用 `HUI` / `HUI/next-token`。
- License 与 package/plugin display attribution 使用 `HUI Contributors`，表示 HUI 的集体版权与作者身份。
- repo-local future commit identity 为 `HUI <automation@hui.local>`；generated asset workflow 使用 `HUI Automation <automation@hui.local>`。
- canonical `hui-commit` 默认不添加 AI 或 co-author trailer。
- 本地 verified history mirror 已将 reachable commit author/committer 改为 HUI，并移除 Claude co-author trailer。发布该历史仍需外部 GitHub 管理员在维护窗口 force-with-lease 推送。
- 外部步骤：确保 `HUI/next-token` GitHub organization/repository、npm publisher、marketplace/funding、Actions secrets/protections 都归 HUI 控制；GitHub PR、release、Actions log、fork、cache 与已有 clone 的旧 metadata 需在平台侧单独处理。

## 12. 项目结构

```text
hui-main/
├── bin/                         # 统一安装器与 provider 集成
├── commands/                    # slash command 定义
├── src/
│   ├── hooks/                   # Claude Code hooks、模式、session、stats、statusline
│   ├── tools/hui-init.js        # 项目规则初始化
│   ├── plugins/opencode/        # OpenCode 原生集成
│   └── mcp-servers/hui-shrink/  # 可选 MCP description/prose proxy
├── skills/                      # canonical skills 来源
├── agents/                      # huicrew agent 定义
├── scripts/                     # 同步、打包、发布检查
├── tests/                       # Node 与 Python 测试
├── evals/                       # 开发评测工具
├── benchmarks/                  # 开发比较工具
├── docs/                        # 网站与边界文档
├── plugins/hui/                 # 插件发布资产
└── dist/hui.skill               # 生成的 skill 包
```

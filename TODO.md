# HUI：功能、使用、验证与路线图

> 面向 AI coding agent 的 focused technical-work toolkit。npm 包名：`next-token-hui`；产品与命令名：`HUI` / `hui`；源码仓库：`everything-ok/next-token`。

## 1. 产品契约

HUI 通过 canonical skills、始终生效规则、host hooks、安装器和测试，帮助 coding agent：

- 保持技术回复直接、简洁，并保留代码、命令、路径、错误和安全信息；
- 以证据为先，区分已观察事实、推断、假设和未知/受阻信息；
- 在非平凡任务中明确范围、验收条件和验证方式；
- 完成后如实报告运行过的检查、结果和未运行/被阻塞项；
- 避免无关扩展、虚构 API/测试结果/发布状态及不安全的实现。

HUI **不是** 模型能力、准确率、成本、token 节省、延迟或账单测量工具。提示词和规则不能保证杜绝幻觉、验证 HUI 无法访问的工具输出、绕过 host 权限，或让不支持 hooks 的平台获得 Claude Code 同等能力。量化文案边界见 [`docs/HONEST-NUMBERS.md`](docs/HONEST-NUMBERS.md)。

## 2. 当前功能

| 功能 | 用户效果 | Canonical 来源 | 支持范围 |
|---|---|---|---|
| Evidence-first constraints | 要求事实依据、未知披露、验收与验证报告；禁止虚构 | `skills/hui-constraints/` | 所有安装了 skill/rule 的 host；强制能力取决于 host |
| HUI 表达模式 | `lite`、`full`、`ultra`、文言强度；去除填充语但保留技术内容 | `skills/hui/` | Claude Code、Gemini、OpenCode；其他平台按其 skill/rule 支持 |
| 模式持久化 | 显式 `/hui` 或明确启用 HUI 才持久化；普通“简短回答”只影响当前回复 | `src/hooks/hui-mode-tracker.js`、OpenCode plugin | Claude Code、OpenCode |
| 项目规则初始化 | 写入支持 host 的 repo 规则；支持 dry-run、冲突检测和指定 host | `src/tools/hui-init.js`、`src/rules/hui-activate.md` | Cursor、Windsurf、Cline、Copilot、OpenCode、AGENTS/OpenClaw 等 |
| 提交/审查辅助 | `/hui-commit` 生成 Conventional Commit 文案；`/hui-review` 输出单条 finding | `skills/hui-commit/`、`skills/hui-review/` | host 命令能力允许时 |
| 安全文本压缩 | 仅改写明确指定的自然语言文件，创建备份并做结构校验 | `skills/hui-compress/` | 支持该 skill 的 host |
| Claude 本地工具 | `/hui-session`、`/hui-stats`、状态栏与本地文本示例 | `src/hooks/` | 仅 Claude Code |
| huicrew | investigator / builder / reviewer 协作角色 | `agents/` | 支持 agent 文件的 host；不持久改写 agent 模型 |
| MCP prose proxy | 可选 `hui-shrink` 仅处理 MCP discovery 响应的 prose 字段 | `src/mcp-servers/hui-shrink/` | 显式配置的 stdio MCP host |

## 3. 平台能力

运行以下命令查看当前机器实际检测和可安装项：

```bash
node bin/install.js --list
```

| 集成级别 | 平台 | 已支持能力与限制 |
|---|---|---|
| 完整本地集成 | Claude Code | hooks、持久模式、状态栏、`/hui-session`、`/hui-stats`、本地 demo；完整 constraints 会在 SessionStart 加载 |
| 原生插件/命令 | OpenCode | plugin、规则、agent、skills、native commands；无 Claude 本地 transcript、stats 或 statusline 等价能力 |
| 原生 skills | Hermes Agent | 所有 HUI skills（包括 `hui-constraints`）；不声明 hook 等价能力 |
| 可移植命令/skills | Gemini CLI、OpenClaw | modes 与 skills/rules；具体命令由 host 能力决定 |
| 规则或 skills 集成 | Codex、Cursor、Windsurf、Cline、GitHub Copilot、Continue、Kilo、Roo、Augment、Aider Desk、Amp、IBM Bob、Crush、Devin、Droid、ForgeCode、Block Goose、iFlow、Kiro、Mistral Vibe、OpenHands、Qwen、Rovo Dev、Tabnine、Trae、Warp、Replit、Junie、Qoder、Antigravity 等 | prompt/rule 级约束；不承诺 hooks、状态栏、transcript 或本地日志 |

“可安装”不等于每项功能均可用。soft provider 需使用 `--only <id>` 显式选择。

## 4. 安装与使用

### 安装器

先预览后写入（npm 包名 `next-token-hui`）：

```bash
npx -y next-token-hui -- --dry-run --all
npx -y next-token-hui -- --all
```

一键安装（自动检测已装 agent）：

```bash
npx -y next-token-hui
```

curl/irm 一行安装（thin shim，转发到 `bin/install.js`）：

```bash
# macOS / Linux / WSL / Git Bash
curl -fsSL https://raw.githubusercontent.com/everything-ok/next-token/main/install.sh | bash

# Windows PowerShell 5.1+
irm https://raw.githubusercontent.com/everything-ok/next-token/main/install.ps1 | iex
```

全局安装后直接用 `hui`：

```bash
npm install -g next-token-hui
hui --help
```

源码目录（clone 后）：

```bash
node bin/install.js --list
node bin/install.js --doctor
node bin/install.js --with-init --dry-run
node src/tools/hui-init.js . --check-conflicts --json
```

常用 flags：

| flag | 作用 |
|---|---|
| `--all` | hooks + 每仓库 init 规则文件 |
| `--only <agent>` | 只装指定 agent（见 `--list`） |
| `--with-hooks` | 强制装 Claude Code standalone hooks |
| `--with-init` | 在当前仓库写 IDE 规则文件 |
| `--minimal` | 只装插件/扩展，不装 hooks |
| `--with-mcp-shrink="<上游命令>"` | 注册 hui-shrink MCP 代理（需带上游） |
| `--dry-run` | 只打印不执行 |
| `--non-interactive` | 不交互，用默认值 |
| `--config-dir <路径>` | 指定配置目录（默认 `~/.claude`） |
| `--doctor` | 诊断 node/npm/hooks/plugin 状态（只读） |
| `--migrate-from-hui [--force]` | 修复旧的 standalone 安装 |

### 卸载

```bash
npx -y next-token-hui -- --uninstall          # 预览加 --dry-run
hui --uninstall                                # 全局安装后
```

卸载会清理：`~/.claude/hooks/` 下的 hui hook 文件、`settings.json` 里的 hui hook/statusline 接线、`claude plugin uninstall hui` 与 `claude mcp remove hui-shrink`，以及运行期状态文件（`.hui-active` / `.hui-active.prev` / `.hui-history.jsonl` / `.hui-mode-log.jsonl`）。`--only` 装的 IDE skill 需在对应 IDE 的 skill 管理器移除；`--with-init` 写的每仓库文件（`.cursor/`、`.windsurf/`、`AGENTS.md` 等）需手动删。

### 常用命令（Claude Code 内）

> 注意：`hui`（终端命令）与 `/hui`（会话 slash 命令）是两件事。`hui` 终端命令只在 `npm install -g next-token-hui` 全局安装后可用；`npx -y next-token-hui` 是一次性运行，不注册 `hui` 命令。`/hui` 等 slash 命令在 Claude Code 会话内、安装 plugin 后即可用，与全局安装无关。

```text
/hui                    显式启用默认 full 模式
/hui lite|full|ultra     切换表达强度
/hui wenyan              切换文言模式（含 wenyan-lite / wenyan-ultra / wenyan-full）
/hui off                 停用持久模式（或说 "stop hui" / "normal mode"）
/hui on <level>          兼容写法，如 /hui on ultra
/hui-constraints         查看 evidence-first 约束摘要
/hui-commit              生成提交文案（独立模式，下一句普通 prompt 自动回到原 prose 模式）
/hui-review              生成单条审查 finding（独立模式，同上）
/hui-compress notes.md   改写受支持的自然语言文件（独立模式，同上）
/hui-session [--compact] Claude Code 本地 transcript 操作（不改原始 transcript）
/hui-stats [--all] [--since 7d]  Claude Code 本地 usage 观察
/hui-init --dry-run      预览项目规则初始化
/hui-help                帮助
/hui demo                本地固定文本示例，不调用模型、不读写会话状态
```

旧别名仍可用：`/hui-lite`、`/hui-ultra`、`/hui-global`(=full)、`/hui:hui <...>`(marketplace namespace 形式)；自然语言 `hui mode` / `talk like hui` / `activate hui` 也能触发。

诊断（终端，非会话内）：

```bash
npx -y next-token-hui -- --doctor            # 机器可读加 --json
npx -y next-token-hui -- --migrate-from-hui --force   # 修复旧 standalone 安装
```

## 4.5 命令验证矩阵（1.1.1 实测）

> 以下命令均在隔离 `$CLAUDE_CONFIG_DIR`（不影响真实 `~/.claude`）下、`next-token-hui@1.1.1` 全程实测通过。会话 slash 命令通过真实执行 `hui-mode-tracker.js` hook（喂 `{prompt:"/..."}` JSON on stdin）验证，非静态检查。每条记 flag 写入结果与退出码。

### 终端 CLI（全局 `npm install -g next-token-hui` 后）

| 命令 | 期望 | 结果 |
|---|---|---|
| `hui --help` | 输出用法，exit 0 | ✅ |
| `hui --list` / `--list --json` | 35 providers，JSON 可解析 | ✅ |
| `hui --doctor` | all checks passed | ✅ |
| `hui --migrate-from-hui` | 干净时报 "no migration actions needed" | ✅ |
| `hui --dry-run --all` | 只打印不写盘 | ✅ |
| `hui --only claude --with-hooks` | 装 plugin + hooks | ✅ |
| `hui --uninstall` | hooks/settings/状态文件/plugin 全清 | ✅ |
| 重复装（幂等） | SessionStart hook 数 = 1，不重复 | ✅ |

### 会话 slash 命令（通过 hook 实跑）

| 命令 | flag 写入 | exit |
|---|---|---|
| `/hui` | full | 0 |
| `/hui lite` / `/hui full` / `/hui ultra` | lite / full / ultra | 0 |
| `/hui wenyan` / `wenyan-lite` / `wenyan-ultra` / `wenyan-full` | 对应值（wenyan-full→wenyan） | 0 |
| `/hui off` / `stop-hui` | flag 删除 | 0 |
| `/hui:hui lite`（marketplace namespace） | lite | 0 |
| `/hui-lite` / `/hui-ultra` / `/hui-global`（legacy） | lite / ultra / full | 0 |
| `hui mode`（自然语言） | full | 0 |
| `/hui on ultra` | ultra | 0 |
| `/hui-commit` / `/hui-review` / `/hui-compress` | 独立模式 + **prev restore 正确**（下句普通 prompt 回到原 prose 模式） | 0 |
| `/hui demo` | 本地文本示例，不调模型 | 0 |
| `/hui bogus`（非法参数） | 保持原 mode 不变 | 0 |
| `/hui-stats` / `--all` / `--since 7d` | 无会话/无记录时正确报错 | 0 |
| `/hui-session` / `--compact` | 无 transcript 正确 block | 0 |
| `/hui-help` / `/hui-init` | 走 command 路径，不崩 | 0 |

### 辅助验证

| 项 | 结果 |
|---|---|
| 15 个 slash 命令 toml manifest（`tomllib` 真解析） | ✅ 15/15 合法 |
| SessionStart hook `hui-activate.js` | ✅ 输出规则 |
| statusline（随 mode 变徽章：`[HUI:ULTRA]` 等） | ✅ |
| 卸载清理 `.hui-active` / `.prev` / `.history` / `.mode-log` / plugin | ✅ 全清 |



- `/hui on` 保持兼容：启用默认模式。
- `/hui on <未知值>` 或 `/hui mode <未知值>` 不改变已有模式；应改用列出的合法强度。
- “be brief”“less tokens”“短一点”等普通请求不改变后续会话模式。
- 用户询问模型身份时，agent 只能陈述当前 host/runtime 已知的模型和提供方；无法确认必须明确未知。

## 5. 使用效果与边界

### 可以期待

- 技术回答减少寒暄、重复、模糊断言和无关扩展。
- 有可用材料时，结论可追溯到文件、符号、命令、错误或工具输出。
- 不确定时明确标记，不把假设包装成事实。
- 改动完成时区分“已实现”“已验证”“未验证/被阻塞”。
- 文件压缩保留备份并验证受保护结构。

### 不应推断

- HUI 不会自动证明模型推理正确，也不能保证所有事实都已被工具验证。
- HUI 不提供统一 token/cost/performance/accuracy 保证或“未启用 HUI”的对照基线。
- `/hui-stats` 是可读取本地 JSONL 的观察工具，不是账单。
- `/hui-compress` 不适用于代码或配置文件，且语义仍需人工复核。
- prompt-level constraints 不能替代权限检查、CI、代码审查或显式外部操作确认。

## 6. 验证与维护

`skills/` 是唯一 canonical 来源。镜像、plugin assets 与 `dist/hui.skill` 必须通过同步脚本生成，不直接手改。

```bash
npm run sync-assets       # 生成 mirrors 与 skill archive（会改文件）
npm run check-assets      # 检查 generated assets 漂移
npm run release:preflight # 验证 hook checksum 与 release contract
npm test                  # Node、Python 与 package smoke
python tests/verify_repo.py # 更广泛静态/安装验证；Windows 会跳过部分 hook flow
npm publish --dry-run --access public # 仅预演包内容与 npm publish 流程
```

| 检查 | 覆盖 | 已知盲区 |
|---|---|---|
| `check-assets` | canonical skill 与生成镜像一致 | 不执行 host runtime |
| `release:preflight` | hook manifest、version/tag contract | 不发布、不做远程鉴权 |
| `npm test` | installer、hooks、parser、skills、压缩、package smoke | 不等于所有 host UI 的端到端验证 |
| `verify_repo.py` | 语法、manifest、安装静态检查 | Windows 跳过部分 shell/hook 流程 |
| PR workflow | `check-assets`、preflight、`npm test` | 仍依赖 GitHub Actions 可用性 |

## 7. 当前限制

1. constraints 在 generic host 上是模型指导，不是不可绕过的运行时策略。
2. `HUICREW_*_MODEL` 只解析为受限、非持久偏好；当前不改写 agent 文件。没有受支持会话级模型 API 的 host 会明确不提供动态覆盖。
3. 项目当前没有独立 lint、format、typecheck、coverage 或通用 build gate；主要质量门是行为/包测试与 preflight。
4. 分发镜像与平台能力会随 host API 演进，新增 host 必须同时更新 installer、能力文档和回归测试。
5. 安装、远程 release verification 和各平台 CLI 可能访问其各自 registry/仓库；HUI 本身不持续 telemetry。

## 8. 后续计划

### 已完成基础

- [x] canonical skills 与自动镜像同步
- [x] `hui-init` dry-run、冲突扫描与受控写入
- [x] 自然语言压缩的 backup/preview/restore 与结构保护
- [x] MCP discovery response 的受限 prose 处理
- [x] evidence-first constraints、Claude SessionStart 组合加载、OpenCode/Hermes 分发补齐
- [x] 普通 PR 的 asset/preflight/full-test 质量门

### 近期

- [ ] 为 constraints 增加可版本化的行为评测样本：证据引用、未知处理、范围控制、测试报告。
- [ ] 评估并仅在有正式 host API 时增加 huicrew 会话级 model override；否则保持明确 unsupported 状态。
- [ ] 为关键 host 增加真实安装后的命令发现 smoke test。
- [ ] 建立 changelog 与发布说明模板，记录用户可见变更和迁移风险。

### 中期

- [ ] 声明式 distribution manifest，统一 skills、commands、agents、zip 与 installer 清单，减少遗漏。
- [ ] 可选 fidelity judge：结构化 rubric、版本化数据集、受保护的手动运行；不得转化为未经验证的准确率承诺。
- [ ] HUI profiles（minimal、technical、documentation、Chinese-wenyan），统一渲染到不同 host 格式。

## 9. 发布决策记录

当前 npm package：`next-token-hui`，版本以 [`package.json`](package.json) 为准；Node.js 要求 `>=18`，公开包使用 `publishConfig.access: public`；源码仓库 `everything-ok/next-token`，发布 tag 为 `v<version>`，远程 hook 资产从该 tag 拉取并对照 `src/hooks/checksums.sha256` 校验。

受支持发布流程：

1. 更新版本并确保 tag 为相同的 `v<version>`。
2. 运行第 6 节全部验证和 `npm publish --dry-run --access public`。
3. 推送 tag，等待 `release-verify.yml`。
4. 由有权限的维护者发布 GitHub Release。
5. 审批 GitHub `npm-publish` protected environment；workflow 通过 npm Trusted Publishing/OIDC 以 provenance 发布并 smoke-test 精确版本。

本地直接 `npm publish`（账号开启 2FA 时需 `--otp=<code>` 或浏览器授权）只在操作者已 npm 登录、拥有 `next-token-hui` 发布授权、符合组织/2FA/provenance 策略且获得显式批准绕过 GitHub/OIDC 流程时进行；它是不可逆外部动作，不会自动执行。

### 发布历史

- `1.1.1`（2026-07-28）：修复 `1.1.0` 端到端验证发现的两个致命 bug——standalone hook 因 `require('../hui-command-parser')` 加载即崩（内联 parser 自洽）；GitHub 仓库 `HUI/next-token` 404 致 plugin 安装与 integrity fetch 失败（统一指向 `everything-ok/next-token`）。同时统一 npm 包名 `next-token-hui`（shim/docs/skills）、`uninstall` 清理运行期状态文件、重算 `checksums.sha256` 与 skill 镜像、补 e2e hook 实跑 + uninstall 状态文件 + parser 同步性回归测试。
- `1.1.0`（首发）：HUI installer 统一 Node 脚本、canonical skills、hooks/statusline、provider matrix。

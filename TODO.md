# HUI：功能、使用、验证与路线图

> 面向 AI coding agent 的 focused technical-work toolkit。npm 包名：`next-token`；产品与命令名：`HUI` / `hui`。

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

先预览后写入：

```bash
npx -y next-token -- --dry-run --all
npx -y next-token -- --all

# 源码目录
node bin/install.js --list
node bin/install.js --doctor
node bin/install.js --with-init --dry-run
node src/tools/hui-init.js . --check-conflicts --json
```

### 常用命令

```text
/hui                    显式启用默认 full 模式
/hui lite|full|ultra     切换表达强度
/hui wenyan              切换文言模式
/hui off                 停用持久模式
/hui-constraints         查看 evidence-first 约束摘要
/hui-commit              生成提交文案
/hui-review              生成单条审查 finding
/hui-compress notes.md   改写受支持的自然语言文件
/hui-session [--compact] Claude Code 本地 transcript 操作
/hui-stats [--all]       Claude Code 本地 usage 观察
/hui-init --dry-run      预览项目规则初始化
```

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

当前 npm package：`next-token`，版本以 [`package.json`](package.json) 为准；Node.js 要求 `>=18`，公开包使用 `publishConfig.access: public`。

受支持发布流程：

1. 更新版本并确保 tag 为相同的 `v<version>`。
2. 运行第 6 节全部验证和 `npm publish --dry-run --access public`。
3. 推送 tag，等待 `release-verify.yml`。
4. 由有权限的维护者发布 GitHub Release。
5. 审批 GitHub `npm-publish` protected environment；workflow 通过 npm Trusted Publishing/OIDC 以 provenance 发布并 smoke-test 精确版本。

未登录 GitHub 时，无法创建/发布 Release 或审批 protected environment，因此**无法完成项目规定的实际 npm 发版**。本地直接 `npm publish` 只可能在操作者已 npm 登录、拥有 `next-token` 发布授权、符合组织/2FA/provenance 策略且获得显式批准绕过 GitHub/OIDC 流程时进行；它是不可逆外部动作，不会自动执行。

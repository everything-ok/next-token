# TODO — HUI 项目路线图

> 让 AI 说话更简洁，同等技术内容，减少 token 消耗。

---

## 项目身份

HUI 是 AI coding agent 行为插件，通过注入 system prompt 规则让模型压缩输出风格。

- **产品名**: HUI（插件、skills、`/hui`、全局 `hui` 命令、状态栏 badge）
- **npm 分发名**: `next-token`（`npx -y next-token -- ...`）
- **仓库**: `2454760302hui/next-token`（GitHub、marketplace、skills source）
- **版权**: Copyright (c) 2026 HUI Contributors

HUI 完全私有化。项目内任何文件不含其他开发者名字。所有身份标识统一为 HUI。

---

## 已实现并验证的功能

以下功能均已通过测试验证（`npm test` + `python tests/verify_repo.py` + `npm run test:package` + `npm run release:preflight`）。

### 核心压缩

| 功能 | 实现方式 | 验证状态 |
|---|---|---|
| 输出压缩 | SKILL.md 规则注入 system prompt | ✅ |
| SessionStart hook | `src/hooks/hui-activate.js`，每次开新会话注入规则 | ✅ |
| 模式切换 | `src/hooks/hui-mode-tracker.js`，6 档强度 | ✅ |
| 6 档强度 | lite / full / ultra / wenyan-lite / wenyan-full / wenyan-ultra | ✅ |
| 状态栏 badge | `hui-statusline.sh` / `.ps1`，显示 `[HUI]` + 节省 token | ✅ |

### Slash 命令

| 命令 | 功能 | 验证状态 |
|---|---|---|
| `/hui` | 激活 full 模式 | ✅ frontmatter 契约测试 |
| `/hui lite\|ultra\|wenyan` | 切换强度 | ✅ |
| `/hui-commit` | Conventional Commits 提交信息（≤50 字符） | ✅ |
| `/hui-review` | 一行式代码 review | ✅ |
| `/hui-compress <file>` | 压缩 .md 文件（节省 ~46% input token） | ✅ |
| `/hui-stats` | 真实 output token 用量 + 节省估算 | ✅ 37 测试 |
| `/hui-help` | 快速参考卡片 | ✅ |
| `/hui-init` | 在当前仓库写入规则文件 | ✅ |
| `stop hui` / `normal mode` | 恢复正常措辞 | ✅ |

### 跨平台安装

| 功能 | 验证状态 |
|---|---|
| 统一安装器 `bin/install.js` | ✅ 113 测试 |
| ~35 平台 provider matrix | ✅ `--list` 可用 |
| 自动检测 IDE/agent | ✅ |
| 一键 curl/PowerShell 安装 | ✅ shim 契约测试 |
| `--dry-run` 不写盘 | ✅ 修复并测试 |
| `--config-dir` 路径展开 | ✅ 修复并测试 |
| OpenCode agent transform（CRLF 兼容） | ✅ 修复并测试 |
| Hook checksum 完整性校验 | ✅ release preflight |
| 卸载保留用户自定义 | ✅ 测试 |

### 平台支持

**自动激活**：Claude Code、Gemini CLI、opencode、OpenClaw、Hermes Agent。

**规则文件激活**：Cursor、Windsurf、Cline、GitHub Copilot、Augment Code、iFlow CLI、Kiro CLI。

**手动 `/hui`**：Codex、Continue、Kilo Code、Roo Code、Aider Desk、Sourcegraph Amp、IBM Bob、Crush、Devin、Droid、ForgeCode、Block Goose、Mistral Vibe、OpenHands、Qwen Code、Atlassian Rovo Dev、Tabnine CLI、Trae、Warp、Replit Agent、JetBrains Junie、Qoder、Google Antigravity。

### Huicrew 团队协作

| Agent | 职责 | 验证状态 |
|---|---|---|
| `huicrew-investigator` | 只读代码定位 | ✅ |
| `huicrew-builder` | ≤2 文件外科式编辑 | ✅ |
| `huicrew-reviewer` | diff review | ✅ |
| 模型覆盖 | `HUICREW_*_MODEL` 环境变量 | ✅ 26 测试 |

### hui-compress 记忆文件压缩

| 功能 | 验证状态 |
|---|---|
| 全文件压缩 | ✅ |
| 增量压缩（`--base`/`--incremental`） | ✅ 只压缩变更 prose |
| 敏感文件拒绝 | ✅ |
| 外置备份 + 回读验证 | ✅ |
| 验证失败自动回滚 | ✅ |
| 结构保护（code/URL/path/heading/inline code） | ✅ |
| `--dry-run` 预览 | ✅ |

### 评测与基准

| 功能 | 验证状态 |
|---|---|
| 三臂评测 `evals/llm_run.py` | ✅ baseline/terse/skill |
| 多模型支持 `HUI_EVAL_MODELS` | ✅ |
| Token 统计 `evals/measure.py` | ✅ |
| Fidelity 门禁 `evals/fidelity.py` | ✅ 确定性 literal 检查 |
| Benchmark `benchmarks/run.py` | ✅ 真实 API 对照 |

### /hui-stats

| 功能 | 验证状态 |
|---|---|
| 真实 output token（读 JSONL） | ✅ |
| Cache read token | ✅ |
| 模式归因（mode 切换时间） | ✅ |
| USD 节省估算 | ✅ |
| `--share` 可分享摘要 | ✅ |
| `--all` 跨会话聚合 | ✅ |
| `--since` 时间窗口 | ✅ |

### MCP proxy

| 功能 | 验证状态 |
|---|---|
| `hui-shrink` MCP 中间件 | ✅ 18 测试 |

### 发布与一致性

| 功能 | 验证状态 |
|---|---|
| 品牌契约测试 `branding.test.mjs` | ✅ 8 测试 |
| Tarball smoke `package_smoke.py` | ✅ 真实 npm pack |
| Release preflight `release_preflight.py` | ✅ checksum + tag 一致 |
| 资产同步 `sync_assets.py` | ✅ 镜像幂等 |
| 根 `.agents` HUI skills 一致 | ✅ byte-identical |
| 两份 skills-lock hash 一致 | ✅ |
| Release verify workflow（tag-only） | ✅ 远端 hooks 校验 |

---

## 待实现功能

### 高优先级

- [ ] **npm 发布与 GitHub 仓库公开**：当前 `next-token` 包未发布到 npm registry，仓库 `2454760302hui/next-token` 未推送。发布后 `npx -y next-token` 与 curl 一键安装才可用。
- [ ] **`--doctor --json` 诊断模式**：无写入地诊断 Node/npm、provider 检测、插件/skills/hooks 状态、过期安装。复用 `bin/install.js` provider matrix。
- [ ] **`--migrate-from-hui` 迁移模式**：默认 dry-run，迁移旧 HUI 安装配置时仅处理 marker 管理内容，绝不覆盖用户 settings/rules。
- [ ] **Eval quality gate 强化**：扩展 `evals/measure.py` 读取 `results-by-model.json`，与 `fidelity.py` 合并输出 model × skill 的压缩率、hard-gate pass rate、最差样本。
- [ ] **`/hui-stats` 净收益估算**：用版本化 eval 数据替代硬编码压缩率，综合规则 input 开销、output 节省、cache-read，输出净省/净亏/未知与置信等级。

### 中优先级

- [ ] **增量压缩安全补齐**：令 `compress_incremental()` 复用敏感路径拒绝、文件大小限制、外置备份、原子写入；新增 Markdown block splitter，保护 table/blockquote/HTML/list 结构。
- [ ] **PR investigator 测试计划化**：将固定路径映射升级为结构化 impact map，自动运行快速 deterministic checks，只将需网络或慢速检查列为建议。
- [ ] **声明式分发 manifest**：集中 canonical source、host mirrors、zip、installer assets、provider capability，减少新增平台时遗漏发布面。
- [ ] **LLM judge fidelity**：确定性 checker 之外，新增可选 LLM judge，结构化 JSON 输出（verdict/遗漏 claims/冲突/严重度/依据/rubric version）。仅手动或受保护分支运行。
- [ ] **跨模型 provider adapter**：以 Claude runner 为基础扩展 OpenAI/Gemini；密钥只来自受保护 workflow secrets，设请求/预算上限。

### 低优先级

- [ ] **HUI profile system**：预设 minimal/technical/documentation/Chinese-wenyan profile，统一渲染为各平台规则格式。
- [ ] **规则冲突检测**：扫描 CLAUDE.md、AGENTS.md、Cursor rules，发现冲突的 verbosity/language/safety 指令，仅报告不自动改。
- [ ] **跨平台验收矩阵 CI**：为 Bash/PowerShell/Windows/WSL/macOS/Linux 建立 fixture 驱动的安装器契约测试。
- [ ] **可追踪安装 manifest**：每次安装记录创建的文件/patch/版本，uninstall 依据 manifest 精确删除。
- [ ] **`--backup` / `--restore`**：修改前对 settings.json、OpenCode config、SOUL.md 记录带时间戳备份。
- [ ] **本地 token effectiveness report**：扩展 `hui-stats` 按 provider/mode/session 输出净 token/USD 报告，opt-in，默认不遥测。

---

## 项目结构

```
hui/
├── install.sh / install.ps1           # 统一安装器包装（调用 npx -y next-token）
├── bin/
│   ├── install.js                     # 唯一安装逻辑
│   └── lib/
│       ├── brand.js                   # HUI 产品与 next-token 分发常量
│       ├── settings.js                # Claude settings.json 读写
│       ├── openclaw.js                # OpenClaw 安装辅助
│       └── opencode-agent.js          # OpenCode agent frontmatter 清洗
├── src/
│   ├── rules/hui-activate.md          # 核心规则本体
│   ├── hooks/
│   │   ├── hui-activate.js            # 会话启动注入规则
│   │   ├── hui-mode-tracker.js        # 模式切换 + 状态持久化
│   │   ├── hui-stats.js               # 读取会话 JSONL，输出真实 token
│   │   ├── hui-config.js
│   │   ├── huicrew-model-overrides.js # HUICREW_*_MODEL 覆盖
│   │   ├── hui-statusline.sh / .ps1   # 状态栏 badge
│   │   ├── install.sh / .ps1          # Claude hooks 安装器
│   │   ├── uninstall.sh / .ps1        # Claude hooks 卸载器
│   │   └── checksums.sha256           # 远端 hook 完整性校验
│   ├── tools/hui-init.js              # 初始化工具
│   ├── plugins/opencode/              # opencode 原生插件
│   └── mcp-servers/hui-shrink/        # token 统计代理
├── skills/                            # skill 包源码（canonical）
│   ├── hui/  hui-commit/  hui-review/
│   ├── hui-compress/  hui-stats/  hui-help/
│   └── huicrew/
├── commands/                          # slash command 定义
├── agents/                            # huicrew agent 角色定义
├── scripts/
│   ├── sync_assets.py                 # 资产同步与漂移检查
│   ├── package_smoke.py               # npm tarball 烟雾测试
│   └── release_preflight.py           # 发布前离线完整性检查
├── tests/                             # Node + Python 测试
├── evals/                             # 三臂评测 + fidelity
├── benchmarks/                        # 真实 API 对照
├── .github/workflows/
│   ├── sync-skill.yml                 # 镜像同步
│   ├── pr-investigator.yml            # PR 变更影响报告
│   └── release-verify.yml             # tag-only 远端校验
├── .agents/ .augment/ .iflow/ .kiro/  # host 镜像（生成产物）
├── plugins/hui/                       # Codex 插件包
└── dist/hui.skill                     # 构建产物
```

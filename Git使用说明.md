# Git 使用说明（本仓库）

> 面向本项目的单人开发场景。远程仓库：`https://github.com/BugsAreLife/eCAT.git`

---

## 一、当前状态（2026-10-25）

| 项 | 状态 |
|---|---|
| 分支 | `main` |
| 提交 | 2 次：`9674938` 报告初稿 → `6a56223` 展示网页初稿 + 目录重组（已打 `v0.1`） |
| 远程 | `origin` 已配置，`main` 已与远程同步 |
| 标签 | 本地有 `v0.1`；**远程还没有**（需推送一次） |
| 可见性 | **⚠️ 当前是公开仓库**，建议改为私有（见第五节） |
| 本地备份 | `_备份/eCAT-存储点-v0.1-20261025.bundle`（可拷 U 盘） |

---

## 二、日常 5 步（复制即用）

```powershell
cd "D:\UsersData\Desktop\eCAT"

git status --short                 # 1) 看改了什么
git add -A                         # 2) 全部暂存
git commit -m "feat(twin): 接入3D模型"   # 3) 提交
git push                           # 4) 推到远程
git log --oneline --decorate -5     # 5) 看历史
```

**提交信息建议格式**（方便回溯）：

```
feat(展示网页): 新增任务中心 DAG
fix(twin): 修复占位图空指针
docs: 更新README目录结构
chore: 调整 .gitignore
```

---

## 三、VS Code 里怎么点

| 操作 | 位置 |
|---|---|
| 看改动 | `Ctrl+Shift+G` → 源代码管理 |
| 暂存全部 | "更改"标题右侧 `+` |
| 提交 | 上方输入框写信息 → 点 `✓` |
| 推送 | 提交后点 **"同步更改 / Sync Changes"**（或左下角状态栏的同步图标） |
| 看历史 | `...` → 视图 → 时间线；或装 GitLens 扩展 |
| 放弃某文件改动 | 文件右键 → 放弃更改（**不可恢复**） |

> ⚠️ VS Code 的"同步更改"**只推分支、不推标签**。推送标签要在终端执行：
> `git push origin main --tags`

---

## 四、本机特殊配置（已设好，勿删）

这台机器的网络存在 **TLS 中间人拦截**（证书链被替换），导致 git 默认的 Schannel 后端报错：

```
schannel: AcquireCredentialsHandle failed
SSL certificate ... unable to get local issuer certificate (20)
```

为此已在**仓库本地**（只影响本仓库，不污染全局）设置了：

```
http.sslbackend = openssl
http.sslverify = false     # ← 跳过证书校验
credential.helper = wincred # ← 复用 Windows 凭据管理器里已存的 GitHub 凭据
```

**说明与风险**：

- `http.sslVerify=false` 会让 HTTPS 传输失去证书校验，存在被中间人窃听/篡改的风险。
  本机网络本身已在替换证书，此设置属于"适配现状"，不是理想状态。
- **换到正常网络（如家里、手机热点）后，建议关掉校验豁免**：

```powershell
cd "D:\UsersData\Desktop\eCAT"
git config --local --unset http.sslVerify
```

---

## 五、⚠️ 建议把仓库改成私有

当前仓库**匿名即可读取**（公开）。里面包含：

- 参赛作品报告书（未提交的成果，公开有被抄袭/查重风险）
- 平台改造需求规格书（含实验室设备与流程信息）
- 赛题原文（可能涉及课题组内部信息）

**改私有步骤**（网页操作，2 分钟）：

1. 打开 `https://github.com/BugsAreLife/eCAT/settings`
2. 拉到最底部 **Danger Zone** → **Change repository visibility**
3. 选 **Make private** → 输入仓库名确认

改私有后，凭据仍需有效；如果之后 push 报 403，重新登录一次即可。

---

## 六、标签（里程碑）怎么用

```powershell
git tag -a v0.5 -m "3D 模型接入完成"      # 打标签
git push origin --tags                     # 推送全部标签
git tag                                     # 看本地标签
git show v0.1 --stat                        # 看某个标签的内容
```

**本项目建议的里程碑**：

| 标签 | 含义 |
|---|---|
| `v0.1` | 展示网页初稿 + 3D 孪生 + 改造规格书 ✅ |
| `v0.5` | 3D 模型接入 + 演示模式 |
| `v1.0` | 提交版（答辩前冻结） |

---

## 七、救命命令

| 场景 | 命令 |
|---|---|
| 撤销未暂存的改动（**不可恢复**） | `git restore <文件>` |
| 撤销暂存（改动保留） | `git restore --staged <文件>` |
| 撤回最近一次提交（改动保留） | `git reset --soft HEAD~1` |
| 看所有操作记录（误操作救命） | `git reflog` |
| 回到某个里程碑看代码 | `git switch --detach v0.1` → 看完 `git switch main` |
| 从 bundle 完整恢复 | `git clone "_备份/eCAT-存储点-v0.1-20261025.bundle" "D:\恢复目录"` |

---

## 八、离线备份（每次里程碑做一次）

```powershell
cd "D:\UsersData\Desktop\eCAT"
git bundle create "_备份/eCAT-$(Get-Date -Format yyyyMMdd).bundle" --all
git bundle verify "_备份/eCAT-$(Get-Date -Format yyyyMMdd).bundle"
```

生成的 `.bundle` 是**单文件完整仓库**（含全部提交与标签），拷到 U 盘/网盘即可异地留存。
（`.gitignore` 已排除 `*.bundle` 与 `_备份/`，不会被提交进仓库。）

---

## 九、二进制文件注意

仓库里有 docx / png，git 能管但**每次改动都整份存储**：

- `作品报告书-*.docx`：定稿后尽量一次提交，别频繁小改后提交
- `fig/*.png`、`_preview.png`：改图后一起提交即可
- 提交 docx 前**先关闭 Word**，否则可能读到旧内容或提交失败

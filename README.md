# Claude Code Skills Hub

一个 Claude Code Skills 安装台，用来聚合、搜索、选择、批量复制安装命令，并导出 ccswitch 可导入的 skills ZIP。

## 功能

- 聚合 4 个仓库的 skills 数据
- 搜索、筛选和详情浏览
- 列表勾选、选中当前筛选结果、全选全库、只看已选
- 批量复制安装命令
- 生成 ccswitch 导入 ZIP，内含所选 skill 的真实文件夹
- 详情区第一屏直接显示安装动作，不需要向下翻
- 自动生成直白中文描述：按服务类型说明具体对象、动作和典型场景
- 私有后台修正描述：自动描述不准时，可以手动覆盖摘要、能力、人群、场景和分类
- 提供服务器部署方式，方便无法访问 GitHub 的用户直接查看镜像数据

## 本地运行

```bash
npm install
npm run dev
```

访问 Vite 输出的本地地址。

## 同步全量数据

```bash
npm run sync
```

同步脚本会读取 `data/sources.json`，从里面配置的仓库抓取 `SKILL.md`、README 和目录信息，生成 `data/skills.json`：

- `ComposioHQ/awesome-claude-skills`
- `JimLiu/baoyu-skills`
- `anthropics/skills`
- `stellarlinkco/myclaude`

如 GitHub 无法访问，可在能访问 GitHub 的机器或服务器上跑同步脚本，再把生成后的 `data/skills.json` 部署到站点。

### 添加新的 skill 仓库

如果你发现一个好仓库，把它加到 `data/sources.json`：

```json
{
  "repo": "owner/repo",
  "url": "https://github.com/owner/repo.git",
  "type": "curated-source"
}
```

然后运行：

```bash
npm run sync:build
```

### 发现高星候选仓库

可以用 GitHub 搜索自动生成候选清单：

```bash
npm run discover
```

如果遇到 GitHub API 限速，带上 token：

```bash
GITHUB_TOKEN=你的_token npm run discover
```

带 token 时脚本会额外使用 GitHub Code Search 搜索真正的 `SKILL.md`，候选质量会明显更高。

它会生成：

```text
data/source-candidates.json
```

候选评分会参考：

- GitHub stars
- 最近更新时间
- 是否包含 `SKILL.md`
- 是否有 `skills/` 目录
- README / 描述中是否明显提到 Claude Skills

普通候选不会自动进入正式库。高星、强 Claude Skills 信号、且真实包含 `SKILL.md` 的仓库，可以用下面的命令自动加入正式库。

如果你希望高星仓库直接自动进入正式库，可以运行：

```bash
GITHUB_TOKEN=你的_token npm run discover:promote
```

默认自动加入条件：

- stars >= `1000`
- 明确包含 Claude Skills / Claude Code 相关信号
- 仓库里真实存在 `SKILL.md` 或 `.claude/skills`

可以调整阈值：

```bash
AUTO_PROMOTE_MIN_STARS=500 GITHUB_TOKEN=你的_token npm run discover:promote
```

### 私有审核后台

本地启动：

```bash
npm run admin
```

默认地址：

```text
http://127.0.0.1:8787
```

如果部署到服务器，建议只监听本机，然后用 SSH 隧道访问：

```bash
ssh -L 8787:127.0.0.1:8787 user@server
```

也可以设置 token：

```bash
ADMIN_TOKEN=你的密码 npm run admin
```

访问：

```text
http://127.0.0.1:8787/?token=你的密码
```

审核后台的“候选源”页可以：

- 查看 `data/source-candidates.json` 中的候选仓库
- 一键加入正式库，写入 `data/sources.json`
- 一键拒绝，写入 `data/rejected-sources.json`
- 打开 GitHub 查看仓库详情

审核后台的“描述修正”页可以：

- 搜索当前库里的 skill
- 修改中文摘要、分类、能做什么、适合谁、典型场景
- 保存到 `data/description-overrides.json`
- 后续运行 `npm run sync` 或自动同步时，手动修正会优先于自动生成描述

如果自动规则无法可靠判断某个 skill 的真实用途，会把分类标成“待补充”，避免生成看起来具体但其实可能错误的描述。这类 skill 建议在后台人工修正后再重点推荐。

修正描述后重新生成站点：

```bash
npm run sync:build
```

项目还内置了每周候选发现 workflow：

- 文件：`.github/workflows/discover-sources.yml`
- 频率：每周自动生成 `data/source-candidates.json`
- 作用：找高星、近期更新、包含真实 `SKILL.md` 的候选仓库
- 自动收录：满足高星和真实 skill 结构的候选会自动加入 `data/sources.json`

## 自动更新

可以自动更新。项目内置了 GitHub Actions：

- 文件：`.github/workflows/sync-skills.yml`
- 频率：每天自动同步一次
- 手动触发：GitHub Actions 页面点击 `Run workflow`
- 行为：拉取 4 个仓库，重新生成 `data/skills.json`、`public/data/skills.json`、`public/skill-files/*.json`，如果有变化就自动提交

如果部署在服务器上，也可以用 cron：

```bash
cd /var/www/claude-code-skills-hub
git pull
npm ci
npm run sync:build
```

示例每天凌晨 4 点更新：

```cron
0 4 * * * cd /var/www/claude-code-skills-hub && git pull && npm ci && npm run sync:build
```

如果用 Cloudflare Pages、Vercel 或 Netlify，建议让 GitHub Actions 自动提交数据变化，平台检测到新提交后自动重新部署。

## 操作体验

网站目前提供三种核心操作：

1. 复制已选安装命令：只安装当前勾选的 skills。
2. 复制全库安装命令：安装数据源里的全部 skills。
3. 导出 ccswitch ZIP：把勾选的 skills 打包成文件夹结构，用于导入 ccswitch。

浏览器不能直接写入用户本机的 `~/.claude/skills`，所以网页内不再伪装成“直接安装”。需要本机安装时复制命令；需要导入 ccswitch 时导出 ZIP。

## 构建部署

```bash
npm run build
```

把 `dist/` 部署到 Nginx、Cloudflare Pages、Vercel、Netlify 或任意静态服务器即可。

### Nginx 示例

```nginx
server {
  listen 80;
  server_name skills.example.com;

  root /var/www/claude-code-skills-hub/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 数据结构

`data/skills.json` 是前端唯一依赖的数据文件。全量同步后，无法访问 GitHub 的用户也能完整搜索和浏览。

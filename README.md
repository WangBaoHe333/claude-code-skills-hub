# Claude Code Skills Hub

Claude Code Skills Hub 是一个面向 Claude Code 用户的 skills 搜索、浏览、批量安装和 ccswitch 导入平台。

在线访问：

[http://39.104.27.129/skills/](http://39.104.27.129/skills/)

普通用户不需要本地部署，直接访问线上站即可。这个仓库公开出来主要是为了让开发者一起改进网站、同步规则、描述质量和导出逻辑。

## 为什么做

Claude Code skills 很有用，但普通用户经常遇到四个问题：

- 不知道 skills 存在
- 不知道每个 skill 能做什么
- 不知道怎么安装和配置
- 访问 GitHub 不方便，拿不到完整信息

这个项目把分散在 GitHub 仓库里的 skills 聚合成一个可搜索、可筛选、可批量导出的网页，让用户不用翻仓库也能直接找到并安装需要的 skill。

## 功能亮点

- 聚合 898 个 Claude Code skills
- 支持中文 / English 双语界面
- 中文描述优先根据英文原始说明直译，避免乱写用途
- 支持按名称、用途、场景、仓库、标签搜索
- 支持常用优先、已选优先、名称排序
- 支持跨筛选批量选择、只看已选、清空选择
- 支持复制单个、已选、全库安装命令
- 支持导出 ccswitch 可导入 ZIP
- ZIP 内保证每个 skill 文件夹包含 `SKILL.md`
- 每个 skill 详情页标注来源仓库、路径、原始描述和许可提示
- 支持私有审核后台，手动修正描述和收录高星仓库
- 支持 GitHub Actions 自动同步上游仓库

## 数据来源与标注

当前聚合以下仓库：

- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
- [stellarlinkco/myclaude](https://github.com/stellarlinkco/myclaude)

详情见 [THIRD_PARTY_SOURCES.md](./THIRD_PARTY_SOURCES.md) 和 [NOTICE.md](./NOTICE.md)。

这个项目是索引、聚合和安装工具，不声明拥有第三方 skill 内容。第三方 skill 文件、名称、说明和源码归原仓库作者所有，并遵循各自上游许可或声明。

同步后会生成：

- `data/skills.json`
- `public/data/skills.json`
- `public/skill-files/*.json`

前端只依赖静态数据文件，所以部署后用户即使不能访问 GitHub，也可以完整搜索和浏览。

## 开发者本地运行

普通用户不需要执行下面的命令。只有在你要参与开发、修页面、改同步脚本或优化描述时，才需要本地运行。

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

部署到子路径 `/skills/`：

```bash
npm run build -- --base=/skills/
```

## 同步 skills

```bash
npm run sync
```

同步并构建：

```bash
npm run sync:build
```

同步脚本会读取 `data/sources.json`，拉取每个仓库中的 `SKILL.md`、README 和目录内容，生成前端数据和可导入包。

## 添加新的仓库

编辑 `data/sources.json`：

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

## 发现高星候选仓库

生成候选清单：

```bash
npm run discover
```

如果 GitHub API 限速，带上 token：

```bash
GITHUB_TOKEN=你的_token npm run discover
```

自动收录高星且结构真实的候选：

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

## 私有审核后台

启动：

```bash
npm run admin
```

默认地址：

```text
http://127.0.0.1:8787
```

可以设置访问 token：

```bash
ADMIN_TOKEN=你的密码 npm run admin
```

访问：

```text
http://127.0.0.1:8787/?token=你的密码
```

后台能力：

- 查看高星候选源
- 一键加入正式库
- 一键拒绝候选源
- 搜索当前 skills
- 修正中文摘要、分类、能力、人群和典型场景
- 保存人工覆盖到 `data/description-overrides.json`

人工修正会优先于自动生成描述，后续同步不会冲掉。

## 自动更新

项目内置 GitHub Actions：

- `.github/workflows/sync-skills.yml`
- `.github/workflows/discover-sources.yml`

作用：

- 每天同步正式来源
- 每周发现高星候选仓库
- 数据变化后自动提交

如果部署在服务器，也可以用 cron：

```cron
0 4 * * * cd /opt/claude-code-skills-hub && git pull && npm ci && npm run sync:build
```

## ccswitch ZIP 格式

导出的 ZIP 结构类似：

```text
ccswitch-skills-batch.zip
├── pdf/
│   └── SKILL.md
├── xlsx/
│   └── SKILL.md
└── browser/
    └── SKILL.md
```

每个 skill 都是独立文件夹，且包含 `SKILL.md`，可用于 ccswitch 导入。

## Nginx 子路径部署示例

```nginx
location = /skills {
    return 301 /skills/;
}

location /skills/ {
    alias /opt/claude-code-skills-hub/dist/;
    index index.html;
    try_files $uri $uri/ /skills/index.html;
}
```

构建命令：

```bash
npm run build -- --base=/skills/
```

## 技术栈

- Vite
- 原生 JavaScript
- 静态 JSON 数据
- Node.js 同步脚本
- GitHub Actions
- Nginx 静态部署

## 项目状态

当前版本已完成：

- 898 个 skills 聚合
- 双语 UI
- 批量安装命令
- ccswitch ZIP 导出
- 私有审核后台
- 高星候选发现
- 服务器部署

## 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

平台代码按 AGPL-3.0-only 开源，见 [LICENSE](./LICENSE)。

第三方 skill 内容不属于本项目原创内容，按各自上游仓库的 license、terms 或声明处理。来源和标注见 [THIRD_PARTY_SOURCES.md](./THIRD_PARTY_SOURCES.md) 与 [NOTICE.md](./NOTICE.md)。

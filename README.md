# Claude Code Skills Hub

Claude Code Skills Hub 是一个面向 Claude Code 用户的 skills 聚合和 ccswitch 批量导入平台。

核心能力：把分散在多个仓库里的 Claude Code skills 聚合起来，让用户搜索、勾选，然后一次性导出 ccswitch 可导入的 ZIP。

在线访问：

[http://39.104.27.129/skills/](http://39.104.27.129/skills/)

## 为什么做

Claude Code skills 很有用，但普通用户经常遇到这些问题：

- 不知道 skills 存在
- 不知道每个 skill 能做什么
- 不知道怎么安装和配置
- 访问 GitHub 不方便
- ccswitch 逐个导入不够省事

这个项目把分散的 skills 聚合成一个可搜索、可筛选、可批量导出的网页。用户不用翻仓库，也不用一个一个安装，选好后直接导出 ZIP 导入 ccswitch。

## 功能亮点

- 聚合 898 个 Claude Code skills
- 支持中文 / English 双语界面
- 支持按名称、用途、场景、仓库、标签搜索
- 支持跨筛选批量选择、只看已选、清空选择
- 支持复制单个、已选、全库安装命令
- 支持把已选 skills 批量打包成 ccswitch 可导入 ZIP
- ZIP 内保证每个 skill 文件夹包含 `SKILL.md`
- 每个 skill 详情页标注来源仓库、路径、原始描述和许可提示

## 数据来源与标注

当前聚合以下仓库：

- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
- [stellarlinkco/myclaude](https://github.com/stellarlinkco/myclaude)

详情见 [THIRD_PARTY_SOURCES.md](./THIRD_PARTY_SOURCES.md) 和 [NOTICE.md](./NOTICE.md)。

这个项目是索引、聚合和安装工具，不声明拥有第三方 skill 内容。第三方 skill 文件、名称、说明和源码归原仓库作者所有，并遵循各自上游许可或声明。

## License

平台代码按 AGPL-3.0-only 开源，见 [LICENSE](./LICENSE)。

第三方 skill 内容不属于本项目原创内容，按各自上游仓库的 license、terms 或声明处理。来源和标注见 [THIRD_PARTY_SOURCES.md](./THIRD_PARTY_SOURCES.md) 与 [NOTICE.md](./NOTICE.md)。

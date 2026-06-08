import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, basename, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const sources = await loadSources();
const descriptionOverrides = await loadDescriptionOverrides();

const workspace = join(tmpdir(), `claude-skills-sync-${Date.now()}`);
await mkdir(workspace, { recursive: true });
await rm("public/skill-files", { recursive: true, force: true });
await mkdir("public/skill-files", { recursive: true });

const skills = [];

try {
  for (const source of sources) {
    const target = join(workspace, source.repo.replace("/", "__"));
    console.log(`Cloning ${source.repo}`);
    await exec("git", ["clone", "--depth", "1", source.url, target], { maxBuffer: 1024 * 1024 * 20 });
    const files = await findCandidateFiles(target);

    for (const file of files) {
      const raw = await readFile(file, "utf8");
      const parsed = await parseSkill(raw, file, source, target);
      if (parsed) skills.push(parsed);
    }
  }

  const deduped = dedupe(skills);
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    sources: sources.map(source => source.repo),
    skills: deduped
  }, null, 2);

  await mkdir("data", { recursive: true });
  await mkdir("public/data", { recursive: true });
  await writeFile("data/skills.json", payload);
  await writeFile("public/data/skills.json", payload);

  console.log(`Wrote data/skills.json and public/data/skills.json with ${deduped.length} skills`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}

async function findCandidateFiles(root) {
  const out = [];
  await walk(root, out);
  return out.filter(file => {
    const name = basename(file).toLowerCase();
    return name === "skill.md" || name === "readme.md";
  });
}

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    if (entry.isFile()) out.push(full);
  }
}

async function parseSkill(raw, file, source, root) {
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
  const fm = frontmatter ? parseFrontmatter(frontmatter[1]) : {};
  if (dirname(file) === root) return null;
  if (basename(file).toLowerCase() === "readme.md" && !looksLikeSkillReadme(raw, file)) return null;
  const name = fm.name || inferName(file);
  if (!isRealSkillName(name)) return null;
  const body = frontmatter ? raw.slice(frontmatter[0].length).trim() : raw.trim();
  const summary = fm.description || firstUsefulParagraph(body) || "Claude Code skill.";
  const repoUrl = source.url.replace(/\.git$/, "");
  const skillSlug = slugify(name);
  const skillPath = normalizePath(relative(root, dirname(file))) || ".";
  const specific = describeSkill({ name, summary, body, source, skillPath });
  const id = `${slugify(source.repo)}-${skillSlug}`;
  const override = descriptionOverrides[id] || descriptionOverrides[`${source.repo}/${skillPath}`] || {};
  const finalSpecific = {
    ...specific,
    ...Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined && value !== ""))
  };
  const files = await collectSkillFiles(join(root, skillPath));
  ensurePackageSkillMd(files, {
    name: skillSlug,
    displayName: name,
    summary,
    summaryZh: finalSpecific.summaryZh,
    capabilityZh: finalSpecific.capabilityZh,
    scenariosZh: finalSpecific.scenariosZh
  });
  await writeFile(join("public/skill-files", `${id}.json`), JSON.stringify({ id, files }, null, 2));

  return {
    id,
    name,
    summary: compact(summary, 180),
    summaryZh: finalSpecific.summaryZh,
    capabilityZh: finalSpecific.capabilityZh,
    audience: finalSpecific.audienceZh,
    audienceZh: finalSpecific.audienceZh,
    scenarios: finalSpecific.scenariosZh,
    scenariosZh: finalSpecific.scenariosZh,
    usage: finalSpecific.usageZh,
    usageZh: finalSpecific.usageZh,
    category: finalSpecific.category,
    tags: inferTags(name, `${summary} ${finalSpecific.summaryZh} ${finalSpecific.category}`),
    install: {
      command: installSnippet(source.repo, skillPath, skillSlug)
    },
    source: {
      repo: source.repo,
      url: repoUrl,
      path: skillPath,
      type: source.type || "unknown",
      stars: source.stars || 0
    },
    packageUrl: `/skill-files/${id}.json`
  };
}

async function collectSkillFiles(skillDir) {
  const all = [];
  await collectFilesWalk(skillDir, skillDir, all);
  return all;
}

function ensurePackageSkillMd(files, skill) {
  if (files.some(file => file.path.toLowerCase() === "skill.md")) return;
  files.unshift({
    path: "SKILL.md",
    encoding: "utf8",
    content: [
      "---",
      `name: ${skill.name}`,
      `description: ${yamlString(compact(skill.summary || skill.summaryZh || skill.displayName, 180))}`,
      "---",
      "",
      `# ${skill.displayName}`,
      "",
      compact(skill.summary || skill.summaryZh, 420),
      "",
      "## 中文说明",
      "",
      skill.capabilityZh || skill.summaryZh,
      "",
      "## 典型场景",
      ...(skill.scenariosZh || []).map(item => `- ${item}`)
    ].filter(line => line !== undefined && line !== null).join("\n")
  });
}

async function collectFilesWalk(root, dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".DS_Store") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesWalk(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = normalizePath(relative(root, full));
    if (!shouldPackageFile(rel)) continue;
    const buffer = await readFile(full);
    if (buffer.length > 700 * 1024) continue;
    if (looksBinary(buffer)) {
      out.push({ path: rel, encoding: "base64", content: buffer.toString("base64") });
    } else {
      out.push({ path: rel, encoding: "utf8", content: buffer.toString("utf8") });
    }
  }
}

function shouldPackageFile(file) {
  const lower = file.toLowerCase();
  if (lower.includes("/.git/") || lower.includes("/node_modules/")) return false;
  const blocked = [".lock", ".log", ".tmp", ".zip", ".tar", ".gz", ".7z", ".mp4", ".mov"];
  return !blocked.some(suffix => lower.endsWith(suffix));
}

function looksBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  if (sample.includes(0)) return true;
  const ext = extname("x").toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp";
}

function looksLikeSkillReadme(raw, file) {
  const text = raw.toLowerCase();
  const path = normalizePath(file).toLowerCase();
  if (path.includes("/composio-skills/")) return true;
  if (text.includes("claude code") || text.includes("skill") || text.includes("mcp")) return true;
  return false;
}

function isRealSkillName(name) {
  const clean = String(name || "").trim().toLowerCase();
  if (!clean || clean === "." || clean === "..") return false;
  if (clean.startsWith(".")) return false;
  if (["node_modules", "dist", "public", "src", "scripts"].includes(clean)) return false;
  return true;
}

function parseFrontmatter(text) {
  const result = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

function firstUsefulParagraph(body) {
  return body
    .split(/\n\s*\n/)
    .map(part => part.replace(/^#+\s*/, "").trim())
    .find(part => part.length > 30 && !part.startsWith("```"));
}

function inferName(file) {
  const parts = file.split(/[\\/]/);
  const parent = parts.at(-2) || basename(file, ".md");
  return parent.replace(/[-_]/g, " ");
}

function inferAudience(summary) {
  const text = summary.toLowerCase();
  if (text.includes("invoice") || text.includes("finance") || text.includes("expense")) return "财务、运营和需要业务流程自动化的团队。";
  if (text.includes("pdf") || text.includes("document") || text.includes("docx")) return "需要处理文档、报告、合同或知识资料的用户。";
  if (text.includes("browser") || text.includes("test")) return "开发者、测试人员和需要验证网页体验的产品团队。";
  return "Claude Code 用户、开发者和希望把重复工作自动化的团队。";
}

function inferScenarios(summary, name) {
  return [
    `使用 ${name} 完成重复任务`,
    "把领域工具接入 Claude Code 工作流",
    compact(summary, 80)
  ];
}

function inferTags(name, summary) {
  const text = `${name} ${summary}`.toLowerCase();
  const tags = new Set(["skill"]);
  const pairs = [
    ["pdf", "pdf"],
    ["doc", "documents"],
    ["sheet", "spreadsheets"],
    ["slide", "presentations"],
    ["browser", "browser"],
    ["test", "testing"],
    ["automation", "automation"],
    ["email", "email"],
    ["calendar", "calendar"],
    ["image", "image"],
    ["video", "video"],
    ["github", "github"],
    ["api", "api"]
  ];

  for (const [needle, tag] of pairs) {
    if (text.includes(needle)) tags.add(tag);
  }

  return [...tags].slice(0, 5);
}

function describeSkill({ name, summary, body, source, skillPath }) {
  const displayName = cleanServiceName(name);
  const text = `${name} ${summary} ${body} ${skillPath}`.toLowerCase();

  if (skillPath.includes("composio-skills/") || /-automation$/i.test(name)) {
    return describeAutomation(displayName, `${name} ${skillPath}`.toLowerCase(), summary);
  }

  if (/pdf/.test(text)) {
    return fixedProfile(displayName, "文档处理", "读取、提取、拆分、合并和检查 PDF 页面内容，适合处理合同、论文、发票、报告和扫描资料。", ["提取 PDF 里的文字、表格和章节", "检查页面渲染、页码、图片和版式是否正确", "把多份 PDF 合并、拆分或整理成可交付文件"]);
  }

  if (/docx|word/.test(text)) {
    return fixedProfile(displayName, "文档处理", "创建、读取和修改 Word 文档，适合报告、合同、方案、批注稿和模板化文档。", ["生成带标题、段落和列表的 Word 文档", "读取已有 .docx 并提取关键信息", "修改文档内容、结构和格式后重新导出"]);
  }

  if (/spreadsheet|xlsx|sheet/.test(text)) {
    return fixedProfile(displayName, "表格处理", "读取、分析、修改和生成电子表格，适合数据清洗、报表整理和表格自动化。", ["批量读写单元格和工作表", "整理 CSV/XLSX 数据并生成统计结果", "制作可直接打开的表格文件"]);
  }

  if (/youtube|transcript|subtitle/.test(text)) {
    return fixedProfile(displayName, "内容整理", "下载 YouTube 字幕、封面、章节和元数据，适合把视频整理成笔记、摘要或知识库材料。", ["按视频链接抓取字幕", "生成章节摘要和重点列表", "保存封面图和视频基础信息"]);
  }

  if (/gif|animation|animated/.test(text)) {
    return fixedProfile(displayName, "视觉素材", "制作适合 Slack 发送的动画 GIF，并检查尺寸、帧数、文件大小和循环效果。", ["生成 Slack 可用的表情或动图", "验证 GIF 文件大小和动画限制", "把多段动画组合成可发送的 GIF"]);
  }

  if (/slide|ppt|presentation/.test(text)) {
    return fixedProfile(displayName, "演示文稿", "创建、编辑和导出演示文稿，适合路演、汇报、课程和方案展示。", ["生成完整 PPTX 结构", "修改已有幻灯片内容和版式", "导出可预览、可交付的演示文件"]);
  }

  if (/markdown|html/.test(text)) {
    return fixedProfile(displayName, "内容发布", "把 Markdown 转成排版好的 HTML，适合公众号、技术文章、教程和内部知识库发布。", ["渲染代码高亮、数学公式和 Mermaid 图", "把长文转成可发布 HTML", "套用主题生成统一风格页面"]);
  }

  if (/browser|playwright|web/.test(text)) {
    return fixedProfile(displayName, "网页自动化", "控制浏览器打开页面、点击、输入、截图和验证结果，适合测试本地网页和执行网页流程。", ["打开 localhost 页面做交互检查", "填写表单、点击按钮并读取页面结果", "截图验证页面布局和状态"]);
  }

  return fixedProfile(displayName, "通用工具", `${displayName} 是 Claude Code 的能力扩展，用来处理对应领域里的文件、网页、数据或自动化流程。`, [`使用 ${displayName} 完成相关任务`, "减少手工复制、整理和重复操作", "把固定流程交给 Claude Code 执行"]);
}

function describeAutomation(service, text, summary) {
  const profile = automationProfile(service, text);
  const translatedSummary = translateEnglishSummary(summary, service);
  if (profile.category === "待补充") {
    return {
      category: profile.category,
      summaryZh: translatedSummary,
      capabilityZh: `${translatedSummary} 具体能调用哪些对象和动作，以授权后搜索到的当前工具 schema 为准。`,
      audienceZh: profile.audience,
      scenariosZh: profile.scenarios.map(item => item.replaceAll("{service}", service)),
      usageZh: `安装前建议先确认 ${service} 的实际用途、授权方式和可用工具；确认后可在 Claude Code 中明确说“使用 ${service}”并给出具体任务。`
    };
  }
  return {
    category: profile.category,
    summaryZh: translatedSummary,
    capabilityZh: `${translatedSummary} 按源仓库说明，它会先搜索当前工具 schema，再根据授权后的 ${service} 工具执行对应任务。`,
    audienceZh: profile.audience,
    scenariosZh: profile.scenarios.map(item => item.replaceAll("{service}", service)),
    usageZh: `安装后先在 Rube/Composio 中授权 ${service}，然后直接说清楚你要处理的对象和动作，例如“查询今天的记录”“创建一个客户”“同步最近的订单”。`
  };
}

function translateEnglishSummary(summary, fallbackName) {
  const text = String(summary || "").replace(/\s+/g, " ").trim();
  const composio = text.match(/^Automate\s+(.+?)\s+tasks\s+via\s+Rube MCP\s+\(Composio\)\.?\s*(Always search tools first for current schemas\.)?/i);
  if (composio) {
    const service = cleanServiceName(composio[1] || fallbackName);
    const suffix = composio[2] ? "使用前始终先搜索工具，获取当前可用的参数和 schema。" : "";
    return `通过 Rube MCP（Composio）自动化 ${service} 任务。${suffix}`.trim();
  }
  if (/^Create, edit,/i.test(text)) return "创建、编辑并整理相关文件，让 Claude Code 能处理更完整的办公和内容工作流。";
  if (/download|transcript|subtitle/i.test(text)) return "下载并整理视频字幕、章节、封面等内容，适合做笔记、摘要和知识库整理。";
  if (/markdown|html/i.test(text)) return "把 Markdown 内容转换成可发布的 HTML 页面，适合文章排版和内容发布。";
  if (/browser|playwright|web/i.test(text)) return "控制浏览器或网页流程，适合本地页面验证、网页操作和自动化测试。";
  if (/^[\x00-\x7F]+$/.test(text)) return `${cleanServiceName(fallbackName)} 的原始英文说明为：${text}`;
  return text || `${cleanServiceName(fallbackName)} 相关能力扩展。`;
}

function fixedProfile(name, category, summary, scenarios) {
  return {
    category,
    summaryZh: summary,
    capabilityZh: summary,
    audienceZh: audienceForCategory(category, name),
    scenariosZh: scenarios,
    usageZh: `安装后在 Claude Code 中明确说“使用 ${name}”，再给出文件、链接或要完成的任务。`
  };
}

function automationProfile(service, text) {
  const profiles = [
    {
      category: "CRM / 销售",
      keywords: ["salesforce", "hubspot", "pipedrive", "zoho", "close", "affinity", "accelo", "agencyzoom", "agiled", "axonaut", "bonsai", "centralstationcrm", "chaser", "copper", "freshsales", "highlevel", "attio", "capsule", "nutshell"],
      objects: "客户、联系人、公司、线索、商机、跟进记录和销售任务",
      actions: "查询、创建、更新、分配、备注和同步",
      audience: "销售、客户成功、运营和需要把客户资料自动同步到 Claude Code 的团队。",
      scenarios: ["批量查询 {service} 里的客户和联系人", "创建或更新线索、公司和销售机会", "把跟进记录整理成待办或销售摘要"]
    },
    {
      category: "邮件 / 日历",
      keywords: ["gmail", "outlook", "mail", "email", "calendar", "calendly", "google-calendar", "microsoft-calendar"],
      objects: "邮件、草稿、收件人、附件、日程、会议和空闲时间",
      actions: "搜索、读取、创建、发送、回复、转发、预约和取消",
      audience: "需要自动处理邮件、会议安排和日程协调的个人、助理和团队。",
      scenarios: ["搜索并总结 {service} 中的邮件或日程", "创建会议邀请、草稿或回复", "根据上下文安排时间、检查冲突并更新日历"]
    },
    {
      category: "项目 / 任务",
      keywords: ["asana", "jira", "linear", "trello", "clickup", "monday", "notion", "todoist", "basecamp", "height", "shortcut", "aero-workflow", "teamwork", "canny", "clockify", "desktime"],
      objects: "任务、项目、看板、工单、负责人、截止日期、评论和状态",
      actions: "查询、创建、更新、分配、移动、评论和关闭",
      audience: "产品、研发、项目经理和需要把任务流接进 Claude Code 的团队。",
      scenarios: ["把需求拆成 {service} 任务", "查询项目进度、阻塞项和负责人", "批量更新状态、截止日期或评论"]
    },
    {
      category: "代码 / DevOps",
      keywords: ["github", "gitlab", "bitbucket", "vercel", "netlify", "sentry", "datadog", "pagerduty", "circleci", "buildkite", "jenkins", "cloudflare", "docker", "kubernetes", "linear", "appcircle", "appveyor", "better-stack", "bugbug", "bugherd", "bugsnag", "bunnycdn", "browserbase", "browserhub"],
      objects: "仓库、Issue、Pull Request、提交、部署、告警、日志和运行状态",
      actions: "查询、创建、更新、触发、评论、关闭和同步",
      audience: "开发者、DevOps、SRE 和需要自动处理工程协作流程的团队。",
      scenarios: ["查询 {service} 的 Issue、PR 或部署状态", "创建工单、评论代码问题或整理发布记录", "读取告警和日志并生成排查摘要"]
    },
    {
      category: "财务 / 支付",
      keywords: ["quickbooks", "xero", "stripe", "paypal", "square", "braintree", "btcpay", "ramp", "brex", "plaid", "chargebee", "recurly", "freshbooks", "wave", "bill", "invoice", "expense", "coupa"],
      objects: "客户、发票、账单、付款、订阅、退款、交易、报销和账户",
      actions: "查询、创建、更新、对账、导出和同步",
      audience: "财务、运营、创业团队和需要自动处理账务、支付或费用流程的人。",
      scenarios: ["查询 {service} 的发票、付款和客户记录", "创建账单、退款、订阅或费用记录", "把交易数据整理成对账或财务摘要"]
    },
    {
      category: "电商 / 订单",
      keywords: ["shopify", "woocommerce", "magento", "bigcommerce", "etsy", "amazon", "ebay", "bestbuy", "baselinker", "brightpearl", "booqable", "shippo", "shipstation", "aftership", "printful", "stripe"],
      objects: "商品、订单、客户、库存、物流、退款、折扣和店铺数据",
      actions: "查询、创建、更新、发货、退款、同步和导出",
      audience: "电商运营、客服、店主和需要自动处理订单与库存的人。",
      scenarios: ["查询 {service} 的订单、客户和物流状态", "更新商品、库存、折扣或订单信息", "整理退款、发货和销售数据"]
    },
    {
      category: "客服 / 工单",
      keywords: ["zendesk", "intercom", "freshdesk", "helpscout", "front", "gorgias", "kustomer", "servicenow", "jira-service", "beamer"],
      objects: "客户、会话、工单、标签、优先级、负责人和知识库文章",
      actions: "搜索、创建、回复、分配、升级、关闭和同步",
      audience: "客服、客户成功、支持工程师和需要自动处理用户问题的团队。",
      scenarios: ["查询 {service} 中的客户会话和工单", "生成回复草稿并更新工单状态", "按优先级、标签或负责人整理待处理问题"]
    },
    {
      category: "营销 / 增长",
      keywords: ["adrapid", "appsflyer", "ayrshare", "campayn", "callpage", "callingly", "mailchimp", "active-campaign", "klaviyo", "sendgrid", "brevo", "constant-contact", "customer.io", "campaign", "marketo", "facebook", "linkedin", "google-ads", "tiktok", "buffer", "hootsuite"],
      objects: "联系人、受众、营销活动、邮件列表、广告、素材、表单和转化数据",
      actions: "查询、创建、更新、发送、同步、统计和导出",
      audience: "市场、增长、内容运营和需要自动化触达或统计营销效果的团队。",
      scenarios: ["查询 {service} 的联系人、活动和投放数据", "创建或更新邮件活动、受众列表和素材", "整理转化、打开率、点击率或广告表现"]
    },
    {
      category: "数据 / 表格",
      keywords: ["airtable", "baserow", "google-sheets", "sheets", "excel", "coda", "smartsheet", "database", "postgres", "mysql", "snowflake", "bigquery", "mongodb", "census-bureau", "datarobot"],
      objects: "表格、记录、字段、视图、数据库行、查询结果和数据集",
      actions: "读取、追加、更新、删除、筛选、统计和导出",
      audience: "数据运营、分析师、无代码工具用户和需要自动整理结构化数据的人。",
      scenarios: ["读取 {service} 的表格、记录或查询结果", "批量追加、更新或删除数据", "把数据整理成报表、摘要或导出文件"]
    },
    {
      category: "文件 / 云盘",
      keywords: ["google-drive", "dropbox", "box", "onedrive", "sharepoint", "drive", "storage", "s3", "cloudinary", "cloudconvert", "convertapi", "conversion-tools"],
      objects: "文件、文件夹、权限、分享链接、图片、附件和存储对象",
      actions: "搜索、上传、下载、移动、复制、删除、分享和同步",
      audience: "需要整理文件、共享资料、处理附件或管理云端资产的团队。",
      scenarios: ["搜索和下载 {service} 中的文件", "上传、移动或共享文件夹", "把附件和素材整理成统一目录"]
    },
    {
      category: "通信 / 社群",
      keywords: ["slack", "discord", "telegram", "teams", "twilio", "whatsapp", "sms", "2chat", "message", "chatwork", "webex"],
      objects: "频道、成员、消息、会话、通知、短信和群组",
      actions: "搜索、发送、回复、创建、邀请、归档和同步",
      audience: "社群运营、内部协作团队、客服和需要自动发送通知的人。",
      scenarios: ["搜索 {service} 中的消息和会话", "发送通知、回复消息或创建群组", "把聊天内容整理成摘要和待办"]
    },
    {
      category: "HR / 招聘",
      keywords: ["greenhouse", "lever", "bamboohr", "workday", "gusto", "deel", "ashby", "recruitee", "hibob", "personio", "breezy-hr", "async-interview"],
      objects: "候选人、员工、职位、面试、Offer、请假、薪资和入离职流程",
      actions: "查询、创建、更新、安排、同步和导出",
      audience: "HR、招聘、行政和需要自动处理候选人或员工数据的团队。",
      scenarios: ["查询 {service} 中的候选人、职位或员工信息", "安排面试、更新状态或记录反馈", "整理入职、离职、请假或薪资数据"]
    },
    {
      category: "设计 / 图片",
      keywords: ["figma", "canva", "adobe", "abstract", "abyssale", "alttext-ai", "astica-ai", "bannerbear", "brandfetch", "claid-ai", "cloudinary", "image", "photoshop"],
      objects: "设计文件、图片、模板、素材、图层、导出图和品牌资产",
      actions: "搜索、创建、更新、生成、上传、下载和导出",
      audience: "设计师、市场、内容运营和需要批量处理视觉素材的人。",
      scenarios: ["查询 {service} 中的设计文件或图片素材", "按模板生成图片、海报或社交媒体素材", "导出、上传或同步品牌资产"]
    },
    {
      category: "安全 / 合规",
      keywords: ["21risk", "okta", "auth0", "1password", "abuseipdb", "abuselpdb", "snyk", "security", "compliance", "vanta", "drata"],
      objects: "用户、权限、风险记录、漏洞、审计日志、合规检查和安全事件",
      actions: "查询、创建、更新、审计、告警和导出",
      audience: "安全、IT、合规和需要自动检查账号、权限或风险数据的团队。",
      scenarios: ["查询 {service} 的用户、权限或安全事件", "整理漏洞、风险和合规检查结果", "导出审计记录并生成排查摘要"]
    },
    {
      category: "SEO / 增长分析",
      keywords: ["ahrefs", "semrush", "moz", "serp", "seo", "similarweb", "google-search-console", "analytics"],
      objects: "关键词、外链、域名、页面、排名、搜索流量和竞品数据",
      actions: "查询、分析、对比、监控、导出和生成报告",
      audience: "SEO、增长、内容运营和需要分析搜索表现或竞品数据的人。",
      scenarios: ["查询 {service} 的关键词、排名和外链数据", "对比竞品域名和页面表现", "整理 SEO 报告、优化建议和待办"]
    },
    {
      category: "线索 / 销售情报",
      keywords: ["apollo", "aeroleads", "hunter", "clearbit", "lusha", "lead", "prospect", "dropcontact", "snov"],
      objects: "潜在客户、联系人、公司、邮箱、职位、线索列表和验证结果",
      actions: "搜索、验证、补全、创建、更新、分组和导出",
      audience: "销售、BD、增长团队和需要批量找人、找公司或补全线索资料的人。",
      scenarios: ["搜索 {service} 里的联系人和公司线索", "验证邮箱并补全职位、公司和社交信息", "把线索整理成可跟进列表"]
    },
    {
      category: "AI / 语音视频",
      keywords: ["openai", "replicate", "groq", "elevenlabs", "deepgram", "assemblyai", "heygen", "aivoov", "ai-ml-api", "dreamstudio", "stability"],
      objects: "模型、提示词、语音、转写、图片、视频、生成任务和推理结果",
      actions: "创建、生成、转写、分析、查询状态、下载和导出",
      audience: "开发者、内容创作者、AI 产品团队和需要把生成式 AI 接入工作流的人。",
      scenarios: ["用 {service} 生成文本、图片、语音或视频", "转写音频并整理摘要和章节", "查询生成任务状态并下载结果"]
    },
    {
      category: "区块链 / 加密",
      keywords: ["alchemy", "coinbase", "coinmarketcap", "coinranking", "bitquery", "blockchain", "etherscan", "moralis", "web3"],
      objects: "钱包、交易、区块、代币、价格、链上事件和市场数据",
      actions: "查询、追踪、分析、同步、告警和导出",
      audience: "Web3 开发者、加密交易团队、数据分析师和需要查询链上或行情数据的人。",
      scenarios: ["查询 {service} 的钱包、交易和代币数据", "跟踪链上事件或价格变化", "整理市场、资产或链上分析报告"]
    },
    {
      category: "文档识别 / OCR",
      keywords: ["affinda", "algodocs", "api2pdf", "carbone", "docsumo", "docparser", "ocr", "pdf.co", "nanonets", "craftmypdf", "boldsign", "better-proposals", "bidsketch", "certifier"],
      objects: "PDF、发票、简历、合同、表单、扫描件和结构化字段",
      actions: "上传、识别、提取、校验、分类、导出和同步",
      audience: "财务、HR、运营、法务和需要从文档里批量提取字段的人。",
      scenarios: ["从 {service} 识别发票、合同或简历字段", "把扫描件和 PDF 转成结构化数据", "校验提取结果并导出到表格或系统"]
    },
    {
      category: "实时通信 / 开发者服务",
      keywords: ["ably", "pusher", "pubnub"],
      objects: "频道、消息、事件、连接状态、订阅、发布记录和开发者配置",
      actions: "查询、发布、订阅、触发、测试、同步和导出",
      audience: "开发者、技术运营和需要管理实时消息或事件流的人。",
      scenarios: ["查询 {service} 的频道、连接和事件状态", "发布或测试实时消息", "整理消息流、订阅状态和调试结果"]
    },
    {
      category: "网页抓取 / 浏览器自动化",
      keywords: ["anchor-browser", "agentql", "agenty", "browserless", "firecrawl", "browseai", "apify", "brightdata"],
      objects: "网页、选择器、抓取任务、浏览器会话、页面内容和结构化结果",
      actions: "打开、抓取、提取、测试、截图、同步和导出",
      audience: "开发者、数据运营、测试人员和需要把网页内容转成结构化数据的人。",
      scenarios: ["用 {service} 抓取网页内容和结构化字段", "测试浏览器会话、截图或页面状态", "把抓取结果整理成表格、摘要或后续任务"]
    },
    {
      category: "地址 / 地理位置",
      keywords: ["addresszen", "dadata", "ambee", "ambient-weather", "mapbox", "google-maps", "geocoding", "location", "address"],
      objects: "地址、邮编、经纬度、地点、行政区、地理编码和校验结果",
      actions: "搜索、校验、补全、转换、标准化和导出",
      audience: "电商、物流、地产、运营和需要处理地址或地理数据的人。",
      scenarios: ["用 {service} 校验和标准化地址", "把地址转换成经纬度或行政区信息", "批量补全邮编、地点和地理字段"]
    },
    {
      category: "证书 / 教育",
      keywords: ["accredible", "certificate", "blackboard", "canvas", "classmarker", "coassemble", "moodle", "learn", "course", "education"],
      objects: "课程、证书、学员、成绩、作业、学习记录和颁发状态",
      actions: "查询、创建、更新、颁发、同步、统计和导出",
      audience: "教育机构、培训团队、HR 和需要管理课程或证书流程的人。",
      scenarios: ["查询 {service} 的学员、课程或证书状态", "创建或颁发证书并同步记录", "整理学习进度、成绩和培训报表"]
    },
    {
      category: "搜索 / 知识检索",
      keywords: ["algolia", "typesense", "meilisearch", "elastic", "search"],
      objects: "索引、记录、搜索配置、同义词、排序规则、查询结果和分析数据",
      actions: "查询、创建、更新、删除、重建索引、测试和导出",
      audience: "开发者、产品运营、内容团队和需要维护站内搜索或知识检索的人。",
      scenarios: ["查询 {service} 的索引和搜索结果", "更新记录、同义词和排序规则", "测试搜索质量并整理优化建议"]
    },
    {
      category: "CMS / 建站",
      keywords: ["agility-cms", "contentful", "contentful-graphql", "prismic", "appdrag", "backendless", "bubble", "cloudcart", "cloudpress", "brilliant-directories", "customgpt"],
      objects: "页面、内容模型、文章、资源、站点配置、用户和发布状态",
      actions: "查询、创建、更新、发布、回滚、同步和导出",
      audience: "网站运营、内容团队、无代码建站用户和需要自动维护站点内容的人。",
      scenarios: ["查询 {service} 的页面、文章和内容模型", "创建或更新内容并发布", "整理站点内容、资源和发布状态"]
    },
    {
      category: "表单 / 预约 / 活动",
      keywords: ["appointo", "eventbrite", "calendly", "jotform", "typeform", "boloforms", "byteforms", "cabinpanda", "chmeetings", "clickmeeting", "demio", "bookingmood"],
      objects: "表单、报名、预约、参会人、活动、会议、票务和提交记录",
      actions: "查询、创建、更新、取消、发送、统计、同步和导出",
      audience: "运营、销售、活动组织者和需要自动处理报名、预约或表单数据的人。",
      scenarios: ["查询 {service} 的预约、活动或表单提交", "创建会议、活动或报名记录", "整理参会名单、提交数据和后续待办"]
    },
    {
      category: "聊天机器人 / AI 客服",
      keywords: ["botpress", "botsonic", "botstar", "botbaba", "chatbotkit", "chatfai", "bolna", "convolo-ai"],
      objects: "机器人、会话、用户、知识库、回复规则、训练数据和消息记录",
      actions: "查询、创建、更新、训练、发送、同步和导出",
      audience: "客服、增长、产品团队和需要维护聊天机器人或 AI 客服流程的人。",
      scenarios: ["查询 {service} 的机器人配置和会话记录", "更新知识库、回复规则或训练数据", "整理用户问题、客服摘要和优化建议"]
    },
    {
      category: "市场数据 / 公共 API",
      keywords: ["benzinga", "builtwith", "bigpicture-io", "big-data-cloud", "api-bible", "api-ninjas", "api-sports", "college-football-data", "currents-api", "countdown-api", "bart"],
      objects: "公开数据、公司信息、技术栈、新闻、体育数据、时间数据和查询结果",
      actions: "查询、筛选、分析、同步、统计和导出",
      audience: "研究员、数据分析师、增长团队和需要把公共数据接进 Claude Code 的人。",
      scenarios: ["查询 {service} 的公开数据或实时信息", "筛选并整理成摘要、表格或报告", "把外部 API 结果同步到后续工作流"]
    },
    {
      category: "房地产 / 建筑",
      keywords: ["zillow", "acculynx", "jobnimbus", "procore", "buildertrend", "real-estate", "construction"],
      objects: "房源、客户、项目、报价、工单、合同、施工进度和附件",
      actions: "查询、创建、更新、分配、同步和导出",
      audience: "房产经纪、建筑工程、装修和现场项目管理团队。",
      scenarios: ["查询 {service} 的客户、项目或房源记录", "更新报价、合同、工单和施工状态", "整理项目进度、附件和待办"]
    }
  ];

  const matched = profiles.find(profile => profile.keywords.some(keyword => text.includes(keyword)));
  if (matched) return matched;

  return {
    category: "待补充",
    objects: `${service} 相关资源`,
    actions: "调用、查询或同步",
    audience: `已经在使用 ${service}，并希望把它接入 Claude Code 的用户。`,
    scenarios: [`原始仓库没有给出足够清晰的中文用途说明`, `需要在私有后台补充 ${service} 的具体对象和场景`, `确认用途后再推荐给普通用户安装`]
  };
}

function audienceForCategory(category, name) {
  const map = {
    "文档处理": "需要处理合同、报告、论文、发票、教材或知识资料的人。",
    "表格处理": "数据运营、分析师、财务和需要批量处理表格的人。",
    "演示文稿": "创业者、销售、产品经理、讲师和需要制作汇报材料的人。",
    "内容整理": "内容创作者、研究者、学习者和需要把视频资料沉淀成文字的人。",
    "内容发布": "技术作者、公众号作者、知识库维护者和内部文档负责人。",
    "网页自动化": "开发者、测试人员、产品经理和需要验证网页流程的人。"
  };
  return map[category] || `需要使用 ${name} 处理具体工作流的 Claude Code 用户。`;
}

function cleanServiceName(name) {
  return String(name || "skill")
    .replace(/^-+/, "")
    .replace(/-automation$/i, "")
    .replace(/\s+automation$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim() || "Skill";
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}

function compact(value, limit) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function installSnippet(repo, skillPath, skillSlug) {
  const tmp = `/tmp/${repo.replace("/", "__")}`;
  const sourcePath = skillPath === "." ? tmp : `${tmp}/${skillPath}`;
  const destPath = `"$HOME/.claude/skills/${skillSlug}"`;
  return [
    "mkdir -p \"$HOME/.claude/skills\"",
    `rm -rf ${shellQuote(tmp)}`,
    `git clone --depth 1 ${shellQuote(`https://github.com/${repo}.git`)} ${shellQuote(tmp)}`,
    `cp -R ${shellQuote(sourcePath)} ${destPath}`,
    `rm -rf ${shellQuote(tmp)}`
  ].join("\n");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function yamlString(value) {
  return JSON.stringify(String(value || "").replace(/\s+/g, " ").trim());
}

async function loadSources() {
  try {
    const raw = await readFile("data/sources.json", "utf8");
    const payload = JSON.parse(raw);
    return normalizeSources(payload.sources || []);
  } catch (error) {
    console.warn(`Could not read data/sources.json, using fallback sources: ${error.message}`);
    return normalizeSources([
      { repo: "ComposioHQ/awesome-claude-skills" },
      { repo: "JimLiu/baoyu-skills" },
      { repo: "anthropics/skills" },
      { repo: "stellarlinkco/myclaude" }
    ]);
  }
}

async function loadDescriptionOverrides() {
  try {
    const raw = await readFile("data/description-overrides.json", "utf8");
    const payload = JSON.parse(raw);
    return payload.overrides || {};
  } catch {
    return {};
  }
}

function normalizeSources(items) {
  return items
    .map(source => {
      const repo = String(source.repo || "").trim();
      if (!repo.includes("/")) return null;
      return {
        ...source,
        repo,
        url: source.url || `https://github.com/${repo}.git`
      };
    })
    .filter(Boolean);
}

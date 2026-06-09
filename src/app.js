const state = {
  skills: [],
  filtered: [],
  selectedId: null,
  checked: new Set(),
  checkedOnly: false,
  lang: localStorage.getItem("ccskills-lang") === "en" ? "en" : "zh",
  query: "",
  repo: "all",
  tag: "all",
  sort: "common",
  queryTerms: []
};

const SEARCH_ALIASES = {
  "常用": ["推荐", "必装", "基础", "common", "recommended"],
  "文档": ["doc", "docs", "docx", "word", "pdf", "报告", "合同", "材料", "文件"],
  "pdf": ["文档", "合同", "论文", "发票", "扫描件"],
  "word": ["doc", "docx", "文档", "报告", "合同"],
  "表格": ["excel", "xlsx", "sheet", "spreadsheet", "csv", "数据", "报表"],
  "excel": ["excle", "xlsx", "sheet", "spreadsheet", "表格", "报表"],
  "ppt": ["pptx", "slide", "presentation", "幻灯片", "演示", "汇报"],
  "图片": ["image", "photo", "cover", "poster", "视觉", "封面", "插画", "海报", "图像"],
  "图像": ["image", "图片", "照片", "视觉", "封面"],
  "压缩": ["compress", "resize", "压缩图片", "图片压缩", "变小"],
  "翻译": ["translate", "translation", "英文", "中文", "本地化"],
  "网页": ["web", "website", "browser", "playwright", "浏览器", "页面", "站点"],
  "浏览器": ["browser", "playwright", "web", "网页", "网站", "页面"],
  "测试": ["test", "testing", "qa", "检查", "验证", "验收"],
  "字幕": ["transcript", "subtitle", "youtube", "视频", "转录"],
  "视频": ["youtube", "transcript", "subtitle", "字幕", "转录"],
  "发布": ["post", "publish", "wechat", "weibo", "x", "公众号", "微博"],
  "公众号": ["wechat", "微信", "发布", "文章"],
  "代码": ["code", "github", "git", "dev", "api", "开发", "编程"],
  "开发": ["code", "dev", "github", "api", "代码", "agent"],
  "自动化": ["automation", "automate", "rube", "composio", "接口", "api"],
  "接口": ["api", "automation", "自动化"],
  "邮件": ["email", "mail", "gmail", "outlook", "邮箱"],
  "日历": ["calendar", "meeting", "会议", "预约"],
  "会议": ["meeting", "calendar", "日历", "预约"],
  "任务": ["task", "project", "todo", "jira", "linear", "项目"],
  "项目": ["project", "task", "jira", "linear", "任务"],
  "客服": ["support", "ticket", "工单", "客户"],
  "工单": ["ticket", "support", "客服"],
  "销售": ["sales", "crm", "lead", "客户", "线索"],
  "线索": ["lead", "prospect", "sales", "销售"],
  "财务": ["finance", "invoice", "payment", "发票", "付款", "账单"],
  "发票": ["invoice", "财务", "账单", "pdf"],
  "设计": ["design", "figma", "canva", "图片", "视觉"],
  "爬虫": ["scrape", "crawler", "抓取", "网页"],
  "抓取": ["scrape", "crawler", "爬虫", "提取"],
  "知识库": ["knowledge", "search", "docs", "检索", "搜索"],
  "搜索": ["search", "find", "检索", "查询"],
  "github": ["git", "代码", "仓库", "issue", "pr"],
  "slack": ["消息", "团队", "通知", "chat"],
  "notion": ["笔记", "知识库", "文档"],
  "figma": ["设计", "design", "原型"],
  "canva": ["设计", "海报", "图片"]
};

const els = {
  total: document.querySelector("#stat-total"),
  selected: document.querySelector("#stat-selected"),
  repos: document.querySelector("#stat-repos"),
  search: document.querySelector("#search-input"),
  repoFilter: document.querySelector("#repo-filter"),
  tagFilter: document.querySelector("#tag-filter"),
  sortFilter: document.querySelector("#sort-filter"),
  resultCount: document.querySelector("#result-count"),
  selectionHint: document.querySelector("#selection-hint"),
  list: document.querySelector("#skills-list"),
  detail: document.querySelector("#detail-panel"),
  selectVisible: document.querySelector("#select-visible"),
  selectAll: document.querySelector("#select-all"),
  clearSelection: document.querySelector("#clear-selection"),
  copySelected: document.querySelector("#copy-selected"),
  copyAllInstall: document.querySelector("#copy-all-install"),
  downloadZip: document.querySelector("#download-zip"),
  checkedOnly: document.querySelector("#toggle-checked-only"),
  langZh: document.querySelector("#lang-zh"),
  langEn: document.querySelector("#lang-en"),
  openSubmit: document.querySelector("#open-submit"),
  closeSubmit: document.querySelector("#close-submit"),
  submitModal: document.querySelector("#submit-modal"),
  submitForm: document.querySelector("#submit-form"),
  toast: document.querySelector("#toast")
};

const i18n = {
  zh: {
    brandTitle: "Skills 安装台",
    brandSubtitle: "聚合大部分 Claude Code skills，批量打包成 ccswitch ZIP，一次导入。",
    statTotal: "全库",
    statSelected: "已选",
    statRepos: "仓库",
    searchLabel: "搜索",
    searchPlaceholder: "名称、用途、场景、仓库...",
    repoLabel: "仓库",
    allRepos: "全部仓库",
    tagLabel: "标签",
    allTags: "全部标签",
    sortLabel: "排序",
    sortCommon: "常用优先",
    sortSelected: "已选优先",
    sortName: "名称 A-Z",
    checkedOnly: "只看已选",
    clearSelection: "清空选择",
    copySelected: "复制已选安装命令",
    copyAllInstall: "复制全库安装命令",
    downloadZip: "导出 ccswitch ZIP",
    submitSkill: "提交 skill",
    submitTitle: "提交候选 skill",
    submitRepo: "GitHub 仓库",
    submitPath: "Skill 路径（可选）",
    submitDescription: "这个 skill 能做什么",
    submitWhy: "为什么值得收录",
    submitProof: "完成任务截图（可选）",
    submitContact: "联系方式（可选，不公开）",
    submitSend: "提交审核",
    submitNote: "提交后只进入维护者审核队列，不会直接发布。",
    emptyTitle: "选择一个 skill",
    emptyBody: "右侧固定显示当前 skill 的核心说明和操作按钮。",
    noSelectedTitle: "没有选中的 skill",
    noSelectedBody: "请调整搜索或筛选条件。",
    noResults: "没有匹配结果。换个关键词，或取消“只看已选”。",
    addToBatch: "加入批量选择",
    removeFromBatch: "从批量选择中移除",
    copyInstall: "复制安装命令",
    exportSingleZip: "导出单个 ZIP",
    capability: "能做什么",
    audience: "适合谁",
    scenarios: "典型场景",
    installPath: "安装位置",
    sourceInfo: "来源标注",
    sourceRepo: "来源仓库",
    sourcePath: "仓库路径",
    originalDescription: "原始说明",
    licenseNotice: "许可提示",
    copy: "复制",
    selectedHintEmpty: "先勾选，再导出 ccswitch ZIP 批量导入",
    selectedHint: count => `已选择 ${formatNumber(count)} 个，建议导出 ccswitch ZIP 后批量导入`,
    resultCount: count => `${formatNumber(count)} 个结果`,
    checkedCount: count => `${formatNumber(count)} 个已选`,
    selectVisible: count => `选中筛选结果 ${formatNumber(count)}`,
    checkedVisible: count => `已显示全部已选 ${formatNumber(count)}`,
    selectAll: count => `全选全库 ${formatNumber(count)}`,
    selectedVisibleToast: count => `已选中当前 ${formatNumber(count)} 个结果`,
    selectedAllToast: "已全选全库 skills",
    clearToast: "已清空选择",
    needSelect: "请先选择至少一个 skill",
    copiedSingle: "已复制单个安装命令",
    copiedBulk: count => `已复制 ${formatNumber(count)} 个 skills 的批量安装命令`,
    zipDone: count => `已导出 ${formatNumber(count)} 个 skill 文件夹 ZIP`,
    submitDone: "已提交，等待维护者审核",
    submitFailed: message => `提交失败：${message}`,
    loadFailed: message => `数据加载失败：${message}`
  },
  en: {
    brandTitle: "Skills Console",
    brandSubtitle: "Aggregate Claude Code skills, batch them, and import into ccswitch with one ZIP.",
    statTotal: "Skills",
    statSelected: "Selected",
    statRepos: "Repos",
    searchLabel: "Search",
    searchPlaceholder: "Name, purpose, scenario, repo...",
    repoLabel: "Repository",
    allRepos: "All repositories",
    tagLabel: "Tag",
    allTags: "All tags",
    sortLabel: "Sort",
    sortCommon: "Common first",
    sortSelected: "Selected first",
    sortName: "Name A-Z",
    checkedOnly: "Selected only",
    clearSelection: "Clear",
    copySelected: "Copy selected install command",
    copyAllInstall: "Copy all install commands",
    downloadZip: "Export ccswitch ZIP",
    submitSkill: "Submit skill",
    submitTitle: "Submit a skill",
    submitRepo: "GitHub repository",
    submitPath: "Skill path (optional)",
    submitDescription: "What this skill does",
    submitWhy: "Why it should be included",
    submitProof: "Task proof screenshot (optional)",
    submitContact: "Contact (optional, private)",
    submitSend: "Submit for review",
    submitNote: "Submissions enter the maintainer review queue and are never published directly.",
    emptyTitle: "Select a skill",
    emptyBody: "The fixed detail panel shows the current skill summary and actions.",
    noSelectedTitle: "No skill selected",
    noSelectedBody: "Adjust search or filters.",
    noResults: "No matching results. Try another keyword or turn off Selected only.",
    addToBatch: "Add to batch",
    removeFromBatch: "Remove from batch",
    copyInstall: "Copy install command",
    exportSingleZip: "Export single ZIP",
    capability: "What it does",
    audience: "Best for",
    scenarios: "Use cases",
    installPath: "Install path",
    sourceInfo: "Source",
    sourceRepo: "Repository",
    sourcePath: "Path",
    originalDescription: "Original description",
    licenseNotice: "License note",
    copy: "Copy",
    selectedHintEmpty: "Select skills, then export a ccswitch ZIP for batch import",
    selectedHint: count => `${formatNumber(count)} selected. Export a ccswitch ZIP for batch import.`,
    resultCount: count => `${formatNumber(count)} results`,
    checkedCount: count => `${formatNumber(count)} selected`,
    selectVisible: count => `Select filtered ${formatNumber(count)}`,
    checkedVisible: count => `Showing ${formatNumber(count)} selected`,
    selectAll: count => `Select all ${formatNumber(count)}`,
    selectedVisibleToast: count => `Selected ${formatNumber(count)} current results`,
    selectedAllToast: "Selected all skills",
    clearToast: "Selection cleared",
    needSelect: "Select at least one skill first",
    copiedSingle: "Copied single install command",
    copiedBulk: count => `Copied batch install command for ${formatNumber(count)} skills`,
    zipDone: count => `Exported ${formatNumber(count)} skill folders as ZIP`,
    submitDone: "Submitted for maintainer review",
    submitFailed: message => `Submission failed: ${message}`,
    loadFailed: message => `Failed to load data: ${message}`
  }
};

async function init() {
  try {
    const response = await fetch(assetUrl("data/skills.json"));
    const payload = await response.json();
    state.skills = (payload.skills || []).map(normalizeSkill);
    state.selectedId = state.skills[0]?.id || null;
    populateFilters();
    bindEvents();
    applyLanguage();
    applyFilters();
  } catch (error) {
    els.list.innerHTML = `<div class="empty-results">${escapeHtml(t("loadFailed", error.message))}</div>`;
  }
}

function bindEvents() {
  els.search.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    state.queryTerms = expandQueryTerms(state.query);
    applyFilters();
  });

  els.repoFilter.addEventListener("change", event => {
    state.repo = event.target.value;
    applyFilters();
  });

  els.tagFilter.addEventListener("change", event => {
    state.tag = event.target.value;
    applyFilters();
  });

  els.sortFilter.addEventListener("change", event => {
    state.sort = event.target.value;
    applyFilters();
  });

  els.selectVisible.addEventListener("click", () => {
    state.filtered.forEach(skill => state.checked.add(skill.id));
    updateSelection();
    renderList();
    showToast(t("selectedVisibleToast", state.filtered.length));
  });

  els.selectAll.addEventListener("click", () => {
    state.skills.forEach(skill => state.checked.add(skill.id));
    updateSelection();
    renderList();
    showToast(t("selectedAllToast"));
  });

  els.clearSelection.addEventListener("click", () => {
    state.checked.clear();
    state.checkedOnly = false;
    updateSelection();
    applyFilters();
    showToast(t("clearToast"));
  });

  els.checkedOnly.addEventListener("click", () => {
    state.checkedOnly = !state.checkedOnly;
    els.checkedOnly.classList.toggle("is-active", state.checkedOnly);
    applyFilters();
  });

  els.langZh.addEventListener("click", () => setLanguage("zh"));
  els.langEn.addEventListener("click", () => setLanguage("en"));

  els.copySelected.addEventListener("click", () => copyBulkInstall(getCheckedSkills()));
  els.copyAllInstall.addEventListener("click", () => copyBulkInstall(state.skills));
  els.downloadZip.addEventListener("click", () => downloadCcsZip(getCheckedSkills()));
  els.openSubmit.addEventListener("click", () => {
    els.submitModal.hidden = false;
    document.querySelector("#submit-repo").focus();
  });
  els.closeSubmit.addEventListener("click", () => closeSubmitModal());
  els.submitModal.addEventListener("click", event => {
    if (event.target === els.submitModal) closeSubmitModal();
  });
  els.submitForm.addEventListener("submit", submitCandidateSkill);
}

function closeSubmitModal() {
  els.submitModal.hidden = true;
}

function populateFilters() {
  const repos = [...new Set(state.skills.map(skill => skill.source.repo))].sort();
  const tags = [...new Set(state.skills.flatMap(skill => skill.tags || []))].sort((a, b) => {
    if (a === "common") return -1;
    if (b === "common") return 1;
    return tagLabel(a).localeCompare(tagLabel(b), state.lang === "zh" ? "zh-CN" : "en-US");
  });

  els.repoFilter.innerHTML = `<option value="all">${escapeHtml(t("allRepos"))}</option>`;
  els.tagFilter.innerHTML = `<option value="all">${escapeHtml(t("allTags"))}</option>`;
  repos.forEach(repo => els.repoFilter.append(new Option(repoLabel(repo), repo)));
  tags.forEach(tag => els.tagFilter.append(new Option(tagLabel(tag), tag)));
  els.repoFilter.value = state.repo;
  els.tagFilter.value = state.tag;

  els.total.textContent = formatNumber(state.skills.length);
  els.repos.textContent = formatNumber(repos.length);
}

function applyFilters() {
  const queryTerms = state.queryTerms;

  state.filtered = state.checkedOnly
    ? state.skills.filter(skill => state.checked.has(skill.id))
    : state.skills.filter(skill => {
      const matchesRepo = state.repo === "all" || skill.source.repo === state.repo;
      const matchesTag = state.tag === "all" || (skill.tags || []).includes(state.tag);
      return matchesRepo && matchesTag && (!queryTerms.length || searchScore(skill, queryTerms) > 0);
    });

  sortFiltered();

  if (!state.filtered.some(skill => skill.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id || null;
  }

  renderList();
  renderDetail();
  updateSelection();
}

function renderList() {
  els.resultCount.textContent = state.checkedOnly
    ? t("checkedCount", state.filtered.length)
    : t("resultCount", state.filtered.length);
  els.selectVisible.textContent = state.checkedOnly
    ? t("checkedVisible", state.filtered.length)
    : t("selectVisible", state.filtered.length);
  els.selectAll.textContent = t("selectAll", state.skills.length);

  if (state.filtered.length === 0) {
    els.list.innerHTML = `<div class="empty-results">${escapeHtml(t("noResults"))}</div>`;
    return;
  }

  els.list.innerHTML = state.filtered.map(skill => {
    const checked = state.checked.has(skill.id);
    return `
      <div class="skill-row ${skill.id === state.selectedId ? "is-active" : ""} ${checked ? "is-checked" : ""}" data-id="${escapeAttribute(skill.id)}">
        <label class="check-wrap" aria-label="选择 ${escapeAttribute(skill.displayName)}">
          <input class="skill-check" type="checkbox" ${checked ? "checked" : ""} />
          <span></span>
        </label>
        <button class="row-main" type="button">
          <span class="row-title">${escapeHtml(skill.displayName)}</span>
          <span class="row-summary">${escapeHtml(skillText(skill, "summary"))}</span>
          <span class="row-meta">
            <span class="pill">${escapeHtml(repoLabel(skill.source.repo))}</span>
            ${(skill.tags || []).slice(0, 3).map(tag => `<span class="pill">${escapeHtml(tagLabel(tag))}</span>`).join("")}
          </span>
        </button>
        <button class="quick-button" type="button">${escapeHtml(t("copy"))}</button>
      </div>
    `;
  }).join("");

  els.list.querySelectorAll(".skill-row").forEach(row => {
    const id = row.dataset.id;
    row.querySelector(".row-main").addEventListener("click", () => {
      state.selectedId = id;
      renderList();
      renderDetail();
    });
    row.querySelector(".skill-check").addEventListener("change", event => {
      if (event.target.checked) state.checked.add(id);
      else state.checked.delete(id);
      updateSelection();
      row.classList.toggle("is-checked", event.target.checked);
    });
    row.querySelector(".quick-button").addEventListener("click", () => {
      const skill = state.skills.find(item => item.id === id);
      copyBulkInstall([skill]);
    });
  });
}

function sortFiltered() {
  const comparators = {
    common: (a, b) => commonScore(b) - commonScore(a) || a.displayName.localeCompare(b.displayName),
    selected: (a, b) => Number(state.checked.has(b.id)) - Number(state.checked.has(a.id)) || commonScore(b) - commonScore(a),
    name: (a, b) => a.displayName.localeCompare(b.displayName)
  };
  const baseComparator = comparators[state.sort] || comparators.common;
  if (state.queryTerms.length) {
    state.filtered.sort((a, b) => searchScore(b, state.queryTerms) - searchScore(a, state.queryTerms) || baseComparator(a, b));
    return;
  }
  state.filtered.sort(baseComparator);
}

function commonScore(skill) {
  const name = `${skill.name} ${skill.displayName} ${skill.category || ""} ${(skill.tags || []).join(" ")}`.toLowerCase();
  const text = `${name} ${skill.summaryZh || ""} ${skill.capabilityZh || ""}`.toLowerCase();
  const categoryScore = [
    [["pdf", "docx", "word", "xlsx", "spreadsheet", "ppt", "slide", "markdown"], 1000],
    [["browser", "playwright", "web"], 920],
    [["github", "gitlab", "jira", "linear"], 880],
    [["gmail", "email", "calendar", "slack", "notion"], 850],
    [["airtable", "sheets", "drive", "dropbox"], 820],
    [["figma", "canva", "image", "youtube", "transcript"], 760],
    [["quickbooks", "stripe", "shopify", "hubspot", "salesforce"], 700]
  ].find(([needles]) => needles.some(needle => text.includes(needle)))?.[1] || 420;
  const officialScore = skill.source.repo === "anthropics/skills" ? 120 : 0;
  const curatedScore = skill.source.repo === "JimLiu/baoyu-skills" ? 70 : 0;
  const selectedScore = state.checked.has(skill.id) ? 80 : 0;
  const automationPenalty = name.includes("automation") ? -120 : 0;
  const obscurePenalty = name.startsWith("-") ? -120 : 0;
  return categoryScore + officialScore + curatedScore + selectedScore + automationPenalty + obscurePenalty;
}

function searchScore(skill, queryTerms) {
  if (!queryTerms.length) return 1;
  const text = skill.searchText || "";
  const tokens = skill.searchTokens || [];
  let score = 0;

  for (const term of queryTerms) {
    if (!term) continue;
    if (text.includes(term)) {
      score += term.length >= 4 ? 12 : 8;
      if (normalizeSearchText(skill.displayName).includes(term)) score += 16;
      if (normalizeSearchText(skill.category).includes(term)) score += 8;
      continue;
    }
    if (isAsciiTerm(term) && fuzzyTokenHit(term, tokens)) score += 4;
  }

  return score;
}

function expandQueryTerms(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = new Set();
  const compactQuery = normalized.replace(/\s+/g, "");
  addSearchTerm(terms, normalized);
  addSearchTerm(terms, compactQuery);

  for (const token of normalized.split(/\s+/)) addSearchTerm(terms, token);

  for (const [key, aliases] of Object.entries(SEARCH_ALIASES)) {
    const normalizedKey = normalizeSearchText(key);
    const all = [normalizedKey, ...aliases.map(normalizeSearchText)];
    if (all.some(item => item && (normalized.includes(item) || compactQuery.includes(item.replace(/\s+/g, ""))))) {
      all.forEach(item => addSearchTerm(terms, item));
    }
  }

  return [...terms].filter(term => term.length > 1);
}

function buildSearchText(skill) {
  const base = [
    skill.name,
    skill.displayName,
    skill.summary,
    skill.summaryZh,
    skill.summaryEn,
    skill.capabilityZh,
    skill.capabilityEn,
    skill.audienceZh,
    skill.audienceEn,
    skill.usageZh,
    skill.usageEn,
    skill.category,
    skill.source?.repo,
    skill.source?.path,
    ...(skill.scenariosZh || []),
    ...(skill.scenariosEn || []),
    ...(skill.tags || [])
  ].join(" ");
  const normalized = normalizeSearchText(base);
  const expanded = new Set([normalized]);

  for (const [key, aliases] of Object.entries(SEARCH_ALIASES)) {
    const all = [key, ...aliases].map(normalizeSearchText);
    if (all.some(item => item && normalized.includes(item))) {
      all.forEach(item => addSearchTerm(expanded, item));
    }
  }

  return [...expanded].join(" ");
}

function searchTokens(text) {
  return [...new Set(normalizeSearchText(text).split(/\s+/).filter(item => item.length > 1))];
}

function addSearchTerm(terms, term) {
  const normalized = normalizeSearchText(term);
  if (normalized && normalized.length > 1) terms.add(normalized);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_/\\.-]+/g, " ")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAsciiTerm(term) {
  return /^[a-z0-9]+$/.test(term) && term.length >= 4;
}

function fuzzyTokenHit(term, tokens) {
  return tokens.some(token => {
    if (!isAsciiTerm(token)) return false;
    if (Math.abs(token.length - term.length) > 2) return false;
    const limit = term.length > 7 ? 2 : 1;
    return editDistanceWithin(term, token, limit);
  });
}

function editDistanceWithin(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
}

function renderDetail() {
  const skill = getSelectedSkill();

  if (!skill) {
    els.detail.innerHTML = `
      <div class="detail-empty">
        <h2>${escapeHtml(t("noSelectedTitle"))}</h2>
        <p>${escapeHtml(t("noSelectedBody"))}</p>
      </div>
    `;
    return;
  }

  const checked = state.checked.has(skill.id);
  els.detail.innerHTML = `
    <div class="detail-actions">
      <button id="detail-check" class="primary-button ${checked ? "alt" : ""}" type="button">${escapeHtml(checked ? t("removeFromBatch") : t("addToBatch"))}</button>
      <button id="detail-install" class="primary-button dark" type="button">${escapeHtml(t("copyInstall"))}</button>
      <button id="detail-zip" class="primary-button" type="button">${escapeHtml(t("exportSingleZip"))}</button>
    </div>
    <header class="detail-title">
      <span>${escapeHtml(repoLabel(skill.source.repo))}</span>
      <h2>${escapeHtml(skill.displayName)}</h2>
      <p>${escapeHtml(skillText(skill, "summary"))}</p>
    </header>
    <div class="detail-grid">
      <section class="detail-section">
        <h3>${escapeHtml(t("capability"))}</h3>
        <p>${escapeHtml(skillText(skill, "capability"))}</p>
      </section>
      <section class="detail-section">
        <h3>${escapeHtml(t("audience"))}</h3>
        <p>${escapeHtml(skillText(skill, "audience"))}</p>
      </section>
      <section class="detail-section wide">
        <h3>${escapeHtml(t("scenarios"))}</h3>
        <ul>${skillScenarios(skill).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="detail-section wide">
        <h3>${escapeHtml(t("installPath"))}</h3>
        <p><code>~/.claude/skills/${escapeHtml(skill.folderName)}</code></p>
      </section>
      <section class="detail-section wide source-section">
        <h3>${escapeHtml(t("sourceInfo"))}</h3>
        <dl>
          <div>
            <dt>${escapeHtml(t("sourceRepo"))}</dt>
            <dd><a href="${escapeAttribute(skill.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(skill.source.repo)}</a></dd>
          </div>
          <div>
            <dt>${escapeHtml(t("sourcePath"))}</dt>
            <dd><code>${escapeHtml(skill.source.path)}</code></dd>
          </div>
          <div>
            <dt>${escapeHtml(t("originalDescription"))}</dt>
            <dd>${escapeHtml(skill.summary || "-")}</dd>
          </div>
          <div>
            <dt>${escapeHtml(t("licenseNotice"))}</dt>
            <dd>${escapeHtml(sourceLicenseNote(skill.source.repo))}</dd>
          </div>
        </dl>
      </section>
    </div>
  `;

  document.querySelector("#detail-check").addEventListener("click", () => {
    if (state.checked.has(skill.id)) state.checked.delete(skill.id);
    else state.checked.add(skill.id);
    updateSelection();
    renderList();
    renderDetail();
  });

  document.querySelector("#detail-install").addEventListener("click", () => copyBulkInstall([skill]));
  document.querySelector("#detail-zip").addEventListener("click", () => downloadCcsZip([skill]));
}

function updateSelection() {
  const count = state.checked.size;
  els.selected.textContent = formatNumber(count);
  els.selectionHint.textContent = count > 0 ? t("selectedHint", count) : t("selectedHintEmpty");
  const disabled = count === 0;
  els.copySelected.disabled = disabled;
  els.downloadZip.disabled = disabled;
}

function setLanguage(lang) {
  if (!["zh", "en"].includes(lang) || state.lang === lang) return;
  state.lang = lang;
  localStorage.setItem("ccskills-lang", lang);
  applyLanguage();
  populateFilters();
  applyFilters();
}

function applyLanguage() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  els.langZh.classList.toggle("is-active", state.lang === "zh");
  els.langEn.classList.toggle("is-active", state.lang === "en");
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  els.checkedOnly.classList.toggle("is-active", state.checkedOnly);
  updateSelection();
}

function t(key, value) {
  const entry = (i18n[state.lang] || i18n.zh)[key] ?? i18n.zh[key] ?? key;
  return typeof entry === "function" ? entry(value) : entry;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US");
}

async function copyBulkInstall(skills) {
  if (!skills.length) return showToast(t("needSelect"));
  await navigator.clipboard.writeText(generateBulkInstall(skills));
  showToast(skills.length === 1 ? t("copiedSingle") : t("copiedBulk", skills.length));
}

async function downloadCcsZip(skills) {
  if (!skills.length) return showToast(t("needSelect"));
  const files = {};

  for (const skill of skills) {
    const packageFiles = await loadSkillFiles(skill);
    files[`${skill.folderName}/`] = new Uint8Array();
    for (const file of packageFiles) {
      const directPath = sanitizeZipPath(`${skill.folderName}/${file.path}`);
      files[directPath] = decodePackagedFile(file);
    }
  }

  const blob = await makeZip(files);
  const filename = skills.length === 1 ? `${skills[0].folderName}.zip` : "ccswitch-skills-batch.zip";
  downloadBlob(filename, blob, "application/zip");
  showToast(t("zipDone", skills.length));
}

async function submitCandidateSkill(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  try {
    const proofInput = document.querySelector("#submit-proof");
    const proofFile = proofInput.files?.[0] || null;
    const proof = proofFile ? await proofToPayload(proofFile) : null;
    const payload = {
      repoUrl: document.querySelector("#submit-repo").value,
      skillPath: document.querySelector("#submit-path").value,
      description: document.querySelector("#submit-description").value,
      whyUseful: document.querySelector("#submit-why").value,
      contact: document.querySelector("#submit-contact").value,
      website: document.querySelector("#submit-website").value,
      proof
    };
    const response = await fetch(submissionApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    form.reset();
    closeSubmitModal();
    showToast(t("submitDone"));
  } catch (error) {
    showToast(t("submitFailed", error.message));
  } finally {
    submitButton.disabled = false;
  }
}

function submissionApiUrl() {
  if (window.CCSKILLS_SUBMIT_API) return window.CCSKILLS_SUBMIT_API;
  return "/skills-api/submit";
}

function proofToPayload(file) {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Only PNG, JPEG, or WebP screenshots are supported"));
      return;
    }
    if (file.size > 1_200_000) {
      reject(new Error("Screenshot must be smaller than 1.2 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(new Error("Failed to read screenshot"));
    reader.readAsDataURL(file);
  });
}

async function loadSkillFiles(skill) {
  try {
    if (!skill.packageUrl) throw new Error("missing packageUrl");
    const response = await fetch(assetUrl(skill.packageUrl));
    if (!response.ok) throw new Error(`package ${response.status}`);
    const payload = await response.json();
    if (Array.isArray(payload.files) && payload.files.length > 0) return payload.files;
  } catch (error) {
    console.warn(`使用兜底 SKILL.md：${skill.displayName}`, error);
  }
  return [{ path: "SKILL.md", encoding: "utf8", content: fallbackSkillMd(skill) }];
}

function fallbackSkillMd(skill) {
  return [
    "---",
    `name: ${skill.folderName}`,
    `description: ${skill.summaryZh}`,
    "---",
    "",
    `# ${skill.displayName}`,
    "",
    skill.capabilityZh || skill.summaryZh,
    "",
    "## 使用场景",
    ...(skill.scenariosZh || []).map(item => `- ${item}`)
  ].join("\n");
}

function decodePackagedFile(file) {
  if (file.encoding === "base64") return base64ToBytes(file.content);
  return file.content || "";
}

function assetUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${cleanBase}${cleanPath}`;
}

function sanitizeZipPath(path) {
  return path
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

function generateBulkInstall(skills) {
  const groups = new Map();
  skills.forEach(skill => {
    if (!groups.has(skill.source.repo)) groups.set(skill.source.repo, []);
    groups.get(skill.source.repo).push(skill);
  });

  const lines = [
    "mkdir -p \"$HOME/.claude/skills\"",
    "workdir=\"$(mktemp -d)\"",
    "trap 'rm -rf \"$workdir\"' EXIT"
  ];

  for (const [repo, items] of groups) {
    const repoDir = repo.replaceAll("/", "__");
    lines.push("");
    lines.push(`# ${repo}`);
    lines.push(`git clone --depth 1 ${shellQuote(`https://github.com/${repo}.git`)} "$workdir/${repoDir}"`);
    items.forEach(skill => {
      lines.push(`rm -rf "$HOME/.claude/skills/${skill.folderName}"`);
      lines.push(`cp -R "$workdir/${repoDir}/${skill.source.path}" "$HOME/.claude/skills/${skill.folderName}"`);
    });
  }

  return lines.join("\n");
}

function getSelectedSkill() {
  return state.skills.find(skill => skill.id === state.selectedId);
}

function getCheckedSkills() {
  return state.skills.filter(skill => state.checked.has(skill.id));
}

function normalizeSkill(skill) {
  const displayName = cleanName(skill.name);
  const summaryZh = skill.summaryZh || chineseSummary(skill.summary, displayName);
  const summaryEn = englishSummary(skill.summary, displayName);
  const tags = new Set(skill.tags || []);
  if (isCommonSkill({ ...skill, displayName, summaryZh })) tags.add("common");
  const normalized = {
    ...skill,
    displayName,
    folderName: folderName(displayName),
    sourceType: skill.source?.type || "unknown",
    sourceStars: Number(skill.source?.stars || 0),
    summaryZh,
    summaryEn,
    capabilityZh: skill.capabilityZh || capabilityText(skill, displayName, summaryZh),
    capabilityEn: skill.capabilityEn || englishCapability(skill, displayName, summaryEn),
    audienceZh: skill.audienceZh || chineseAudience(skill.audience, displayName),
    audienceEn: skill.audienceEn || englishAudience(skill.audience, displayName),
    scenariosZh: skill.scenariosZh || chineseScenarios(skill.scenarios, displayName, summaryZh),
    scenariosEn: skill.scenariosEn || englishScenarios(skill.scenarios, displayName, summaryEn),
    tags: [...tags],
    usageEn: skill.usageEn || `Install the skill, then ask Claude Code to use ${displayName} for the specific task, file, or service you want to work with.`
  };
  normalized.searchText = buildSearchText(normalized);
  normalized.searchTokens = searchTokens(normalized.searchText);
  return normalized;
}

function isCommonSkill(skill) {
  const text = `${skill.name} ${skill.displayName} ${skill.category || ""} ${skill.summaryZh || ""}`.toLowerCase();
  const coreNames = [
    "pdf", "docx", "xlsx", "pptx", "browser", "frontend-design", "skill-creator",
    "baoyu-translate", "baoyu-url-to-markdown", "baoyu-youtube-transcript",
    "baoyu-markdown-to-html", "baoyu-format-markdown", "baoyu-image-gen",
    "baoyu-cover-image", "baoyu-compress-image", "github", "slack", "notion",
    "gmail", "google-drive", "google-calendar", "googledocs", "googlesheets"
  ];
  if (skill.source?.repo === "anthropics/skills") return true;
  if (coreNames.some(name => text.includes(name))) return true;
  if (/文档处理|表格处理|演示文稿|内容整理|内容发布|网页自动化|翻译|视觉素材|代码 \/ Agent/.test(skill.category || "")) return true;
  return false;
}

function skillText(skill, field) {
  if (state.lang === "en") {
    const en = skill[`${field}En`];
    if (en) return en;
  }
  return skill[`${field}Zh`] || skill[field] || "";
}

function skillScenarios(skill) {
  const scenarios = state.lang === "en" ? skill.scenariosEn : skill.scenariosZh;
  return Array.isArray(scenarios) && scenarios.length ? scenarios : [skillText(skill, "summary")];
}

function cleanName(name) {
  return String(name || "skill")
    .replace(/^-+/, "")
    .replace(/-automation$/i, "")
    .replace(/\s+automation$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "skill";
}

function folderName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
}

function chineseSummary(summary, name) {
  const text = String(summary || "").trim();
  const automate = text.match(/^Automate\s+(.+?)\s+tasks\s+via\s+Rube MCP\s+\(Composio\)\.?\s*(Always search tools first for current schemas\.)?/i);
  if (automate) {
    const suffix = automate[2] ? "使用前始终先搜索工具，获取当前可用的参数和 schema。" : "";
    return `通过 Rube MCP（Composio）自动化 ${cleanName(automate[1])} 任务。${suffix}`.trim();
  }
  if (/^Create, edit,/.test(text)) return "创建、编辑和整理相关文件，让 Claude Code 能处理更完整的办公和内容工作流。";
  if (/download|transcript|subtitle/i.test(text)) return "下载和整理视频字幕、章节、封面等内容，适合做笔记、摘要和知识库整理。";
  if (/markdown|html/i.test(text)) return "把 Markdown 内容转换成可发布的 HTML 页面，适合文章排版和内容发布。";
  if (/browser|web/i.test(text)) return "控制浏览器或网页流程，适合本地页面验证、网页操作和自动化测试。";
  if (/^[\x00-\x7F]+$/.test(text)) return `${name} 的原始英文说明为：${text}`;
  return text || `${name} 相关能力扩展。`;
}

function englishSummary(summary, name) {
  const text = String(summary || "").replace(/\s+/g, " ").trim();
  if (text && isMostlyEnglish(text)) return text;
  return `${name} is a Claude Code skill for connecting the related tool or workflow.`;
}

function capabilityText(skill, name, summary) {
  if ((skill.tags || []).includes("automation")) return `${summary} 具体能调用哪些对象和动作，以授权后搜索到的当前工具 schema 为准。`;
  if ((skill.tags || []).includes("documents")) return `${summary} 它主要帮助你减少手工打开、复制、整理文档的时间。`;
  return summary;
}

function englishCapability(skill, name, summary) {
  if ((skill.tags || []).includes("automation")) {
    return `${summary} It acts as an automation connector for ${name}, usually through Composio / Rube when the source skill uses that integration.`;
  }
  if ((skill.tags || []).includes("documents")) {
    return `${summary} It helps Claude Code read, create, edit, or organize files with less manual copying.`;
  }
  return summary;
}

function chineseAudience(audience, name) {
  const text = String(audience || "");
  if (/财务|运营|团队|用户|开发者/.test(text)) return text;
  if (/finance|invoice|expense/i.test(text)) return "财务、运营、创业团队，以及需要自动处理账单和费用流程的人。";
  if (/document|pdf|docx/i.test(text)) return "需要处理合同、报告、论文、发票或知识资料的人。";
  return `需要使用 ${name} 或相关工具，并希望减少重复操作的 Claude Code 用户。`;
}

function englishAudience(audience, name) {
  const text = String(audience || "").replace(/\s+/g, " ").trim();
  if (text && isMostlyEnglish(text)) return text;
  if (/pdf|doc|document/i.test(`${name} ${text}`)) return "People who need Claude Code to work with documents, reports, contracts, or knowledge files.";
  if (/browser|web|test/i.test(`${name} ${text}`)) return "Developers, testers, and product teams who need to inspect or automate web workflows.";
  return `Claude Code users who already use ${name} or the related workflow and want to reduce repetitive manual work.`;
}

function chineseScenarios(scenarios, name, summary) {
  const base = Array.isArray(scenarios) ? scenarios : [];
  const zh = base
    .map(item => String(item || ""))
    .filter(item => item && !/^[\x00-\x7F\s.,:;()/-]+$/.test(item))
    .slice(0, 3);
  while (zh.length < 3) {
    const candidates = [
      `批量处理 ${name} 相关任务`,
      "把外部工具接入 Claude Code 工作流",
      summary
    ];
    zh.push(candidates[zh.length]);
  }
  return zh.slice(0, 3);
}

function englishScenarios(scenarios, name, summary) {
  const base = Array.isArray(scenarios) ? scenarios : [];
  const en = base
    .map(item => String(item || "").replace(/\s+/g, " ").trim())
    .filter(item => item && isMostlyEnglish(item))
    .slice(0, 3);
  while (en.length < 3) {
    const candidates = [
      `Use ${name} for related Claude Code tasks`,
      "Connect an external tool or workflow to Claude Code",
      summary
    ];
    en.push(candidates[en.length]);
  }
  return en.slice(0, 3);
}

function isMostlyEnglish(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const ascii = text.replace(/[^\x00-\x7F]/g, "").length;
  return ascii / text.length > 0.88;
}

function repoLabel(repo) {
  const labels = {
    zh: {
      "ComposioHQ/awesome-claude-skills": "Composio 自动化库",
      "JimLiu/baoyu-skills": "宝玉 Skills",
      "anthropics/skills": "Anthropic 官方",
      "stellarlinkco/myclaude": "myclaude 配置"
    },
    en: {
      "ComposioHQ/awesome-claude-skills": "Composio automation",
      "JimLiu/baoyu-skills": "Baoyu Skills",
      "anthropics/skills": "Anthropic official",
      "stellarlinkco/myclaude": "myclaude config"
    }
  };
  return labels[state.lang]?.[repo] || repo;
}

function tagLabel(tag) {
  const labels = {
    zh: {
      common: "常用推荐",
      skill: "通用",
      automation: "自动化",
      documents: "文档",
      spreadsheets: "表格",
      presentations: "幻灯片",
      browser: "浏览器",
      testing: "测试",
      image: "图片",
      video: "视频",
      api: "API",
      github: "GitHub"
    },
    en: {
      common: "Recommended",
      skill: "Skill",
      automation: "Automation",
      documents: "Documents",
      spreadsheets: "Spreadsheets",
      presentations: "Presentations",
      browser: "Browser",
      testing: "Testing",
      image: "Image",
      video: "Video",
      api: "API",
      github: "GitHub"
    }
  };
  return labels[state.lang]?.[tag] || tag;
}

function sourceLicenseNote(repo) {
  const notes = {
    zh: {
      "ComposioHQ/awesome-claude-skills": "第三方 skill 内容来自 ComposioHQ/awesome-claude-skills；部分 skill 目录包含独立 LICENSE.txt，请以原仓库为准。",
      "JimLiu/baoyu-skills": "第三方 skill 内容来自 JimLiu/baoyu-skills；未检测到统一顶层许可，请以原仓库声明为准。",
      "anthropics/skills": "第三方 skill 内容来自 anthropics/skills；部分 skill 目录包含独立 LICENSE.txt，请以原仓库为准。",
      "stellarlinkco/myclaude": "第三方 skill 内容来自 stellarlinkco/myclaude；原仓库包含 AGPL-3.0 许可声明。"
    },
    en: {
      "ComposioHQ/awesome-claude-skills": "Third-party skill content from ComposioHQ/awesome-claude-skills. Some skill folders include their own LICENSE.txt; check upstream.",
      "JimLiu/baoyu-skills": "Third-party skill content from JimLiu/baoyu-skills. No unified top-level license was detected; check upstream.",
      "anthropics/skills": "Third-party skill content from anthropics/skills. Some skill folders include their own LICENSE.txt; check upstream.",
      "stellarlinkco/myclaude": "Third-party skill content from stellarlinkco/myclaude. The upstream repository declares AGPL-3.0."
    }
  };
  return notes[state.lang]?.[repo] || (state.lang === "zh" ? "第三方 skill 内容，请以原仓库许可为准。" : "Third-party skill content. Check the upstream license.");
}

function downloadBlob(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function makeZip(files) {
  const encoder = new TextEncoder();
  const fileRecords = [];
  let offset = 0;
  const chunks = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = toBytes(content, encoder);
    const crc = crc32(data);
    const isDirectory = name.endsWith("/");
    const local = concatBytes(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
      nameBytes, data
    );
    chunks.push(local);
    fileRecords.push({ nameBytes, crc, size: data.length, offset, isDirectory });
    offset += local.length;
  }

  const central = [];
  for (const record of fileRecords) {
    central.push(concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(record.crc), u32(record.size), u32(record.size), u16(record.nameBytes.length),
      u16(0), u16(0), u16(0), u16(0), u32(record.isDirectory ? 0x10 : 0), u32(record.offset), record.nameBytes
    ));
  }
  const centralBlob = concatBytes(...central);
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(fileRecords.length), u16(fileRecords.length),
    u32(centralBlob.length), u32(offset), u16(0)
  );

  return new Blob([concatBytes(...chunks, centralBlob, end)], { type: "application/zip" });
}

function toBytes(content, encoder) {
  if (typeof content === "string") return encoder.encode(content);
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(content);
}

function base64ToBytes(value = "") {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

init();

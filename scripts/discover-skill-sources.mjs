import { mkdir, readFile, writeFile } from "node:fs/promises";

const searchQueries = [
  "claude code skills",
  "claude skills",
  "claude-code skill",
  "anthropic skills",
  "SKILL.md claude"
];

const codeSearchQueries = [
  "filename:SKILL.md \"Claude Code\"",
  "filename:SKILL.md \"Claude\"",
  "path:.claude/skills filename:SKILL.md",
  "path:skills filename:SKILL.md \"Claude\""
];

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const autoPromote = process.argv.includes("--promote") || process.env.AUTO_PROMOTE_HIGH_STAR === "1";
const autoPromoteMinStars = Number(process.env.AUTO_PROMOTE_MIN_STARS || 1000);
const headers = {
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
};
if (token) headers.Authorization = `Bearer ${token}`;

const existing = new Set(await loadExistingRepos());
const repos = new Map();
const errors = [];

for (const query of searchQueries) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${query} in:name,description,readme`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "20");

  let payload;
  try {
    payload = await githubJson(url);
  } catch (error) {
    errors.push({ query, error: error.message });
    continue;
  }
  for (const item of payload.items || []) {
    if (!repos.has(item.full_name)) repos.set(item.full_name, item);
  }
}

if (token) {
  for (const query of codeSearchQueries) {
    const url = new URL("https://api.github.com/search/code");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "indexed");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "30");

    let payload;
    try {
      payload = await githubJson(url);
    } catch (error) {
      errors.push({ query, error: error.message });
      continue;
    }

    for (const item of payload.items || []) {
      const fullName = item.repository?.full_name;
      if (!fullName || repos.has(fullName)) continue;
      try {
        repos.set(fullName, await githubJson(`https://api.github.com/repos/${fullName}`));
      } catch (error) {
        errors.push({ query: fullName, error: error.message });
      }
    }
  }
} else {
  errors.push({
    query: "code search",
    error: "Skipped because GITHUB_TOKEN is not set. Code Search is the best way to find real SKILL.md repositories."
  });
}

const candidates = [];

for (const repo of repos.values()) {
  if (existing.has(repo.full_name)) continue;
  const tree = await getRepoTree(repo);
  const readme = await getRepoReadme(repo);
  const skillFiles = tree.filter(file => basename(file.path).toLowerCase() === "skill.md");
  const readmeSkillHints = tree.filter(file => basename(file.path).toLowerCase() === "readme.md" && /skill/i.test(file.path));
  const hasSkillsDir = tree.some(file => file.path.toLowerCase().includes("skills/"));
  const hasClaudeSkillsPath = tree.some(file => file.path.toLowerCase().includes(".claude/skills"));
  const claudeSignal = hasClaudeSkillSignal(repo, tree, readme);

  if (!claudeSignal) continue;
  if (skillFiles.length === 0 && !hasClaudeSkillsPath) continue;
  if (repo.stargazers_count < 5 && skillFiles.length === 0 && !hasSkillsDir) continue;

  candidates.push({
    repo: repo.full_name,
    url: repo.clone_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    pushedAt: repo.pushed_at,
    description: repo.description || "",
    skillFileCount: skillFiles.length,
    readmeSkillHintCount: readmeSkillHints.length,
    hasSkillsDir,
    hasClaudeSkillsPath,
    claudeSignal,
    score: scoreRepo(repo, skillFiles.length, readmeSkillHints.length, hasSkillsDir),
    reason: reasonText(repo, skillFiles.length, readmeSkillHints.length, hasSkillsDir)
  });
}

candidates.sort((a, b) => b.score - a.score || b.stars - a.stars);

const promoted = autoPromote ? await promoteHighStarCandidates(candidates) : [];

await mkdir("data", { recursive: true });
await writeFile("data/source-candidates.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  queries: searchQueries,
  codeSearchQueries,
  errors,
  autoPromote: {
    enabled: autoPromote,
    minStars: autoPromoteMinStars,
    promoted: promoted.map(item => item.repo)
  },
  count: candidates.length,
  candidates
}, null, 2));

console.log(`Wrote data/source-candidates.json with ${candidates.length} candidates`);
if (promoted.length) console.log(`Promoted ${promoted.length} high-star repositories into data/sources.json`);
if (errors.length) {
  console.log("Some GitHub searches failed. Set GITHUB_TOKEN for a higher API rate limit.");
  console.log(errors.map(item => `${item.query}: ${item.error}`).join("\n"));
}
console.log(candidates.slice(0, 10).map(item => `${item.score} ${item.stars}★ ${item.repo} - ${item.reason}`).join("\n"));

async function loadExistingRepos() {
  try {
    const raw = await readFile("data/sources.json", "utf8");
    const payload = JSON.parse(raw);
    return (payload.sources || []).map(source => source.repo).filter(Boolean);
  } catch {
    return [];
  }
}

async function promoteHighStarCandidates(candidates) {
  const sourcePayload = await loadSourcesPayload();
  const sourceRepos = new Set((sourcePayload.sources || []).map(source => source.repo));
  const highConfidence = candidates.filter(candidate => {
    if (sourceRepos.has(candidate.repo)) return false;
    if (candidate.stars < autoPromoteMinStars) return false;
    if (!candidate.claudeSignal) return false;
    return candidate.skillFileCount > 0 || candidate.hasClaudeSkillsPath;
  });

  if (!highConfidence.length) return [];

  sourcePayload.sources = [
    ...(sourcePayload.sources || []),
    ...highConfidence.map(candidate => ({
      repo: candidate.repo,
      url: candidate.url,
      type: "auto-promoted-high-star",
      stars: candidate.stars,
      discoveredAt: new Date().toISOString(),
      reason: candidate.reason
    }))
  ];

  await writeFile("data/sources.json", JSON.stringify(sourcePayload, null, 2));
  return highConfidence;
}

async function loadSourcesPayload() {
  try {
    const raw = await readFile("data/sources.json", "utf8");
    return JSON.parse(raw);
  } catch {
    return { sources: [] };
  }
}

async function getRepoTree(repo) {
  try {
    const url = `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`;
    const payload = await githubJson(url);
    return (payload.tree || []).filter(item => item.type === "blob");
  } catch {
    return [];
  }
}

async function getRepoReadme(repo) {
  const paths = ["README.md", "readme.md", "README.MD"];
  for (const path of paths) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${path}`);
      if (response.ok) return await response.text();
    } catch {
      continue;
    }
  }
  return "";
}

function hasClaudeSkillSignal(repo, tree, readme) {
  const text = `${repo.full_name} ${repo.description || ""} ${readme}`.toLowerCase();
  const pathText = tree.slice(0, 3000).map(file => file.path.toLowerCase()).join(" ");
  const signals = [
    "claude code",
    "claude-code",
    "claude skills",
    "claude skill",
    "anthropic skills",
    "anthropic skill",
    ".claude/skills",
  ];
  if (signals.some(signal => text.includes(signal))) return true;
  if (pathText.includes(".claude/skills") || pathText.includes("/claude/skills")) return true;
  return false;
}

async function githubJson(url) {
  const response = await fetch(String(url), { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json();
}

function scoreRepo(repo, skillFileCount, readmeSkillHintCount, hasSkillsDir) {
  const pushedDays = Math.max(1, (Date.now() - new Date(repo.pushed_at).getTime()) / 86400000);
  const recentScore = Math.max(0, 120 - Math.floor(pushedDays));
  return Math.round(
    Math.log10(repo.stargazers_count + 1) * 100 +
    skillFileCount * 35 +
    readmeSkillHintCount * 8 +
    (hasSkillsDir ? 40 : 0) +
    recentScore
  );
}

function reasonText(repo, skillFileCount, readmeSkillHintCount, hasSkillsDir) {
  const reasons = [];
  if (repo.stargazers_count) reasons.push(`${repo.stargazers_count} stars`);
  if (skillFileCount) reasons.push(`${skillFileCount} SKILL.md`);
  if (readmeSkillHintCount) reasons.push(`${readmeSkillHintCount} skill README hints`);
  if (hasSkillsDir) reasons.push("has skills directory");
  return reasons.join(", ") || "matched search keywords";
}

function basename(path) {
  return path.split("/").pop() || path;
}

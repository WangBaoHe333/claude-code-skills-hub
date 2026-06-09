import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { URL } from "node:url";

const execAsync = promisify(exec);
const host = process.env.ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.ADMIN_PORT || 8787);
const token = process.env.ADMIN_TOKEN || "";
const basePath = normalizeBasePath(process.env.ADMIN_BASE_PATH || "");
const maxBodyBytes = Number(process.env.SUBMIT_MAX_BODY_BYTES || 1_600_000);
const publicSubmitPath = process.env.PUBLIC_SUBMIT_PATH || "/api/submit";
const dataPath = process.env.SUBMISSIONS_FILE || "data/submissions.json";
const reviewPath = process.env.AI_REVIEWS_FILE || "data/ai-reviews.json";
const proofDir = process.env.PROOF_UPLOAD_DIR || "data/uploaded-proofs";
const deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const publishCommand = process.env.PUBLISH_COMMAND || "";
const rateBuckets = new Map();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const originalPath = url.pathname;
    stripBasePath(url);

    if (request.method === "OPTIONS") return options(response);
    if (request.method === "POST" && originalPath === publicSubmitPath) {
      return send(response, 200, await createSubmission(request));
    }

    if (!authorized(request, url)) return send(response, 401, { error: "Unauthorized" });

    if (request.method === "GET" && url.pathname === "/") return html(response, adminHtml());
    if (request.method === "GET" && url.pathname === "/api/state") return send(response, 200, await getState());
    if (request.method === "GET" && url.pathname === "/api/skills") return send(response, 200, await getSkills());
    if (request.method === "GET" && url.pathname === "/api/submissions") return send(response, 200, await getSubmissions());
    if (request.method === "GET" && url.pathname === "/api/proof") return serveProof(response, url);
    if (request.method === "POST" && url.pathname === "/api/approve") return send(response, 200, await approve(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/reject") return send(response, 200, await reject(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/description") return send(response, 200, await saveDescription(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/ai-review") return send(response, 200, await runAiReview(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/submission-decision") return send(response, 200, await decideSubmission(await jsonBody(request)));

    return send(response, 404, { error: "Not found" });
  } catch (error) {
    return send(response, error.status || 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  const suffix = token ? "?token=PRIVATE_TOKEN" : "";
  console.log(`Skill review server: http://${host}:${port}${basePath || "/"}${suffix}`);
  console.log(`Local public submit endpoint: http://${host}:${port}${publicSubmitPath}`);
});

function normalizeBasePath(value) {
  const clean = String(value || "").trim().replace(/\/+$/, "");
  if (!clean || clean === "/") return "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function stripBasePath(url) {
  if (!basePath) return;
  if (url.pathname === basePath) url.pathname = "/";
  if (url.pathname.startsWith(`${basePath}/`)) {
    url.pathname = url.pathname.slice(basePath.length) || "/";
  }
}

function authorized(request, url) {
  if (!token) return true;
  const header = request.headers.authorization || "";
  return url.searchParams.get("token") === token || header === `Bearer ${token}`;
}

async function createSubmission(request) {
  const ip = clientIp(request);
  enforceRateLimit(ip);
  const payload = await jsonBody(request, maxBodyBytes);
  const repo = parseRepo(payload.repoUrl || payload.repo || "");
  const now = new Date().toISOString();
  const submissions = await readJson(dataPath, { submissions: [] });
  const duplicate = submissions.submissions.find(item =>
    item.repo === repo.full && item.status === "pending" && Date.now() - Date.parse(item.createdAt) < 24 * 60 * 60 * 1000
  );
  if (duplicate) return { ok: true, id: duplicate.id, duplicate: true };

  const proof = await saveProof(payload.proof);
  const item = {
    id: randomUUID(),
    repo: repo.full,
    repoUrl: repo.url,
    skillPath: cleanText(payload.skillPath, 180),
    description: cleanText(payload.description, 1200),
    whyUseful: cleanText(payload.whyUseful, 1200),
    contact: cleanText(payload.contact, 180),
    proof,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ipHash: hashIp(ip),
    userAgent: cleanText(request.headers["user-agent"], 260)
  };
  if (!item.description && !item.skillPath) throw badRequest("Need description or skill path");
  submissions.submissions.unshift(item);
  await writeJson(dataPath, submissions);
  return { ok: true, id: item.id };
}

async function getSubmissions() {
  const submissions = await readJson(dataPath, { submissions: [] });
  const reviews = await readJson(reviewPath, { reviews: {} });
  return {
    submissions: submissions.submissions || [],
    reviews: reviews.reviews || {}
  };
}

async function decideSubmission(payload) {
  const id = String(payload.id || "").trim();
  const decision = String(payload.decision || "").trim();
  if (!id || !["approved", "rejected", "needs_edit"].includes(decision)) throw badRequest("Invalid decision");
  const data = await readJson(dataPath, { submissions: [] });
  const item = data.submissions.find(entry => entry.id === id);
  if (!item) throw badRequest("Submission not found");

  item.status = decision;
  item.maintainerNote = cleanText(payload.note, 1000);
  item.updatedAt = new Date().toISOString();

  let publish = { published: false };
  if (decision === "approved") {
    const sources = await readJson("data/sources.json", { sources: [] });
    if (!sources.sources.some(source => source.repo === item.repo)) {
      sources.sources.push({
        repo: item.repo,
        url: `https://github.com/${item.repo}.git`,
        type: "submission-approved",
        approvedAt: item.updatedAt,
        reason: item.maintainerNote || "Maintainer approved user submission"
      });
      await writeJson("data/sources.json", sources);
    }
    publish = await publishApprovedChanges();
  }

  await writeJson(dataPath, data);
  return { ok: true, id, status: item.status, publish };
}

async function publishApprovedChanges() {
  if (!publishCommand) return { published: false, reason: "PUBLISH_COMMAND is not configured" };
  const { stdout, stderr } = await execAsync(publishCommand, {
    cwd: process.cwd(),
    timeout: Number(process.env.PUBLISH_TIMEOUT_MS || 600_000),
    maxBuffer: 1024 * 1024 * 4,
    shell: "/bin/bash"
  });
  return {
    published: true,
    stdout: stdout.slice(-1200),
    stderr: stderr.slice(-1200)
  };
}

async function runAiReview(payload) {
  const id = String(payload.id || "").trim();
  const submissions = await readJson(dataPath, { submissions: [] });
  const submission = submissions.submissions.find(item => item.id === id);
  if (!submission) throw badRequest("Submission not found");
  const evidence = await collectEvidence(submission);
  const review = await callDeepSeek(submission, evidence);
  const reviews = await readJson(reviewPath, { reviews: {} });
  reviews.reviews ||= {};
  reviews.reviews[id] = {
    submissionId: id,
    reviewedAt: new Date().toISOString(),
    model: deepseekModel,
    evidence,
    review
  };
  await writeJson(reviewPath, reviews);
  return { ok: true, review: reviews.reviews[id] };
}

async function collectEvidence(submission) {
  const repo = parseRepo(submission.repo);
  const headers = githubHeaders();
  try {
    const repoMeta = await fetchJson(`https://api.github.com/repos/${repo.full}`, headers);
    const branch = repoMeta.default_branch || "main";
    const tree = await fetchJson(`https://api.github.com/repos/${repo.full}/git/trees/${encodeURIComponent(branch)}?recursive=1`, headers);
    const files = Array.isArray(tree.tree) ? tree.tree : [];
    const skillFiles = files
      .filter(file => file.type === "blob" && /(^|\/)SKILL\.md$/i.test(file.path))
      .slice(0, 12)
      .map(file => file.path);
    const readme = files.find(file => /^readme\.(md|markdown|txt)$/i.test(file.path));
    const likelyPath = submission.skillPath && skillFiles.find(path => path.toLowerCase() === submission.skillPath.toLowerCase());
    const picked = [likelyPath, ...skillFiles].filter(Boolean).slice(0, 3);
    const skillTexts = [];
    for (const path of picked) {
      skillTexts.push({
        path,
        content: await fetchText(rawUrl(repo.full, branch, path), headers, 7000)
      });
    }
    return {
      repo: repo.full,
      stars: Number(repoMeta.stargazers_count || 0),
      license: repoMeta.license?.spdx_id || "",
      defaultBranch: branch,
      skillFileCount: skillFiles.length,
      skillFiles,
      readme: readme ? await fetchText(rawUrl(repo.full, branch, readme.path), headers, 5000) : "",
      skillTexts
    };
  } catch (error) {
    return fallbackEvidence(repo, submission, error.message);
  }
}

async function fallbackEvidence(repo, submission, reason) {
  const headers = { "User-Agent": "claude-code-skills-hub" };
  const branch = "HEAD";
  const cleanPath = String(submission.skillPath || "").replace(/^\/+|\/+$/g, "");
  const paths = [
    cleanPath && `${cleanPath}/SKILL.md`,
    cleanPath && cleanPath,
    cleanPath && `.claude/skills/${cleanPath}/SKILL.md`,
    "SKILL.md"
  ].filter(Boolean);
  const skillTexts = [];
  for (const path of paths.slice(0, 4)) {
    const content = await fetchText(rawUrl(repo.full, branch, path), headers, 7000);
    if (content) skillTexts.push({ path, content });
  }
  return {
    repo: repo.full,
    stars: 0,
    license: "",
    defaultBranch: branch,
    skillFileCount: skillTexts.length,
    skillFiles: skillTexts.map(item => item.path),
    readme: "",
    skillTexts,
    evidenceWarning: reason
  };
}

async function callDeepSeek(submission, evidence) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw badRequest("DeepSeek API key is not configured");
  const body = {
    model: deepseekModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You review Claude Code skills for a Chinese skill directory.",
          "Return strict JSON only.",
          "Never invent capabilities. Separate proven facts from guesses.",
          "Write direct, developer-style Chinese, not marketing copy.",
          "Flag missing SKILL.md, unclear license, duplicated source, binary-heavy or suspicious content."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          requiredSchema: {
            isSkill: "boolean",
            risk: "low | medium | high",
            usefulnessScore: "0-100",
            commonScore: "0-100",
            shouldApprove: "boolean",
            shouldPromoteCommon: "boolean",
            descriptionZh: "one concrete sentence",
            descriptionEn: "one concrete sentence",
            capabilityZh: "what the skill can do, concrete",
            audienceZh: "who should use it",
            scenariosZh: ["3 to 5 concrete use cases"],
            evidence: ["short factual evidence"],
            concerns: ["risks or missing facts"]
          },
          submission,
          evidence
        })
      }
    ],
    temperature: 0.2,
    max_tokens: 1600
  };
  const res = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw badRequest(`DeepSeek review failed: ${res.status} ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  const content = payload.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

async function getState() {
  const sources = await readJson("data/sources.json", { sources: [] });
  const candidates = await readJson("data/source-candidates.json", { candidates: [] });
  const rejected = await readJson("data/rejected-sources.json", { rejected: [] });
  const sourceRepos = new Set((sources.sources || []).map(item => item.repo));
  const rejectedRepos = new Set((rejected.rejected || []).map(item => item.repo));
  return {
    sources: sources.sources || [],
    rejected: rejected.rejected || [],
    candidates: (candidates.candidates || []).map(candidate => ({
      ...candidate,
      accepted: sourceRepos.has(candidate.repo),
      rejected: rejectedRepos.has(candidate.repo)
    }))
  };
}

async function getSkills() {
  const skills = await readJson("data/skills.json", { skills: [] });
  const overrides = await readJson("data/description-overrides.json", { overrides: {} });
  return {
    overrides: overrides.overrides || {},
    skills: (skills.skills || []).map(skill => ({
      id: skill.id,
      name: skill.name,
      repo: skill.source?.repo || "",
      path: skill.source?.path || "",
      summaryZh: skill.summaryZh || "",
      capabilityZh: skill.capabilityZh || "",
      audienceZh: skill.audienceZh || "",
      scenariosZh: skill.scenariosZh || [],
      category: skill.category || "",
      override: (overrides.overrides || {})[skill.id] || {}
    }))
  };
}

async function approve(payload) {
  const repo = cleanRepo(payload.repo);
  const sources = await readJson("data/sources.json", { sources: [] });
  if (!(sources.sources || []).some(item => item.repo === repo)) {
    sources.sources.push({
      repo,
      url: payload.url || `https://github.com/${repo}.git`,
      type: "review-approved",
      stars: Number(payload.stars || 0),
      approvedAt: new Date().toISOString(),
      reason: payload.reason || ""
    });
    await writeJson("data/sources.json", sources);
  }
  return { ok: true, repo };
}

async function reject(payload) {
  const repo = cleanRepo(payload.repo);
  const rejected = await readJson("data/rejected-sources.json", { rejected: [] });
  if (!(rejected.rejected || []).some(item => item.repo === repo)) {
    rejected.rejected.push({
      repo,
      rejectedAt: new Date().toISOString(),
      reason: payload.reason || ""
    });
    await writeJson("data/rejected-sources.json", rejected);
  }
  return { ok: true, repo };
}

async function saveDescription(payload) {
  const id = String(payload.id || "").trim();
  if (!id) throw badRequest("Missing skill id");
  const data = await readJson("data/description-overrides.json", { overrides: {} });
  data.overrides ||= {};
  data.overrides[id] = {
    summaryZh: cleanText(payload.summaryZh, 300),
    capabilityZh: cleanText(payload.capabilityZh, 1200),
    audienceZh: cleanText(payload.audienceZh, 600),
    scenariosZh: Array.isArray(payload.scenariosZh)
      ? payload.scenariosZh.map(item => cleanText(item, 240)).filter(Boolean).slice(0, 5)
      : String(payload.scenariosText || "").split("\n").map(item => cleanText(item, 240)).filter(Boolean).slice(0, 5),
    category: cleanText(payload.category, 80),
    updatedAt: new Date().toISOString()
  };
  await writeJson("data/description-overrides.json", data);
  return { ok: true, id };
}

async function saveProof(proof) {
  if (!proof?.dataUrl) return null;
  const match = String(proof.dataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw badRequest("Proof image must be PNG, JPEG, or WebP");
  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_200_000) throw badRequest("Proof image is too large");
  if (!validImageMagic(bytes, mime)) throw badRequest("Proof image content does not match MIME type");
  await mkdir(proofDir, { recursive: true });
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  await writeFile(`${proofDir}/${filename}`, bytes, { mode: 0o600 });
  return {
    id,
    filename,
    mime,
    size: bytes.length,
    originalName: cleanText(proof.name, 120)
  };
}

async function serveProof(response, url) {
  const id = String(url.searchParams.get("id") || "").trim();
  const submissions = await readJson(dataPath, { submissions: [] });
  const proof = submissions.submissions.find(item => item.proof?.id === id)?.proof;
  if (!proof) return send(response, 404, { error: "Proof not found" });
  const body = await readFile(`${proofDir}/${proof.filename}`);
  response.writeHead(200, {
    "Content-Type": proof.mime,
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function enforceRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = Number(process.env.SUBMIT_RATE_LIMIT_PER_HOUR || 8);
  const bucket = rateBuckets.get(ip) || [];
  const recent = bucket.filter(time => now - time < windowMs);
  if (recent.length >= limit) throw Object.assign(new Error("Too many submissions, try later"), { status: 429 });
  recent.push(now);
  rateBuckets.set(ip, recent);
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function parseRepo(value) {
  const text = String(value || "").trim();
  let owner = "";
  let repo = "";
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.hostname.toLowerCase() !== "github.com") throw new Error("not github");
      const parts = url.pathname.split("/").filter(Boolean);
      owner = parts[0] || "";
      repo = (parts[1] || "").replace(/\.git$/i, "");
    } catch {
      throw badRequest("Only GitHub owner/repo or GitHub URL is supported");
    }
  } else {
    const match = text.match(/^(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)(?:\.git)?$/);
    if (!match?.groups) throw badRequest("Only GitHub owner/repo or GitHub URL is supported");
    owner = match.groups.owner;
    repo = match.groups.repo.replace(/\.git$/i, "");
  }
  const full = `${owner}/${repo}`;
  cleanRepo(full);
  return { owner, repo, full, url: `https://github.com/${full}` };
}

function cleanRepo(repo) {
  const value = String(repo || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) throw badRequest("Invalid repo");
  return value;
}

function validImageMagic(bytes, mime) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function rawUrl(repo, branch, path) {
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw badRequest(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function githubHeaders() {
  const headers = { "User-Agent": "claude-code-skills-hub" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchText(url, headers, limit) {
  const res = await fetch(url, { headers });
  if (!res.ok) return "";
  const text = await res.text();
  return text.slice(0, limit);
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function hashIp(ip) {
  return createHash("sha256").update(`${process.env.IP_HASH_SALT || "local"}:${ip}`).digest("hex").slice(0, 24);
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(path.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function jsonBody(request, limit = maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large"), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function options(response) {
  response.writeHead(204, {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  });
  response.end();
}

function html(response, body) {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(body);
}

function adminHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skill Review Admin</title>
  <style>
    body{margin:0;background:#f5f1e8;color:#171717;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{display:grid;grid-template-columns:320px 1fr;height:100vh}
    aside{padding:18px;border-right:1px solid #d8d0bf;background:#fffdf8;overflow:auto}
    section{overflow:auto;padding:18px}
    h1{margin:0 0 8px;font-size:24px} p{color:#68645d;line-height:1.45}
    .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.stat div{border:1px solid #d8d0bf;padding:10px;background:#fbf7ed}.stat b{display:block;font-size:22px}
    .card{border:1px solid #d8d0bf;background:#fffdf8;margin:0 0 12px;padding:14px;display:grid;gap:8px}
    .meta{display:flex;gap:6px;flex-wrap:wrap}.pill{border:1px solid #d8d0bf;padding:2px 7px;color:#68645d;font-size:12px}
    button{min-height:36px;border:1px solid #171717;background:#fffdf8;cursor:pointer;padding:6px 10px}button.primary{background:#0f5f4a;color:white}button.danger{background:#b9472f;color:white}
    .actions{display:flex;gap:8px;flex-wrap:wrap}.accepted{background:#dff3ea}.rejected{opacity:.55}
    input,textarea,select{width:100%;border:1px solid #171717;padding:8px 10px;background:white;font:inherit} input,select{height:38px} textarea{min-height:76px;resize:vertical}
    .tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.tabs button.active{background:#0f5f4a;color:white}
    .edit{display:grid;grid-template-columns:1fr 1fr;gap:10px}.edit label{font-size:12px;color:#68645d}.edit .full{grid-column:1/-1}
    pre{white-space:pre-wrap;background:#171717;color:#fffdf8;padding:12px;max-height:360px;overflow:auto}
    img{max-width:360px;max-height:240px;border:1px solid #d8d0bf}
  </style>
</head>
<body>
<main>
  <aside>
    <h1>私有审核后台</h1>
    <p>后台只应该通过本机或 SSH tunnel 访问。公开用户只能提交候选，不能查看审核数据。</p>
    <div class="tabs"><button id="tabSubmissions" class="active" onclick="mode='submissions'; render()">用户提交</button><button id="tabCandidates" onclick="mode='candidates'; render()">候选源</button></div>
    <div class="tabs"><button id="tabDescriptions" onclick="mode='descriptions'; render()">描述修正</button><button onclick="load()">刷新</button></div>
    <input id="q" placeholder="搜索 repo / skill / 描述">
    <div class="stat">
      <div><b id="submissionCount">0</b><span>提交</span></div>
      <div><b id="candidateCount">0</b><span>候选</span></div>
      <div><b id="sourceCount">0</b><span>已收录</span></div>
    </div>
  </aside>
  <section id="list"></section>
</main>
<script>
let state = { candidates: [], sources: [], rejected: [], skills: [], overrides: {}, submissions: [], reviews: {} };
let mode = 'submissions';
const basePath = '${basePath}';
const params = new URLSearchParams(location.search);
async function api(path, body){
  const target = basePath + path;
  const url = params.get('token') ? target + '?token=' + encodeURIComponent(params.get('token')) : target;
  const res = await fetch(url, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : undefined);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function load(){
  const [review, skills, submissions] = await Promise.all([api('/api/state'), api('/api/skills'), api('/api/submissions')]);
  state = {...review, ...skills, ...submissions};
  render();
}
function render(){
  tabSubmissions.classList.toggle('active', mode==='submissions');
  tabCandidates.classList.toggle('active', mode==='candidates');
  tabDescriptions.classList.toggle('active', mode==='descriptions');
  submissionCount.textContent = state.submissions.length;
  candidateCount.textContent = state.candidates.length;
  sourceCount.textContent = state.sources.length;
  if(mode==='descriptions') return renderDescriptions();
  if(mode==='candidates') return renderCandidates();
  return renderSubmissions();
}
function renderSubmissions(){
  const query = q.value.toLowerCase();
  list.innerHTML = state.submissions
    .filter(s => !query || (s.repo + ' ' + s.description + ' ' + s.whyUseful + ' ' + s.status).toLowerCase().includes(query))
    .map(s => {
      const r = state.reviews[s.id];
      return '<div class="card">'+
        '<strong>'+escapeHtml(s.repo)+'</strong>'+
        '<div class="meta"><span class="pill">'+escapeHtml(s.status)+'</span><span class="pill">'+escapeHtml(s.createdAt)+'</span><span class="pill">'+escapeHtml(s.skillPath||'未填路径')+'</span></div>'+
        '<p><b>提交说明：</b>'+escapeHtml(s.description||'-')+'</p>'+
        '<p><b>为什么有用：</b>'+escapeHtml(s.whyUseful||'-')+'</p>'+
        (s.proof ? '<img src="'+basePath+'/api/proof?id='+encodeURIComponent(s.proof.id)+(params.get('token')?'&token='+encodeURIComponent(params.get('token')):'')+'">' : '')+
        (r ? '<pre>'+escapeHtml(JSON.stringify(r.review, null, 2))+'</pre>' : '<p>还没有 AI 审核。</p>')+
        '<div class="actions"><button class="primary" onclick="aiReview(\\''+escapeAttr(s.id)+'\\')">AI 审核</button><button class="primary" onclick="decide(\\''+escapeAttr(s.id)+'\\',\\'approved\\')">通过并加入来源</button><button onclick="decide(\\''+escapeAttr(s.id)+'\\',\\'needs_edit\\')">需要修改</button><button class="danger" onclick="decide(\\''+escapeAttr(s.id)+'\\',\\'rejected\\')">拒绝</button><button onclick="window.open(\\'https://github.com/'+escapeAttr(s.repo)+'\\')">打开 GitHub</button></div>'+
      '</div>';
    }).join('');
}
function renderCandidates(){
  const query = q.value.toLowerCase();
  list.innerHTML = state.candidates
    .filter(c => !query || (c.repo + ' ' + c.description).toLowerCase().includes(query))
    .map(c => '<div class="card '+(c.accepted?'accepted':'')+' '+(c.rejected?'rejected':'')+'">'+
      '<strong>'+escapeHtml(c.repo)+'</strong>'+
      '<p>'+escapeHtml(c.description || '')+'</p>'+
      '<div class="meta"><span class="pill">'+(c.stars||0)+' stars</span><span class="pill">'+(c.skillFileCount||0)+' SKILL.md</span><span class="pill">'+escapeHtml(c.reason||'')+'</span></div>'+
      '<div class="actions"><button class="primary" onclick="approve(\\''+escapeAttr(c.repo)+'\\')">加入正式库</button><button class="danger" onclick="rejectRepo(\\''+escapeAttr(c.repo)+'\\')">拒绝</button><button onclick="window.open(\\'https://github.com/'+escapeAttr(c.repo)+'\\')">打开 GitHub</button></div>'+
    '</div>').join('');
}
function renderDescriptions(){
  const query = q.value.toLowerCase();
  list.innerHTML = state.skills
    .filter(s => !query || (s.name+' '+s.repo+' '+s.summaryZh+' '+s.capabilityZh).toLowerCase().includes(query))
    .slice(0, 80)
    .map(s => {
      const o = s.override || {};
      return '<div class="card">'+
        '<strong>'+escapeHtml(s.name)+'</strong>'+
        '<div class="meta"><span class="pill">'+escapeHtml(s.repo)+'</span><span class="pill">'+escapeHtml(s.category||'')+'</span><span class="pill">'+(o.updatedAt?'已覆盖':'自动生成')+'</span></div>'+
        '<div class="edit">'+
          field(s.id,'summaryZh','摘要',o.summaryZh||s.summaryZh)+
          field(s.id,'category','分类',o.category||s.category)+
          field(s.id,'capabilityZh','能做什么',o.capabilityZh||s.capabilityZh,'full')+
          field(s.id,'audienceZh','适合谁',o.audienceZh||s.audienceZh,'full')+
          field(s.id,'scenariosText','典型场景（一行一个）',(o.scenariosZh||s.scenariosZh||[]).join('\\n'),'full')+
        '</div>'+
        '<div class="actions"><button class="primary" onclick="saveDesc(\\''+escapeAttr(s.id)+'\\')">保存覆盖</button></div>'+
      '</div>';
    }).join('');
}
function field(id,key,label,value,klass=''){
  const tag = key==='summaryZh'||key==='category' ? 'input' : 'textarea';
  const valueHtml = escapeHtml(value||'');
  return '<label class="'+klass+'">'+label+(tag==='input'
    ? '<input data-id="'+escapeAttr(id)+'" data-key="'+key+'" value="'+valueHtml+'">'
    : '<textarea data-id="'+escapeAttr(id)+'" data-key="'+key+'">'+valueHtml+'</textarea>')+'</label>';
}
async function saveDesc(id){
  const payload = { id };
  document.querySelectorAll('[data-id="'+CSS.escape(id)+'"]').forEach(el => payload[el.dataset.key]=el.value);
  await api('/api/description', payload);
  await load();
}
async function approve(repo){ const c=state.candidates.find(x=>x.repo===repo); await api('/api/approve', c); await load(); }
async function rejectRepo(repo){ const c=state.candidates.find(x=>x.repo===repo); await api('/api/reject', c); await load(); }
async function aiReview(id){ await api('/api/ai-review', {id}); await load(); }
async function decide(id, decision){ const note = prompt('审核备注（可空）') || ''; await api('/api/submission-decision', {id, decision, note}); await load(); }
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function escapeAttr(v){return String(v||'').replace(/['\\\\]/g,'');}
q.addEventListener('input', render);
load();
</script>
</body>
</html>`;
}

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const host = process.env.ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.ADMIN_PORT || 8787);
const token = process.env.ADMIN_TOKEN || "";

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (!authorized(request, url)) return send(response, 401, { error: "Unauthorized" });

    if (request.method === "GET" && url.pathname === "/") return html(response, adminHtml());
    if (request.method === "GET" && url.pathname === "/api/state") return send(response, 200, await getState());
    if (request.method === "GET" && url.pathname === "/api/skills") return send(response, 200, await getSkills());
    if (request.method === "POST" && url.pathname === "/api/approve") return send(response, 200, await approve(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/reject") return send(response, 200, await reject(await jsonBody(request)));
    if (request.method === "POST" && url.pathname === "/api/description") return send(response, 200, await saveDescription(await jsonBody(request)));

    return send(response, 404, { error: "Not found" });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  console.log(`Admin review server: http://${host}:${port}/${suffix}`);
});

function authorized(request, url) {
  if (!token) return true;
  const header = request.headers.authorization || "";
  return url.searchParams.get("token") === token || header === `Bearer ${token}`;
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
  if (!id) throw new Error("Missing skill id");
  const data = await readJson("data/description-overrides.json", { overrides: {} });
  data.overrides ||= {};
  data.overrides[id] = {
    summaryZh: String(payload.summaryZh || "").trim(),
    capabilityZh: String(payload.capabilityZh || "").trim(),
    audienceZh: String(payload.audienceZh || "").trim(),
    scenariosZh: Array.isArray(payload.scenariosZh)
      ? payload.scenariosZh.map(item => String(item).trim()).filter(Boolean).slice(0, 5)
      : String(payload.scenariosText || "").split("\n").map(item => item.trim()).filter(Boolean).slice(0, 5),
    category: String(payload.category || "").trim(),
    updatedAt: new Date().toISOString()
  };
  await writeJson("data/description-overrides.json", data);
  return { ok: true, id };
}

function cleanRepo(repo) {
  const value = String(repo || "").trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(value)) throw new Error("Invalid repo");
  return value;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function html(response, body) {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function adminHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skill Source Review</title>
  <style>
    body{margin:0;background:#f5f1e8;color:#171717;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{display:grid;grid-template-columns:320px 1fr;height:100vh}
    aside{padding:18px;border-right:1px solid #d8d0bf;background:#fffdf8}
    section{overflow:auto;padding:18px}
    h1{margin:0 0 8px;font-size:24px} p{color:#68645d;line-height:1.45}
    .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.stat div{border:1px solid #d8d0bf;padding:10px;background:#fbf7ed}.stat b{display:block;font-size:22px}
    .card{border:1px solid #d8d0bf;background:#fffdf8;margin:0 0 12px;padding:14px;display:grid;gap:8px}
    .meta{display:flex;gap:6px;flex-wrap:wrap}.pill{border:1px solid #d8d0bf;padding:2px 7px;color:#68645d;font-size:12px}
    button{height:36px;border:1px solid #171717;background:#fffdf8;cursor:pointer}button.primary{background:#0f5f4a;color:white}button.danger{background:#b9472f;color:white}
    .actions{display:flex;gap:8px}.accepted{background:#dff3ea}.rejected{opacity:.55}
    input,textarea{width:100%;border:1px solid #171717;padding:8px 10px;background:white;font:inherit} input{height:38px} textarea{min-height:76px;resize:vertical}
    .tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.tabs button.active{background:#0f5f4a;color:white}
    .edit{display:grid;grid-template-columns:1fr 1fr;gap:10px}.edit label{font-size:12px;color:#68645d}.edit .full{grid-column:1/-1}
  </style>
</head>
<body>
<main>
  <aside>
    <h1>候选审核</h1>
    <p>这是你的私有审核后台。通过的仓库会写入 <code>data/sources.json</code>，拒绝的写入 <code>data/rejected-sources.json</code>。</p>
    <div class="tabs"><button id="tabCandidates" class="active" onclick="mode='candidates'; render()">候选源</button><button id="tabDescriptions" onclick="mode='descriptions'; render()">描述修正</button></div>
    <input id="q" placeholder="搜索 repo / skill / 描述">
    <div class="stat">
      <div><b id="candidateCount">0</b><span>候选</span></div>
      <div><b id="sourceCount">0</b><span>已收录</span></div>
      <div><b id="rejectedCount">0</b><span>已拒绝</span></div>
    </div>
    <button class="primary" onclick="load()">刷新</button>
  </aside>
  <section id="list"></section>
</main>
<script>
let state = { candidates: [], sources: [], rejected: [], skills: [], overrides: {} };
let mode = 'candidates';
const params = new URLSearchParams(location.search);
async function api(path, body){
  const url = params.get('token') ? path + '?token=' + encodeURIComponent(params.get('token')) : path;
  const res = await fetch(url, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : undefined);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function load(){
  const [review, skills] = await Promise.all([api('/api/state'), api('/api/skills')]);
  state = {...review, ...skills};
  render();
}
function render(){
  tabCandidates.classList.toggle('active', mode==='candidates');
  tabDescriptions.classList.toggle('active', mode==='descriptions');
  candidateCount.textContent = state.candidates.length;
  sourceCount.textContent = state.sources.length;
  rejectedCount.textContent = state.rejected.length;
  if(mode==='descriptions') return renderDescriptions();
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
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function escapeAttr(v){return String(v||'').replace(/['\\\\]/g,'');}
q.addEventListener('input', render);
load();
</script>
</body>
</html>`;
}

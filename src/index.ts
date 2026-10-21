/**
 * @dsh-external/dsh-paper-checker
 * 检查学术期刊投稿审稿状态并定时汇报。
 * - Editorial Manager 期刊：内置确定性 Playwright 抓取（Playwright 内置 Chromium，无头）
 * - 其他投稿系统（system='other'）：回退信号，交给 AI 用浏览器工具处理
 * - 守护定时：每天到点自动检查、写报告、推微信（Server酱）
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import https from 'node:https'
import { createRequire } from 'node:module'
// 用 createRequire(import.meta.url) 强制标准 Node 解析 playwright-core（命中插件 node_modules），
// 绕开 DSH 宿主对动态 import 的自定义解析——后者会解析到错误的 playwright-core 副本。
const pwRequire = createRequire(import.meta.url)

type AppContext = Context & {
  setInterval(fn: () => void, ms: number): any
  tools: { register(def: any): () => void }
  webServer: { register(def: any): () => void }
  agents: { get(id: string): any; list(): any[] }
  sessions: { list(): any[]; get(id: string): any }
  llm: { stream(options: any): AsyncIterable<any> }
}

export const name = '@dsh-external/dsh-paper-checker'
export const inject = ['tools', 'timer', 'webServer', 'agents', 'sessions', 'llm']

// ============ 配置 ============
export interface JournalConfig {
  name: string
  baseUrl: string
  username: string
  password: string
  sections: string[]
  system?: string
}

export interface Config {
  journals: JournalConfig[]
  time: string
  timezone: string
  scheduleEnabled: boolean
  serverchanKey: string
  reportDir: string
  reportSessionId: string
  discoverProvider: string
  discoverModel: string
  browserPath: string
  // [patch 2026-10-22t] 已结束（出版/发表/拒稿…）投稿的追溯范围，单位：月，最小 1
  endedMonths: number
}

export const Config = z.object({
  journals: z.array(z.object({
    name: z.string(),
    baseUrl: z.string(),
    username: z.string(),
    password: z.string(),
    sections: z.array(z.string()).default([]),
    system: z.string().default('editorial-manager'),
    // [自动识别] LLM 识别出的整份主菜单组织结构：分区顺序、是否抓取、kind 与分组。
    // 缺省时（模型失败或旧配置）检查流程走原来的确定性逻辑。
    structure: z.object({
      source: z.string().default('llm'),
      model: z.string().default(''),
      capturedAt: z.string().default(''),
      name: z.string().default(''),
      system: z.string().default(''),
      groups: z.array(z.object({ title: z.string().default(''), sections: z.array(z.string()).default([]) })).default([]),
      sections: z.array(z.object({ name: z.string().default(''), kind: z.string().default('active'), check: z.boolean().default(true) })).default([]),
    }),
  })).default([]),
  time: z.string().default('08:00'),
  timezone: z.string().default('Asia/Shanghai'),
  scheduleEnabled: z.boolean().default(true),
  serverchanKey: z.string().default(''),
  reportDir: z.string().default(''),
  reportSessionId: z.string().default(''),
  discoverProvider: z.string().default(''),
  discoverModel: z.string().default(''),
  // Playwright 浏览器目录（可选的 PLAYWRIGHT_BROWSERS_PATH；留空用系统默认 %LOCALAPPDATA%\ms-playwright）
  browserPath: z.string().default(''),
  // [patch 2026-10-22t] 已结束（出版/发表/拒稿…）投稿的追溯范围，单位：月，最小 1
  endedMonths: z.number().default(1),
})

// DSH 0.2 的设置服务只看 schema 的 meta.volatile 才允许写入配置（dsh-settings 的
// volatileForm()/isVolatilePath() 读 schema.meta.volatile），否则面板保存会报
// `Plugin entry "paper-checker" has no volatile fields`。
// 这里直接标 meta 并用 try/catch 兜住：schemastery 的 .volatile() 返回克隆、且旧版本没有该方法。
try {
  const schemaMeta = (Config as any).meta
  if (schemaMeta) schemaMeta.volatile = true

// [关键] DSH 的写入是按**字段路径**判断 volatile 的（docs: "Edit fields that plugins declare with .volatile()"）。
// 只标根节点会让命名空间看起来可写（保存不再报错），但字段级写入会被判定为「非 volatile」而静默丢弃——
// 表现是「保存返回 ok、revision 递增，值却没变」。所以递归把每个子 schema 也标上。
const __pcSeenSchema = new Set<any>()
const markVolatilePC = (s: any, depth = 0): void => {
  try {
    if (!s || typeof s !== 'object' || depth > 6 || __pcSeenSchema.has(s)) return
    __pcSeenSchema.add(s)
    if (s.meta && typeof s.meta === 'object') s.meta.volatile = true
    if (s.dict && typeof s.dict === 'object') for (const k of Object.keys(s.dict)) markVolatilePC(s.dict[k], depth + 1)
    if (s.inner !== undefined) markVolatilePC(s.inner, depth + 1)
    if (Array.isArray(s.list)) for (const x of s.list) markVolatilePC(x, depth + 1)
  } catch { /* ignore */ }
}
markVolatilePC(Config)
} catch { /* 保持原样 */ }

// ============ 数据结构 ============
interface Submission {
  number: string
  title: string
  submitted?: string
  statusDate?: string
  revBegan?: string
  revDue?: string
  status: string
}
interface SectionResult {
  name: string
  count: number
  submissions: Submission[]
  /** 决策历史分区（Submissions with a Decision）：报告里只列最近 7 天决策的稿件。 */
  kind?: 'decision'
}
interface JournalResult {
  journal: string
  system: string
  sections?: SectionResult[]
  error?: string
}

// ============ 状态翻译 ============
const STATUS_ZH: Record<string, string> = {
  // 审稿流程（submission）
  'Under Review': '审稿中',
  'With Editor': '编辑处理中',
  'With Editorial Office': '编辑部处理中',
  'Required Reviews Completed': '审稿完成',
  'Decision in Process': '决策中',
  'Reviewers Assigned': '已指派审稿人',
  'Reviewers Invited': '已邀请审稿人',
  'Awaiting Reviewer Selection': '等待选择审稿人',
  'Awaiting Reviewer Scores': '等待审稿意见',
  'Awaiting EIC Assignment': '等待主编指派',
  'Submitted': '已投稿',
  'Submission': '已投稿',
  'Transfer': '已转投',
  'Transferred': '已转投',
  'Withdrawn': '已撤稿',
  'Declined': '已婉拒',
  'Sent Back to Author': '退回作者',
  'Incomplete': '信息不完整',
  'Waiting for Approval': '等待批准',
  'Awaiting Author Approval': '等待作者确认',
  'Submissions Being Processed': '处理中',
  // 修改流程（revision）
  'Submissions Needing Revision': '需要修改',
  'Major Revision': '大修',
  'Minor Revision': '小修',
  'Revise': '修改中',
  'Revised': '已修改',
  'Under Revision': '修改中',
  'Revisions Being Processed': '修改处理中',
  'Revisions Under Review': '修改稿审稿中',
  'Incomplete Submissions Being Revised': '修改信息不完整',
  'Date Revision Began': '修改开始',
  'Date Revision Due': '修改截止',
  // 生产流程（production）
  'In Production': '生产中',
  'Production': '生产中',
  'With Production': '生产中',
  'Proofs Available': '校样可获取',
  'Proofs Sent': '校样已发送',
  'Issue Assigned': '已分配刊期',
  // 结果
  'Completed': '已完成',
  'Accepted': '已接受',
  'Rejected': '已拒稿',
}
/** 状态翻译：精确表优先，其次前缀/关键词兜底。 */
const zh = (s: string): string => {
  const t = (s || '').trim()
  if (!t) return ''
  if (STATUS_ZH[t]) return STATUS_ZH[t]
  if (/reject/i.test(t)) return '已拒稿'
  if (/accept/i.test(t)) return '已接受'
  if (/production/i.test(t)) return '生产中'
  if (/revis/i.test(t)) return '修改中'
  if (/^under review/i.test(t)) return '审稿中'
  if (/reviewer/i.test(t)) return '审稿中'
  if (/^withdraw/i.test(t)) return '已撤稿'
  return t
}

// ============ 工具函数 ============
function defaultReportDir(): string {
  return join(homedir(), '.dsh', 'paper-checker', 'reports')
}

function log(reportDir: string, msg: string): void {
  try {
    const dir = reportDir || defaultReportDir()
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'run.log'), '[' + new Date().toISOString() + '] ' + msg + '\n')
  } catch { /* 静默 */ }
}

async function readBody(req: any): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(Buffer.from(c as any))
  return Buffer.concat(chunks).toString('utf8')
}

function nowInTz(timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

// ============ Editorial Manager 确定性抓取 ============
/**
 * EM 把登录页载入 iframe。不再只认 name=content：遍历所有子 frame，谁先出现 login.asp
 * 且带 username 输入框的就用谁（各期刊实例的命名与填充时机并不一致，且偶发长时间停在 about:blank）。 */
async function waitForFrame(page: any, budgetMs = 45000): Promise<any | null> {
  const deadline = Date.now() + budgetMs
  let fallback: any = null
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue
      const url = f.url() || ''
      if (url.includes('login.asp') || url.includes('login.aspx')) return f
      if (url && !url.includes('about:blank') && !fallback) fallback = f
    }
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue
      const has = await f.$("input[name='username']").then((x: any) => !!x).catch(() => false)
      if (has) return f
    }
    await page.waitForTimeout(500)
  }
  return fallback ?? page.frame({ name: 'content' })
}

let __pcCtx: any = null;

let __pcCwdUsed = "";

async function __pcAttachWorkspace(sessionId: any) {
  try {
    if (!__pcCtx) return "no-ctx";
    const reg = typeof __pcCtx.get === "function" ? __pcCtx.get("workspaceRegistry") : undefined;
    if (!reg || typeof reg.list !== "function") return "no-registry";
    const list = reg.list() || [];
    let w = list.find((x: any) => x && Array.isArray(x.sessionIds) && x.sessionIds.includes(sessionId));
    if (!w) {
      let cwd = "";
      try { cwd = cwdFromIndexPC(sessionId); } catch (e: any) { cwd = ""; }
      if (cwd) w = list.find((x: any) => x && x.path && String(x.path).toLowerCase() === String(cwd).toLowerCase());
    }
    if (!w) w = list[0];
    if (!w || typeof w.attachSession !== "function") return "no-workspace";
    await w.attachSession(sessionId);
    return "attached:" + String(w.id || w.path || "?");
  } catch (e: any) { return "attach-err:" + String(e && e.message ? e.message : e); }
}

function __pcAgents() {
  try {
    const sc = (__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null;
    if (sc && sc.agents && typeof sc.agents.ensureSession === "function") return sc.agents;
    if (sc && sc.agents) return sc.agents;
  } catch (e: any) { /* ignore */ }
  return __pcCtx && __pcCtx.agents ? __pcCtx.agents : null;
}

async function __pcLoadSession(sessionId: any, cwd: any) {
  try {
    // [local patch] cwd 为空会让宿主 ensureSession 执行 mkdir "" 而 ENOENT（实测错误原文）。
    // 依次回退：会话 header 的、workspace 记录里的路径、进程当前目录。__pcCwdFallback
    if (!cwd) {
      try { const s = (__pcCtx.sessions && __pcCtx.sessions.get) ? __pcCtx.sessions.get(sessionId) : null; cwd = (s && s.header && s.header.cwd) || ""; } catch (e: any) { /* ignore */ }
    }
    if (!cwd) {
      try {
        const reg = (typeof __pcCtx.get === "function") ? __pcCtx.get("workspaceRegistry") : null;
        const list = (reg && typeof reg.list === "function") ? (reg.list() || []) : [];
        for (const w of list) {
          const p = (w && w.record && (w.record.path || w.record.cwd)) || (w && w.path) || "";
          if (p) { cwd = String(p); break; }
        }
      } catch (e: any) { /* ignore */ }
    }
    // [local patch] 权威 cwd 来源：storages/workspace.json 的 workspaces 表里，
    // 哪个 workspace 的 sessionIds 含该会话，它的 path 就是该会话的 cwd。__pcWorkspaceJsonCwd
    if (!cwd) {
      try {
        const __home = process.env.DSH_HOME || join(homedir(), ".dsh");
        const __wp = join(__home, "storages", "workspace.json");
        if (existsSync(__wp)) {
          const __j = JSON.parse(readFileSync(__wp, "utf8"));
          const __tbl = (__j && __j.tables && __j.tables.workspaces) || {};
          for (const __k of Object.keys(__tbl)) {
            const __w = __tbl[__k];
            if (__w && Array.isArray(__w.sessionIds) && __w.sessionIds.includes(sessionId) && __w.path) { cwd = String(__w.path); break; }
          }
        }
      } catch (e: any) { /* ignore */ }
    }
    if (!cwd) { try { cwd = process.cwd() || ""; } catch (e: any) { /* ignore */ } }
    // [local patch] 无条件解析权威 cwd 并覆盖调用方值：__pcResolveCwd
    try {
      const __home = process.env.DSH_HOME || join(homedir(), ".dsh");
      let __c = "";
      const __wp = join(__home, "storages", "workspace.json");
      if (existsSync(__wp)) {
        const __j = JSON.parse(readFileSync(__wp, "utf8"));
        const __tbl = (__j && __j.tables && __j.tables.workspaces) || {};
        for (const __k of Object.keys(__tbl)) {
          const __w = __tbl[__k];
          if (__w && Array.isArray(__w.sessionIds) && __w.sessionIds.includes(sessionId) && __w.path) { __c = String(__w.path); break; }
        }
      }
      if (!__c) {
        const __sid = sessionId.startsWith("session-") ? sessionId : ("session-" + sessionId);
        const __pc = join(__home, "storages", "session_projcache", "sessions", __sid + ".json");
        if (existsSync(__pc)) {
          const __jj = JSON.parse(readFileSync(__pc, "utf8"));
          const __p = __jj && __jj.record && __jj.record.identity && __jj.record.identity.cwd;
          if (__p) __c = String(__p);
        }
      }
      if (__c) cwd = __c;
      __pcCwdUsed = String(cwd || "");
    } catch (e: any) { __pcCwdUsed = "err:" + String(e && e.message ? e.message : e); }
    if (!__pcCtx || typeof __pcCtx.get !== "function") return "no-ctx";
    const sc = __pcCtx.get("sessionController");
    if (!sc) return "no-controller";
    const __tries: any = [];
    for (const nm of ["create", "resume", "createOrAdopt"]) {
      if (typeof sc[nm] === "function") __tries.push([nm, () => sc[nm]({ sessionId, cwd })]);
    }
    for (const face of ["typertRemote", "commands", "remote"]) {
      const fx = sc[face];
      if (fx && typeof fx === "object") {
        for (const nm of ["create", "resume"]) if (typeof fx[nm] === "function") __tries.push([face + "." + nm, () => fx[nm]({ sessionId, cwd })]);
      }
    }
    const ag = sc.agents;
    if (ag && typeof ag.ensureSession === "function") __tries.push(["agents.ensureSession", () => ag.ensureSession(sessionId, cwd, true)]);
    const __pcErrs: any = [];
    for (const [nm, fn] of __tries) {
      try { const r = await fn(); if (r !== void 0) return "ok:" + nm; } catch (e: any) { __pcErrs.push(nm + "=" + String(e && e.message ? e.message : e).slice(0, 90)); }
    }
    return "none(" + __tries.length + "): " + (__pcErrs.join(" | ") || "无异常但返回 undefined");
  } catch (e: any) { return "err:" + String(e && e.message ? e.message : e); }
}

async function __pcAwaitAgent(sessionId: any, ms: any) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const a = ctxAgentsGet(sessionId); if (a && typeof a.followup === "function") return a; } catch (e: any) { /* ignore */ }
    await new Promise((r: any) => setTimeout(r, 500));
  }
  return null;
}

function ctxAgentsGet(sessionId: any) {
  try {
    const sc = (__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null;
    const cands = [__pcCtx && __pcCtx.agents, sc && sc.agents, __pcAgents()];
    for (const c of cands) if (c && typeof c.get === "function") { const a = c.get(sessionId); if (a) return a; }
  } catch (e: any) { /* ignore */ }
  return null;
}

function __pcBuildMsg(report: any) {
  try {
    return createUserMessage({
      content: [{ type: "text", text: "📊 每日投稿状态自动汇报（插件 dsh-paper-checker）：\n\n" + report + "\n\n——请一句话确认收到即可，不要重新检查、不要调用工具。" }],
      source: { kind: "user" }
    });
  } catch (e: any) { return report; }
}

function readPersistedPC() {
  try {
    const root = join(homedir(), ".dsh", "profiles");
    const cands: any = [];
    for (const prof of readdirSync(root)) {
      const p = join(root, prof, "cordis.patch.yml");
      try { if (existsSync(p)) cands.push({ p, m: statSync(p).mtimeMs }); } catch (e: any) { /* ignore */ }
    }
    // 关键：DSH 只写当前 profile 的那份，所以取 mtime 最新的，避免读到其他 profile 的。
    cands.sort((a: any, b: any) => b.m - a.m);
    for (const c of cands) {
      try {
        const text = readFileSync(c.p, "utf8");
        if (!text.includes("paper-checker")) continue;
        const doc = __pcYaml(text);
        const arr = Array.isArray(doc) ? doc : (doc && typeof doc === "object" ? Object.values(doc)[0] : null);
        const list = Array.isArray(arr) ? arr : [];
        const entry = list.find((x: any) => x && x.name === "@dsh-external/dsh-paper-checker") || list.find((x: any) => x && x.config);
        if (entry && entry.config) return entry.config;
      } catch (e: any) { /* 试下一个 */ }
    }
  } catch (e: any) { /* ignore */ }
  return null;
}

function __pcYaml(text: any) {
  const lines = text.split(/\r?\n/);
  const parse = (i: any, indent: any) => {
    let seq: any = null, map: any = null;
    while (i < lines.length) {
      const raw = lines[i];
      const s = raw.trim();
      if (s === "" || s.startsWith("#")) { i++; continue; }
      const ind = raw.match(/^ */)[0].length;
      if (ind < indent) break;
      if (ind > indent) { i++; continue; }
      const body = raw.slice(indent);
      const keyRe = /^([A-Za-z_][\w.-]*):\s*(.*)$/;
      if (body.startsWith("- ")) {
        if (map) break;
        if (!seq) seq = [];
        const item = body.slice(2);
        const m = keyRe.exec(item);
        if (!m) { seq.push(__pcScalar(item.trim())); i++; continue; }
        const obj: any = {};
        if (m[2].trim() === "") { const r = parse(i + 1, indent + 4); obj[m[1]] = r[0]; i = r[1]; }
        else { obj[m[1]] = __pcScalar(m[2].trim()); i++; }
        while (i < lines.length) {
          const r2 = lines[i]; const s2 = r2.trim();
          if (s2 === "" || s2.startsWith("#")) { i++; continue; }
          if (r2.match(/^ */)[0].length !== indent + 2) break;
          const m2 = keyRe.exec(r2.slice(indent + 2));
          if (!m2) break;
          if (m2[2].trim() === "") { const r3 = parse(i + 1, indent + 4); obj[m2[1]] = r3[0]; i = r3[1]; }
          else { obj[m2[1]] = __pcScalar(m2[2].trim()); i++; }
        }
        seq.push(obj);
      } else {
        if (seq) break;
        if (!map) map = {};
        const m = keyRe.exec(body);
        if (!m) { i++; continue; }
        if (m[2].trim() === "") { const r = parse(i + 1, indent + 2); map[m[1]] = r[0]; i = r[1]; }
        else { map[m[1]] = __pcScalar(m[2].trim()); i++; }
      }
    }
    return [seq !== null ? seq : (map !== null ? map : null), i];
  };
  return parse(0, lines.findIndex((l: any) => l.trim().startsWith("- ")) === 0 ? 0 : 0)[0];
}

function __pcScalar(v: any) {
  if (v === "\"\"" || v === "''") return "";
  if (v.length > 1 && ((v[0] === "\"" && v[v.length - 1] === "\"") || (v[0] === "'" && v[v.length - 1] === "'"))) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "[]") return [];
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/**
 * 打开期刊登录页并把登录帧准备到可见状态，失败自动重试。
 * 加固：EM 靠页面自己的 JS 把登录页填进 content iframe，这一步在插件进程里实测可能一直不发生
 * （三次尝试共 90 多秒都停在 about:blank，而同机独立进程 2 秒就绪）。所以不再依赖那段 JS：
 * 等很短时间没动静，就自己把 iframe 的 src 指到 <base>/login.asp（登录表单本来就在这个地址）。
 * 另外挂一次诊断监听，把 playwright-core 位置、浏览器版本、失败请求与页面错误带进报错。 */
async function openLoginFrame(page: any, baseUrl: string, dbg: string[], attempts = 3): Promise<any | null> {
  try {
    if (!page.__pcDiag) {
      page.__pcDiag = true
      dbg.push('pwcore=' + (typeof pwRequire?.resolve === 'function' ? pwRequire.resolve('playwright-core') : '?'))
      dbg.push('browser=' + (page.context?.()?.browser?.()?.version?.() ?? '?'))
      // 宿主进程若带代理环境变量，Chromium 会继承它，EM 的连接可能因此被中断；写进报错便于定位。
      dbg.push('proxy=' + String(process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? '(unset)'))
      page.on?.('requestfailed', (r: any) => { if (dbg.length < 20) dbg.push('reqfail=' + String(r.url()).slice(0, 70) + '::' + String(r.failure?.()?.errorText ?? '')) })
      page.on?.('pageerror', (e: any) => { if (dbg.length < 20) dbg.push('pageerror=' + String(e?.message ?? e).slice(0, 90)) })
      page.on?.('console', (m: any) => { if (m?.type?.() === 'error' && dbg.length < 20) dbg.push('consoleerr=' + String(m.text()).slice(0, 90)) })
    }
  } catch { /* 诊断失败不影响主流程 */ }
  for (let a = 1; a <= attempts; a++) {
    try {
      await page.goto(`${baseUrl}/Default.aspx?pg=login.asp&username=`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (e) {
      dbg.push('goto' + a + '=' + String(e).split('\n')[0])
    }
    let f = await waitForFrame(page, 12000)
    if (!f || !f.url() || f.url().includes('about:blank')) {
      const forced = await page.evaluate((u: string) => {
        const fr: any = document.querySelector('iframe[name="content"]')
        if (!fr) return 'no-iframe'
        if (!fr.src || String(fr.src).includes('about:blank')) fr.src = u
        return 'src-set'
      }, `${baseUrl}/login.asp?username=`).catch((e: any) => 'eval-failed:' + String(e?.message ?? e))
      dbg.push('try' + a + '=forceSrc:' + forced)
      f = await waitForFrame(page, 25000)
    }
    const frames = page.frames().map((x: any) => (x.name() || '(main)') + ':' + (x.url() || '')).join(' , ')
    if (dbg.length < 20) dbg.push('try' + a + '=' + (f ? f.url() : 'null') + ' frames[' + frames.slice(0, 260) + ']')
    if (!f) continue
    await f.waitForSelector("input[name='username']", { state: 'attached', timeout: 20000 }).catch(() => {})
    await f.evaluate(() => {
      const details = document.querySelector('#traditionalLoginCollapsible')
      if (details) (details as any).open = true
      const ud = document.querySelector('#userNamePasswordDiv')
      if (ud) ud.classList.remove('hideElement')
      const eb = document.querySelector('#emLoginButtonsDiv')
      if (eb) eb.classList.remove('hideElement')
    }).catch(() => {})
    await f.waitForSelector("input[name='username']", { state: 'visible', timeout: 10000 }).catch(() => {})
    const visible = await f.locator("input[name='username']").isVisible().catch(() => false)
    if (visible) return f
    dbg.push('try' + a + '=usernameVisible:false')
    await page.waitForTimeout(1500)
  }
  return null
}

async function waitForMainMenu(page: any): Promise<any | null> {
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    const f = page.frame({ name: 'content' })
    if (f && (f.url().includes('AuthorMainMenu') || f.url().includes('MainMenu'))) {
      const txt = await f.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')
      if (txt.includes('Submissions')) return f
    }
  }
  return null
}

async function scrapeMenu(frame: any): Promise<{ counts: Record<string, number>; links: Record<string, string> }> {
  const text = await frame.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')
  const counts: Record<string, number> = {}
  for (const m of text.matchAll(/([^\n()]{2,60}?)\s*\((\d+)\)/g)) counts[m[1].trim()] = parseInt(m[2], 10)
  const links: Record<string, string> = await frame.evaluate(() => {
    const out: Record<string, string> = {}
    for (const a of document.querySelectorAll('a')) {
      const t = (a.innerText || '').trim()
      if (t && a.href) out[t] = a.href
    }
    return out
  }).catch(() => ({}))
  return { counts, links }
}

async function parseTable(frame: any): Promise<{ headers: string[]; rows: string[][] } | null> {
  for (let i = 0; i < 40; i++) {
    const found = await frame.evaluate(() => {
      const t = document.querySelector('table#datatable') || document.querySelector('table#GridSubmissions')
      return !!t || Array.from(document.querySelectorAll('table')).some((tb) => tb.querySelector('th'))
    }).catch(() => false)
    if (found) {
      return frame.evaluate(() => {
        // 兼容两种 EM 结构：标准 #datatable（thead 表头）与 Grid 表格（表头在 tbody 第一行的 th）。
        const table = document.querySelector('table#datatable') || document.querySelector('table#GridSubmissions')
          || Array.from(document.querySelectorAll('table')).find((tb) => tb.querySelector('th'))
        if (!table) return null
        let ths: string[] = []
        const theadThs = table.querySelectorAll('thead th')
        if (theadThs.length > 0) {
          ths = Array.from(theadThs).map((th: any) => (th.innerText || '').replace(/\s+/g, ' ').trim() || 'action')
        } else {
          ths = Array.from(table.querySelectorAll('th')).map((th: any) => (th.innerText || '').replace(/\s+/g, ' ').trim() || 'action')
        }
        const rows = Array.from(table.querySelectorAll('tbody tr, tr'))
          .filter((tr: any) => tr.querySelector('td') && !tr.querySelector('th'))
          .map((tr: any) => Array.from(tr.querySelectorAll('td')).map((td: any) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
        return { headers: ths, rows }
      }).catch(() => null)
    }
    await frame.waitForTimeout(500)
  }
  return null
}

/**
 * 遍历表格的所有分页（EM datatable 常见分页），最多 maxPages 页，合并返回全部行。
 * 用于决策历史等可能跨页的分区；普通活跃分区（一般一页内）仍走 parseTable。
 * 分页控件是 <a href="javascript:document.resort.currentpage.value=N;document.resort.submit();">Next</a>，
 * 点击会让 content iframe 整页导航（2-4s），故翻页后轮询等待第一行编号变化，避免导航中误判断连。 */
async function scrapeTableAllPages(frame: any, maxPages = 8): Promise<{ headers: string[]; rows: string[][] } | null> {
  let merged: { headers: string[]; rows: string[][] } | null = null
  let prevFirst = ''
  for (let p = 0; p < maxPages; p++) {
    // 解析当前页（parseTable 内部已轮询等待表格；导航中 evaluate 抛错返回 null，这里短重试）。
    let parsed = await parseTable(frame)
    if (!parsed || parsed.rows.length === 0) {
      let ok = false
      for (let w = 0; w < 20 && !ok; w++) {
        await frame.waitForTimeout(500)
        parsed = await parseTable(frame)
        if (parsed && parsed.rows.length > 0) ok = true
      }
      if (!ok) break
    }
    if (!parsed) break
    if (!merged) merged = { headers: parsed.headers, rows: [] }
    // 用第二列（Manuscript Number）做翻页判断：第一列是 Action 链接列，每页都相同。
    // 翻页后第一行编号未变 → 页面没跳转（已是最后一页/点击未生效），停止，防死循环。
    const first = parsed.rows[0]?.[1] ?? parsed.rows[0]?.[0] ?? ''
    if (p > 0 && first === prevFirst) break
    merged.rows.push(...parsed.rows)
    prevFirst = first
    // 点击分页 Next（a / button / input[type=button]，文本以 Next 或右箭头开头）
    const clicked = await frame.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, button, input[type="button"]'))
      const n = els.find((e) => {
        const t = ((e as any).innerText ?? (e as any).value ?? '').trim()
        return /^(next|›|»|&gt;|>)/i.test(t)
      })
      if (!n) return false
      ;(n as any).click()
      return true
    }).catch(() => false)
    if (!clicked) break
    // 等待翻页生效：第二列编号变化（表单提交整页导航，最多等 ~8s）。
    let moved = false
    for (let w = 0; w < 16; w++) {
      await frame.waitForTimeout(500)
      const cur = await frame.evaluate(() => {
        const t = document.querySelector('table#datatable') || document.querySelector('table#GridSubmissions')
          || Array.from(document.querySelectorAll('table')).find((tb) => tb.querySelector('th'))
        const tr = t ? Array.from(t.querySelectorAll('tbody tr, tr')).find((r: any) => r.querySelector('td') && !r.querySelector('th')) : null
        if (!tr) return ''
        const tds = tr.querySelectorAll('td')
        return ((tds[1] as any)?.innerText || (tds[0] as any)?.innerText || '').trim()
      }).catch(() => '')
      if (cur && cur !== prevFirst) { moved = true; break }
    }
    if (!moved) break
  }
  return merged
}

function normalizeRows(parsed: { headers: string[]; rows: string[][] } | null): Submission[] {
  if (!parsed) return []
  return parsed.rows.map((cells) => {
    const rec: Record<string, string> = {}
    parsed.headers.forEach((h, i) => { rec[h.toLowerCase()] = cells[i] ?? '' })
    return {
      number: rec['manuscript number'] ?? '',
      title: rec['title'] ?? rec['article title'] ?? '',
      submitted: rec['initial date submitted'] ?? '',
      statusDate: rec['status date'] ?? rec['final decision date'] ?? rec['decision date'] ?? rec['transfer offer expiration date'] ?? '',
      revBegan: rec['date revision began'] ?? '',
      revDue: rec['date revision due'] ?? rec['transfer offer expiration date'] ?? '',
      status: rec['current status'] ?? rec['production status'] ?? rec['status'] ?? '',
    }
  }).filter((s) => s.number || s.title)
}

// ===== 持久化浏览器会话（B 方案）=====
// 目的：支持 ORCID / 学校 SSO / Taylor&Francis 等「没法用账号密码填表完成」的登录。
// 做法：Chromium 用固定的 profile 目录启动（launchPersistentContext），人工在有头窗口里登录一次，
// cookie 落到 profile 里；之后所有无头抓取都复用这份登录态，不再走 Editorial Manager 表单。
const PC_LOGIN_TIMEOUT_MS = 10 * 60 * 1000

/** 持久化 profile 目录（自动创建）。 */
function pcProfileDir(): string {
  const dir = join(homedir(), '.dsh', 'paper-checker', 'browser-profile')
  try { mkdirSync(dir, { recursive: true }) } catch { /* 静默 */ }
  return dir
}

// 同一个 profile 不能被两个 Chromium 实例同时打开（Chromium 的 ProcessSingleton 会让后启动的那个直接失败），
// 所以浏览器会话串行化：定时检查 / 面板检查 / 登录一次排队执行，而不是互相把 profile 锁死。
let __pcBrowserChain: Promise<void> = Promise.resolve()
async function pcAcquireBrowser(): Promise<() => void> {
  const prev = __pcBrowserChain
  let releaseSlot: () => void = () => {}
  __pcBrowserChain = new Promise<void>((r) => { releaseSlot = r })
  await prev
  let done = false
  let guard: any = null
  const release = () => {
    if (done) return
    done = true
    if (guard) clearTimeout(guard)
    try { releaseSlot() } catch { /* 静默 */ }
  }
  // 兜底：调用点若在异常路径漏关，20 分钟后自动放行，避免整条队列永久卡死。
  guard = setTimeout(release, 20 * 60 * 1000)
  try { (guard as any).unref?.() } catch { /* 静默 */ }
  return release
}

/** 清掉 Chromium 的单例锁文件（上个进程被强杀时残留，会让新实例启动失败）。 */
function pcClearSingleton(profileDir: string): void {
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile']) {
    try { const p = join(profileDir, f); if (existsSync(p)) rmSync(p, { force: true }) } catch { /* 静默 */ }
  }
}

/** 启动 Playwright Chromium；browserPath 非空时用其中的 headless shell（版本号取自 playwright 期望值）。
 *  B 方案：改为在持久化 profile 里启动，返回 BrowserContext（自带 newPage()/close()，调用点可直接用）。
 *  启动失败（profile 被占 / 损坏）时清一次单例锁重试，再失败就退回临时 Browser ——
 *  保证「现有 EM 期刊照旧能抓」这条底线不被 profile 问题拖垮。 */
async function launchChromium(browserPath?: string): Promise<any> {
  const { chromium } = pwRequire('playwright-core')
  const release = await pcAcquireBrowser()
  const opts: any = { headless: true, viewport: { width: 1440, height: 900 }, locale: 'en-US' }
  if (browserPath) {
    const expected = chromium.executablePath()
    const rev = expected.match(/chromium[_-]?(\d+)/)?.[1]
    if (rev) {
      const exe = join(browserPath, `chromium_headless_shell-${rev}`, 'chrome-win', 'headless_shell.exe')
      if (existsSync(exe)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath
        opts.executablePath = exe
      }
    }
  }
  const dir = pcProfileDir()
  let ctx: any = null
  try {
    ctx = await chromium.launchPersistentContext(dir, opts)
  } catch (e1) {
    log(defaultReportDir(), '持久化 profile 启动失败: ' + String(e1).split('\n')[0].slice(0, 300))
    if (/singleton|in use|already (running|open)|lock|EBUSY|EPERM/i.test(String(e1))) {
      pcClearSingleton(dir)
      await new Promise((r) => setTimeout(r, 1200))
      try { ctx = await chromium.launchPersistentContext(dir, opts) } catch (e2) {
        log(defaultReportDir(), '清锁后仍失败: ' + String(e2).split('\n')[0].slice(0, 300))
      }
    }
  }
  if (ctx) {
    try { ctx.on('close', release) } catch { release() }
    return ctx
  }
  // 回退：临时 Browser（不持久化，用不上登录态，但抓取不整体失败）。
  try {
    const b = await chromium.launch({ headless: true })
    try { b.on('disconnected', release) } catch { release() }
    return b
  } catch (e3) {
    release()
    throw e3
  }
}

/** 统一取页面：持久化 context 启动时自带一个 about:blank 页，复用它；
 *  回退的 Browser 没有 newPage()，走 newContext()+newPage()。 */
async function openBrowserPage(browser: any): Promise<any> {
  if (browser && typeof browser.newPage === 'function') {
    const pages = browser.pages?.() ?? []
    const blank = pages.find((p: any) => { try { return p.url() === 'about:blank' } catch { return false } })
    return blank || browser.newPage()
  }
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  return c.newPage()
}

/** 登录页特征：URL 里出现这些，就当「还在登录流程里」。 */
const PC_LOGIN_URL_RE = /(\/|\?)login|login\.aspx?|accounts\.|identity|\/signin|sign-in|\/auth|oauth|openid|sso|shibboleth/i

/** 页面上（含各 iframe）是否还有登录表单：EM 的 username/authorLogin，或任意密码框。
 *  表单还在就一定没登录 —— 这条比 URL 可靠（EM 登录页把密码框藏在 hideElement 里，
 *  所以只按 DOM 里存在，不看可见性）。 */
async function pcHasLoginForm(page: any): Promise<boolean> {
  const sel = "input[name='username'], input[name='authorLogin'], input[type='password']"
  const countIn = async (t: any) => { try { return (await t.locator(sel).count()) > 0 } catch { return false } }
  if (await countIn(page)) return true
  for (const f of (page.frames?.() ?? [])) { if (await countIn(f)) return true }
  return false
}

/** 取业务正文（优先 content iframe：EM 的主体内容在 iframe 里）。 */
async function pcBodyText(page: any): Promise<string> {
  const cf = page.frame?.({ name: 'content' })
  const t1 = cf ? await cf.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '') : ''
  if (t1 && String(t1).trim()) return String(t1)
  return String(await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '') || '')
}

/** 判断某一页是否已经登录成功（「登录一次」轮询用）：没登录表单 + URL 不像登录页 + 正文有业务字样。 */
async function pcLoggedInSignal(page: any, startHost: string): Promise<{ ok: boolean; url: string; why: string }> {
  const url = String(page.url?.() ?? '')
  if (!url || url === 'about:blank' || !/^https?:/i.test(url)) return { ok: false, url, why: 'blank' }
  let host = ''
  try { host = new URL(url).hostname.toLowerCase() } catch { host = '' }
  if (await pcHasLoginForm(page)) return { ok: false, url, why: 'login-form' }
  const leftHost = !!startHost && !!host && host !== startHost
  if (!leftHost && PC_LOGIN_URL_RE.test(url)) return { ok: false, url, why: 'login-url' }
  const txt = await pcBodyText(page)
  if (String(txt).trim().length < 40) return { ok: false, url, why: 'thin-page' }
  if (!/(submission|manuscript|author|dashboard|profile|account|welcome|orcid|home|my )/i.test(txt)) return { ok: false, url, why: 'no-biz-text' }
  return { ok: true, url, why: 'ok' }
}

/** 有头浏览器可执行文件候选：先试配置里的浏览器目录（chromium-<rev> 完整包，不是 headless shell），
 *  再试 Playwright 默认安装，最后交给 playwright 自己解析。 */
function pcHeadedExeCandidates(browserPath?: string): (string | undefined)[] {
  const { chromium } = pwRequire('playwright-core')
  const out: (string | undefined)[] = []
  const push = (p?: string) => { if (p && existsSync(p) && !out.includes(p)) out.push(p) }
  try {
    const expected = chromium.executablePath()
    const rev = expected?.match(/chromium[_-]?(\d+)/)?.[1]
    if (browserPath && rev) {
      push(join(browserPath, `chromium-${rev}`, 'chrome-win', 'chrome.exe'))
      push(join(browserPath, `chromium-${rev}`, 'chrome-win64', 'chrome.exe'))
      process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath
    }
    push(expected)
  } catch { /* 静默 */ }
  out.push(undefined)
  return out
}

/** [local patch 2026-10-22d] 网址是不是「登录 / 统一身份门户」页（这类页没有稿件列表，不能当期刊入口） */
function pcIsLoginishUrl(u: string): boolean {
	const s0 = String(u || "").toLowerCase();
	if (!s0) return true;
	return /(orcid\.org|accounts\.taylorfrancis\.com|\/identity(\/|$|\?)|login\.microsoftonline|\/login(\/|$|\?)|\/signin|\/sign-in|\/oauth(\/|$|\?)|\/sso(\/|$|\?)|[?&]pg=login)/.test(s0);
}
/** [local patch 2026-10-22d] 从登录轨迹里挑出真正的投稿系统网址：命中已知投稿系统主机、且不是登录页的优先 */
function pcTraceBestUrl(entered: string, urls: string[]): string {
	let inHost = "";
	try {
		inHost = new URL(String(entered || "")).hostname.toLowerCase();
	} catch {}
	let best = "";
	let bestScore = -1;
	for (const raw of urls || []) {
		const u = String(raw || "");
		if (!/^https?:\/\//i.test(u)) continue;
		if (pcIsLoginishUrl(u)) continue;
		let host = "";
		let path = "/";
		try {
			const o = new URL(u);
			host = o.hostname.toLowerCase();
			path = (o.pathname || "/").toLowerCase();
		} catch {
			continue;
		}
		let score = 10;
		if (/^rp\.tandfonline\.com$/.test(host)) score = /dashboard/.test(path) ? 120 : 100;
		else if (/editorialmanager\.com$/.test(host)) score = /(login\.asp|pg=login)/i.test(u) ? 20 : 110;
		else if (/manuscriptcentral\.com$/.test(host)) score = 105;
		else if (/^snapp|snapp\./.test(host)) score = 95;
		else if (/scholarone/.test(host)) score = 90;
		else if (host && host !== inHost) score = 30;
		if (score > bestScore) {
			bestScore = score;
			best = u;
		}
	}
	return bestScore >= 30 ? best : "";
}
/** [local patch 2026-10-22d] 把 plan 写到指定 baseUrl 名下（key 由 baseUrl 决定） */
function pcWriteStructureAt(baseUrl: string, plan: any): string {
	try {
		const p = pcStructurePath(baseUrl);
		mkdirSync(pcStructuresDir(), {
			recursive: true
		});
		writeFileSync(p, JSON.stringify({
			baseUrl,
			plan,
			capturedAt: new Date().toISOString()
		}, null, 2), "utf8");
		return p;
	} catch (e) {
		return "";
	}
}
/** [patch 2026-10-22e] host service refs captured while the context is active (the timer context is inactive) */
let __pcSCRef: any = null
let __pcAgentsRef: any = null
let __pcSessionsRef: any = null
let __pcLoginOnceBusy = false
/** 人工登录一次：有头窗口打开期刊入口，等用户自己完成 ORCID / SSO / 表单登录。
 *  登录态（cookie）随 profile 落盘，之后的无头抓取直接复用。 */
async function loginOnce(baseUrl: string, browserPath?: string, onLoggedIn?: (ctxAny: any, finalUrl: string, keyUrl?: string) => Promise<any>): Promise<{
  ok: boolean; finalUrl?: string; waitedMs?: number; error?: string; profileDir?: string; structure?: any
  /** [local patch 2026-10-22] 登录窗口里所有页面轨迹（at=第几秒 / url / title） */
  pages?: Array<{ at?: number; url: string; title: string }>
  /** 识别出的稿件列表入口（plan.listUrl） */
  planAt?: string
  /** [local patch 2026-10-22d] 轨迹里找到的真实投稿系统网址 */
  bestUrl?: string
  /** 是否是用户手动关掉浏览器结束的 */
  closedByUser?: boolean
  /** 轮询期间顺手记录的账号密码（cookie 过期时重新登录用） */
  creds?: { username: string; password: string }
}> {
	const { chromium } = pwRequire("playwright-core");
	const startedAt = Date.now();
	const release = await pcAcquireBrowser();
	let ctx: any = null;
	const launchErr = [];
	try {
		const dir = pcProfileDir();
		for (const exe of pcHeadedExeCandidates(browserPath)) {
			const opts: any = {
				headless: false,
				viewport: {
					width: 1280,
					height: 860
				},
				locale: "en-US"
			};
			if (exe) opts.executablePath = exe;
			try {
				ctx = await chromium.launchPersistentContext(dir, opts);
				break;
			} catch (e) {
				launchErr.push((exe ? "exe=" + exe + " " : "default ") + String(e).split("\n")[0].slice(0, 200));
				if (/singleton|in use|already (running|open)|lock|EBUSY|EPERM/i.test(String(e))) {
					pcClearSingleton(dir);
					await new Promise((r) => setTimeout(r, 1200));
				}
			}
		}
		if (!ctx) return {
			ok: false,
			waitedMs: Date.now() - startedAt,
			error: "有头浏览器启动失败（没有可用的完整 Chromium）: " + launchErr.join(" | ").slice(0, 500)
		};
		const page = (ctx.pages?.() ?? [])[0] ?? await ctx.newPage();
		// [patch 2026-10-22k] 页面内记录器：用户每次输入/点击/回车都把账号密码记到 window.__pcCapturedCreds
		try {
			await ctx.addInitScript(() => {
				try {
					const win: any = window as any;
					const doc: any = document as any;
					const grab = () => {
						try {
							const pws: any[] = Array.from(doc.querySelectorAll("input[type=password]")) as any[];
							const pw: any = pws.find((i: any) => String(i.value || "").length > 0);
							if (!pw) return;
							const form: any = pw.form || (pw.closest ? pw.closest("form") : null) || doc;
							const cands: any[] = Array.from(form.querySelectorAll("input")).filter((i: any) => {
								const ty = String(i.type || "").toLowerCase();
								if (ty !== "text" && ty !== "email" && ty !== "") return false;
								return i !== pw && String(i.value || "").length > 0;
							});
							const u: any = cands.find((i: any) => /user|email|login|account|name|id/i.test(String(i.name || "") + String(i.id || "") + String(i.placeholder || ""))) || cands[0];
							win.__pcCapturedCreds = { username: u ? String(u.value || "") : "", password: String(pw.value || "") };
							try { console.log("__pcCred__ " + JSON.stringify(win.__pcCapturedCreds)); } catch (e2) {}
						} catch (e) {}
					};
					for (const ev of ["input", "change", "blur", "submit", "click", "keydown"]) doc.addEventListener(ev, grab, true);
					setInterval(grab, 500);
				} catch (e) {}
			});
		} catch (e) { log(defaultReportDir(), "登录追踪：安装凭据记录器失败 " + String(e).slice(0, 160)); }
		// [patch 2026-10-22k2] console 标记事件即时回传凭据（页面跳走也不丢）
		let __pcCreds: { username: string; password: string } | null = null;
		const __pcOnConsole = (m: any) => {
			try {
				const t = String(m?.text?.() ?? "");
				if (!t.startsWith("__pcCred__ ")) return;
				const j = JSON.parse(t.slice(11));
				if (j && j.password) __pcCreds = { username: String(j.username || ""), password: String(j.password) } // [patch 2026-10-22k3]
			} catch {}
		};
		try {
			for (const pg of ctx.pages?.() ?? []) pg.on?.("console", __pcOnConsole);
			ctx.on?.("page", (pg: any) => pg.on?.("console", __pcOnConsole));
		} catch {}
		let startHost = "";
		try {
			startHost = new URL(baseUrl).hostname.toLowerCase();
		} catch {}
		await page.goto(baseUrl, {
			waitUntil: "domcontentloaded",
			timeout: 6e4
		}).catch(() => {});
		// [local patch 2026-10-22b] 全程追踪：从点「登录一次」到用户关闭浏览器窗口，记录访问过的每个页面；
		// 不再一检测到登录成功就关窗口（用户往往还要点进「我的稿件 / 作者中心」），每出现新页面就试一次结构识别，
		// 最后把整条访问轨迹 + 命中的 plan 一起报回面板。
		const TRACE_CAP_MS = 18e5;
		const TRACE: Array<{ at: number; url: string; title: string }> = [];
		const traceSeen = new Set<string>();
		const __pcTracePush = (u: string, t: string) => {
			const url = String(u ?? "");
			if (!url || traceSeen.has(url) || url === "about:blank") return;
			traceSeen.add(url);
			TRACE.push({ at: Math.round((Date.now() - startedAt) / 1000), url, title: String(t ?? "").slice(0, 120) });
		};
		let lastUrl = String(page.url?.() ?? "");
		let okUrl = "";
		let loggedIn = false;
		let browserClosed = false;
		let emptyTicks = 0;
		try {
			ctx.on?.("close", () => {
				browserClosed = true;
			});
		} catch {}
		// [patch 2026-10-22i] 登录成功后冻结凭据（只记最后一次成功登录时用的）
		let __pcCredsLocked = false;
		let structure: any = null;
		let planAt = "";
		let attempts = 0;
		let lastTryAt = 0;
		let lastTryKey = "";
		let bestHint = ""
		const tryRecognize = async (why: string) => {
			if (structure && structure.plan) return;
			const cb = onLoggedIn;
			if (!cb) return;
			if (attempts >= 8) return;
			attempts += 1;
			lastTryAt = Date.now();
			const pagesNow: string[] = (ctx.pages?.() ?? []).map((pg: any) => String(pg.url?.() ?? "")).filter((u: string) => u && u !== "about:blank");
			lastTryKey = pagesNow.slice().sort().join("\n");
			log(defaultReportDir(), "登录追踪识别 #" + attempts + "（" + why + "）pages=" + pagesNow.length);
			try {
				const rec = await cb(ctx, pagesNow[0] || baseUrl, bestHint);
				if (rec && rec.plan) {
					structure = rec;
					planAt = String(rec.plan?.listUrl || "");
					log(defaultReportDir(), "登录追踪识别成功 #" + attempts + " system=" + String(rec.plan?.system ?? "") + " listUrl=" + planAt);
				} else if (rec && rec.error) {
					structure = rec;
				}
			} catch (e) {
				structure = { error: String(e) };
			}
		};
		while (Date.now() - startedAt < TRACE_CAP_MS) {
			await new Promise((r) => setTimeout(r, 1000));
			if (browserClosed) break;
			let pagesList: any[] = [];
			try {
				pagesList = ctx.pages?.() ?? [];
			} catch {
				browserClosed = true;
				break;
			}
			if (!pagesList.length) {
				emptyTicks += 1;
				log(defaultReportDir(), "登录追踪：当前没有可见标签页（第 " + emptyTicks + " 次），窗口还开着就继续等");
				if (emptyTicks >= 8) {
					browserClosed = true;
					break;
				}
				continue;
			}
			emptyTicks = 0;
			// 1) 顺手记下账号密码（登录表单还在页面上时取 value；提交后页面跳走就没了）
			// [patch 2026-10-22i] 一直刷新，直到登录成功才冻结（用户可能第一次输错再重输）
			// [patch 2026-10-22k3] 始终刷新：最后一次输入就是用户真正提交的那一份
			if (true) {
				for (const pg of pagesList) {
					for (const fr of pg.frames?.() ?? []) {
						try {
							const got = await fr.evaluate(() => {
								// [patch 2026-10-22k] 优先读页面内记录器抓到的「最后一次输入」
								const rec: any = (window as any).__pcCapturedCreds;
								if (rec && rec.password) return { username: String(rec.username || ""), password: String(rec.password) };
								const pws: any[] = Array.from(document.querySelectorAll("input[type=password]")) as any[];
								const pw: any = pws.find((i: any) => String(i.value || "").length > 0);
								if (!pw) return null;
								const form: any = pw.form || pw.closest?.("form") || document;
								const cands: any[] = Array.from(form.querySelectorAll("input")).filter((i: any) => {
									const ty = String(i.type || "").toLowerCase();
									if (ty !== "text" && ty !== "email" && ty !== "") return false;
									return i !== pw && String(i.value || "").length > 0;
								});
								const u: any = cands.find((i: any) => /user|email|login|account|name|id/i.test(String(i.name || "") + String(i.id || "") + String(i.placeholder || ""))) || cands[0];
								return { username: String(u?.value || ""), password: String(pw.value || "") };
							});
							if (got && got.password) __pcCreds = { username: got.username, password: got.password };
						} catch {}
					}
				}
			}
			// 2) 记录访问轨迹（新页面才取标题，避免每个 tick 都去查 title）
			for (const pg of pagesList) {
				try {
					const u = String(pg.url?.() ?? "");
					if (!u || traceSeen.has(u)) continue;
					let t = "";
					try {
						t = String(await Promise.race([pg.title(), new Promise((r) => setTimeout(() => r(""), 1200))]) ?? "");
					} catch {}
					__pcTracePush(u, t);
					lastUrl = u;
				} catch {}
			}
			// 3) 登录态信号（只用于标记"已登录"，不再据此关窗口）
			if (!loggedIn) {
				for (const pg of pagesList) {
					try {
						const sig = await pcLoggedInSignal(pg, startHost);
						if (sig.ok) {
							loggedIn = true;
							okUrl = sig.url;
							break;
						}
					} catch {}
				}
				if (loggedIn) log(defaultReportDir(), "登录追踪：检测到登录成功 url=" + okUrl);
			}
			// 4) 页面集合变了就试一次识别（不要求已登录：有些门户检测不到登录信号，用户点进稿件列表本身就是证据）
			if (!(structure && structure.plan) && Date.now() - lastTryAt > 1e4) {
				const cur = pagesList.map((pg: any) => String(pg.url?.() ?? "")).filter((u: string) => u && u !== "about:blank").sort().join("\n");
				if (cur && cur !== lastTryKey) await tryRecognize(loggedIn ? "页面变了" : "页面变了（还没检测到登录信号）");
			}
		}
		log(defaultReportDir(), "登录追踪结束：窗口" + (browserClosed ? "已关闭" : "到达 30 分钟上限") + "，用时 " + Math.round((Date.now() - startedAt) / 1000) + "s，访问页面 " + TRACE.length + " 条，loggedIn=" + loggedIn + " plan=" + !!(structure && structure.plan));
		// 收尾：补一次标题较全的轨迹快照
		try {
			for (const pg of ctx.pages?.() ?? []) {
				const u = String(pg.url?.() ?? "");
				if (!u || traceSeen.has(u)) continue;
				let t = "";
				try {
					t = String(await Promise.race([pg.title(), new Promise((r) => setTimeout(() => r(""), 1200))]) ?? "");
				} catch {}
				__pcTracePush(u, t);
			}
		} catch {}
		let bestUrl = pcTraceBestUrl(baseUrl, TRACE.map((x) => x.url))
		bestHint = bestUrl
		if (!bestUrl && structure && structure.plan) {
			const lu0 = String(structure.plan.listUrl || "")
			if (lu0 && !pcIsLoginishUrl(lu0)) bestUrl = lu0
		}
		if (bestUrl) log(defaultReportDir(), "登录追踪：轨迹里找到真实投稿系统网址 bestUrl=" + bestUrl)
		if (bestUrl && !(structure && structure.plan) && onLoggedIn && attempts < 8) {
			attempts += 1
			log(defaultReportDir(), "登录追踪：按真实系统网址再识别一次 #" + attempts)
			try {
				const rec3 = await onLoggedIn(ctx, bestUrl, bestUrl)
				if (rec3 && rec3.plan) {
					structure = rec3
					planAt = String(rec3.plan?.listUrl || "")
				} else if (rec3 && rec3.error && !(structure && structure.error)) structure = rec3
			} catch (e) {
				log(defaultReportDir(), "登录追踪：按 bestUrl 识别异常 " + String(e).slice(0, 200))
			}
		}
		if (structure && structure.plan) {
			const lu1 = String(structure.plan.listUrl || "")
			if (bestUrl && (!lu1 || pcIsLoginishUrl(lu1))) {
				structure.plan.listUrl = bestUrl
				planAt = bestUrl
			}
			if (bestUrl) pcWriteStructureAt(bestUrl, structure.plan)
		}
		const plan = structure && structure.plan ? structure : null;
		if (!structure) structure = { error: "没有识别到可用的稿件列表" };
		if (!structure.plan) {
			if (!loggedIn) structure = { error: "等了 " + Math.round((Date.now() - startedAt) / 1000) + " 秒没检测到登录成功（登录态可能已存进 profile，可再点一次试试）" };
			else if (!structure.error) structure = { error: "登录成功，但在你访问过的页面里没认出击稿列表——请把面板下方轨迹里「我的稿件」那条网址直接填进上方再点一次" };
		}
		return {
			ok: loggedIn || !!plan,
			finalUrl: okUrl || lastUrl,
			waitedMs: Date.now() - startedAt,
			profileDir: dir,
			structure,
			planAt,
			closedByUser: browserClosed,
			bestUrl,
			pages: TRACE.slice(0, 60),
			creds: __pcCreds ?? void 0
		};
	} catch (e) {
		return {
			ok: false,
			waitedMs: Date.now() - startedAt,
			error: String(e)
		};
	} finally {
		try {
			await ctx?.close?.();
		} catch {}
		release();
	}
}


// ============ 第二步：登录后结构识别 + 通用抓取器 ============
// 思路：人工登录一次拿到持久化登录态后，立刻把「登录态可见」的页面结构摘要交给 LLM 判型，
// 记住投稿列表页与字段选择器，写到 ~/.dsh/paper-checker/structures/<site>.json（独立文件，不动期刊 schema）。
// 抓取时先看这份 plan：EM 或没有 plan → 走 EM 逻辑（行为不变）；其他系统 → 通用抓取器（DOM 优先，0 条回退 LLM）。
/** 通用抓取器需要的运行时依赖（LLM 通道 + 可选覆盖模型）。 */
type ScrapeEnv = { llmService?: any; settingsService?: any; providerOverride?: string; modelOverride?: string }

interface StructurePlan {
  system: string
  listUrl: string
  rowSelector: string
  fields: Record<string, string>
  menuSections: string[]
  confidence: number
  notes: string
}

const PC_SYSTEMS = ['editorial-manager', 'scholarone', 'taylorfrancis', 'sNAPP', 'other']
const PC_SYSTEM_LABEL: Record<string, string> = {
  'editorial-manager': 'Editorial Manager',
  scholarone: 'ScholarOne',
  taylorfrancis: 'Taylor & Francis',
  sNAPP: 'sNAPP',
  other: '未知投稿系统',
}
function pcSystemLabel(s: string): string { return PC_SYSTEM_LABEL[String(s ?? '')] || String(s ?? '') }
/** 疑似投稿列表页的链接特征（主动打开 1-3 个候选页用）。 */
const PC_LIST_HINT_RE = /submissions?|manuscripts?|my submissions|author dashboard|dashboard|submission status/i

function pcStructuresDir(): string {
  const dir = join(homedir(), '.dsh', 'paper-checker', 'structures')
  try { mkdirSync(dir, { recursive: true }) } catch { /* 静默 */ }
  return dir
}
/** baseUrl → 稳定文件名（主机名 + 路径；非 [a-z0-9._-] 归一为 '_'）。 */
function pcStructureKey(baseUrl: string): string {
  let raw = String(baseUrl ?? '')
  try {
    const u = new URL(raw)
    raw = u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch { /* 不是 URL 就按原串处理 */ }
  const key = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return (key || 'site').slice(0, 120)
}
function pcStructurePath(baseUrl: string): string { return join(pcStructuresDir(), pcStructureKey(baseUrl) + '.json') }

/** 读结构 plan；没有文件返回 {path}（表示没有 plan），文件坏掉返回 {path,error}。 */
function pcReadStructure(baseUrl: string): { plan?: StructurePlan; path: string; error?: string } {
  const p = pcStructurePath(baseUrl)
  if (!existsSync(p)) return { path: p }
  try {
    const obj: any = JSON.parse(readFileSync(p, 'utf8'))
    if (!obj?.plan || typeof obj.plan !== 'object') return { path: p, error: '结构文件里没有 plan' }
    return { path: p, plan: obj.plan as StructurePlan }
  } catch (e) {
    return { path: p, error: '结构文件解析失败: ' + String(e) }
  }
}

function pcStr(v: any, max = 300): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** 清洗 LLM 返回的 plan：system 白名单、listUrl 必须是 http(s)、confidence 夹到 0..1。 */
function pcSanitizePlan(raw: any, _fallbackUrl: string): StructurePlan {
  const sysRaw = pcStr(raw?.system, 40).toLowerCase()
  const system = PC_SYSTEMS.find((s) => s.toLowerCase() === sysRaw) || 'other'
  let listUrl = pcStr(raw?.listUrl, 1000)
  if (!/^https?:\/\//i.test(listUrl)) listUrl = ''
  const fields: Record<string, string> = {}
  for (const k of ['number', 'title', 'status', 'submitted', 'updated']) {
    const v = pcStr(raw?.fields?.[k], 200)
    if (v) fields[k] = v
  }
  const menuSections = Array.isArray(raw?.menuSections)
    ? raw.menuSections.map((x: any) => pcStr(x, 80)).filter(Boolean).slice(0, 30)
    : []
  let confidence = Number(raw?.confidence)
  if (!Number.isFinite(confidence)) confidence = 0
  confidence = Math.max(0, Math.min(1, confidence))
  return {
    system,
    listUrl,
    rowSelector: pcStr(raw?.rowSelector, 300),
    fields,
    menuSections,
    confidence,
    notes: pcStr(raw?.notes, 800),
  }
}

/** 结构识别用的 LLM 提示词：只准输出 JSON，判据写死，避免模型自由发挥。 */
function pcStructurePrompt(baseUrl: string, journalName: string, digest: string, emHint: boolean): string {
  return [
    '你是网页结构分析器。下面是用户**已经登录**的期刊投稿系统若干页面的结构摘要',
    '（每个页面的 URL + title + h1-h3 + 每张表的表头与前几行 + 按钮/链接文本 + 表单字段名）。',
    '请判断这是哪个投稿系统，并给出「投稿列表页」与抓取选择器建议。只输出 JSON，不要解释、不要 Markdown 代码块。',
    '',
    'system 取值与判据：',
    '- editorial-manager：URL 含 editorialmanager.com，页面有 Author Main Menu / Submissions Being Processed，',
    '  表格列为 Manuscript Number / Article Title / Initial Date Submitted / Status Date / Current Status。',
    '- scholarone：URL 含 mc.manuscriptcentral.com 或 scholarone，页面有 Author Dashboard / Submitted Manuscripts。',
    '- taylorfrancis：URL 含 tandfonline.com，或页面有 Author Services / Track my article。',
    '- sNAPP：URL 含 snapp，或页面有 sNAPP / Springer Nature 投稿界面。',
    '- other：以上都不像。',
    '',
    '输出格式（严格 JSON，不要多余字段）：',
    '{"system":"editorial-manager|scholarone|taylorfrancis|sNAPP|other",',
    ' "listUrl":"列表页完整 URL（必须来自摘要里出现过的 URL；没有就给空串）",',
    ' "rowSelector":"一行稿件对应的 CSS 选择器（不确定就给空串）",',
    ' "fields":{"number":"稿号选择器或列名","title":"标题","status":"状态","submitted":"初始投稿日期","updated":"状态更新日期"},',
    ' "menuSections":["页面上出现的分区名称"],',
    ' "confidence":0 到 1 之间的小数,',
    ' "notes":"一句话说明依据"}',
    '',
    'baseUrl: ' + baseUrl,
    'journalName: ' + (journalName || '(未提供)'),
    '页面特征提示: ' + (emHint
      ? '已检测到 Editorial Manager 特征（Author Main Menu / Submissions Being Processed）'
      : '未检测到 Editorial Manager 特征'),
    '',
    '=== 页面结构摘要开始 ===',
    digest,
    '=== 页面结构摘要结束 ===',
  ].join('\n')
}

/** 单页（含所有 iframe）摘要：title、h1/h2/h3、表格 + 前 3 行、按钮/链接文本（去重后最多 120 条）、表单字段名。 */
async function pcPageDigest(pg: any): Promise<{ text: string; lists: string[] }> {
  const out: string[] = []
  const lists: string[] = []
  let frames: any[] = []
  try { frames = pg.frames?.() ?? [] } catch { /* 静默 */ }
  if (!frames.length) frames = [pg]
  for (const fr of frames) {
    let d: any = null
    try {
      d = await fr.evaluate(() => {
        const txt = (el: any) => ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim()
        const q = (sel: string) => Array.from(document.querySelectorAll(sel))
        const tables = q('table').slice(0, 6).map((tb: any) => {
          const rows = Array.from(tb.querySelectorAll('tr')).slice(0, 4)
          return rows
            .map((r: any) => Array.from(r.querySelectorAll('th,td')).map(txt).filter(Boolean).slice(0, 12).join(' | '))
            .filter(Boolean)
        }).filter((t: string[]) => t.length > 0)
        const ctrls = Array.from(new Set(
          q('a,button,input[type=button],input[type=submit]')
            .map((e: any) => (txt(e) || e.value || '').trim())
            .filter((t: string) => t && t.length <= 80),
        )).slice(0, 120)
        const fields = q('input,select,textarea').map((e: any) => e.getAttribute('name') || e.id || '').filter(Boolean).slice(0, 60)
        const lists = Array.from(new Set(
          q('a[href]').map((a: any) => String(a.href || ''))
            .filter((h: string) => /submissions?|manuscripts?|my submissions|author dashboard|dashboard|submission status/i.test(h)),
        )).slice(0, 30)
        return { title: document.title || '', heads: q('h1,h2,h3').map(txt).filter(Boolean).slice(0, 12), tables, ctrls, fields, lists }
      })
    } catch { continue }
    if (!d) continue
    const chunk: string[] = []
    if (d.title) chunk.push('title: ' + d.title)
    if (d.heads?.length) chunk.push('heads: ' + d.heads.join(' / '))
    if (d.tables?.length) d.tables.forEach((t: string[], i: number) => chunk.push('table' + (i + 1) + ': ' + t.join(' ;; ')))
    if (d.ctrls?.length) chunk.push('controls: ' + d.ctrls.join(' | '))
    if (d.fields?.length) chunk.push('formFields: ' + d.fields.join(','))
    if (chunk.length) out.push(chunk.join('\n'))
    for (const u of (d.lists ?? [])) if (!lists.includes(u)) lists.push(u)
  }
  return { text: out.join('\n\n'), lists }
}

/** 收集 context 内所有页面的摘要，再主动打开 1-3 个疑似投稿列表页补采（登录态下才有内容）。 */
async function pcCollectStructureDigest(baseUrl: string, ctxAny: any): Promise<{ text: string; pages: string[] }> {
  const chunks: string[] = []
  const seen: string[] = []
  const cands: string[] = []
  const pages: any[] = (() => { try { return ctxAny?.pages?.() ?? [] } catch { return [] } })()
  for (const pg of pages) {
    let u = ''
    try { u = String(pg.url?.() ?? '') } catch { /* 静默 */ }
    if (!u || u === 'about:blank' || seen.includes(u)) continue
    seen.push(u)
    const d = await pcPageDigest(pg)
    chunks.push('### page: ' + u + '\n' + d.text)
    for (const l of d.lists) if (!cands.includes(l)) cands.push(l)
  }
  const picked = cands.filter((u) => !seen.includes(u) && PC_LIST_HINT_RE.test(u)).slice(0, 3)
  for (const u of picked) {
    let pg: any = null
    try { pg = await ctxAny.newPage() } catch { break }
    try {
      await pg.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await new Promise((r) => setTimeout(r, 1500)) // SPA 落地后再取 DOM
      const d = await pcPageDigest(pg)
      chunks.push('### page: ' + u + '  (list candidate)\n' + d.text)
    } catch {
      chunks.push('### page: ' + u + '  (list candidate, 打开失败)')
    } finally {
      try { await pg.close?.() } catch { /* 静默 */ }
    }
  }
  return { text: chunks.join('\n\n'), pages: [...seen, ...picked] }
}

/** EM 的硬特征（主菜单 frame / 表格文案）：LLM 挂了也能保证 EM 期刊不被误判成 other。 */
async function pcEmHint(ctxAny: any): Promise<boolean> {
  const pages: any[] = (() => { try { return ctxAny?.pages?.() ?? [] } catch { return [] } })()
  // 域名硬特征：editorialmanager.com 只服务 Editorial Manager（比页面文案更可靠，且不受 iframe 时序影响）。
  try {
    const urls = pages.map((pg: any) => String(pg?.url?.() ?? '')).join(' ')
    if (/editorialmanager\.com/i.test(urls)) return true
  } catch { /* 静默 */ }
  for (const pg of pages) {
    let frames: any[] = []
    try { frames = pg.frames?.() ?? [] } catch { /* 静默 */ }
    for (const fr of frames) {
      const u = String(fr.url?.() ?? '')
      if (/AuthorMainMenu|MainMenu/i.test(u)) return true
      try {
        const head = await fr.evaluate(() => String((document.body && (document.body as any).innerText) || '').slice(0, 1200))
        if (/submissions being processed|submit new manuscript/i.test(String(head))) return true
      } catch { /* 静默 */ }
    }
  }
  return false
}

/** 识别 + 落盘。返回 {plan, planPath} 或 {error}（失败时绝不写假 plan）。 */
async function pcRecognizeStructure(opts: {
  baseUrl: string
  journalName?: string
  ctxAny: any
  llmService: any
  settingsService: any
  providerOverride?: string
  modelOverride?: string
}): Promise<{ plan?: StructurePlan; planPath?: string; error?: string }> {
  const baseUrl = String(opts.baseUrl)
  try {
    const emHint = await pcEmHint(opts.ctxAny)
    const dig = await pcCollectStructureDigest(baseUrl, opts.ctxAny)
    if (!dig.text.trim()) return { error: '登录成功，但页面上没取到可识别的结构（可能是纯前端空壳或整页 iframe 受限）。' }
    const digest = dig.text.length > 60000 ? dig.text.slice(0, 60000) + '\n…（摘要已截断）' : dig.text
    let plan: StructurePlan | undefined
    let llmErr = ''
    const provider = opts.providerOverride || 'deepseek-official'
    const model = opts.modelOverride || (opts.providerOverride ? '' : 'deepseek-v4-pro')
    try {
      const raw = await callLlmText(
        opts.llmService, opts.settingsService,
        pcStructurePrompt(baseUrl, opts.journalName ?? '', digest, emHint),
        opts.providerOverride, opts.modelOverride,
      )
      const m = String(raw).match(/\{[\s\S]*\}/)
      if (!m) throw new Error('模型没有返回 JSON: ' + String(raw).slice(0, 200))
      plan = pcSanitizePlan(JSON.parse(m[0]), baseUrl)
    } catch (e) {
      llmErr = String(e).split('\n')[0]
    }
    // EM 特征很硬：即便 LLM 挂了/判错，也按 editorial-manager 记一条高置信 plan（单刊抓取不受影响）。
    if (emHint) {
      const wantUrl = /AuthorMainMenu|MainMenu/i.test(String(plan?.listUrl ?? ''))
        ? plan!.listUrl
        : baseUrl + '/Default.aspx?pg=authorMainMenu'
      plan = pcSanitizePlan({
        ...(plan ?? {}),
        system: 'editorial-manager',
        confidence: Math.max(plan?.confidence ?? 0, 0.95),
        listUrl: wantUrl,
        notes: ((plan?.notes ? plan.notes + '；' : '') + '检测到 EM 主菜单/域名特征，按 Editorial Manager 处理'),
      }, baseUrl)
    }
    if (!plan) return { error: '结构识别失败: ' + (llmErr || ('模型返回为空（' + provider + (model ? ' / ' + model : '') + '），可在配置页换一个识别模型再试')) }
    const planPath = pcStructurePath(baseUrl)
    writeFileSync(planPath, JSON.stringify({
      baseUrl,
      journalName: opts.journalName ?? '',
      capturedAt: new Date().toISOString(),
      model: provider + '/' + (model || '(默认)'),
      pages: dig.pages,
      plan,
    }, null, 2), 'utf8')
    return { plan, planPath }
  } catch (e) {
    return { error: '结构识别异常: ' + String(e) }
  }
}

function pcNormDate(v: any): string {
  const s = pcStr(v, 60)
  return s
}

/** DOM 提取：按 plan 的 rowSelector / 字段选择器抓行；选择器为空或没命中返回 []（由调用方回退 LLM）。 */
async function pcExtractByPlan(pg: any, plan: StructurePlan): Promise<Submission[]> {
  const rowSel = String(plan.rowSelector || '').trim()
  if (!rowSel) return []
  let rows: any[] = []
  try {
    rows = await pg.evaluate((arg: any) => {
      const txt = (el: any) => ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim()
      const pick = (root: any, sel: string) => {
        if (!sel) return ''
        try { return txt(root.querySelector(sel)) } catch { return '' }
      }
      const out: any[] = []
      for (const r of Array.from(document.querySelectorAll(arg.row)).slice(0, 200)) {
        const one: any = {}
        for (const k of Object.keys(arg.fields || {})) one[k] = pick(r, String((arg.fields as any)[k] || ''))
        out.push(one)
      }
      return out
    }, { row: rowSel, fields: plan.fields ?? {} })
  } catch {
    return []
  }
  const subs: Submission[] = []
  for (const r of rows) {
    const number = pcStr(r?.number, 120)
    const title = pcStr(r?.title, 500)
    if (!number && !title) continue
    subs.push({
      number: number || '(未识别稿号)',
      title: title || '(未识别标题)',
      submitted: pcNormDate(r?.submitted),
      statusDate: pcNormDate(r?.updated),
      status: pcStr(r?.status, 200) || '未知状态',
    })
  }
  return subs
}

/** 回退：列表页可见文本（≤40KB）交给 LLM 抽 JSON 数组。 */
async function pcExtractByLlm(pg: any, plan: StructurePlan, opts: {
  journalName: string; llmService: any; settingsService: any; providerOverride?: string; modelOverride?: string
}): Promise<Submission[]> {
  let body = ''
  try {
    body = String(await pg.evaluate(() => String((document.body && (document.body as any).innerText) || '')))
  } catch { /* 静默 */ }
  body = body.trim()
  if (!body) return []
  if (body.length > 40000) body = body.slice(0, 40000) + '\n…（正文已截断）'
  const prompt = [
    '下面是一个学术期刊投稿系统的「投稿列表页」纯文本（用户已登录' + (opts.journalName || '') + '）：',
    '请把页面上的每一篇稿件抽成 JSON 数组，只输出数组本身（不要解释、不要 Markdown 代码块）。',
    '[{"number":"稿号","title":"标题","status":"当前状态","submitted":"初始投稿日期","updated":"状态更新日期"}]',
    '要求：没有的字段给空串；不要编造页面上不存在的稿件；一篇文章一行；最多 200 条。',
    '识别到的系统类型提示: ' + plan.system,
    '',
    '=== 页面文本开始 ===',
    body,
    '=== 页面文本结束 ===',
  ].join('\n')
  const raw = await callLlmText(opts.llmService, opts.settingsService, prompt, opts.providerOverride, opts.modelOverride)
  const text = String(raw)
  let arr: any[] | null = null
  const mArr = text.match(/\[[\s\S]*\]/)
  const mObj = text.match(/\{[\s\S]*\}/)
  try {
    if (mArr) arr = JSON.parse(mArr[0])
    else if (mObj) {
      const o: any = JSON.parse(mObj[0])
      arr = Array.isArray(o?.items) ? o.items : Array.isArray(o?.submissions) ? o.submissions : null
    }
  } catch { arr = null }
  if (!Array.isArray(arr)) return []
  const subs: Submission[] = []
  for (const r of arr.slice(0, 200)) {
    const number = pcStr(r?.number, 120)
    const title = pcStr(r?.title, 500)
    if (!number && !title) continue
    subs.push({
      number: number || '(未识别稿号)',
      title: title || '(未识别标题)',
      submitted: pcNormDate(r?.submitted),
      statusDate: pcNormDate(r?.updated),
      status: pcStr(r?.status, 200) || '未知状态',
    })
  }
  return subs
}

/** 通用抓取器：非 EM 系统走这里（DOM 优先，0 条回退 LLM），status 里带上识别到的系统名。 */
/** 等列表行出现：命中即返回 true；超时返回 false（不抛）。 */
async function pg0WaitRows(page: any, sel: string, ms: number): Promise<boolean> {
    try {
        await page.waitForSelector(sel, { timeout: ms });
        return true;
    }
    catch {
        return false;
    }
}
async function scrapeGenericJournal(j: JournalConfig, plan: StructurePlan, opts: ScrapeEnv & {
  browserPath?: string
}): Promise<JournalResult> {
  const baseUrl = String(j.baseUrl)
  const system = String(plan?.system || 'other')
  // system 落到 'other' 时用更中性的标签，避免报告里出现「（未知投稿系统）」
  const sysLabel = system === 'other' ? '通用抓取' : pcSystemLabel(system)
  const listUrl = String(plan?.listUrl || '').trim()
  const planPath = pcStructurePath(baseUrl)
  if (!/^https?:\/\//i.test(listUrl)) {
    return {
      journal: j.name, system,
      error: sysLabel + '：结构识别结果里没有可用的投稿列表页（' + planPath + '），请重新点一次「登录一次」。',
    }
  }
  let browser: any = null
  try {
    browser = await launchChromium(opts.browserPath)
    const page = await openBrowserPage(browser)
    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (e) {
      return {
        journal: j.name, system,
        error: sysLabel + '：打开列表页失败（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240) +
          '；已复用登录态：' + pcProfileDir() + '（如过期请再点一次「登录一次」）',
      }
    }
    // [local patch 2026-10-22d] 等列表真正渲染出来（很多投稿系统是前端框架，domcontentloaded 时行还没出来）
    try {
        const rowSel0 = String(plan?.rowSelector || "").trim();
        if (rowSel0) await pg0WaitRows(page, rowSel0, 20000);
        else await new Promise((r) => setTimeout(r, 3000));
    }
    catch {
        await new Promise((r) => setTimeout(r, 2500));
    }
    let subs: Submission[] = []
    let how = 'DOM 选择器'
    try {
      subs = await pcExtractByPlan(page, plan)
    } catch { /* 静默 */ }
    if (!subs.length) {
      how = 'LLM 文本抽取'
      try {
        subs = await pcExtractByLlm(page, plan, {
          journalName: j.name,
          llmService: opts.llmService,
          settingsService: opts.settingsService,
          providerOverride: opts.providerOverride,
          modelOverride: opts.modelOverride,
        })
      } catch (e) {
        return {
          journal: j.name, system,
          error: sysLabel + '：DOM 和 LLM 都没抓到稿件（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240) +
            '；已复用登录态：' + pcProfileDir(),
        }
      }
    }
    if (!subs.length) {
      return {
        journal: j.name, system,
        error: sysLabel + '：列表页 ' + listUrl + ' 上没有解析到稿件（可能确实 0 条，也可能页面结构与识别结果不符）；已复用登录态：' + pcProfileDir() +
          '；可重新点「登录一次」刷新结构（' + planPath + '）。',
      }
    }
    // status 末尾附系统名，报告里一眼看出这条来自哪个系统。
    const tagged: Submission[] = subs.map((s) => ({
      ...s,
      status: [s.status, sysLabel ? '（' + sysLabel + '）' : ''].join(''),
    }))
    const sectionName = (plan.menuSections && plan.menuSections[0]) ? plan.menuSections[0] : sysLabel + ' 投稿列表'
    return {
      journal: j.name,
      system,
      sections: [{ name: sectionName, count: tagged.length, submissions: tagged }],
    }
  } catch (e) {
    return {
      journal: j.name, system,
      error: sysLabel + '：通用抓取异常（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240),
    }
  } finally {
    try { await browser?.close?.() } catch { /* 静默 */ }
  }
}

/** 抓取分流：有结构 plan 且不是 EM → 通用抓取器；EM / 没有 plan → 走 EM 逻辑（行为不变）。
 *  system='other' 的期刊：以前一律回退信号，现在只要登录后识别出了非 EM 系统就真的去抓（没有 plan 时行为不变）。 */
async function scrapeJournal(j: JournalConfig, browserPath?: string, env?: ScrapeEnv): Promise<JournalResult> {
  const st = pcReadStructure(j.baseUrl)
  const plan = st.plan
  const e = env ?? {}
  // [patch 2026-10-22h] 非 editorial-manager 的系统（taylorfrancis / scholarone / sNAPP …）走通用抓取器
  const sys0 = String(j.system ?? 'editorial-manager')
  if (sys0 !== 'editorial-manager') {
    if (plan && plan.system !== 'editorial-manager') return scrapeGenericJournal(j, plan, { browserPath, ...e })
    return { journal: j.name, system: sys0 }
  }
  if (!plan || plan.system === 'editorial-manager') return scrapeEmJournal(j, browserPath)
  return scrapeGenericJournal(j, plan, { browserPath, ...e })
}

/** 抓取前先探一下持久化 profile 里有没有有效会话：有就直接进业务页，不走 EM 表单登录。
 *  kind='em' 复用主菜单 frame；kind='authed-other' 说明登录态有了但站点不是 EM；kind='none' 走原流程。 */
async function pcDetectSession(page: any, baseUrl: string, dbg: string[]): Promise<{
  kind: 'em' | 'authed-other' | 'none'; frame?: any; url?: string
}> {
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } catch (e) {
    dbg.push('probeGoto=' + String(e).split('\n')[0])
    return { kind: 'none' }
  }
  for (let i = 0; i < 14; i++) {
    const f = page.frame({ name: 'content' })
    const fu = f ? String(f.url?.() ?? '') : ''
    const cfSettled = !!(f && fu && !fu.includes('about:blank'))
    if (f && /AuthorMainMenu|MainMenu/i.test(fu)) {
      const txt = await f.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')
      if (/submission/i.test(String(txt))) { dbg.push('probe=em-reuse'); return { kind: 'em', frame: f } }
    }
    // 页面上还挂着登录表单 → 肯定没登录，直接走原 EM 表单流程（不必再空等）。
    if (await pcHasLoginForm(page)) { dbg.push('probe=login-form'); return { kind: 'none' } }
    // 没有任何登录表单 + 正文有业务字样 → 已登录但不是 EM（例如 Taylor&Francis 作者中心）。
    // 注意：EM 新版外壳页（frameset）主文档自带「Main Menu / Submit a Manuscript」等文字，
    // content iframe 还没提交时这一条会先命中，把「已登录的 EM」误判成 authed-other，
    // 于是复用登录态的 EM 抓取直接放弃（报告里那句「不是 Editorial Manager 主菜单」）。
    // 因此：content iframe 存在时（EM 的 frameset 外壳）一律继续等它落定/变成主菜单，
    // 只有「根本没有 content iframe」（无 frameset 的其它系统）或等满轮数才判定 authed-other。
    if (!cfSettled && (i >= 2 && !f || i >= 13)) {
      const txt = String(await pcBodyText(page) || '')
      if (txt.trim().length >= 80 && /(submission|manuscript|dashboard|author|profile|account|welcome)/i.test(txt)) {
        dbg.push('probe=authed-other url=' + page.url())
        return { kind: 'authed-other', url: String(page.url?.() ?? '') }
      }
    }
    await page.waitForTimeout(700)
  }
  dbg.push('probe=none url=' + String(page.url?.() ?? ''))
  return { kind: 'none' }
}

/** 登录 EM 期刊并返回作者主菜单信息（用于「新增期刊」自动识别 name/sections）。 */
async function loginAndGetMenu(baseUrl: string, username: string, password: string, browserPath?: string): Promise<{
  title: string; bodyText: string; counts: Record<string, number>; links: Record<string, string>; error?: string
}> {
  const dbg: string[] = []
  const browser = await launchChromium(browserPath)
  try {
    const page = await openBrowserPage(browser)
    // 先看持久化 profile 里有没有有效会话（「登录一次」留下的 ORCID/SSO cookie）：有就直接进业务页。
    const probe = await pcDetectSession(page, baseUrl, dbg)
    let frame: any = null
    if (probe.kind === 'em' && probe.frame) {
      frame = probe.frame
      dbg.push('login=reused-profile')
    } else if (probe.kind === 'authed-other') {
      return { title: '', bodyText: '', counts: {}, links: {}, error: '已复用登录态（' + String(probe.url ?? '') + '），但打开的页面不是 Editorial Manager 主菜单；自动识别只支持 EM，其他投稿系统需要单独的解析适配器' }
    } else {
      await page.goto(`${baseUrl}/Default.aspx?pg=login.asp&username=`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      frame = await waitForFrame(page)
      if (!frame) return { title: '', bodyText: '', counts: {}, links: {}, error: '未找到登录 iframe' }
      dbg.push('frameUrl=' + frame.url())

      await frame.waitForSelector("input[name='username']", { state: 'attached', timeout: 20000 }).catch(() => {})
      await frame.evaluate(() => {
        const details = document.querySelector('#traditionalLoginCollapsible')
        if (details) (details as any).open = true
        const ud = document.querySelector('#userNamePasswordDiv')
        if (ud) ud.classList.remove('hideElement')
        const eb = document.querySelector('#emLoginButtonsDiv')
        if (eb) eb.classList.remove('hideElement')
      }).catch(() => {})
      await frame.waitForSelector("input[name='username']", { state: 'visible', timeout: 10000 }).catch(() => {})
      const uVisible = await frame.locator("input[name='username']").isVisible().catch(() => false)
      dbg.push('usernameVisible=' + uVisible)
      if (uVisible) {
        await frame.fill("input[name='username']", username).catch((e: any) => dbg.push('fillU=' + String(e).split('\n')[0]))
        await frame.fill("input[name='password']", password).catch((e: any) => dbg.push('fillP=' + String(e).split('\n')[0]))
        const ab = frame.locator("input[name='authorLogin']")
        await ab.click().catch((e: any) => dbg.push('clickA=' + String(e).split('\n')[0]))
      }
    }
    frame = await waitForMainMenu(page)
    if (!frame) return { title: '', bodyText: '', counts: {}, links: {}, error: '登录失败或未等到主菜单[' + dbg.join(' | ') + ']' }

    const title = await frame.evaluate(() => {
      const t = document.querySelector('h1, h2, .pageTitle, #pageTitle')
      return (t as any)?.innerText?.trim() || document.title || ''
    }).catch(() => '')
    const { counts, links } = await scrapeMenu(frame)
    const bodyText = await frame.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')
    return { title, bodyText, counts, links }
  } catch (e) {
    return { title: '', bodyText: '', counts: {}, links: {}, error: String(e) }
  } finally {
    await browser.close().catch(() => {})
  }
}

async function scrapeEmJournal(j: JournalConfig, browserPath?: string): Promise<JournalResult> {
  const dbg: string[] = []
  const browser = await launchChromium(browserPath)
  try {
    const page = await openBrowserPage(browser)
    // 先看持久化 profile 里有没有有效会话（「登录一次」留下的 ORCID/SSO cookie）：有就直接用，不走 EM 表单。
    const probe = await pcDetectSession(page, j.baseUrl, dbg)
    let frame: any = null
    if (probe.kind === 'em' && probe.frame) {
      frame = probe.frame
      dbg.push('login=reused-profile')
    } else if (probe.kind === 'authed-other') {
      // 登录态有了，但站点不是 Editorial Manager：表格/主菜单解析器抓不到，属于「解析适配器」的问题。
      return {
        journal: j.name,
        system: 'editorial-manager',
        error: '已复用登录态（' + String(probe.url ?? '') + '），但该站点不是 Editorial Manager 主菜单，当前解析适配器抓不到数据；可把该期刊 system 设为 other，或等解析适配器支持该投稿系统',
      }
    } else {
      await page.goto(`${j.baseUrl}/Default.aspx?pg=login.asp&username=`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      frame = await waitForFrame(page)
      if (!frame) return { journal: j.name, system: 'editorial-manager', error: '未找到登录 iframe' }
      dbg.push('frameUrl=' + frame.url())

      // 等 username 元素出现在 DOM（login.asp 异步渲染，先等 attached 不要求可见）。
      await frame.waitForSelector("input[name='username']", { state: 'attached', timeout: 20000 }).catch(() => {})
      // 主动展开传统登录折叠面板 + 移除 hideElement（CBM 的折叠显示由 JS 动态控制）。
      await frame.evaluate(() => {
        const details = document.querySelector('#traditionalLoginCollapsible')
        if (details) (details as any).open = true
        const ud = document.querySelector('#userNamePasswordDiv')
        if (ud) ud.classList.remove('hideElement')
        const eb = document.querySelector('#emLoginButtonsDiv')
        if (eb) eb.classList.remove('hideElement')
      }).catch(() => {})
      await frame.waitForSelector("input[name='username']", { state: 'visible', timeout: 10000 }).catch(() => {})
      const uVisible = await frame.locator("input[name='username']").isVisible().catch(() => false)
      dbg.push('usernameVisible=' + uVisible)
      if (uVisible) {
        await frame.fill("input[name='username']", j.username).catch((e: any) => dbg.push('fillU=' + String(e).split('\n')[0]))
        await frame.fill("input[name='password']", j.password).catch((e: any) => dbg.push('fillP=' + String(e).split('\n')[0]))
        const ab = frame.locator("input[name='authorLogin']")
        const abVisible = await ab.isVisible().catch(() => false)
        dbg.push('authorVisible=' + abVisible)
        await ab.click().catch((e: any) => dbg.push('clickA=' + String(e).split('\n')[0]))
      }
    }
    frame = await waitForMainMenu(page)
    if (!frame) return { journal: j.name, system: 'editorial-manager', error: '登录失败或未等到主菜单[' + dbg.join(' | ') + ']' }

    const { counts, links } = await scrapeMenu(frame)
    // 分区清单优先采用「自动识别」时 LLM 给出的组织结构：顺序、是否抓取、kind 都由它定
    // （决策历史分区 kind=decision，报告里只列最近 7 天决策的稿件）
    // structure 缺失（模型当年失败或旧配置）时回落到原来的确定性逻辑。
    // 配置里的 sections 保序优先，再按正则自动补充主菜单上的投稿分区。
    const st: any = (j as any).structure
    const stSections: { name: string; kind?: string; check?: boolean }[] = Array.isArray(st?.sections) ? st.sections : []
    const secNames: string[] = []
    const kindOf: Record<string, 'decision' | undefined> = {}
    const autoAdd = () => {
      for (const key of Object.keys(links)) {
        if (secNames.includes(key)) continue
        const kt = key.toLowerCase()
        if (!/(submission|revision|decision)/.test(kt)) continue
        if (/new submission|with production completed/.test(kt)) continue
        if ((counts[key] ?? 0) > 0 && links[key]) {
          secNames.push(key)
          if (/with a decision/i.test(key)) kindOf[key] = 'decision'
        }
      }
    }
    if (stSections.length) {
      // LLM 顺序；check=false 的不抓；主菜单上找不到的跳过（不报 href 错）。
      for (const s of stSections) {
        const nm = typeof s?.name === 'string' ? s.name : ''
        if (!nm || s.check === false || !links[nm] || secNames.includes(nm)) continue
        secNames.push(nm)
        if (s.kind === 'decision') kindOf[nm] = 'decision'
      }
      autoAdd()
    } else {
      for (const sec of j.sections) if (sec && !secNames.includes(sec)) secNames.push(sec)
      autoAdd()
    }
    const sections: SectionResult[] = []
    for (const secName of secNames) {
      const count = counts[secName] ?? 0
      const href = links[secName]
      const submissions: Submission[] = []
      const kind: 'decision' | undefined = kindOf[secName] ?? (/with a decision/i.test(secName) ? 'decision' : undefined)
      if (count > 0 && href) {
        await frame.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
        // 决策历史可能跨页，遍历全部分页；普通活跃分区一页即够。
        const parsed = kind === 'decision' ? await scrapeTableAllPages(frame) : await parseTable(frame)
        const rows = normalizeRows(parsed)
        // 转投/等待批准分区的 Current Status 列显示的是操作词（Reject/Decline），修正为「等待作者批准」。
        if (/waiting for author|transfer/i.test(secName)) {
          for (const s of rows) if (/^reject|^decline/i.test(s.status)) s.status = 'Awaiting Author Approval'
        }
        submissions.push(...rows)
      }
      sections.push({ name: secName, count, submissions, kind })
    }
    return { journal: j.name, system: 'editorial-manager', sections, groups: Array.isArray(st?.groups) ? st.groups : [] } as any
  } catch (e) {
    return { journal: j.name, system: 'editorial-manager', error: String(e) }
  } finally {
    await browser.close().catch(() => {})
  }
}

// ============ 报告与通知 ============
/** 稿件阶段：production（生产中）/ revision（修改中）/ submission（审稿中）。 */
type Stage = 'submission' | 'revision' | 'production'
const STAGE_ZH: Record<Stage, string> = { submission: '审稿', revision: '修改', production: '生产' }
function stageOf(secName: string, status: string): Stage {
  const t = (secName + ' ' + status).toLowerCase()
  if (t.includes('production')) return 'production'
  if (t.includes('revis')) return 'revision'
  return 'submission'
}

/** [patch 2026-10-22t] 已结束投稿的默认追溯范围（月）。 */
const DEFAULT_ENDED_MONTHS = 1
/** [patch 2026-10-22t] 「已结束」状态：接受/拒稿/发表/撤稿/转投等。 */
function pcIsEndedStatus(status: string | undefined): boolean {
  const t = String(status || '').toLowerCase()
  return /accept|reject|publish|withdraw|declin|transfer|complet|发表|出版|已拒|拒稿|接受|录用|撤回/.test(t)
}
/** [patch 2026-10-22t] 日期是否在最近 months 个月内（最小 1 个月）。 */
function pcWithinMonths(today: Date, dateStr: string | undefined, months: number): boolean {
  const d = parseEmDate(dateStr)
  if (!d) return false
  const cut = new Date(today.getTime())
  cut.setMonth(cut.getMonth() - Math.max(1, Number(months) || DEFAULT_ENDED_MONTHS))
  return d.getTime() >= cut.getTime()
}
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
/** 解析 EM 常见日期格式（YYYY-MM-DD / MM/DD/YYYY / Mon DD YYYY / DD Mon YYYY / 带时间后缀），失败返回 null。 */
function parseEmDate(s: string | undefined): Date | null {
  const t = (s || '').trim()
  if (!t) return null
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[1] - 1, +m[2])
  m = t.match(/^([A-Za-z]{3,9})[.\s]+(\d{1,2}),?\s+(\d{4})/)
  if (m) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)]
    if (mon !== undefined) return new Date(+m[3], mon, +m[2])
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})[.\s]+(\d{4})/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)]
    if (mon !== undefined) return new Date(+m[3], mon, +m[1])
  }
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d
}

/** [patch 2026-10-22t] 已结束分区：只保留决策日期在最近 months 个月内的稿件（日期无法解析则视为历史，不列）。 */
function recentDecisions(subs: Submission[], today: Date, months: number): Submission[] {
  return subs.filter((s) => pcWithinMonths(today, s.statusDate, months))
}

function formatReport(results: JournalResult[], dateStr: string, endedMonths: number = DEFAULT_ENDED_MONTHS): string {
  // [patch 2026-10-22t] 已结束投稿的追溯月数（配置 endedMonths，最小 1）
  const endMonths = Math.max(1, Number(endedMonths) || DEFAULT_ENDED_MONTHS)
  const lines: string[] = [`📊 每日投稿状态报告 (${dateStr})`, '']
  let total = 0
  let decisionTotal = 0
  const stageCounts: Record<Stage, number> = { submission: 0, revision: 0, production: 0 }
  const today = new Date()
  for (const r of results) {
    lines.push(`**${r.journal}:**`)
    if (r.error) {
      lines.push(`- ⚠️ ${r.error}`)
      continue
    }
    // 通用抓取器成功时 system 可能是 'other'/sNAPP 等；只有「没有抓取结果」才走人工兜底提示
    if (r.system === 'other' && !(r.sections ?? []).length) {
      lines.push('- 需 AI 手动检查（非 Editorial Manager，请用浏览器工具或 check_paper_status 交互式处理）')
      continue
    }
    const sections = r.sections ?? []
    // 报告分节：structure.groups 里每一组的第一个分区之前插入组标题
    const groupsOf: { title: string; sections: string[] }[] = Array.isArray((r as any).groups) ? (r as any).groups : []
    const groupOf = (n: string) => groupsOf.find((g) => Array.isArray(g.sections) && g.sections.includes(n))?.title ?? ''
    let lastGroup = ''
    const secLines: string[] = []
    let hasContent = false
    for (const sec of sections) {
      const gName = groupOf(sec.name)
      if (gName && gName !== lastGroup) { secLines.push('### ' + gName); lastGroup = gName }
      const subs = sec.submissions ?? []
      // 决策历史分区：只列最近 7 天内的决策，独立分组，不计入活跃投稿。
      if (sec.kind === 'decision') {
        const recent = recentDecisions(subs, today, endMonths)
        if (recent.length === 0) continue
        hasContent = true
        decisionTotal += recent.length
        secLines.push(`- 📂 已结束（最近 ${endMonths} 个月）`)
        for (const s of recent) {
          const parts: string[] = []
          if (s.statusDate) parts.push(`决策 ${s.statusDate}`)
          secLines.push(`  - [${zh(s.status)}] ${s.number}: ${s.title}${parts.length ? '（' + parts.join('，') + '）' : ''}`)
        }
        continue
      }
      if (subs.length === 0) {
        if ((sec.count ?? 0) > 0) secLines.push(`- ⚠️ ${sec.name}（计数 ${sec.count}，未抓到稿件列表）`)
        continue
      }
      hasContent = true
      secLines.push(`- 📂 ${sec.name}（${sec.count}）`)
      for (const s of subs) {
        // [patch 2026-10-22t] 已结束且超出追溯窗口的稿件不再列出
        if (pcIsEndedStatus(s.status) && !pcWithinMonths(today, s.statusDate, endMonths)) continue
        const stage = stageOf(sec.name, s.status)
        stageCounts[stage]++
        total++
        const parts: string[] = []
        if (s.submitted) parts.push(`投稿 ${s.submitted}`)
        if (s.statusDate) parts.push(`更新 ${s.statusDate}`)
        if (s.revDue) parts.push(`截止 ${s.revDue}`)
        secLines.push(`  - [${zh(s.status)}] ${s.number}: ${s.title}${parts.length ? '（' + parts.join('，') + '）' : ''}`)
      }
    }
    if (!hasContent) {
      lines.push('- 无活跃投稿（所有分区计数均为 0）。')
      lines.push('')
      continue
    }
    lines.push(...secLines)
    lines.push('')
  }
  const stageSummary = (['submission', 'revision', 'production'] as Stage[])
    .filter((k) => stageCounts[k] > 0)
    .map((k) => `${STAGE_ZH[k]} ${stageCounts[k]} 篇`)
  let summary = `**摘要:** 共 ${total} 篇活跃投稿${stageSummary.length ? '（' + stageSummary.join(' · ') + '）' : ''}`
  if (decisionTotal > 0) summary += ` · 近期决策 ${decisionTotal} 篇`
  lines.push(summary + '。')
  return lines.join('\n')
}

function pushServerChan(key: string, title: string, desp: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!key) return resolve(false)
    const body = JSON.stringify({ title, desp })
    const req = https.request({
      hostname: 'sctapi.ftqq.com', path: `/${key}.send`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, (res) => {
      let buf = ''
      res.on('data', (chunk) => { buf += chunk })
      res.on('end', () => {
        // Server酱：HTTP 200 不代表成功，业务 code===0 才是
        try {
          const parsed = JSON.parse(buf)
          // [patch 2026-10-22j] 失败时把返回体记下来
          const okPush = res.statusCode === 200 && parsed && parsed.code === 0
          if (!okPush) { try { log(defaultReportDir(), '微信推送失败详情: status=' + res.statusCode + ' body=' + String(buf).slice(0, 300)) } catch {} }
          resolve(okPush)
        } catch {
          resolve(res.statusCode === 200)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.write(body)
    req.end()
  })
}

/** 'HH:mm' → 当天分钟数（补跑判断用）。 */
function tMin(s: string): number {
  const [h, m] = String(s ?? '').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ============ 主检查流程 ============
async function runCheck(config: Config, env?: ScrapeEnv): Promise<JournalResult[]> {
  const results: JournalResult[] = []
  for (const j of config.journals) {
    results.push(await scrapeJournal(j, config.browserPath, env))
  }
  return results
}

// ============ 对话内汇报 ============
/** 从会话事件里取第一条用户文本作为回退标题。 */
function fallbackSessionTitle(session: any): string {
  try {
    for (const e of session.events ?? []) {
      if (e.type === 'user/message' && e.data?.message?.kind === 'user') {
        for (const block of e.data.message.content ?? []) {
          if (block.type === 'text' && block.text) {
            const t = String(block.text).replace(/\s+/g, ' ').trim()
            return t.length > 32 ? t.slice(0, 32) + '…' : t
          }
        }
      }
    }
  } catch { /* 静默 */ }
  return '(未命名)'
}

/** 列出当前 live 会话（sessionId + cwd + 标题），供设置面板选择汇报目标。 */
/**
 * 从设置命名空间重算 provider/模型列表：DSH 0.2 客户端已不再暴露 connection.api.llm.models。
 * 命名空间名（如 llm-deepseek-account）不是 provider id，只有与 agent-default-model 一致的才用真实 id 标注。
 * 其余不猜——错的 id 下发只会让「模型识别」静默失败。 */
async function buildModelGroupsPC(llmService: any, settingsService: any): Promise<any[]> {
  const out: any[] = []
  const seen = new Set<string>()
  let defProvider = ''
  let defModel = ''
  try {
    const dm = settingsService?.get?.('agent-default-model')
    defProvider = dm?.provider ?? ''
    defModel = dm?.model ?? ''
  } catch { /* 忽略 */ }
  const push = (id: string, name: string, models: any[]) => {
    if (!id) return
    const list = (models ?? []).map((m: any) => ({ id: String(m?.id ?? m ?? ''), name: String(m?.name ?? m?.id ?? m ?? '') })).filter((m: any) => !!m.id)
    // 目录为空也要保留 provider：面板模型下拉有「识别模型（默认）」兜底，选空即用该 provider 的第一个模型
    const existing = out.find((g) => g.id === id)
    if (existing) {
      // 可配置 provider 目录先以空模型登记，后面 settings 的 providers 声明里有模型要补进来
      if (!existing.models.length && list.length) existing.models = list
      if ((!existing.name || existing.name === existing.id) && name) existing.name = name
      return
    }
    seen.add(id)
    out.push({ id, name: name || id, models: list })
  }
  // 1) 真源：LLM 运行时注册表 listProviders()/listModels()。官方 DeepSeek 账号（provider id = deepseek-account）
  //    这类内置 provider 只存在于运行时，settings 里根本查不到 → 早先只扫 settings 才会出现"下拉里没有官方账号"。
  try {
    const provs = typeof llmService?.listProviders === 'function' ? llmService.listProviders() : []
    for (const p of provs ?? []) {
      const id = String(p?.id ?? p?.provider ?? '')
      if (!id) continue
      let models: any[] = []
      try {
        const list = await llmService.listModels(id)
        models = Array.isArray(list) ? list : []
      } catch { /* 该 provider 没有模型目录：留给后面的目录/设置补齐 */ }
      push(id, String(p?.name ?? p?.displayName ?? p?.label ?? id), models)
    }
  } catch { /* 静默 */ }
  // 1b) 可配置 provider 目录（未激活也有声明）。settingsNs ≠ provider id：例如 settingsNs 是 'llm-deepseek-account'、
  //     真正的 provider 是 'deepseek-account'。把设置命名空间当 provider id 下发出去，正是识别静默失败（空输出）的根因。
  try {
    const dir = typeof llmService?.listConfigurableProviders === 'function' ? llmService.listConfigurableProviders() : []
    for (const e of dir ?? []) {
      const id = String(e?.provider ?? e?.id ?? '')
      if (!id) continue
      let models: any[] = []
      try {
        const list = await llmService.listModels(id)
        models = Array.isArray(list) ? list : []
      } catch { /* 未激活时没有目录 */ }
      push(id, String(e?.displayName ?? e?.name ?? id), models)
    }
  } catch { /* 静默 */ }
  // 2) 设置里声明的 providers（部分可配置 provider 只在设置里声明）
  try {
    const rows = typeof settingsService?.describe === 'function' ? settingsService.describe() : []
    for (const d of rows ?? []) {
      const v = d?.value
      if (!v || typeof v !== 'object') continue
      const provs = v.providers
      if (!provs || typeof provs !== 'object') continue
      for (const k of Object.keys(provs)) {
        const p = provs[k] ?? {}
        // [local patch 2026-10-22] 没配 API key 的 provider 是死的：不进下拉
        if (!pcProviderKeyOkPC(p)) continue
        push(k, p.name || k, Array.isArray(p.models) ? p.models : [])
      }
    }
    for (const d of rows ?? []) {
      const v = d?.value
      if (!v || typeof v !== 'object') continue
      if (v.providers && typeof v.providers === 'object') continue
      if (!Array.isArray(v.models) || !v.models.length) continue
      const ids = v.models.map((m: any) => m?.id ?? String(m))
      if (defModel && defProvider && ids.includes(defModel)) push(defProvider, defProvider, v.models)
      else if (!defModel) push(d.ns, d.ns, v.models)
    }
  } catch { /* 静默 */ }
  // 3) 兜底：默认 provider 至少出现在下拉里，否则面板只剩"默认"一项
  if (defProvider && !seen.has(defProvider)) push(defProvider, defProvider, defModel ? [{ id: defModel, name: defModel }] : [])
    // [local patch 2026-10-22c] 排序：官方 DeepSeek 账号排第一（用户默认用它识别），其次 agent-default-model 的 provider，其余按 id
  const pcRank = (id: string): number => {
    const s0 = String(id || "").toLowerCase();
    if (s0 === "deepseek-account") return 0;
    if (defProvider && s0 === String(defProvider).toLowerCase()) return 0.5;
    if (s0.indexOf("deepseek") === 0) return 1;
    return 2;
  };
  out.sort((a: any, b: any) => {
    const ra = pcRank(a.id);
    const rb = pcRank(b.id);
    if (ra !== rb) return ra - rb;
    return String(a.id).localeCompare(String(b.id));
  })
  // [local patch 2026-10-22] 只留「有模型目录」的 provider（默认 provider 例外）
  return out.filter((g: any) => (g.models && g.models.length > 0) || g.id === defProvider)
}

/** [local patch 2026-10-22] provider 是否真的能用：apiKeyEnv 缺失即死配置。 */
function pcProviderKeyOkPC(p: any): boolean {
  try {
    if (!p || typeof p !== 'object') return true
    if (typeof p.apiKey === 'string' && p.apiKey.trim()) return true
    if (typeof p.apiKeyEnv === 'string' && p.apiKeyEnv.trim()) {
      const k = p.apiKeyEnv.trim()
      return !!(typeof process !== 'undefined' && process.env && process.env[k])
    }
    return true
  } catch { return true }
}

/** provider id 是否真的可用：运行时注册表 + 可配置目录（settingsNs 不算）。 */
function pcValidProviderPC(llmService: any, id: string, settingsService?: any): boolean {
  const want = String(id ?? '')
  if (!want) return false
  try {
    const provs = typeof llmService?.listProviders === 'function' ? llmService.listProviders() : []
    if ((provs ?? []).some((p: any) => String(p?.id ?? p?.provider ?? '') === want)) return true
    const dir = typeof llmService?.listConfigurableProviders === 'function' ? llmService.listConfigurableProviders() : []
    if ((dir ?? []).some((e: any) => String(e?.provider ?? e?.id ?? '') === want)) return true
    // pi-ai 这类可配置 provider：没激活时不在运行时注册表里，但设置在 providers 里声明过，用户选它是合法的
    const rows = typeof settingsService?.describe === 'function' ? settingsService.describe() : []
    for (const d of rows ?? []) {
      const provs2 = d?.value?.providers
      if (provs2 && typeof provs2 === 'object' && Object.prototype.hasOwnProperty.call(provs2, want)) return true
    }
    return false
  } catch { return false }
}
/** 从会话索引读取 cwd（冷会话未载入，sessions.get() 给不出 cwd）。 */
function cwdFromIndexPC(sessionId: string): string {
  try {
    const raw = String(sessionId || '')
    const base = raw.startsWith('session-') ? raw : 'session-' + raw
    const j2 = JSON.parse(readFileSync(join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions', base + '.json'), 'utf8'))
    return j2?.record?.identity?.cwd ?? ''
  } catch { return '' }
}

/**
 * 列出全部会话：live 的来自 sessions 服务，其余来自 DSH 的会话索引。
 * （~/.dsh/storages/session_projcache/sessions），未打开的标注「（未打开）」。
 * 索引里的 id 保留 'session-' 前缀，才能与 live 会话去重、并直接交给 ensureSession。 */
function listAllSessionsPC(agents: any, sessions: any, sessionTitle: any): any[] {
  const out: any[] = []
  const seen = new Set<string>()
  try {
    for (const s of sessions.list() ?? []) {
      let title = ''
      try { title = sessionTitle?.get?.(s)?.title ?? fallbackSessionTitle(s) } catch { title = '' }
      out.push({
        sessionId: s.id,
        cwd: s.header?.cwd ?? '',
        title: (title && String(title).trim()) || '(未命名)',
        running: agents?.get?.(s.id)?.status === 'running',
        live: true,
      })
      seen.add(s.id)
    }
  } catch { /* 静默 */ }
  try {
    const dir = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')
    const rows: any[] = []
    for (const n of readdirSync(dir)) {
      if (!/^session-.+\.json$/.test(n)) continue
      const id = n.slice(0, -5)
      if (seen.has(id)) continue
      try {
        const j3 = JSON.parse(readFileSync(join(dir, n), 'utf8'))
        const r = j3?.record ?? {}
        const t = r.rows?.title?.val
        rows.push({
          sessionId: id,
          cwd: r.identity?.cwd ?? '',
          title: ((typeof t === 'string' && t.trim()) ? t.trim() : '(未命名)') + '（未打开）',
          running: false,
          live: false,
          at: r.identity?.createdAt ?? 0,
        })
      } catch { /* 跳过坏条目 */ }
    }
    rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    for (const r of rows) out.push(r)
  } catch { /* 静默 */ }
  return out
}

function listLiveSessions(agents: any, sessions: any, sessionTitle: any): any[] {
  const out: any[] = []
  try {
    for (const s of sessions.list() ?? []) {
      const title = sessionTitle?.get?.(s)?.title ?? fallbackSessionTitle(s)
      out.push({
        sessionId: s.id,
        cwd: s.header?.cwd ?? '',
        title,
        running: agents?.get?.(s.id)?.status === 'running',
      })
    }
  } catch { /* 静默 */ }
  out.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'))
  return out
}

/** 往指定 live 会话注入一条用户消息（报告），触发 agent 简短确认。返回 'ok' 或失败原因。 */
/**
 * 往指定会话注入一条用户消息（报告）。会话未打开时用宿主 agents 服务
 * ensureSession(sessionId, cwd, checkPersistedIdentity) 按需载入（它返回 live agent），
 * 所以目标会话不必提前打开。返回 'ok' 或失败原因。 */
async function reportToSession(agents: any, sessions: any, sessionId: string, report: string): Promise<string> {
  // [patch 2026-10-22e] public host entry: sessionController.prompt resumes a cold session then followup
  try {
    const __sc0: any = (__pcSCRef as any) || ((__pcCtx && typeof (__pcCtx as any).get === "function") ? (__pcCtx as any).get("sessionController") : null)
    if (__sc0 && typeof __sc0.prompt === "function" && sessionId) {
      await __sc0.prompt({ sessionId, content: [{ type: "text", text: "\u23f0 \u6bcf\u65e5\u6295\u7a3f\u72b6\u6001\u81ea\u52a8\u6c47\u62a5\uff08\u63d2\u4ef6 dsh-paper-checker\uff09\uff1a\n\n" + report + "\n\n\u2014\u2014\u8bf7\u4e00\u53e5\u8bdd\u786e\u8ba4\u6536\u5230\u5373\u53ef\uff0c\u4e0d\u8981\u91cd\u65b0\u68c0\u67e5\u3001\u4e0d\u8981\u8c03\u7528\u5de5\u5177\u3002" }] }, { kind: "user" })
      return "ok"
    }
  } catch (e) {
    try { log(defaultReportDir(), "[delivery] prompt channel failed: " + String(e).slice(0, 200)) } catch {}
  }
  const __pcPre = await (async () => {
    try {
      const quick = (agents && typeof agents.get === "function") ? agents.get(sessionId) : null;
      if (quick && typeof quick.followup === "function") return quick;
      let cwd0 = "";
      try { cwd0 = cwdFromIndexPC(sessionId) || ""; } catch (e: any) { cwd0 = ""; }
      await __pcLoadSession(sessionId, cwd0);
      const a0 = await __pcAwaitAgent(sessionId, 8000);
      return a0;
    } catch (e: any) { return null; }
  })();
  if (__pcPre && typeof __pcPre.followup === "function") {
    try { __pcPre.followup(__pcBuildMsg(report)); return "ok"; } catch (e: any) { /* 落到原逻辑 */ }
  }
  if (!sessionId) return '未配置汇报会话'
  let agent = agents?.get?.(sessionId)
  if (!agent || typeof agent.followup !== 'function') {
    try {
      if (typeof agents?.ensureSession === 'function') {
        let cwd = ''
        try { cwd = sessions?.get?.(sessionId)?.header?.cwd || '' } catch { cwd = '' }
        if (!cwd) cwd = cwdFromIndexPC(sessionId)
        agent = await agents.ensureSession(sessionId, cwd, true)
      }
    } catch { /* 落到下面的错误信息 */ }
  }
  if (!agent || typeof agent.followup !== 'function') agent = agents?.get?.(sessionId)
  if (!agent || typeof agent.followup !== 'function') {
    return `会话 ${sessionId} 无法载入（非 live，且 ensureSession 未成功）`
  }
  const message = createUserMessage({
    content: [{
      type: 'text',
      text: '📊 每日投稿状态自动汇报（插件 dsh-paper-checker）：\n\n' + report +
        '\n\n——请一句话确认收到即可，不要重新检查、不要调用工具。',
    }],
    source: { kind: 'user' },
  })
  agent.followup(message)
  return 'ok'
}

// ============ 新增期刊自动识别 ============
/** 调 LLM 生成一段文本（provider/model 可覆盖；为空则读 agent-default-model）。 */
async function callLlmText(llmService: any, settingsService: any, prompt: string, providerOverride?: string, modelOverride?: string): Promise<string> {
  let provider = 'deepseek-official'
  let model = 'deepseek-v4-pro'
  try {
    const dm = settingsService?.get?.('agent-default-model')
    if (dm?.provider) provider = dm.provider
    if (dm?.model) model = dm.model
  } catch { /* 用默认 */ }
  if (providerOverride) {
    provider = providerOverride
    if (modelOverride) {
      model = modelOverride
    } else {
      // 只指定 provider：取该 provider 目录里的第一个模型，避免错配全局默认的 model。
      try {
        const models = await llmService.listModels(providerOverride)
        if (Array.isArray(models) && models.length > 0) model = models[0].id
      } catch { /* 保持 agent-default-model 的 model */ }
    }
  } else if (modelOverride) {
    model = modelOverride
  }

  const messages = [createUserMessage({
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'user' },
  })]
  // 先尝试 reasoningEffort 'off'（省 token、关闭思考）；空输出（不支持 off / reasoning 占满）则回退到不传（adapter 默认）。
  for (const effort of ['off', undefined] as const) {
    const out: string[] = []
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 180000)
    try {
      const stream = llmService.stream({
        provider, model,
        ...effort === undefined ? {} : { reasoningEffort: effort },
        messages,
        maxTokens: 8000,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk?.type === 'text-delta' && chunk.text) out.push(chunk.text)
      }
    } catch (e) {
      // 以前这里只有 finally，异常被上层吞成「模型没有返回 JSON: 」；把 provider/model 和真实原因带出去
      const msg = String((e as any)?.message ?? e).split('\n')[0]
      throw new Error('模型调用失败（' + provider + (model ? ' / ' + model : '') + '）：' + msg.slice(0, 300))
    } finally {
      clearTimeout(timer)
    }
    if (out.length > 0) return out.join('')
  }
  return ''
}

/** 分析 EM 主菜单文本，识别期刊名 + 系统类型（分区由页面确定性探测提供，不依赖模型，避免认错）。 */
/** LLM 识别出的主菜单组织结构（存进期刊配置的 structure 字段）。 */
interface MenuStructure {
  name: string
  system: string
  groups: { title: string; sections: string[] }[]
  sections: { name: string; kind: string; check: boolean }[]
}

/**
 * 让 LLM 识别整份主菜单的组织结构：刊名、系统类型、分区清单、分组、每个分区是否值得抓取。
 * 定位：LLM 只做"挑名字 + 分类 + 排序"，不做发明与计数——
 *   · 分区名必须逐字来自真实抓到的链接名，本函数会再校验一次，编出来的名字一律丢弃；
 *   · 计数一律使用页面确定性值，不信模型给的数字。
 *   · 模型漏掉但页面确实存在的投稿分区，按旧的确定性规则补在末尾，避免丢分区。 */
async function analyzeJournalMenu(llmService: any, settingsService: any, baseUrl: string, menu: { title?: string; bodyText?: string; counts?: Record<string, number>; links?: Record<string, string> }, providerOverride?: string, modelOverride?: string): Promise<{ structure?: MenuStructure; error?: string }> {
  const counts = menu.counts ?? {}
  const linkNames = Object.keys(menu.links ?? menu.counts ?? {})
  const menuList = linkNames.map((n) => '- ' + n + (counts[n] !== undefined ? ' (' + counts[n] + ')' : '')).join('\n')
  const prompt = [
    '你是学术期刊投稿系统配置助手。下面是某投稿系统登录后「作者主菜单」的全部链接名与菜单文本。',
    '请识别：期刊名、系统类型，以及整个主菜单的组织结构（分区清单与分组），供后续每日检查程序直接使用。',
    '',
    '硬性要求：',
    '1. sections[].name 必须逐字取自下面「链接名清单」中的某一项，不要改写、不要翻译、不要发明；',
    '2. 只有“稿件列表类”分区才 check=true；发起新投稿的入口（如 New Submissions）、已完成/归档、任务分配类一律 check=false；',
    '3. kind 取值：active（处理中）、revision（修改中）、decision（已决策历史）、entry（投稿入口）、archive（已完成归档）、other；',
    '4. sections 按菜单阅读顺序排列；',
    '5. groups[].sections 必须是 sections[].name 的子集，用于报告分节展示；',
    '6. 只输出一个 JSON 对象，不要 markdown 代码块、不要多余说明。',
    '',
    '站点地址：' + baseUrl,
    '页面标题：' + (menu.title || '(无)'),
    '',
    '链接名清单：',
    menuList.slice(0, 4000),
    '',
    '菜单文本：',
    String(menu.bodyText ?? '').slice(0, 4000),
    '',
    'JSON 格式：',
    '{"name":"期刊名","system":"editorial-manager","groups":[{"title":"分组名","sections":["分区名"]}],"sections":[{"name":"分区名","kind":"active","check":true}]}',
  ].join('\n')
  const text = await callLlmText(llmService, settingsService, prompt, providerOverride, modelOverride)
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return { error: '模型未返回有效 JSON: ' + text.slice(0, 200) }
  try {
    const obj = JSON.parse(m[0])
    const allowed = new Set(linkNames)
    const seen = new Set<string>()
    const secs: { name: string; kind: string; check: boolean }[] = []
    for (const s of Array.isArray(obj.sections) ? obj.sections : []) {
      const nm = typeof s?.name === 'string' ? s.name.trim() : ''
      if (!nm || !allowed.has(nm) || seen.has(nm)) continue
      seen.add(nm)
      secs.push({ name: nm, kind: typeof s?.kind === 'string' ? s.kind : 'other', check: s?.check !== false })
    }
    for (const nm of linkNames) {
      if (seen.has(nm)) continue
      const kt = nm.toLowerCase()
      if (!/(submission|revision|decision)/.test(kt)) continue
      if (/new submission|with production completed|task assignment/.test(kt)) continue
      if ((counts[nm] ?? 0) <= 0) continue
      seen.add(nm)
      secs.push({ name: nm, kind: /with a decision/i.test(nm) ? 'decision' : 'active', check: true })
    }
    const groups = (Array.isArray(obj.groups) ? obj.groups : [])
      .map((g: any) => ({ title: typeof g?.title === 'string' ? g.title : '', sections: (Array.isArray(g?.sections) ? g.sections : []).filter((x: any) => typeof x === 'string' && seen.has(x)) }))
      .filter((g: any) => g.sections.length > 0)
    return {
      structure: {
        name: typeof obj.name === 'string' ? obj.name.trim() : '',
        system: typeof obj.system === 'string' ? obj.system.trim() : '',
        groups,
        sections: secs,
      },
    }
  } catch (e) {
    return { error: 'JSON 解析失败: ' + String(e) + ' | ' + text.slice(0, 200) }
  }
}

// ============ 插件入口 ============
export function apply(ctx: AppContext, config: Config): void {
  // settings 化：配置可运行时读写 + 持久化到 settings.yaml（UI 可编辑）
  let getConfigRaw: () => Config = () => config
  // [patch 2026-10-22p] 配置热更新：所有运行时读取都合并落盘的 cordis.patch.yml，
  // 所以面板保存后立刻用新配置，无需重启 DSH。
  const getConfigMerged = (): Config => {
    const base = getConfigRaw()
    try {
      const p = readPersistedPC()
      if (!p) return base
      const merged: any = { ...(base as any), ...p }
      try { return Config(merged) as any } catch (e) { return merged as Config }
    } catch (e) { return base }
  }
  const getConfig = (): Config => getConfigMerged()
  installSettingsSection(ctx, 'paper-checker', Config, config, {
    setSource: (fn: any) => { getConfigRaw = fn as () => Config },
    onChange: () => {},
  })

  const reportDir = () => getConfig().reportDir || defaultReportDir()
  // [patch 2026-10-22e] capture service refs while active
  try { __pcSCRef = ctx.get("sessionController") } catch {}
  try { __pcAgentsRef = ctx.agents } catch {}
  try { __pcSessionsRef = ctx.sessions } catch {}
  mkdirSync(reportDir(), { recursive: true })

  // 自定义配置 API：绕开 apiproxy 的 settings 白名单（paper-checker 不在 WEB_SETTINGS_NAMESPACES，
  // 所以 describe/mutate 会被 notExposed 拦截），改由 webServer 直连 host 内部 settings 服务。
  let settingsService: any = null
  ctx.inject(['settings'], (sctx: any) => { settingsService = sctx.settings })
  let sessionTitleService: any = null
  ctx.inject(['sessionTitle'], (sctx: any) => { sessionTitleService = sctx.sessionTitle })

  // 第二步（通用抓取器）的 LLM 环境：结构识别与「0 条回退」都走插件已有的 callLlmText，
  // provider/model 复用面板上的「识别用模型」（discoverProvider / discoverModel）。
  const pcScrapeEnv = (cfg?: Config): ScrapeEnv => {
    const c = cfg ?? getConfig()
    let providerOverride = c.discoverProvider || undefined
    let modelOverride = c.discoverModel || undefined
    // provider 不在运行时注册表里就别往下透传：llm.stream 会静默吐空文本，
    // 面板最后只看到「模型没有返回 JSON: 」这种没法排查的错。这里回退到 agent-default-model。
    if (providerOverride && !pcValidProviderPC(ctx.llm, providerOverride, settingsService)) {
      try { log(reportDir(), '识别 provider 未注册，回退默认模型: ' + String(providerOverride)) } catch { /* 静默 */ }
      providerOverride = undefined
      modelOverride = undefined
    }
    return {
      llmService: ctx.llm,
      settingsService,
      providerOverride,
      modelOverride,
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/paper-checker/api',
    handler: async (req: any, res: any) => {
      const send = (code: number, obj: any) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(obj))
      }
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const p = url.pathname.replace(/^\/paper-checker\/api/, '') || '/'
        if (req.method === 'GET' && p === '/config') {
          if (!settingsService?.describe) return send(500, { ok: false, error: 'settings 服务不可用' })
          const desc = settingsService.describe().find((d: any) => d.ns === 'paper-checker')
          const modelGroups = await (async () => { try { return await buildModelGroupsPC(ctx.llm, settingsService) } catch { return [] } })()
          const baseCfg: any = { ...(desc?.value ?? getConfig()) }
          // 落盘值只补「运行态缺失」的字段。早期实现是整体覆盖，结果面板里刚删掉的期刊会在下次 GET 时
          // 被 cordis.patch.yml 里的旧快照盖回来——用户看到的"删除期刊失效"就是这么来的。
          try {
            const pp = readPersistedPC()
            if (pp && typeof pp === 'object') for (const k of Object.keys(pp)) {
              const cur = baseCfg[k]
              const missing = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0)
              if (missing) baseCfg[k] = pp[k]
            }
          } catch { /* 落盘读取失败不影响主流程 */ }
          // 历史配置里可能存着无效 provider（被当成 provider id 的设置命名空间名）：显示为空，回退默认模型
          if (baseCfg.discoverProvider && !pcValidProviderPC(ctx.llm, baseCfg.discoverProvider, settingsService)) {
            baseCfg.discoverProvider = ''
            baseCfg.discoverModel = ''
          } else if (baseCfg.discoverProvider) {
            const g = modelGroups.find((x: any) => x.id === baseCfg.discoverProvider)
            const ids = new Set(((g && g.models) || []).map((m: any) => String(m.id)))
            if (baseCfg.discoverModel && ids.size > 0 && !ids.has(String(baseCfg.discoverModel))) baseCfg.discoverModel = ''
          }
          return send(200, {
            ok: true,
            config: baseCfg,
            revision: desc?.revision ?? 0,
            // 面板要的会话列表、provider/模型列表统一由 /config 下发：客户端 0.2 拿不到
            // llm.models，sessions 路径在渲染进程里也会静默失败。
            sessions: (() => { try { return listAllSessionsPC(ctx.agents, ctx.sessions, sessionTitleService) } catch { return [] } })(),
            modelGroups,
          })
        }
        if (req.method === 'GET' && p === '/sessions') {
          return send(200, { ok: true, sessions: listLiveSessions(ctx.agents, ctx.sessions, sessionTitleService) })
        }
        if (req.method === 'POST' && p === '/config') {
          const body = JSON.parse(await readBody(req))
          const value = body?.config
          const expectedRevision = body?.expectedRevision
          if (!settingsService?.mutate) return send(500, { ok: false, error: 'settings 服务不可用' })
          // DSH 的 mutate 是**字段级编辑**（docs: ordered form edits）——单个根 op（path: []）会被静默丢弃，
          // 表现是返回 ok、revision 递增、值不变。这里改为逐字段 op。
          const opsPC = Object.keys(value ?? {}).map((k: string) => ({ op: 'set', path: [k], value: (value as any)[k] }))
          await settingsService.mutate('paper-checker', opsPC.length ? opsPC : [{ op: 'set', path: [], value }], expectedRevision)
          const desc = settingsService.describe().find((d: any) => d.ns === 'paper-checker')
          // 写后回读校验：DSH 的写入是字段级 volatile 判定，非 volatile 字段会被静默丢弃。
          // 这里逐字段比对（journals 的 schema 会补默认值而跳过深比），不一致就报错，避免假成功。
          const afterValue: any = (desc?.value ?? {}) as any
          const notWritten: string[] = []
          for (const k of Object.keys(value ?? {})) {
            if (k === 'journals') continue
            if (JSON.stringify(afterValue?.[k] ?? null) !== JSON.stringify((value as any)[k] ?? null)) notWritten.push(k)
          }
          if (notWritten.length) return send(200, { ok: false, revision: desc?.revision ?? 0, error: '保存未生效（这些字段没有写入）: ' + notWritten.join(', ') })
          return send(200, { ok: true, revision: desc?.revision ?? 0, verified: true })
        }
        if (req.method === 'POST' && p === '/run') {
          const cfgRun = getConfig()
          const results = await runCheck(cfgRun, pcScrapeEnv(cfgRun))
          const dateStr = new Date().toISOString().slice(0, 10)
          const reportRun = formatReport(results, dateStr, cfgRun.endedMonths)
          // 立即检查同样汇报到对话（原先只有定时检查会汇报）。
          let deliver = ''
          if (cfgRun.reportSessionId) {
            try { deliver = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfgRun.reportSessionId, reportRun) } catch (e) { deliver = '汇报异常: ' + String(e) }
          }
          return send(200, { ok: true, report: reportRun, deliver })
        }
        if (req.method === 'POST' && p === '/report') {
          const cfg = getConfig()
          const dir = cfg.reportDir || defaultReportDir()
          let report = ''
          try { report = readFileSync(join(dir, 'latest.md'), 'utf8') } catch { /* 无最近报告 */ }
          if (!report) {
            const results = await runCheck(cfg, pcScrapeEnv(cfg))
            report = formatReport(results, new Date().toISOString().slice(0, 10), cfg.endedMonths)
          }
          const r = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfg.reportSessionId, report)
          return send(200, { ok: true, result: r })
        }
        // 只检查一条期刊（面板「检查这一本」用）：不影响整轮检查，便于逐条排障。
        if (req.method === 'POST' && p === '/run-one') {
          const body = JSON.parse(await readBody(req))
          const one = body?.journal
          if (!one || typeof one !== 'object' || !one.baseUrl) return send(400, { ok: false, error: '缺少 journal.baseUrl' })
          const cfgOne = getConfig()
          const jOne: any = {
            name: String(one.name ?? '') || new URL(String(one.baseUrl)).hostname,
            baseUrl: String(one.baseUrl).replace(/\/+$/, '').replace(/\/default\.aspx$/i, '').replace(/\/+$/, ''),
            username: String(one.username ?? ''),
            password: String(one.password ?? ''),
            sections: Array.isArray(one.sections) ? one.sections : [],
            system: String(one.system ?? 'editorial-manager') as any,
            structure: one.structure,
          }
          const dateOne = new Date().toISOString().slice(0, 10)
          const rOne: any = await scrapeJournal(jOne, cfgOne.browserPath, pcScrapeEnv(cfgOne))
          const reportOne = formatReport([rOne], dateOne, cfgOne.endedMonths)
          let deliverOne = ''
          if (cfgOne.reportSessionId) {
            try { deliverOne = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfgOne.reportSessionId, reportOne) } catch (e) { deliverOne = '汇报异常: ' + String(e) }
          }
          return send(200, { ok: true, report: reportOne, single: true, deliver: deliverOne })
        }
        // 人工登录一次（B 方案）：用共享 profile 打开有头浏览器，用户自己完成 ORCID / 学校 SSO 登录。
        // 登录态落到 ~/.dsh/paper-checker/browser-profile，之后的无头抓取直接复用 cookie。
        // 登录成功后顺手把页面结构交给模型识别（投稿系统 / 列表入口 / 字段选择器），落盘 structures/<key>.json。
        if (req.method === 'POST' && p === '/login-once') {
          const body = JSON.parse(await readBody(req))
          const baseUrl = String(body?.baseUrl ?? '').trim().replace(/\/+$/, '').replace(/\/default\.aspx$/i, '').replace(/\/+$/, '')
          const journalName = String(body?.journalName ?? '').trim()
          if (!baseUrl) return send(400, { ok: false, error: '缺少 baseUrl（期刊入口网址）' })
          if (__pcLoginOnceBusy) return send(409, { ok: false, error: '已有一个登录窗口在等待完成，请先在那个窗口里登录或把它关掉' })
          __pcLoginOnceBusy = true
          try {
            log(reportDir(), '登录一次开始 baseUrl=' + baseUrl)
            const envOnce = pcScrapeEnv()
            const rOnce = await loginOnce(baseUrl, getConfig().browserPath, async (ctxAny: any, finalUrl: string) => {
              return await pcRecognizeStructure({
                baseUrl,
                journalName,
                ctxAny,
                llmService: ctx.llm,
                settingsService,
                providerOverride: envOnce.providerOverride,
                modelOverride: envOnce.modelOverride,
              })
            })
            const rec: any = (rOnce as any).structure ?? null
            const plan: any = rec?.plan ?? null
            const planPath = String(rec?.planPath ?? '')
            const planError = rec?.error ? String(rec.error) : ''
            log(reportDir(), '登录一次结束 ok=' + rOnce.ok + ' finalUrl=' + (rOnce.finalUrl ?? '') + ' waitedMs=' + (rOnce.waitedMs ?? 0) +
              ' system=' + String(plan?.system ?? '') + ' conf=' + String(plan?.confidence ?? '') + (planError ? ' planError=' + planError : ''))
            return send(200, {
              ok: rOnce.ok,
              finalUrl: rOnce.finalUrl ?? '',
              waitedMs: rOnce.waitedMs ?? 0,
              plan: plan ? { system: plan.system, confidence: plan.confidence, listUrl: plan.listUrl, fields: plan.fields } : null,
              planPath,
              planError,
              // [modified] 把轮询期捕获到的账号密码一并回给面板，面板随期刊条目存进配置（cookie 过期可自动重登）
              credentials: (rOnce as any).creds ?? null,
              profileDir: pcProfileDir(),
            })
          } finally {
            __pcLoginOnceBusy = false
          }
        }
        if (req.method === 'POST' && p === '/discover') {
          const body = JSON.parse(await readBody(req))
          const baseUrl = String(body?.baseUrl ?? '').trim().replace(/\/+$/, '').replace(/\/default\.aspx$/i, '').replace(/\/+$/, '')
          const username = String(body?.username ?? '').trim()
          const password = String(body?.password ?? '')
          if (!baseUrl || !username || !password) return send(400, { ok: false, error: '网址/账号/密码不能为空' })
          const menu = await loginAndGetMenu(baseUrl, username, password, getConfig().browserPath)
          if (menu.error) return send(200, { ok: false, error: menu.error })
          // 分区以页面确定性探测为准：主菜单里全部带计数分区（含 count=0，按菜单顺序），
          // 这就是「网站有哪些分区」的结构——保存后每次检查时配置优先抓取。
          // count=0 的分区自动跳过，将来一有稿件（count>0）即被抓取，无需再手动维护。
          // 排除 with Production Completed（已完成历史归档）与 Task Assignments（EM 任务功能区，非投稿分区）。
          // 交给 LLM 识别整份主菜单的组织结构（分区清单 / 分组 / 是否抓取 / kind）。
          // 确定性探测仍然负责两件事：给出真实存在的链接名"白名单、以及页面上的计数。
          const cfgNow = getConfig()
          const parsed = await analyzeJournalMenu(ctx.llm, settingsService, baseUrl, menu, cfgNow.discoverProvider, cfgNow.discoverModel)
          const st = parsed.structure
          const detSections = Object.keys(menu.counts).filter((k) => !/with production completed|task assignment/i.test(k))
          // 分区顺序：完全按 LLM 给出的顺序；模型失败则回落到旧的确定性顺序。
          const sections = st ? st.sections.filter((s) => s.check).map((s) => s.name) : detSections
          let name = menu.title?.trim() || ''
          const titleGeneric = !name || name.length < 3 || /editorial manager|author main menu|main menu|welcome/i.test(name)
          if (titleGeneric && st?.name) name = st.name
          if (!name) name = new URL(baseUrl).hostname.replace(/^www\./, '').replace(/\.editorialmanager\.com$/, '')
          // 本次登录走的是 EM 流程，运行路径仍是 editorial-manager；模型判定的系统类型记录到
          // structure.system 里，供将来接入别的投稿系统时使用。
          const system = 'editorial-manager'
          const structure = st
            ? { source: 'llm', model: cfgNow.discoverModel || '', capturedAt: new Date().toISOString(), name: st.name, system: st.system, groups: st.groups, sections: st.sections }
            : { source: '', model: '', capturedAt: '', name: '', system: '', groups: [], sections: [] }
          return send(200, { ok: true, config: { name, baseUrl, username, sections, system, structure }, llmError: parsed.error })
        }
        return send(404, { ok: false, error: 'not found: ' + p })
      } catch (e: any) {
        return send(500, { ok: false, error: String(e?.message ?? e) })
      }
    },
  }), 'paper-checker: config api')

  // 工具：按需检查
  const disposeTool = ctx.tools.register(defineTool({
    name: 'check_paper_status',
    description: '检查配置的学术期刊投稿审稿状态（Editorial Manager 期刊确定性抓取；其他系统返回回退信号，请改用浏览器工具手动检查）',
    parameters: {
      journal_name: { type: 'string', description: '可选：只检查指定期刊名；缺省检查全部配置期刊' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args: any, value: string) => [{ type: 'text', text: value }],
    },
    async execute(args: any) {
      const cfg = getConfig()
      const journals = args.journal_name
        ? cfg.journals.filter((j) => j.name === args.journal_name)
        : cfg.journals
      if (journals.length === 0) return '没有匹配的期刊配置'
      const results = await runCheck({ ...cfg, journals }, pcScrapeEnv(cfg))
      const dateStr = new Date().toISOString().slice(0, 10)
      const report = formatReport(results, dateStr, cfg.endedMonths)
      return report
    },
    presentCall: (args: any) => ({ card: 'generic', title: '检查投稿状态', kind: 'read', rawInput: args.journal_name ?? '' }),
  }))
  ctx.effect(() => disposeTool, 'paper-checker: tool')

  // 守护定时：每天到点自动检查（配置变化后下一 tick 自动用新值）。
  // 触发条件：当天还没跑过，且当前时刻已到目标时间——DSH 在目标时刻未运行(关机/休眠/晚启动)时，启动后自动补跑当天检查。
  let lastRunDate = ''
  ctx.setInterval(() => {
    void (async () => {
      const cfg = getConfig()
      if (!cfg.scheduleEnabled || cfg.journals.length === 0) return
      const { date, time } = nowInTz(cfg.timezone)
      if (lastRunDate !== date && tMin(time) >= tMin(cfg.time)) {
        lastRunDate = date
        const dir = cfg.reportDir || defaultReportDir()
        log(dir, '定时检查开始 date=' + date + ' time=' + time)
        const results = await runCheck(cfg, pcScrapeEnv(cfg))
        const report = formatReport(results, date, cfg.endedMonths)
        writeFileSync(join(dir, `report-${date}.md`), report, 'utf8')
        writeFileSync(join(dir, 'latest.md'), report, 'utf8')
        if (cfg.serverchanKey) {
          const ok = await pushServerChan(cfg.serverchanKey, `📊 投稿状态报告 (${date})`, report)
          log(dir, '微信推送 ' + (ok ? '成功' : '失败'))
        }
        if (cfg.reportSessionId) {
          const r = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfg.reportSessionId, report)
          log(dir, '对话汇报: ' + r)
        }
        log(dir, '定时检查完成')
      }
    })().catch((e) => log(reportDir(), '定时检查异常: ' + String(e)))
  }, 30000)
  ctx.logger?.info?.('[@dsh-external/dsh-paper-checker] 守护定时启动（每天 ' + getConfig().time + ' ' + getConfig().timezone + '）')
}


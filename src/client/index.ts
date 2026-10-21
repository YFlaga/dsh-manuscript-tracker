/**
 * @dsh-external/dsh-paper-checker — client 配置面板（plugins.bundle.config）。
 * 注册在侧栏「插件」页里本 bundle 的详情页上（描述与行列表之间），可视化编辑定时配置 + 期刊列表。
 * 配置读写走插件自建 HTTP API（/paper-checker/api），绕过 apiproxy 的 settings 白名单。
 */
import * as React from 'react'

type ClientContext = {
  slots: any
  get(name: string): any
}

export const inject = ['slots']

const API = '/paper-checker/api'

function fetchJson(path: string, init?: any): Promise<any> {
  return fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  }).then((r) => r.json())
}

function PaperCheckerPanel(props: any): any {
  const [cfg, setCfg] = React.useState<any>(null)
  const [revision, setRevision] = React.useState<number>(0)
  const [journalsText, setJournalsText] = React.useState<string>('')
  const [msg, setMsg] = React.useState<string>('')
  const [saving, setSaving] = React.useState<boolean>(false)
  const [running, setRunning] = React.useState<boolean>(false)
  const [report, setReport] = React.useState<string>('')
  const [sessions, setSessions] = React.useState<any[]>([])
  const [dUrl, setDUrl] = React.useState<string>('')
  const [loginName, setLoginName] = React.useState<string>('')
  // 「登录一次」（B 方案）：有头浏览器里人工完成 ORCID / SSO 登录，cookie 存进持久化 profile
  const [loginUrl, setLoginUrl] = React.useState<string>('')
  const [loginBusy, setLoginBusy] = React.useState<boolean>(false)
  const [loginMsg, setLoginMsg] = React.useState<string>('')
  const [loginOk, setLoginOk] = React.useState<boolean>(false)
  // 登录成功后模型识别出的投稿系统结构（editorial-manager / scholarone / …）
  const [loginPlan, setLoginPlan] = React.useState<any>(null)
  // 登录一次时顺手记录到的账号密码（存进期刊条目，cookie 过期可自动重登）
  const [loginCreds, setLoginCreds] = React.useState<any>(null)
  const [loginTrace, setLoginTrace] = React.useState<any[]>([])
  const [traceFilled, setTraceFilled] = React.useState<number>(-1)
  const [traceCopied, setTraceCopied] = React.useState<number>(-1)
  // [patch 2026-10-22d] 登录轨迹里发现的真实投稿系统网址（用户填的常是登录门户）
  const [loginBestUrl, setLoginBestUrl] = React.useState<string>('')
  // 已经登录过（页面直接进后台、没有密码表单）时自动记录拿不到凭据：允许手动补录，跟条目一起保存
  const [manualUser, setManualUser] = React.useState<string>('')
  const [manualPass, setManualPass] = React.useState<string>('')
  // 识别模型选择（结构识别用哪个 LLM；默认跟随 DSH 当前默认模型）
  const [modelGroups, setModelGroups] = React.useState<any[]>([])

  const loadSessions = React.useCallback(() => {
    // 服务端把会话列表搭在 /config 上返回（/sessions 在渲染进程里会静默失败）
    fetchJson('/config').then((res: any) => {
      if (res && res.ok && Array.isArray(res.sessions)) setSessions(res.sessions)
    }).catch(() => {})
  }, [])

  const loadProviders = React.useCallback(() => {
    // DSH 0.2 不再暴露 connection.api.llm.models；服务端把 provider/模型列表搭在 /config 上
    fetchJson('/config').then((res: any) => {
      if (res && res.ok && Array.isArray(res.modelGroups)) setModelGroups(res.modelGroups)
    }).catch(() => {})
  }, [])

  React.useEffect(() => {
    let alive = true
    fetchJson('/config').then((res: any) => {
      if (!alive) return
      if (res.ok) {
        setCfg(res.config || {})
        setRevision(res.revision ?? 0)
        setJournalsText(JSON.stringify(res.config?.journals || [], null, 2))
      } else {
        setMsg('加载失败: ' + (res.error ?? ''))
      }
    }).catch((e: any) => { if (alive) setMsg('加载异常: ' + String(e)) })
    loadSessions()
    loadProviders()
    return () => { alive = false }
  }, [loadSessions, loadProviders])

  const save = async () => {
    if (!cfg) return
    let journals: any
    try { journals = JSON.parse(journalsText) } catch { setMsg('期刊列表 JSON 格式错误，未保存'); return }
    if (!Array.isArray(journals)) { setMsg('期刊列表必须是数组'); return }
    setSaving(true)
    try {
      const res = await fetchJson('/config', {
        method: 'POST',
        body: JSON.stringify({ config: { ...cfg, journals }, expectedRevision: revision }),
      })
      if (res.ok) {
        setMsg('已保存 ✓')
        setRevision(res.revision ?? revision + 1)
      } else {
        setMsg('保存失败: ' + (res.error ?? '未知错误'))
      }
    } catch (e) {
      setMsg('保存异常: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  const runNow = async () => {
    setRunning(true); setReport(''); setMsg('')
    try {
      const res = await fetchJson('/run', { method: 'POST' })
      if (res.ok) setReport((res.report ?? '(无报告)') + (res.deliver ? '\n\n—— 对话汇报: ' + res.deliver : ''))
      else setMsg('检查失败: ' + (res.error ?? ''))
    } catch (e) {
      setMsg('检查异常: ' + String(e))
    } finally {
      setRunning(false)
    }
  }

  // ---- 已添加期刊列表：从 journalsText 派生，逐条删除（两段式确认）----
  const [confirmDel, setConfirmDel] = React.useState<number>(-1)
  const journalItems: any[] = (() => {
    try { const a = JSON.parse(journalsText); return Array.isArray(a) ? a : [] } catch { return [] }
  })()
  const journalsInvalid = (() => { if (journalsText.trim() === '') return false; try { return !Array.isArray(JSON.parse(journalsText)) } catch { return true } })()

  // [modified] 不再自动填入：入口网址保持空白，由用户手动填写（新增期刊场景）；也可用下面的下拉快速填入已有期刊

  const loginOnce = async () => {
    const target = (loginUrl || dUrl || '').trim(); setLoginUrl(target)
    if (!target) { setLoginMsg('请先在上面填写期刊网址'); return }
    setLoginBusy(true); setLoginOk(false); setLoginPlan(null); setLoginCreds(null); setLoginTrace([])
    setLoginMsg('登录窗口已打开：登录后请继续点开「我的稿件 / 作者中心」等页面，看完后**关闭浏览器窗口**，我会把访问过的页面全部列出来并尝试识别（最长 18 分钟）')
    // 顺手把期刊名带上，识别结果落到 structures/<key>.json 时能对上配置里的期刊
    const hit = (Array.isArray(journalItems) ? journalItems : []).find((j2: any) => String(j2?.baseUrl ?? '').replace(/\/+$/, '') === target.replace(/\/+$/, ''))
    const journalName = String(hit?.name ?? '')
    try {
      const res = await fetchJson('/login-once', { method: 'POST', body: JSON.stringify({ baseUrl: target, journalName }) })
      if (res.ok) {
        setLoginOk(true)
        setLoginPlan(res.plan ?? null)
        setLoginCreds(res.credentials ?? null)
        const errLine = res.planError ? '；结构识别未完成: ' + res.planError : ''
        const credLine = (res.credentials && res.credentials.password) ? '；已同步记录账号密码 ✓' : '（本次未记录账号密码——ORCID/SSO 登录没有可记的表单，靠持久化 cookie）'
        // [patch 2026-10-22] 识别失败时把「浏览器里实际看到的页面」列出来：用户才知道自己粘的是统一身份门户还是投稿系统
        const pgs: any[] = Array.isArray(res.pages) ? res.pages : []
        setLoginTrace(pgs)
        setLoginBestUrl(String((res as any).bestUrl ?? ''))
        const pageLine = pgs.length ? '；你访问过的页面见下方轨迹（共 ' + pgs.length + ' 条，可点选）' : ''
        setLoginMsg('登录结束 ✓（用时 ' + Math.round((res.waitedMs ?? 0) / 1000) + 's' + (res.closedByUser ? '，你关闭了窗口' : '') + '）' + errLine + credLine + pageLine)
      } else {
        setLoginMsg('登录未完成: ' + (res.error ?? '未知错误'))
      }
    } catch (e) {
      setLoginMsg('登录异常: ' + String(e))
    } finally {
      setLoginBusy(false)
    }
  }
  // [modified] 新增期刊唯一入口：登录一次 + 结构识别 → 直接用识别结果加入列表（不再需要账号密码/自动识别）
  const addFromLogin = () => {
    const url = dUrl.trim()
    if (!url) { setLoginMsg('请先填写期刊入口网址'); return }
    let journals: any[]
    try { journals = JSON.parse(journalsText) } catch { journals = [] }
    if (!Array.isArray(journals)) journals = []
    const norm = (x: string) => x.replace(/\/+$/, '').toLowerCase()
    const plan = loginPlan || {}
    // [patch 2026-10-22d] 用户填的往往是登录/统一身份门户；优先用登录轨迹里发现的真实投稿系统网址
    const planListUrl = String(plan?.listUrl ?? '')
    const saneListUrl = planListUrl && !/orcid\.org|accounts\.taylorfrancis\.com|\/identity|\/login|\/oauth|login\.microsoftonline/i.test(planListUrl) ? planListUrl : ''
    const finalUrl = (saneListUrl || loginBestUrl || url).replace(/\/+$/, '')
    if (journals.some((j2: any) => norm(String(j2?.baseUrl ?? '')) === norm(finalUrl))) {
      setLoginMsg('该网址已在期刊列表里，未重复加入（' + finalUrl + '）')
      return
    }
    const name = loginName.trim() || finalUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    // 自动记录到的凭据优先；已登录站点没有密码表单时用上面手动补录的
    const uName = String(loginCreds?.username ?? '') || manualUser.trim()
    const uPass = String(loginCreds?.password ?? '') || manualPass
    journals.push({
      name,
      baseUrl: finalUrl,
      username: uName,
      password: uPass,
      sections: Array.isArray(plan.menuSections) ? plan.menuSections : [],
      system: plan.system || 'other',
    })
    setLoginName('')
    setLoginPlan(null)
    setManualUser('')
    setManualPass('')
    setLoginMsg('已加入期刊列表' + (uPass ? '（已记录账号密码 ✓）' : '（未记录账号密码，只靠持久化 cookie）') + (finalUrl !== url ? '（采用真实投稿系统网址：' + finalUrl + '）' : '') + '，正在保存…')
    // [patch 2026-10-22] 加入后立刻落盘，不再要求用户再点一次「保存」
    void saveJournalsNow(journals, '已加入「' + name + '」')
  }

  // 列表操作（删除/清空/排序）立刻落盘：以前只改本地 JSON 缓冲区，必须再点一次「保存」，
  // 用户看到的就成了"删了又回来"（加上 GET 的旧值覆盖）。这里直接写设置，失败只提示、不回滚输入。
  const saveJournalsNow = async (next: any[], note: string) => {
    setJournalsText(JSON.stringify(next, null, 2))
    setSaving(true)
    // [patch 2026-10-22] 只提交 journals 一个字段：面板里的旧 cfg 不参与写回，避免把别的设置（含别的窗口刚改的值）覆盖回去
    const post = async (expected: number) => fetchJson('/config', {
      method: 'POST',
      body: JSON.stringify({ config: { journals: next }, expectedRevision: expected }),
    })
    try {
      let res: any = await post(revision)
      // 版本冲突（面板打开期间配置被别处改过）：重读一次再重试，别让用户看到"保存失败"
      if (!res.ok && /revision|changed since|conflict/i.test(String(res.error ?? ''))) {
        const fresh: any = await fetchJson('/config')
        const rv = Number(fresh?.revision ?? 0)
        if (fresh?.config) setCfg(fresh.config)
        setRevision(rv)
        res = await post(rv)
      }
      if (res.ok) {
        setRevision(res.revision ?? revision + 1)
        setMsg(note + ' ✓（已自动保存）')
      } else {
        setMsg(note + '，但自动保存失败: ' + (res.error ?? '未知错误') + '——请点下方「保存」重试')
      }
    } catch (e) {
      setMsg(note + '，但自动保存异常: ' + String(e) + '——请点下方「保存」重试')
    } finally {
      setSaving(false)
    }
  }

  const removeJournal = (idx: number) => {
    const next = journalItems.slice()
    const removed = next[idx]
    next.splice(idx, 1)
    setConfirmDel(-1)
    void saveJournalsNow(next, '已移除「' + String(removed?.name ?? '') + '」')
  }

  // ---- 顺序调整 / 清空 / 单独检查一本 ----
  const [confirmClear, setConfirmClear] = React.useState<boolean>(false)
  const [runningOne, setRunningOne] = React.useState<number>(-1)
  const clearJournals = () => {
    setConfirmClear(false)
    void saveJournalsNow([], '已清空期刊列表')
  }
  const moveJournal = (idx: number, dir: number) => {
    const next = journalItems.slice()
    const to = idx + dir
    if (to < 0 || to >= next.length) return
    const tmp = next[idx]
    next[idx] = next[to]
    next[to] = tmp
    setConfirmDel(-1)
    void saveJournalsNow(next, '已' + (dir < 0 ? '上移' : '下移'))
  }
  const checkOne = async (idx: number) => {
    const one = journalItems[idx]
    if (!one || !one.baseUrl) { setMsg('该条目缺少 baseUrl，无法单独检查'); return }
    setRunningOne(idx); setMsg(''); setReport('')
    try {
      const res = await fetchJson('/run-one', { method: 'POST', body: JSON.stringify({ journal: one }) })
      if (res.ok) { setReport((res.report ?? '(无报告)') + (res.deliver ? '\n\n—— 对话汇报: ' + res.deliver : '')); setMsg('已单独检查「' + String(one.name ?? '') + '」') }
      else setMsg('单独检查失败: ' + (res.error ?? ''))
    } catch (e) { setMsg('单独检查异常: ' + String(e)) } finally { setRunningOne(-1) }
  }
  const s = {
    label: { display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' },
    input: { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', color: 'inherit' },
    row: { marginBottom: 12 },
    textarea: { width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', color: 'inherit', fontFamily: 'monospace', fontSize: 12, minHeight: 180 },
    btn: { padding: '6px 14px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', color: 'inherit', cursor: 'pointer' },
    title: { fontSize: 14, fontWeight: 600, marginBottom: 12 },
    hint: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)', marginTop: 4, lineHeight: 1.5 },
    report: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', color: 'inherit', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', marginTop: 12 },
  } as const

  if (!cfg) {
    return React.createElement('div', { style: { padding: 16 } }, msg || '加载中…')
  }

  const field = (label: string, key: string, placeholder: string) =>
    React.createElement('div', { style: s.row, key },
      React.createElement('label', { style: s.label }, label),
      React.createElement('input', {
        style: s.input,
        value: cfg[key] || '',
        placeholder,
        onChange: (e: any) => setCfg({ ...cfg, [key]: e.target.value }),
      }),
    )

  return React.createElement('div', { style: { padding: 16, maxWidth: 560 } },
    React.createElement('div', { style: s.title }, '投稿状态检查 · 定时任务'),
    field('触发时间（HH:mm）', 'time', '08:00'),
    field('时区（IANA）', 'timezone', 'Asia/Shanghai'),
    React.createElement('div', { style: s.row },
      React.createElement('label', { style: { ...s.label, display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('input', {
          type: 'checkbox',
          checked: !!cfg.scheduleEnabled,
          onChange: (e: any) => setCfg({ ...cfg, scheduleEnabled: e.target.checked }),
        }),
        '启用每天定时检查',
      ),
    ),
    field('Server酱 SendKey（微信推送，可留空）', 'serverchanKey', 'SCT...'),
    field('Playwright 浏览器目录（可留空，留空用系统默认 %LOCALAPPDATA%\\ms-playwright）', 'browserPath', 'E:\\...\\pw-browsers'),
    React.createElement('div', { style: s.row },
      React.createElement('label', { style: s.label }, '汇报目标会话（定时检查完成后在对话内汇报）'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('select', {
          style: { ...s.input, flex: 1 },
          value: cfg.reportSessionId || '',
          onChange: (e: any) => setCfg({ ...cfg, reportSessionId: e.target.value }),
        },
          React.createElement('option', { value: '' }, '（不汇报到对话，仅微信）'),
          ...sessions.map((sess: any) => React.createElement('option', { key: sess.sessionId, value: sess.sessionId }, sess.title + (sess.cwd ? ' · ' + sess.cwd : ''))),
        ),
        React.createElement('button', { style: s.btn, type: 'button', onClick: loadSessions }, '刷新'),
      ),
      React.createElement('div', { style: s.hint }, '只列出当前已打开的会话；若目标会话未打开，定时汇报会跳过对话（微信照常推送）。'),
    ),
    React.createElement('div', { style: { ...s.row, border: '1px dashed var(--dsw-alias-border-l1, #ccc)', borderRadius: 8, padding: 10 } },
      React.createElement('label', { style: s.label }, '➕ 新增期刊（登录一次 + 自动识别结构）'),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 6 } },
        React.createElement('select', {
          style: { ...s.input, flex: 1 },
          value: cfg.discoverProvider || '',
          onChange: (e: any) => setCfg({ ...cfg, discoverProvider: e.target.value, discoverModel: '' }),
        },
          React.createElement('option', { value: '' }, '识别模型 Provider（默认）'),
          ...modelGroups.filter((g: any) => Array.isArray(g.models) && g.models.length > 0).map((g: any) => React.createElement('option', { key: g.id, value: g.id }, g.name || g.id)),
        ),
        React.createElement('select', {
          style: { ...s.input, flex: 1 },
          value: cfg.discoverModel || '',
          onChange: (e: any) => setCfg({ ...cfg, discoverModel: e.target.value }),
        },
          React.createElement('option', { value: '' }, '识别模型（默认）'),
          ...(modelGroups.find((g: any) => g.id === cfg.discoverProvider)?.models || []).map((m: any) => React.createElement('option', { key: m.id, value: m.id }, m.name || m.id)),
        ),
        React.createElement('button', { style: s.btn, type: 'button', onClick: loadProviders, title: '刷新模型列表' }, '刷新'),
      ),
      React.createElement('input', {
        style: { ...s.input, marginBottom: 6 },
        placeholder: '期刊入口网址，如 https://www.editorialmanager.com/conbuildmat',
        value: dUrl,
        onChange: (e: any) => setDUrl(e.target.value),
      }),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', onClick: loginOnce, disabled: loginBusy },
          loginBusy ? '登录中…（关闭浏览器后结束）' : '🔐 登录一次并识别'),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)' } },
          '在打开的浏览器里人工登录一次（cookie 会保存）。登录后**继续点开「我的稿件 / Author Dashboard」等页面**，最后关闭浏览器窗口 —— 插件会记录你访问过的每一个页面，并自动识别投稿系统结构。'),
      ),
      loginMsg ? React.createElement('div', { style: { fontSize: 11, marginBottom: 4, color: loginOk ? 'var(--dsw-alias-label-secondary, #888)' : 'var(--dsw-alias-label-tertiary, #999)' } }, loginMsg) : null,
      loginPlan ? React.createElement('div', { style: { fontSize: 12, marginBottom: 6, color: 'var(--dsw-alias-label-secondary, #666)', wordBreak: 'break-all' } },
        '已识别系统：' + String(loginPlan.system || 'other') + '（置信度 ' + (Number(loginPlan.confidence ?? 0) || 0).toFixed(2) + '）/ 抓取入口：' + (loginPlan.listUrl || '(未识别到列表页，可再登录一次)'),
      ) : null,
      loginTrace.length ? React.createElement('div', { style: { marginBottom: 6, maxHeight: 240, overflow: 'auto', border: '1px solid var(--dsw-alias-border-l1, #ccc)', borderRadius: 6, padding: 6, fontSize: 11, lineHeight: 1.5 } },
        React.createElement('div', { style: { ...s.hint, marginBottom: 4 } }, '你在登录窗口里访问过的页面（按时间顺序）。点「填入」把它设为期刊入口网址；网址文字也可以直接拖选复制：'),
        ...loginTrace.map((p: any, i: number) => React.createElement('div', { key: i, style: { display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3 } },
          React.createElement('button', {
            onClick: () => { const u = String(p.url ?? ''); setLoginUrl(u); setDUrl(u); setTraceFilled(i) },
            style: { flexShrink: 0, padding: '1px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', cursor: 'pointer', color: 'inherit' },
            title: '设为期刊入口网址',
          }, traceFilled === i ? '\u2713 已填入' : '填入'),
          React.createElement('button', {
            onClick: () => { const u = String(p.url ?? ''); try { void navigator.clipboard?.writeText(u) } catch {} setTraceCopied(i) },
            style: { flexShrink: 0, padding: '1px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #ccc)', background: 'transparent', cursor: 'pointer', color: 'inherit' },
            title: '复制这条网址',
          }, traceCopied === i ? '已复制' : '复制'),
          React.createElement('span', {
            style: { wordBreak: 'break-all', userSelect: 'text', cursor: 'text', color: (loginPlan && String(loginPlan.listUrl) === String(p.url)) ? 'var(--dsw-alias-label-primary, #222)' : 'var(--dsw-alias-label-secondary, #777)' },
            title: String(p.title ?? ''),
          }, (p.at != null ? String(p.at) + 's  ' : '') + String(p.url ?? '')),
        )),
      ) : null,
      loginCreds && loginCreds.password
        ? React.createElement('div', { style: { fontSize: 11, marginBottom: 6, color: 'var(--dsw-alias-label-secondary, #888)' } },
            '已同步记录账号密码（' + String(loginCreds.username || '(空)') + '）：存进期刊条目，cookie 过期时可自动重新登录。')
        : (loginOk ? React.createElement('div', { style: { marginBottom: 6 } },
            React.createElement('div', { style: s.hint }, '本次没记到账号密码（浏览器已登录时不会出现密码表单，属正常）。想让它记下来就在下面手填一次（可留空）：'),
            React.createElement('input', {
              style: { ...s.input, marginTop: 4, marginBottom: 4 },
              placeholder: '账号 / 邮箱（可选）',
              value: manualUser,
              onChange: (e: any) => setManualUser(e.target.value),
            }),
            React.createElement('input', {
              style: s.input,
              placeholder: '密码（可选，只存在本机插件配置里）',
              type: 'password',
              value: manualPass,
              onChange: (e: any) => setManualPass(e.target.value),
            }),
          ) : null),
      loginOk && !loginPlan ? React.createElement('div', { style: { fontSize: 11, marginBottom: 4, color: 'var(--dsw-alias-label-tertiary, #999)' } }, '结构识别没成功，但仍可先加入列表（抓取时会再试一次识别；也可以回去重新选识别模型后再登录一次）。') : null,
      loginOk ? React.createElement('div', { style: { marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #ccc)', fontSize: 12 } },
        React.createElement('label', { style: { ...s.label, marginBottom: 2 } }, '期刊名（加入列表时用）'),
        React.createElement('input', {
          style: { ...s.input, marginBottom: 6 },
          placeholder: '如 Road Materials and Pavement Design',
          value: loginName,
          onChange: (e: any) => setLoginName(e.target.value),
        }),
        React.createElement('div', { style: { marginTop: 2 } },
          React.createElement('button', { style: s.btn, type: 'button', onClick: addFromLogin }, '加入期刊列表（立刻保存）'),
        ),
      ) : null,
      React.createElement('div', { style: s.hint }, '上面的 Provider/模型 只用于「识别投稿系统结构」这一步（不影响 DSH 主对话模型；留空则用当前默认模型）。登录成功后自动探测该系统的列表页/字段并写入本地结构缓存（~/.dsh/paper-checker/structures/）；同时把你在登录表单里输入的账号密码一并记录到期刊条目里（ORCID/SSO 登录没有表单则只靠持久化登录态）。加入列表并「保存」后，定时检查与「立即检查」都复用这份登录态。'),

    ),
    React.createElement('div', { style: { ...s.row, border: '1px solid var(--dsw-alias-border-l1, #ccc)', borderRadius: 8, padding: 10 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('label', { style: { ...s.label, marginBottom: 0, flex: 1 } }, '已添加期刊（' + journalItems.length + ' 条）'),
        confirmClear
          ? React.createElement('span', { style: { display: 'flex', gap: 4 } },
              React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', onClick: clearJournals }, '确认清空'),
              React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', onClick: () => setConfirmClear(false) }, '取消'),
            )
          : React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', disabled: journalItems.length === 0, onClick: () => setConfirmClear(true) }, '清空全部'),
      ),
      journalsInvalid
        ? React.createElement('div', { style: s.hint }, '下方 JSON 当前不是合法数组，无法列出条目。')
        : (journalItems.length === 0
          ? React.createElement('div', { style: s.hint }, '（暂无期刊。用上面的「新增期刊」先登录一次再加入，或直接编辑下方 JSON。）')
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              ...journalItems.map((j2: any, i: number) =>
                React.createElement('div', {
                  key: String(j2?.baseUrl ?? '') + '#' + i,
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--dsw-alias-border-l1, #ccc)' },
                },
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      (j2?.name || '(未命名)') + (j2?.system === 'editorial-manager' ? ' · 确定性抓取' : ' · 结构抓取')),
                    React.createElement('div', { style: { ...s.hint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      String(j2?.baseUrl ?? '') +
                        (j2?.password ? ' · 已存账号密码' : ' · 仅 cookie') +
                        ' · 分区 ' + (Array.isArray(j2?.sections) ? j2.sections.length : 0) + ' 个' +
                        (j2?.structure && Array.isArray(j2.structure.sections) && j2.structure.sections.length ? ' · 结构 ' + j2.structure.sections.length + ' 项' : '')),
                  ),
                  confirmDel === i
                    ? React.createElement('span', { style: { display: 'flex', gap: 4 } },
                        React.createElement('button', { style: { ...s.btn, padding: '4px 10px' }, type: 'button', onClick: () => removeJournal(i) }, '确认删除'),
                        React.createElement('button', { style: { ...s.btn, padding: '4px 10px' }, type: 'button', onClick: () => setConfirmDel(-1) }, '取消'),
                      )
                    : React.createElement('span', { style: { display: 'flex', gap: 4 } },
                        React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', title: '上移', disabled: i === 0, onClick: () => moveJournal(i, -1) }, '↑'),
                        React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', title: '下移', disabled: i === journalItems.length - 1, onClick: () => moveJournal(i, 1) }, '↓'),
                        React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', disabled: runningOne === i, onClick: () => checkOne(i) }, runningOne === i ? '检查中…' : '检查这一本'),
                        React.createElement('button', { style: { ...s.btn, padding: '4px 8px' }, type: 'button', onClick: () => setConfirmDel(i) }, '删除'),
                      ),
                ),
              ),
            )),
      React.createElement('div', { style: s.hint }, '删除只改这份编辑内容，点下方「保存」后才写入配置。'),
    ),
    React.createElement('div', { style: s.row },
      React.createElement('label', { style: s.label }, '期刊列表（JSON 数组）'),
      React.createElement('textarea', {
        style: s.textarea,
        value: journalsText,
        onChange: (e: any) => setJournalsText(e.target.value),
        spellCheck: false,
      }),
      React.createElement('div', { style: s.hint },
        '每项字段：name 期刊名、baseUrl 站点根地址、sections 要检查的分区名数组、system 为 editorial-manager（确定性）或 other（登录一次识别出的通用结构抓取）。username/password 由「登录一次」自动记录（可留空，靠持久化 cookie）。',
      ),
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      React.createElement('button', { style: s.btn, onClick: save, disabled: saving }, saving ? '保存中…' : '保存'),
      React.createElement('button', { style: s.btn, onClick: runNow, disabled: running }, running ? '检查中…' : '立即检查'),
      msg ? React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #999)' } }, msg) : null,
    ),
    report ? React.createElement('pre', { style: s.report }, report) : null,
  )
}

export function apply(ctx: ClientContext): void {
  // 配置界面挂在侧栏「插件」页里本 bundle 的详情页上，而不是设置里：
  // plugins.bundle.config 按 bundle 的 npm 包名索引，页面在描述与行列表之间渲染它。
  // 页面自己画标题/图标/面包屑；注册随 bundle 的开关存在，bundle 关掉时自然消失。
  ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@dsh-external/dsh-paper-checker',
  }, (props: any) => (props?.view === 'summary' ? null : React.createElement(PaperCheckerPanel, props)))), 'paper-checker: bundle config')
}

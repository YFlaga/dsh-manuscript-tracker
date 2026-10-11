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

export const inject = ['slots', 'connection']

const API = '/paper-checker/api'

function fetchJson(path: string, init?: any): Promise<any> {
  return fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  }).then((r) => r.json())
}

function PaperCheckerPanel(props: any): any {
  const api = props.api
  const [cfg, setCfg] = React.useState<any>(null)
  const [revision, setRevision] = React.useState<number>(0)
  const [journalsText, setJournalsText] = React.useState<string>('')
  const [msg, setMsg] = React.useState<string>('')
  const [saving, setSaving] = React.useState<boolean>(false)
  const [running, setRunning] = React.useState<boolean>(false)
  const [report, setReport] = React.useState<string>('')
  const [sessions, setSessions] = React.useState<any[]>([])
  const [dUrl, setDUrl] = React.useState<string>('')
  const [dUser, setDUser] = React.useState<string>('')
  const [dPass, setDPass] = React.useState<string>('')
  const [discovering, setDiscovering] = React.useState<boolean>(false)
  const [discovered, setDiscovered] = React.useState<any>(null)
  const [discoveredName, setDiscoveredName] = React.useState<string>('')
  const [discoverMsg, setDiscoverMsg] = React.useState<string>('')
  const [modelGroups, setModelGroups] = React.useState<any[]>([])

  const loadSessions = React.useCallback(() => {
    // 服务端把会话列表搭在 /config 上返回（/sessions 在渲染进程里会静默失败）
    fetchJson('/config').then((res: any) => {
      if (res && res.ok && Array.isArray(res.sessions)) setSessions(res.sessions)
    }).catch(() => {})
  }, [])

  const loadProviders = React.useCallback(() => {
    // DSH 0.2 不再暴露 connection.api.llm.models；服务端把 provider/模型列表搭在 /config 上
    if (!api?.llm?.models) {
      fetchJson('/config').then((res: any) => {
        if (res && res.ok && Array.isArray(res.modelGroups)) setModelGroups(res.modelGroups)
      }).catch(() => {})
      return
    }
    api.llm.models({}).then((res: any) => {
      const groups = res?.result?.value?.groups || []
      setModelGroups(groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        models: (g.models || []).map((m: any) => ({ id: m.id, name: m.name })),
      })))
    }).catch(() => {})
  }, [api])

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

  const discover = async () => {
    if (!dUrl.trim() || !dUser.trim() || !dPass) { setDiscoverMsg('请填写网址、账号、密码'); return }
    setDiscovering(true); setDiscovered(null); setDiscoverMsg('')
    try {
      const res = await fetchJson('/discover', {
        method: 'POST',
        body: JSON.stringify({ baseUrl: dUrl.trim(), username: dUser.trim(), password: dPass }),
      })
      if (res.ok) {
        // 服务端不再回显密码，这里用面板自己的输入补齐，保证「加入列表」写进配置的凭据完整。
        setDiscovered({ ...(res.config || {}), username: dUser.trim(), password: dPass })
        setDiscoveredName(res.config?.name || '')
        setDiscoverMsg(res.llmError ? '（模型识别失败，已用页面信息回退）确认无误后点「加入列表」' : '识别成功，确认无误后点「加入列表」')
      } else {
        setDiscoverMsg('识别失败: ' + (res.error ?? ''))
      }
    } catch (e) {
      setDiscoverMsg('识别异常: ' + String(e))
    } finally {
      setDiscovering(false)
    }
  }

  const addDiscovered = () => {
    if (!discovered) return
    let journals: any[]
    try { journals = JSON.parse(journalsText) } catch { journals = [] }
    if (!Array.isArray(journals)) journals = []
    const name = discoveredName.trim() || discovered.name || ''
    if (!name) { setDiscoverMsg('期刊名不能为空'); return }
    journals.push({ ...discovered, name })
    setJournalsText(JSON.stringify(journals, null, 2))
    setDiscovered(null)
    setDiscoveredName('')
    setDiscoverMsg('已加入列表，记得点「保存」')
  }

  // ---- 已添加期刊列表：从 journalsText 派生，逐条删除（两段式确认）----
  const [confirmDel, setConfirmDel] = React.useState<number>(-1)
  const journalItems: any[] = (() => {
    try { const a = JSON.parse(journalsText); return Array.isArray(a) ? a : [] } catch { return [] }
  })()
  const journalsInvalid = (() => { if (journalsText.trim() === '') return false; try { return !Array.isArray(JSON.parse(journalsText)) } catch { return true } })()
  const removeJournal = (idx: number) => {
    const next = journalItems.slice()
    const removed = next[idx]
    next.splice(idx, 1)
    setJournalsText(JSON.stringify(next, null, 2))
    setConfirmDel(-1)
    setMsg('已移除「' + String(removed?.name ?? '') + '」，点「保存」生效')
  }

  // ---- 顺序调整 / 清空 / 单独检查一本 ----
  const [confirmClear, setConfirmClear] = React.useState<boolean>(false)
  const [runningOne, setRunningOne] = React.useState<number>(-1)
  const clearJournals = () => {
    setJournalsText('[]')
    setConfirmClear(false)
    setMsg('已清空期刊列表，点「保存」生效')
  }
  const moveJournal = (idx: number, dir: number) => {
    const next = journalItems.slice()
    const to = idx + dir
    if (to < 0 || to >= next.length) return
    const tmp = next[idx]
    next[idx] = next[to]
    next[to] = tmp
    setJournalsText(JSON.stringify(next, null, 2))
    setConfirmDel(-1)
    setMsg('已' + (dir < 0 ? '上移' : '下移') + '，点「保存」生效')
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
      React.createElement('label', { style: s.label }, '➕ 新增期刊（输入网址 + 账号密码，自动登录并识别）'),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 6 } },
        React.createElement('select', {
          style: { ...s.input, flex: 1 },
          value: cfg.discoverProvider || '',
          onChange: (e: any) => setCfg({ ...cfg, discoverProvider: e.target.value, discoverModel: '' }),
        },
          React.createElement('option', { value: '' }, '模型 Provider（默认）'),
          ...modelGroups.map((g: any) => React.createElement('option', { key: g.id, value: g.id }, g.name || g.id)),
        ),
        React.createElement('select', {
          style: { ...s.input, flex: 1 },
          value: cfg.discoverModel || '',
          onChange: (e: any) => setCfg({ ...cfg, discoverModel: e.target.value }),
        },
          React.createElement('option', { value: '' }, '模型（默认）'),
          ...(modelGroups.find((g: any) => g.id === cfg.discoverProvider)?.models || []).map((m: any) => React.createElement('option', { key: m.id, value: m.id }, m.name || m.id)),
        ),
        React.createElement('button', { style: s.btn, type: 'button', onClick: loadProviders, title: '刷新模型列表' }, '刷新'),
      ),
      React.createElement('input', {
        style: { ...s.input, marginBottom: 6 },
        placeholder: '站点网址，如 https://www.editorialmanager.com/conbuildmat',
        value: dUrl,
        onChange: (e: any) => setDUrl(e.target.value),
      }),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 6 } },
        React.createElement('input', { style: { ...s.input, flex: 1 }, placeholder: '账号', value: dUser, onChange: (e: any) => setDUser(e.target.value) }),
        React.createElement('input', { style: { ...s.input, flex: 1 }, placeholder: '密码', type: 'password', value: dPass, onChange: (e: any) => setDPass(e.target.value) }),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement('button', { style: s.btn, type: 'button', onClick: discover, disabled: discovering }, discovering ? '登录识别中…' : '自动识别'),
        discoverMsg ? React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)' } }, discoverMsg) : null,
      ),
      discovered ? React.createElement('div', { style: { marginTop: 8, padding: 8, borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #ccc)', fontSize: 12 } },
        React.createElement('label', { style: { ...s.label, marginBottom: 2 } }, '期刊名（可修改，自动识别可能不准）'),
        React.createElement('input', {
          style: { ...s.input, marginBottom: 6 },
          value: discoveredName,
          onChange: (e: any) => setDiscoveredName(e.target.value),
        }),
        React.createElement('div', null, '分区（' + (Array.isArray(discovered.sections) ? discovered.sections.length : 0) + ' 个）：' + (Array.isArray(discovered.sections) ? discovered.sections.slice(0, 8).join('、') + (discovered.sections.length > 8 ? ' 等' : '') : '')),
        React.createElement('div', { style: { marginTop: 6 } },
          React.createElement('button', { style: s.btn, type: 'button', onClick: addDiscovered }, '加入列表'),
        ),
      ) : null,
      React.createElement('div', { style: s.hint }, '自动打开期刊网站登录，探测主菜单上的全部投稿分区（含当前 0 篇的分区）并识别期刊名，生成后加入下方期刊列表；保存后每次检查会按探测结果自动抓取各分区（出现新稿件即被抓到），无需手动维护分区。'),
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
          ? React.createElement('div', { style: s.hint }, '（暂无期刊。用上面的「新增期刊」识别，或直接编辑下方 JSON。）')
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              ...journalItems.map((j2: any, i: number) =>
                React.createElement('div', {
                  key: String(j2?.baseUrl ?? '') + '#' + i,
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--dsw-alias-border-l1, #ccc)' },
                },
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      (j2?.name || '(未命名)') + (j2?.system === 'other' ? ' · AI 回退' : ' · 确定性抓取')),
                    React.createElement('div', { style: { ...s.hint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      String(j2?.baseUrl ?? '') +
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
        '每项字段：name 期刊名、baseUrl 站点根地址、username/password 登录凭据、sections 要检查的分区名数组、system 为 editorial-manager（确定性）或 other（AI 回退）。',
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
  const api = ctx.get('connection')?.api
  // 配置界面挂在侧栏「插件」页里本 bundle 的详情页上，而不是设置里：
  // plugins.bundle.config 按 bundle 的 npm 包名索引，页面在描述与行列表之间渲染它。
  // 页面自己画标题/图标/面包屑；注册随 bundle 的开关存在，bundle 关掉时自然消失。
  ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@dsh-external/dsh-paper-checker',
  }, (props: any) => (props?.view === 'summary' ? null : React.createElement(PaperCheckerPanel, { ...props, api })))), 'paper-checker: bundle config')
}

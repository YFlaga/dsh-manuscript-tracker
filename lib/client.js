window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-paper-checker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/index.ts
		/**
		* @dsh-external/dsh-paper-checker — client 配置面板（plugins.bundle.config）。
		* 注册在侧栏「插件」页里本 bundle 的详情页上（描述与行列表之间），可视化编辑定时配置 + 期刊列表。
		* 配置读写走插件自建 HTTP API（/paper-checker/api），绕过 apiproxy 的 settings 白名单。
		*/
		const inject = ["slots", "connection"];
		const API = "/paper-checker/api";
		function fetchJson(path, init) {
			return fetch(API + path, {
				headers: { "content-type": "application/json" },
				...init
			}).then((r) => r.json());
		}
		function PaperCheckerPanel(props) {
			const api = props.api;
			const [cfg, setCfg] = react.useState(null);
			const [revision, setRevision] = react.useState(0);
			const [journalsText, setJournalsText] = react.useState("");
			const [msg, setMsg] = react.useState("");
			const [saving, setSaving] = react.useState(false);
			const [running, setRunning] = react.useState(false);
			const [report, setReport] = react.useState("");
			const [sessions, setSessions] = react.useState([]);
			const [dUrl, setDUrl] = react.useState("");
			const [dUser, setDUser] = react.useState("");
			const [dPass, setDPass] = react.useState("");
			const [discovering, setDiscovering] = react.useState(false);
			const [discovered, setDiscovered] = react.useState(null);
			const [discoveredName, setDiscoveredName] = react.useState("");
			const [discoverMsg, setDiscoverMsg] = react.useState("");
			const [modelGroups, setModelGroups] = react.useState([]);
			const [loginUrl, setLoginUrl] = react.useState("");
			const [loginBusy, setLoginBusy] = react.useState(false);
			const [loginMsg, setLoginMsg] = react.useState("");
			const [loginOk, setLoginOk] = react.useState(false);
			const [loginPlan, setLoginPlan] = react.useState(null);
			const loadSessions = react.useCallback(() => {
				fetchJson("/config").then((res) => {
					if (res && res.ok && Array.isArray(res.sessions)) setSessions(res.sessions);
				}).catch(() => {});
			}, []);
			const loadProviders = react.useCallback(() => {
				if (!api?.llm?.models) {
					fetchJson("/config").then((res) => {
						if (res && res.ok && Array.isArray(res.modelGroups)) setModelGroups(res.modelGroups);
					}).catch(() => {});
					return;
				}
				api.llm.models({}).then((res) => {
					const groups = res?.result?.value?.groups || [];
					setModelGroups(groups.map((g) => ({
						id: g.id,
						name: g.name,
						models: (g.models || []).map((m) => ({
							id: m.id,
							name: m.name
						}))
					})));
				}).catch(() => {});
			}, [api]);
			react.useEffect(() => {
				let alive = true;
				fetchJson("/config").then((res) => {
					if (!alive) return;
					if (res.ok) {
						setCfg(res.config || {});
						setRevision(res.revision ?? 0);
						setJournalsText(JSON.stringify(res.config?.journals || [], null, 2));
					} else setMsg("加载失败: " + (res.error ?? ""));
				}).catch((e) => {
					if (alive) setMsg("加载异常: " + String(e));
				});
				loadSessions();
				loadProviders();
				return () => {
					alive = false;
				};
			}, [loadSessions, loadProviders]);
			const save = async () => {
				if (!cfg) return;
				let journals;
				try {
					journals = JSON.parse(journalsText);
				} catch {
					setMsg("期刊列表 JSON 格式错误，未保存");
					return;
				}
				if (!Array.isArray(journals)) {
					setMsg("期刊列表必须是数组");
					return;
				}
				setSaving(true);
				try {
					const res = await fetchJson("/config", {
						method: "POST",
						body: JSON.stringify({
							config: {
								...cfg,
								journals
							},
							expectedRevision: revision
						})
					});
					if (res.ok) {
						setMsg("已保存 ✓");
						setRevision(res.revision ?? revision + 1);
					} else setMsg("保存失败: " + (res.error ?? "未知错误"));
				} catch (e) {
					setMsg("保存异常: " + String(e));
				} finally {
					setSaving(false);
				}
			};
			const runNow = async () => {
				setRunning(true);
				setReport("");
				setMsg("");
				try {
					const res = await fetchJson("/run", { method: "POST" });
					if (res.ok) setReport((res.report ?? "(无报告)") + (res.deliver ? "\n\n—— 对话汇报: " + res.deliver : ""));
					else setMsg("检查失败: " + (res.error ?? ""));
				} catch (e) {
					setMsg("检查异常: " + String(e));
				} finally {
					setRunning(false);
				}
			};
			const discover = async () => {
				if (!dUrl.trim() || !dUser.trim() || !dPass) {
					setDiscoverMsg("请填写网址、账号、密码");
					return;
				}
				setDiscovering(true);
				setDiscovered(null);
				setDiscoverMsg("");
				try {
					const res = await fetchJson("/discover", {
						method: "POST",
						body: JSON.stringify({
							baseUrl: dUrl.trim(),
							username: dUser.trim(),
							password: dPass
						})
					});
					if (res.ok) {
						setDiscovered({
							...res.config || {},
							username: dUser.trim(),
							password: dPass
						});
						setDiscoveredName(res.config?.name || "");
						setDiscoverMsg(res.llmError ? "（模型识别失败，已用页面信息回退）确认无误后点「加入列表」" : "识别成功，确认无误后点「加入列表」");
					} else setDiscoverMsg("识别失败: " + (res.error ?? ""));
				} catch (e) {
					setDiscoverMsg("识别异常: " + String(e));
				} finally {
					setDiscovering(false);
				}
			};
			const addDiscovered = () => {
				if (!discovered) return;
				let journals;
				try {
					journals = JSON.parse(journalsText);
				} catch {
					journals = [];
				}
				if (!Array.isArray(journals)) journals = [];
				const name = discoveredName.trim() || discovered.name || "";
				if (!name) {
					setDiscoverMsg("期刊名不能为空");
					return;
				}
				journals.push({
					...discovered,
					name
				});
				setJournalsText(JSON.stringify(journals, null, 2));
				setDiscovered(null);
				setDiscoveredName("");
				setDiscoverMsg("已加入列表，记得点「保存」");
			};
			const [confirmDel, setConfirmDel] = react.useState(-1);
			const journalItems = (() => {
				try {
					const a = JSON.parse(journalsText);
					return Array.isArray(a) ? a : [];
				} catch {
					return [];
				}
			})();
			const journalsInvalid = (() => {
				if (journalsText.trim() === "") return false;
				try {
					return !Array.isArray(JSON.parse(journalsText));
				} catch {
					return true;
				}
			})();
			const loginOnce = async () => {
				const target = (loginUrl || dUrl || "").trim();
				setLoginUrl(target);
				if (!target) {
					setLoginMsg("请先在上面填写期刊网址");
					return;
				}
				setLoginBusy(true);
				setLoginOk(false);
				setLoginPlan(null);
				setLoginMsg("登录中… 请在打开的窗口里完成登录（最多等 10 分钟）");
				const hit = (Array.isArray(journalItems) ? journalItems : []).find((j2) => String(j2?.baseUrl ?? "").replace(/\/+$/, "") === target.replace(/\/+$/, ""));
				const journalName = String(hit?.name ?? "");
				try {
					const res = await fetchJson("/login-once", {
						method: "POST",
						body: JSON.stringify({
							baseUrl: target,
							journalName
						})
					});
					if (res.ok) {
						setLoginOk(true);
						setLoginPlan(res.plan ?? null);
						const errLine = res.planError ? "；结构识别未完成: " + res.planError : "";
						setLoginMsg("登录成功 ✓ 登录态已保存（" + (res.finalUrl ?? "") + "，用时 " + Math.round((res.waitedMs ?? 0) / 1e3) + "s）；之后的无头检查会复用这份 cookie" + errLine);
					} else setLoginMsg("登录未完成: " + (res.error ?? "未知错误"));
				} catch (e) {
					setLoginMsg("登录异常: " + String(e));
				} finally {
					setLoginBusy(false);
				}
			};
			const removeJournal = (idx) => {
				const next = journalItems.slice();
				const removed = next[idx];
				next.splice(idx, 1);
				setJournalsText(JSON.stringify(next, null, 2));
				setConfirmDel(-1);
				setMsg("已移除「" + String(removed?.name ?? "") + "」，点「保存」生效");
			};
			const [confirmClear, setConfirmClear] = react.useState(false);
			const [runningOne, setRunningOne] = react.useState(-1);
			const clearJournals = () => {
				setJournalsText("[]");
				setConfirmClear(false);
				setMsg("已清空期刊列表，点「保存」生效");
			};
			const moveJournal = (idx, dir) => {
				const next = journalItems.slice();
				const to = idx + dir;
				if (to < 0 || to >= next.length) return;
				const tmp = next[idx];
				next[idx] = next[to];
				next[to] = tmp;
				setJournalsText(JSON.stringify(next, null, 2));
				setConfirmDel(-1);
				setMsg("已" + (dir < 0 ? "上移" : "下移") + "，点「保存」生效");
			};
			const checkOne = async (idx) => {
				const one = journalItems[idx];
				if (!one || !one.baseUrl) {
					setMsg("该条目缺少 baseUrl，无法单独检查");
					return;
				}
				setRunningOne(idx);
				setMsg("");
				setReport("");
				try {
					const res = await fetchJson("/run-one", {
						method: "POST",
						body: JSON.stringify({ journal: one })
					});
					if (res.ok) {
						setReport((res.report ?? "(无报告)") + (res.deliver ? "\n\n—— 对话汇报: " + res.deliver : ""));
						setMsg("已单独检查「" + String(one.name ?? "") + "」");
					} else setMsg("单独检查失败: " + (res.error ?? ""));
				} catch (e) {
					setMsg("单独检查异常: " + String(e));
				} finally {
					setRunningOne(-1);
				}
			};
			const s = {
				label: {
					display: "block",
					marginBottom: 4,
					fontSize: 12,
					color: "var(--dsw-alias-label-secondary, #888)"
				},
				input: {
					width: "100%",
					boxSizing: "border-box",
					padding: "6px 8px",
					borderRadius: 8,
					border: "1px solid var(--dsw-alias-border-l1, #ccc)",
					background: "transparent",
					color: "inherit"
				},
				row: { marginBottom: 12 },
				textarea: {
					width: "100%",
					boxSizing: "border-box",
					padding: "8px",
					borderRadius: 8,
					border: "1px solid var(--dsw-alias-border-l1, #ccc)",
					background: "transparent",
					color: "inherit",
					fontFamily: "monospace",
					fontSize: 12,
					minHeight: 180
				},
				btn: {
					padding: "6px 14px",
					borderRadius: 8,
					border: "1px solid var(--dsw-alias-border-l1, #ccc)",
					background: "transparent",
					color: "inherit",
					cursor: "pointer"
				},
				title: {
					fontSize: 14,
					fontWeight: 600,
					marginBottom: 12
				},
				hint: {
					fontSize: 11,
					color: "var(--dsw-alias-label-tertiary, #999)",
					marginTop: 4,
					lineHeight: 1.5
				},
				report: {
					width: "100%",
					boxSizing: "border-box",
					padding: 10,
					borderRadius: 8,
					border: "1px solid var(--dsw-alias-border-l1, #ccc)",
					background: "transparent",
					color: "inherit",
					fontFamily: "monospace",
					fontSize: 12,
					whiteSpace: "pre-wrap",
					maxHeight: 320,
					overflow: "auto",
					marginTop: 12
				}
			};
			if (!cfg) return react.createElement("div", { style: { padding: 16 } }, msg || "加载中…");
			const field = (label, key, placeholder) => react.createElement("div", {
				style: s.row,
				key
			}, react.createElement("label", { style: s.label }, label), react.createElement("input", {
				style: s.input,
				value: cfg[key] || "",
				placeholder,
				onChange: (e) => setCfg({
					...cfg,
					[key]: e.target.value
				})
			}));
			return react.createElement("div", { style: {
				padding: 16,
				maxWidth: 560
			} }, react.createElement("div", { style: s.title }, "投稿状态检查 · 定时任务"), field("触发时间（HH:mm）", "time", "08:00"), field("时区（IANA）", "timezone", "Asia/Shanghai"), react.createElement("div", { style: s.row }, react.createElement("label", { style: {
				...s.label,
				display: "flex",
				alignItems: "center",
				gap: 8
			} }, react.createElement("input", {
				type: "checkbox",
				checked: !!cfg.scheduleEnabled,
				onChange: (e) => setCfg({
					...cfg,
					scheduleEnabled: e.target.checked
				})
			}), "启用每天定时检查")), field("Server酱 SendKey（微信推送，可留空）", "serverchanKey", "SCT..."), field("Playwright 浏览器目录（可留空，留空用系统默认 %LOCALAPPDATA%\\ms-playwright）", "browserPath", "E:\\...\\pw-browsers"), react.createElement("div", { style: s.row }, react.createElement("label", { style: s.label }, "汇报目标会话（定时检查完成后在对话内汇报）"), react.createElement("div", { style: {
				display: "flex",
				gap: 8
			} }, react.createElement("select", {
				style: {
					...s.input,
					flex: 1
				},
				value: cfg.reportSessionId || "",
				onChange: (e) => setCfg({
					...cfg,
					reportSessionId: e.target.value
				})
			}, react.createElement("option", { value: "" }, "（不汇报到对话，仅微信）"), ...sessions.map((sess) => react.createElement("option", {
				key: sess.sessionId,
				value: sess.sessionId
			}, sess.title + (sess.cwd ? " · " + sess.cwd : "")))), react.createElement("button", {
				style: s.btn,
				type: "button",
				onClick: loadSessions
			}, "刷新")), react.createElement("div", { style: s.hint }, "只列出当前已打开的会话；若目标会话未打开，定时汇报会跳过对话（微信照常推送）。")), react.createElement("div", { style: {
				...s.row,
				border: "1px dashed var(--dsw-alias-border-l1, #ccc)",
				borderRadius: 8,
				padding: 10
			} }, react.createElement("label", { style: s.label }, "➕ 新增期刊（输入网址 + 账号密码，自动登录并识别）"), react.createElement("div", { style: {
				display: "flex",
				gap: 6,
				marginBottom: 6
			} }, react.createElement("select", {
				style: {
					...s.input,
					flex: 1
				},
				value: cfg.discoverProvider || "",
				onChange: (e) => setCfg({
					...cfg,
					discoverProvider: e.target.value,
					discoverModel: ""
				})
			}, react.createElement("option", { value: "" }, "模型 Provider（默认）"), ...modelGroups.map((g) => react.createElement("option", {
				key: g.id,
				value: g.id
			}, g.name || g.id))), react.createElement("select", {
				style: {
					...s.input,
					flex: 1
				},
				value: cfg.discoverModel || "",
				onChange: (e) => setCfg({
					...cfg,
					discoverModel: e.target.value
				})
			}, react.createElement("option", { value: "" }, "模型（默认）"), ...(modelGroups.find((g) => g.id === cfg.discoverProvider)?.models || []).map((m) => react.createElement("option", {
				key: m.id,
				value: m.id
			}, m.name || m.id))), react.createElement("button", {
				style: s.btn,
				type: "button",
				onClick: loadProviders,
				title: "刷新模型列表"
			}, "刷新")), react.createElement("input", {
				style: {
					...s.input,
					marginBottom: 6
				},
				placeholder: "站点网址，如 https://www.editorialmanager.com/conbuildmat",
				value: dUrl,
				onChange: (e) => setDUrl(e.target.value)
			}), react.createElement("div", { style: {
				display: "flex",
				gap: 6,
				marginBottom: 6,
				alignItems: "center",
				flexWrap: "wrap"
			} }, react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				onClick: loginOnce,
				disabled: loginBusy
			}, loginBusy ? "登录中…（最多 10 分钟）" : "🔐 登录一次（ORCID / 学校 SSO）"), react.createElement("span", { style: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #999)"
			} }, "非 Editorial Manager 的期刊（如 Taylor&Francis / ScholarOne）：先在上面填网址，点这里人工登录一次，插件会保存登录态并自动识别该系统结构；EM 期刊可直接用下面的账号密码自动识别。")), loginMsg ? react.createElement("div", { style: {
				fontSize: 11,
				marginBottom: 4,
				color: loginOk ? "var(--dsw-alias-label-secondary, #888)" : "var(--dsw-alias-label-tertiary, #999)"
			} }, loginMsg) : null, loginPlan ? react.createElement("div", { style: {
				fontSize: 12,
				marginBottom: 6,
				color: "var(--dsw-alias-label-secondary, #666)",
				wordBreak: "break-all"
			} }, "已识别系统：" + String(loginPlan.system || "other") + "（置信度 " + (Number(loginPlan.confidence ?? 0) || 0).toFixed(2) + "）/ 抓取入口：" + (loginPlan.listUrl || "(未识别到列表页，可再点一次登录)")) : null, react.createElement("div", { style: {
				display: "flex",
				gap: 6,
				marginBottom: 6
			} }, react.createElement("input", {
				style: {
					...s.input,
					flex: 1
				},
				placeholder: "账号",
				value: dUser,
				onChange: (e) => setDUser(e.target.value)
			}), react.createElement("input", {
				style: {
					...s.input,
					flex: 1
				},
				placeholder: "密码",
				type: "password",
				value: dPass,
				onChange: (e) => setDPass(e.target.value)
			})), react.createElement("div", { style: {
				display: "flex",
				gap: 8,
				alignItems: "center",
				flexWrap: "wrap"
			} }, react.createElement("button", {
				style: s.btn,
				type: "button",
				onClick: discover,
				disabled: discovering
			}, discovering ? "登录识别中…" : "自动识别"), discoverMsg ? react.createElement("span", { style: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #999)"
			} }, discoverMsg) : null), discovered ? react.createElement("div", { style: {
				marginTop: 8,
				padding: 8,
				borderRadius: 6,
				border: "1px solid var(--dsw-alias-border-l1, #ccc)",
				fontSize: 12
			} }, react.createElement("label", { style: {
				...s.label,
				marginBottom: 2
			} }, "期刊名（可修改，自动识别可能不准）"), react.createElement("input", {
				style: {
					...s.input,
					marginBottom: 6
				},
				value: discoveredName,
				onChange: (e) => setDiscoveredName(e.target.value)
			}), react.createElement("div", null, "分区（" + (Array.isArray(discovered.sections) ? discovered.sections.length : 0) + " 个）：" + (Array.isArray(discovered.sections) ? discovered.sections.slice(0, 8).join("、") + (discovered.sections.length > 8 ? " 等" : "") : "")), react.createElement("div", { style: { marginTop: 6 } }, react.createElement("button", {
				style: s.btn,
				type: "button",
				onClick: addDiscovered
			}, "加入列表"))) : null, react.createElement("div", { style: s.hint }, "自动打开期刊网站登录，探测主菜单上的全部投稿分区（含当前 0 篇的分区）并识别期刊名，生成后加入下方期刊列表；保存后每次检查会按探测结果自动抓取各分区（出现新稿件即被抓到），无需手动维护分区。")), react.createElement("div", { style: {
				...s.row,
				border: "1px solid var(--dsw-alias-border-l1, #ccc)",
				borderRadius: 8,
				padding: 10
			} }, react.createElement("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 8
			} }, react.createElement("label", { style: {
				...s.label,
				marginBottom: 0,
				flex: 1
			} }, "已添加期刊（" + journalItems.length + " 条）"), confirmClear ? react.createElement("span", { style: {
				display: "flex",
				gap: 4
			} }, react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				onClick: clearJournals
			}, "确认清空"), react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				onClick: () => setConfirmClear(false)
			}, "取消")) : react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				disabled: journalItems.length === 0,
				onClick: () => setConfirmClear(true)
			}, "清空全部")), journalsInvalid ? react.createElement("div", { style: s.hint }, "下方 JSON 当前不是合法数组，无法列出条目。") : journalItems.length === 0 ? react.createElement("div", { style: s.hint }, "（暂无期刊。用上面的「新增期刊」识别，或直接编辑下方 JSON。）") : react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6
			} }, ...journalItems.map((j2, i) => react.createElement("div", {
				key: String(j2?.baseUrl ?? "") + "#" + i,
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "6px 8px",
					borderRadius: 6,
					border: "1px dashed var(--dsw-alias-border-l1, #ccc)"
				}
			}, react.createElement("div", { style: {
				flex: 1,
				minWidth: 0
			} }, react.createElement("div", { style: {
				fontSize: 13,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			} }, (j2?.name || "(未命名)") + (j2?.system === "other" ? " · AI 回退" : " · 确定性抓取")), react.createElement("div", { style: {
				...s.hint,
				marginTop: 2,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			} }, String(j2?.baseUrl ?? "") + " · 分区 " + (Array.isArray(j2?.sections) ? j2.sections.length : 0) + " 个" + (j2?.structure && Array.isArray(j2.structure.sections) && j2.structure.sections.length ? " · 结构 " + j2.structure.sections.length + " 项" : ""))), confirmDel === i ? react.createElement("span", { style: {
				display: "flex",
				gap: 4
			} }, react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 10px"
				},
				type: "button",
				onClick: () => removeJournal(i)
			}, "确认删除"), react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 10px"
				},
				type: "button",
				onClick: () => setConfirmDel(-1)
			}, "取消")) : react.createElement("span", { style: {
				display: "flex",
				gap: 4
			} }, react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				title: "上移",
				disabled: i === 0,
				onClick: () => moveJournal(i, -1)
			}, "↑"), react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				title: "下移",
				disabled: i === journalItems.length - 1,
				onClick: () => moveJournal(i, 1)
			}, "↓"), react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				disabled: runningOne === i,
				onClick: () => checkOne(i)
			}, runningOne === i ? "检查中…" : "检查这一本"), react.createElement("button", {
				style: {
					...s.btn,
					padding: "4px 8px"
				},
				type: "button",
				onClick: () => setConfirmDel(i)
			}, "删除"))))), react.createElement("div", { style: s.hint }, "删除只改这份编辑内容，点下方「保存」后才写入配置。")), react.createElement("div", { style: s.row }, react.createElement("label", { style: s.label }, "期刊列表（JSON 数组）"), react.createElement("textarea", {
				style: s.textarea,
				value: journalsText,
				onChange: (e) => setJournalsText(e.target.value),
				spellCheck: false
			}), react.createElement("div", { style: s.hint }, "每项字段：name 期刊名、baseUrl 站点根地址、username/password 登录凭据、sections 要检查的分区名数组、system 为 editorial-manager（确定性）或 other（AI 回退）。")), react.createElement("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 12
			} }, react.createElement("button", {
				style: s.btn,
				onClick: save,
				disabled: saving
			}, saving ? "保存中…" : "保存"), react.createElement("button", {
				style: s.btn,
				onClick: runNow,
				disabled: running
			}, running ? "检查中…" : "立即检查"), msg ? react.createElement("span", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary, #999)"
			} }, msg) : null), report ? react.createElement("pre", { style: s.report }, report) : null);
		}
		function apply(ctx) {
			const api = ctx.get("connection")?.api;
			ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "@dsh-external/dsh-paper-checker"
			}, (props) => props?.view === "summary" ? null : react.createElement(PaperCheckerPanel, {
				...props,
				api
			}))), "paper-checker: bundle config");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
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
		const inject = ["slots"];
		const API = "/paper-checker/api";
		function fetchJson(path, init) {
			return fetch(API + path, {
				headers: { "content-type": "application/json" },
				...init
			}).then((r) => r.json());
		}
		function PaperCheckerPanel(props) {
			const [cfg, setCfg] = react.useState(null);
			const [revision, setRevision] = react.useState(0);
			const [journalsText, setJournalsText] = react.useState("");
			const [msg, setMsg] = react.useState("");
			const [saving, setSaving] = react.useState(false);
			const [running, setRunning] = react.useState(false);
			const [report, setReport] = react.useState("");
			const [sessions, setSessions] = react.useState([]);
			const [dUrl, setDUrl] = react.useState("");
			const [loginName, setLoginName] = react.useState("");
			const [loginUrl, setLoginUrl] = react.useState("");
			const [loginBusy, setLoginBusy] = react.useState(false);
			const [loginMsg, setLoginMsg] = react.useState("");
			const [loginOk, setLoginOk] = react.useState(false);
			const [loginPlan, setLoginPlan] = react.useState(null);
			const [loginCreds, setLoginCreds] = react.useState(null);
			const [manualUser, setManualUser] = react.useState("");
			const [manualPass, setManualPass] = react.useState("");
			const [modelGroups, setModelGroups] = react.useState([]);
			const loadSessions = react.useCallback(() => {
				fetchJson("/config").then((res) => {
					if (res && res.ok && Array.isArray(res.sessions)) setSessions(res.sessions);
				}).catch(() => {});
			}, []);
			const loadProviders = react.useCallback(() => {
				fetchJson("/config").then((res) => {
					if (res && res.ok && Array.isArray(res.modelGroups)) setModelGroups(res.modelGroups);
				}).catch(() => {});
			}, []);
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
				setLoginCreds(null);
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
						setLoginCreds(res.credentials ?? null);
						const errLine = res.planError ? "；结构识别未完成: " + res.planError : "";
						const credLine = res.credentials && res.credentials.password ? "；已同步记录账号密码 ✓" : "（本次未记录账号密码——ORCID/SSO 登录没有可记的表单，靠持久化 cookie）";
						const pgs = Array.isArray(res.pages) ? res.pages : [];
						const pageLine = !res.plan && pgs.length ? "；本次浏览器里看到的页面：" + pgs.slice(0, 4).map((x) => String(x.url ?? "")).filter(Boolean).join(" | ") : "";
						setLoginMsg("登录成功 ✓ 登录态已保存（" + (res.finalUrl ?? "") + "，用时 " + Math.round((res.waitedMs ?? 0) / 1e3) + "s）" + errLine + credLine + pageLine);
					} else setLoginMsg("登录未完成: " + (res.error ?? "未知错误"));
				} catch (e) {
					setLoginMsg("登录异常: " + String(e));
				} finally {
					setLoginBusy(false);
				}
			};
			const addFromLogin = () => {
				const url = dUrl.trim();
				if (!url) {
					setLoginMsg("请先填写期刊入口网址");
					return;
				}
				let journals;
				try {
					journals = JSON.parse(journalsText);
				} catch {
					journals = [];
				}
				if (!Array.isArray(journals)) journals = [];
				const norm = (x) => x.replace(/\/+$/, "").toLowerCase();
				if (journals.some((j2) => norm(String(j2?.baseUrl ?? "")) === norm(url))) {
					setLoginMsg("该网址已在期刊列表里，未重复加入");
					return;
				}
				const plan = loginPlan || {};
				const name = loginName.trim() || url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
				const uName = String(loginCreds?.username ?? "") || manualUser.trim();
				const uPass = String(loginCreds?.password ?? "") || manualPass;
				journals.push({
					name,
					baseUrl: url,
					username: uName,
					password: uPass,
					sections: Array.isArray(plan.menuSections) ? plan.menuSections : [],
					system: plan.system || "other"
				});
				setLoginName("");
				setLoginPlan(null);
				setManualUser("");
				setManualPass("");
				setLoginMsg("已加入期刊列表" + (uPass ? "（已记录账号密码 ✓）" : "（未记录账号密码，只靠持久化 cookie）") + "，正在保存…");
				saveJournalsNow(journals, "已加入「" + name + "」");
			};
			const saveJournalsNow = async (next, note) => {
				setJournalsText(JSON.stringify(next, null, 2));
				setSaving(true);
				const post = async (expected) => fetchJson("/config", {
					method: "POST",
					body: JSON.stringify({
						config: { journals: next },
						expectedRevision: expected
					})
				});
				try {
					let res = await post(revision);
					if (!res.ok && /revision|changed since|conflict/i.test(String(res.error ?? ""))) {
						const fresh = await fetchJson("/config");
						const rv = Number(fresh?.revision ?? 0);
						if (fresh?.config) setCfg(fresh.config);
						setRevision(rv);
						res = await post(rv);
					}
					if (res.ok) {
						setRevision(res.revision ?? revision + 1);
						setMsg(note + " ✓（已自动保存）");
					} else setMsg(note + "，但自动保存失败: " + (res.error ?? "未知错误") + "——请点下方「保存」重试");
				} catch (e) {
					setMsg(note + "，但自动保存异常: " + String(e) + "——请点下方「保存」重试");
				} finally {
					setSaving(false);
				}
			};
			const removeJournal = (idx) => {
				const next = journalItems.slice();
				const removed = next[idx];
				next.splice(idx, 1);
				setConfirmDel(-1);
				saveJournalsNow(next, "已移除「" + String(removed?.name ?? "") + "」");
			};
			const [confirmClear, setConfirmClear] = react.useState(false);
			const [runningOne, setRunningOne] = react.useState(-1);
			const clearJournals = () => {
				setConfirmClear(false);
				saveJournalsNow([], "已清空期刊列表");
			};
			const moveJournal = (idx, dir) => {
				const next = journalItems.slice();
				const to = idx + dir;
				if (to < 0 || to >= next.length) return;
				const tmp = next[idx];
				next[idx] = next[to];
				next[to] = tmp;
				setConfirmDel(-1);
				saveJournalsNow(next, "已" + (dir < 0 ? "上移" : "下移"));
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
			} }, react.createElement("label", { style: s.label }, "➕ 新增期刊（登录一次 + 自动识别结构）"), react.createElement("div", { style: {
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
			}, react.createElement("option", { value: "" }, "识别模型 Provider（默认）"), ...modelGroups.filter((g) => Array.isArray(g.models) && g.models.length > 0).map((g) => react.createElement("option", {
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
			}, react.createElement("option", { value: "" }, "识别模型（默认）"), ...(modelGroups.find((g) => g.id === cfg.discoverProvider)?.models || []).map((m) => react.createElement("option", {
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
				placeholder: "期刊入口网址，如 https://www.editorialmanager.com/conbuildmat",
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
			}, loginBusy ? "登录中…（最多 10 分钟）" : "🔐 登录一次并识别"), react.createElement("span", { style: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #999)"
			} }, "在打开的浏览器里用 ORCID / 学校 SSO / 账号密码人工登录一次（cookie 会保存），插件自动识别该投稿系统的结构；然后在下面填期刊名并加入列表。")), loginMsg ? react.createElement("div", { style: {
				fontSize: 11,
				marginBottom: 4,
				color: loginOk ? "var(--dsw-alias-label-secondary, #888)" : "var(--dsw-alias-label-tertiary, #999)"
			} }, loginMsg) : null, loginPlan ? react.createElement("div", { style: {
				fontSize: 12,
				marginBottom: 6,
				color: "var(--dsw-alias-label-secondary, #666)",
				wordBreak: "break-all"
			} }, "已识别系统：" + String(loginPlan.system || "other") + "（置信度 " + (Number(loginPlan.confidence ?? 0) || 0).toFixed(2) + "）/ 抓取入口：" + (loginPlan.listUrl || "(未识别到列表页，可再登录一次)")) : null, loginCreds && loginCreds.password ? react.createElement("div", { style: {
				fontSize: 11,
				marginBottom: 6,
				color: "var(--dsw-alias-label-secondary, #888)"
			} }, "已同步记录账号密码（" + String(loginCreds.username || "(空)") + "）：存进期刊条目，cookie 过期时可自动重新登录。") : loginOk ? react.createElement("div", { style: { marginBottom: 6 } }, react.createElement("div", { style: s.hint }, "本次没记到账号密码（浏览器已登录时不会出现密码表单，属正常）。想让它记下来就在下面手填一次（可留空）："), react.createElement("input", {
				style: {
					...s.input,
					marginTop: 4,
					marginBottom: 4
				},
				placeholder: "账号 / 邮箱（可选）",
				value: manualUser,
				onChange: (e) => setManualUser(e.target.value)
			}), react.createElement("input", {
				style: s.input,
				placeholder: "密码（可选，只存在本机插件配置里）",
				type: "password",
				value: manualPass,
				onChange: (e) => setManualPass(e.target.value)
			})) : null, loginOk && !loginPlan ? react.createElement("div", { style: {
				fontSize: 11,
				marginBottom: 4,
				color: "var(--dsw-alias-label-tertiary, #999)"
			} }, "结构识别没成功，但仍可先加入列表（抓取时会再试一次识别；也可以回去重新选识别模型后再登录一次）。") : null, loginOk ? react.createElement("div", { style: {
				marginTop: 4,
				padding: 8,
				borderRadius: 6,
				border: "1px solid var(--dsw-alias-border-l1, #ccc)",
				fontSize: 12
			} }, react.createElement("label", { style: {
				...s.label,
				marginBottom: 2
			} }, "期刊名（加入列表时用）"), react.createElement("input", {
				style: {
					...s.input,
					marginBottom: 6
				},
				placeholder: "如 Road Materials and Pavement Design",
				value: loginName,
				onChange: (e) => setLoginName(e.target.value)
			}), react.createElement("div", { style: { marginTop: 2 } }, react.createElement("button", {
				style: s.btn,
				type: "button",
				onClick: addFromLogin
			}, "加入期刊列表（立刻保存）"))) : null, react.createElement("div", { style: s.hint }, "上面的 Provider/模型 只用于「识别投稿系统结构」这一步（不影响 DSH 主对话模型；留空则用当前默认模型）。登录成功后自动探测该系统的列表页/字段并写入本地结构缓存（~/.dsh/paper-checker/structures/）；同时把你在登录表单里输入的账号密码一并记录到期刊条目里（ORCID/SSO 登录没有表单则只靠持久化登录态）。加入列表并「保存」后，定时检查与「立即检查」都复用这份登录态。")), react.createElement("div", { style: {
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
			}, "清空全部")), journalsInvalid ? react.createElement("div", { style: s.hint }, "下方 JSON 当前不是合法数组，无法列出条目。") : journalItems.length === 0 ? react.createElement("div", { style: s.hint }, "（暂无期刊。用上面的「新增期刊」先登录一次再加入，或直接编辑下方 JSON。）") : react.createElement("div", { style: {
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
			} }, (j2?.name || "(未命名)") + (j2?.system === "editorial-manager" ? " · 确定性抓取" : " · 结构抓取")), react.createElement("div", { style: {
				...s.hint,
				marginTop: 2,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			} }, String(j2?.baseUrl ?? "") + (j2?.password ? " · 已存账号密码" : " · 仅 cookie") + " · 分区 " + (Array.isArray(j2?.sections) ? j2.sections.length : 0) + " 个" + (j2?.structure && Array.isArray(j2.structure.sections) && j2.structure.sections.length ? " · 结构 " + j2.structure.sections.length + " 项" : ""))), confirmDel === i ? react.createElement("span", { style: {
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
			}), react.createElement("div", { style: s.hint }, "每项字段：name 期刊名、baseUrl 站点根地址、sections 要检查的分区名数组、system 为 editorial-manager（确定性）或 other（登录一次识别出的通用结构抓取）。username/password 由「登录一次」自动记录（可留空，靠持久化 cookie）。")), react.createElement("div", { style: {
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
			ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "@dsh-external/dsh-paper-checker"
			}, (props) => props?.view === "summary" ? null : react.createElement(PaperCheckerPanel, props))), "paper-checker: bundle config");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
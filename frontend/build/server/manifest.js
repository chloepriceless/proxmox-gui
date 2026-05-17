const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.Do_aRU5p.js",app:"_app/immutable/entry/app.BiY6pCqx.js",imports:["_app/immutable/entry/start.Do_aRU5p.js","_app/immutable/chunks/CSJZfSZd.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/entry/app.BiY6pCqx.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-Cc9rv6Vc.js')),
			__memo(() => import('./chunks/1-8XuCI7_O.js')),
			__memo(() => import('./chunks/2-TuhD5XFw.js')),
			__memo(() => import('./chunks/3-BF1p2bQc.js')),
			__memo(() => import('./chunks/4-L3lZO7dE.js')),
			__memo(() => import('./chunks/5-DysRUT63.js')),
			__memo(() => import('./chunks/6-Dt14vRP3.js')),
			__memo(() => import('./chunks/7-CcFHsxp2.js')),
			__memo(() => import('./chunks/8-FgrlHykD.js')),
			__memo(() => import('./chunks/9-BjnMrHPk.js')),
			__memo(() => import('./chunks/10-DAoSSR-u.js')),
			__memo(() => import('./chunks/11-CvpY5y3n.js')),
			__memo(() => import('./chunks/12-Bubex_YM.js')),
			__memo(() => import('./chunks/13-C8vNmsz6.js')),
			__memo(() => import('./chunks/14-R_r0xasv.js')),
			__memo(() => import('./chunks/15-DTDnz8ov.js')),
			__memo(() => import('./chunks/16-Dz91tMdb.js')),
			__memo(() => import('./chunks/17-DnlKJFy2.js')),
			__memo(() => import('./chunks/18-B9TBeqiQ.js')),
			__memo(() => import('./chunks/19-ChWefpx7.js')),
			__memo(() => import('./chunks/20--UdPGwRF.js')),
			__memo(() => import('./chunks/21-DMHUaT_5.js')),
			__memo(() => import('./chunks/22-DD3RWjDi.js')),
			__memo(() => import('./chunks/23-DIaIofx_.js')),
			__memo(() => import('./chunks/24-DwOijHii.js')),
			__memo(() => import('./chunks/25-DqQD1orf.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/admin",
				pattern: /^\/admin\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/admin/clusters",
				pattern: /^\/admin\/clusters\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/admin/clusters/new",
				pattern: /^\/admin\/clusters\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/admin/clusters/[id]",
				pattern: /^\/admin\/clusters\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/admin/teams",
				pattern: /^\/admin\/teams\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/admin/teams/new",
				pattern: /^\/admin\/teams\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/admin/teams/[id]",
				pattern: /^\/admin\/teams\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/admin/users",
				pattern: /^\/admin\/users\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/admin/users/new",
				pattern: /^\/admin\/users\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/admin/users/[id]",
				pattern: /^\/admin\/users\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/audit",
				pattern: /^\/audit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/backups",
				pattern: /^\/backups\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/console/embed",
				pattern: /^\/console\/embed\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/create",
				pattern: /^\/create\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/inventory",
				pattern: /^\/inventory\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]/activity",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/activity\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 21 },
				endpoint: null
			},
			{
				id: "/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 22 },
				endpoint: null
			},
			{
				id: "/profile/ssh-keys",
				pattern: /^\/profile\/ssh-keys\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 23 },
				endpoint: null
			},
			{
				id: "/profile/tokens",
				pattern: /^\/profile\/tokens\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 24 },
				endpoint: null
			},
			{
				id: "/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 25 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map

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
		client: {start:"_app/immutable/entry/start.Fwex0aiO.js",app:"_app/immutable/entry/app.DZFJBQg0.js",imports:["_app/immutable/entry/start.Fwex0aiO.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/entry/app.DZFJBQg0.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-CEacMosT.js')),
			__memo(() => import('./chunks/1-CDL-EnTl.js')),
			__memo(() => import('./chunks/2-CMnZlOUc.js')),
			__memo(() => import('./chunks/3-BF1p2bQc.js')),
			__memo(() => import('./chunks/4-CrsBA0_f.js')),
			__memo(() => import('./chunks/5-xatz-lof.js')),
			__memo(() => import('./chunks/6-CrMD5wo6.js')),
			__memo(() => import('./chunks/7-F-TYX_uy.js')),
			__memo(() => import('./chunks/8-BLsJki0h.js')),
			__memo(() => import('./chunks/9-BYpCNHKK.js')),
			__memo(() => import('./chunks/10-BUzxskAu.js')),
			__memo(() => import('./chunks/11-D_5ChxQH.js')),
			__memo(() => import('./chunks/12-Drs7GRkm.js')),
			__memo(() => import('./chunks/13-D4Cvdf_h.js')),
			__memo(() => import('./chunks/14-AZS7brrd.js')),
			__memo(() => import('./chunks/15-B0Aj0YSz.js')),
			__memo(() => import('./chunks/16-B_Yve5Ti.js')),
			__memo(() => import('./chunks/17-DvTiWCHF.js')),
			__memo(() => import('./chunks/18-kOizWHhl.js')),
			__memo(() => import('./chunks/19-C1mUcSWe.js')),
			__memo(() => import('./chunks/20-B2fUHtoy.js')),
			__memo(() => import('./chunks/21-Dwi8i96n.js'))
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
				id: "/admin/clusters",
				pattern: /^\/admin\/clusters\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/admin/clusters/new",
				pattern: /^\/admin\/clusters\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/admin/clusters/[id]",
				pattern: /^\/admin\/clusters\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/admin/teams",
				pattern: /^\/admin\/teams\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/admin/teams/new",
				pattern: /^\/admin\/teams\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/admin/teams/[id]",
				pattern: /^\/admin\/teams\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/admin/users",
				pattern: /^\/admin\/users\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/admin/users/new",
				pattern: /^\/admin\/users\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/admin/users/[id]",
				pattern: /^\/admin\/users\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/audit",
				pattern: /^\/audit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/inventory",
				pattern: /^\/inventory\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]/activity",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/activity\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/profile/ssh-keys",
				pattern: /^\/profile\/ssh-keys\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/profile/tokens",
				pattern: /^\/profile\/tokens\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 21 },
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

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
		client: {start:"_app/immutable/entry/start.CB-K6XVU.js",app:"_app/immutable/entry/app.BfclnNr0.js",imports:["_app/immutable/entry/start.CB-K6XVU.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/entry/app.BfclnNr0.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-C1hZkOM6.js')),
			__memo(() => import('./chunks/1-BYFgwbkz.js')),
			__memo(() => import('./chunks/2-DMmdOw1D.js')),
			__memo(() => import('./chunks/3-iEfPt4Kv.js')),
			__memo(() => import('./chunks/4-DIGWt6tq.js')),
			__memo(() => import('./chunks/5-pD5g4-2m.js')),
			__memo(() => import('./chunks/6-WWi9ONEQ.js')),
			__memo(() => import('./chunks/7-BNUBv1Cv.js')),
			__memo(() => import('./chunks/8-z3dsdosy.js')),
			__memo(() => import('./chunks/9-CSLwUj9E.js')),
			__memo(() => import('./chunks/10-Dn0VLqz9.js')),
			__memo(() => import('./chunks/11-D4fWjgAp.js')),
			__memo(() => import('./chunks/12-y-Up7wVz.js')),
			__memo(() => import('./chunks/13-tH1k8v3g.js')),
			__memo(() => import('./chunks/14-BCUQXNYP.js')),
			__memo(() => import('./chunks/15-dnIAB-dw.js')),
			__memo(() => import('./chunks/16-BUHXehOY.js')),
			__memo(() => import('./chunks/17-CnFVq2dh.js')),
			__memo(() => import('./chunks/18-CYpRuQvY.js')),
			__memo(() => import('./chunks/19-hNGS54iy.js'))
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
				id: "/admin/teams/[id]",
				pattern: /^\/admin\/teams\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/admin/users",
				pattern: /^\/admin\/users\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/admin/users/new",
				pattern: /^\/admin\/users\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/admin/users/[id]",
				pattern: /^\/admin\/users\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/audit",
				pattern: /^\/audit\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/inventory",
				pattern: /^\/inventory\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/inventory/[cluster]/[vmid]/activity",
				pattern: /^\/inventory\/([^/]+?)\/([^/]+?)\/activity\/?$/,
				params: [{"name":"cluster","optional":false,"rest":false,"chained":false},{"name":"vmid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/profile/ssh-keys",
				pattern: /^\/profile\/ssh-keys\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/profile/tokens",
				pattern: /^\/profile\/tokens\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 19 },
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

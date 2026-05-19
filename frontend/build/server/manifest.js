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
		client: {start:"_app/immutable/entry/start.DiRudsWY.js",app:"_app/immutable/entry/app.hXrr0sPI.js",imports:["_app/immutable/entry/start.DiRudsWY.js","_app/immutable/chunks/4BoP6hY8.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/entry/app.hXrr0sPI.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-DU5WLcVH.js')),
			__memo(() => import('./chunks/1-BrjFYp0Q.js')),
			__memo(() => import('./chunks/2-TuhD5XFw.js')),
			__memo(() => import('./chunks/3-BF1p2bQc.js')),
			__memo(() => import('./chunks/4-CLOEt5pr.js')),
			__memo(() => import('./chunks/5-D7AGB8WP.js')),
			__memo(() => import('./chunks/6-DqAEvWph.js')),
			__memo(() => import('./chunks/7-YmbO-QBi.js')),
			__memo(() => import('./chunks/8-BKUOI2gl.js')),
			__memo(() => import('./chunks/9-De0Mv6Cn.js')),
			__memo(() => import('./chunks/10-DCEVocJD.js')),
			__memo(() => import('./chunks/11-D1jGjn9W.js')),
			__memo(() => import('./chunks/12-BpnyXb4a.js')),
			__memo(() => import('./chunks/13-CTm_W1FH.js')),
			__memo(() => import('./chunks/14-vQS0JpR0.js')),
			__memo(() => import('./chunks/15-DDxw1LQ5.js')),
			__memo(() => import('./chunks/16-DcDu0Qw3.js')),
			__memo(() => import('./chunks/17-BD3pQ77-.js')),
			__memo(() => import('./chunks/18-BKojRsCH.js')),
			__memo(() => import('./chunks/19-CcpeBiJL.js')),
			__memo(() => import('./chunks/20-Bu_G2lFa.js')),
			__memo(() => import('./chunks/21-B1wALpwx.js')),
			__memo(() => import('./chunks/22-DD3RWjDi.js')),
			__memo(() => import('./chunks/23-81cRU2Cj.js')),
			__memo(() => import('./chunks/24-Do3ZyBMx.js')),
			__memo(() => import('./chunks/25-Dvf6odi_.js'))
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

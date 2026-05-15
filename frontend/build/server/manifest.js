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
		client: {start:"_app/immutable/entry/start.D0BwFzHx.js",app:"_app/immutable/entry/app.CUVgvecn.js",imports:["_app/immutable/entry/start.D0BwFzHx.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/entry/app.CUVgvecn.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-DgxFGFhF.js')),
			__memo(() => import('./chunks/1-CUq32TFL.js')),
			__memo(() => import('./chunks/2-CcWLR1cS.js')),
			__memo(() => import('./chunks/3-CUIHZysF.js')),
			__memo(() => import('./chunks/4-YHFlV27v.js')),
			__memo(() => import('./chunks/5-CPssILhM.js')),
			__memo(() => import('./chunks/6-D59KKJ_w.js')),
			__memo(() => import('./chunks/7-DCnG6ev1.js')),
			__memo(() => import('./chunks/8-Bh-gVXro.js')),
			__memo(() => import('./chunks/9-BiYJngvP.js')),
			__memo(() => import('./chunks/10-DC0axlOo.js')),
			__memo(() => import('./chunks/11-CKFvc1ll.js')),
			__memo(() => import('./chunks/12-BZ8yRI6-.js')),
			__memo(() => import('./chunks/13-BgKDIvdf.js')),
			__memo(() => import('./chunks/14-BrznRU8H.js')),
			__memo(() => import('./chunks/15-Bbcjz_NO.js')),
			__memo(() => import('./chunks/16-8xbwZ7sv.js')),
			__memo(() => import('./chunks/17-VWnHRhRu.js')),
			__memo(() => import('./chunks/18-DWO3yGl7.js')),
			__memo(() => import('./chunks/19-Cb7lJGr1.js')),
			__memo(() => import('./chunks/20-P4MLnMD3.js')),
			__memo(() => import('./chunks/21-DSxQ_n52.js'))
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

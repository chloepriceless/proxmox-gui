import 'clsx';

function _layout($$renderer, $$props) {
  let { children } = $$props;
  $$renderer.push(`<div class="bg-muted min-h-screen px-4 py-12"><div class="mx-auto flex w-full max-w-[35rem] flex-col items-center gap-6">`);
  children($$renderer);
  $$renderer.push(`<!----></div></div>`);
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-DXaANruz.js.map

// Cloud-Init two-pane editor behaviour tests — Plan 04-13, Task 1.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (the same constraint every Phase 1-4 component test documents — see
// tests/vm-wizard.test.ts, tests/wizard-draft.test.ts). We therefore test the
// *logic* the editor carries, exercising the real code in `cloudinit-form.ts`:
//   - the form-to-preview-request translation feeding `cloudinitPreview`,
//   - the form-to-create-fields translation feeding `buildQemuRequest`,
//   - the SSH-key resolution + the team-wide owner grouping (D-11),
//   - the block-hard / warn-soft verdict predicates (D-12, VM-07).
//
// The rendered two-pane Svelte markup (the form left / `CloudInitYamlPane`
// right, the PVE-injected-line dimming + badge, the hard/soft validation
// blocks) is exercised end-to-end by `pnpm exec svelte-check` (the typed-props
// contract) — see the plan's automated verification.
//
// A static no-code-editor-import assertion guards the UI-SPEC Design System
// rule (monaco / codemirror / prismjs / shiki are forbidden).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cloudInitFormDefaults,
  resolveSshKeys,
  groupSshKeysByOwner,
  toCloudInitPreviewRequest,
  toQemuCloudInitFields,
  cloudInitBlocksNext,
  hardErrorFor,
  hasSoftWarnings,
  linesToList,
  listToLines,
  CLOUD_INIT_IP_MODES,
  type CloudInitEditorForm,
  type SshKeyChoice,
} from '$lib/components/wizard/cloudinit-form';
import type { CloudInitVerdict } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sshKey(over: Partial<SshKeyChoice>): SshKeyChoice {
  return {
    id: 1,
    name: 'laptop',
    owner: 'alice',
    publicKey: 'ssh-ed25519 AAAA alice@laptop',
    ...over,
  };
}

function editorForm(over: Partial<CloudInitEditorForm> = {}): CloudInitEditorForm {
  return { ...cloudInitFormDefaults(), ...over };
}

function verdict(over: Partial<CloudInitVerdict> = {}): CloudInitVerdict {
  return { hard_errors: [], soft_warnings: [], ok: true, ...over };
}

// ---------------------------------------------------------------------------
// cloudInitFormDefaults
// ---------------------------------------------------------------------------

describe('cloudInitFormDefaults', () => {
  it('produces an empty form with the dhcp IP mode and no selected keys', () => {
    const f = cloudInitFormDefaults();
    expect(f.ciuser).toBe('');
    expect(f.cipassword).toBe('');
    expect(f.sshKeyIds).toEqual([]);
    expect(f.ipMode).toBe('dhcp');
    expect(f.nameservers).toEqual([]);
    expect(f.packages).toEqual([]);
    expect(f.runcmd).toEqual([]);
  });

  it('returns a fresh object each call (no shared mutable arrays)', () => {
    const a = cloudInitFormDefaults();
    const b = cloudInitFormDefaults();
    a.sshKeyIds.push(9);
    expect(b.sshKeyIds).toEqual([]);
  });

  it('exposes the four IP modes the network field offers', () => {
    expect(CLOUD_INIT_IP_MODES).toEqual(['auto', 'dhcp', 'static', 'none']);
  });
});

// ---------------------------------------------------------------------------
// resolveSshKeys + groupSshKeysByOwner — the team-wide multi-select (D-11)
// ---------------------------------------------------------------------------

describe('resolveSshKeys', () => {
  const catalogue = [
    sshKey({ id: 1, owner: 'alice', publicKey: 'ssh-ed25519 AAAA alice' }),
    sshKey({ id: 2, owner: 'bob', publicKey: 'ssh-rsa BBBB bob' }),
    sshKey({ id: 3, owner: 'alice', publicKey: 'ssh-ed25519 CCCC alice2' }),
  ];

  it('resolves selected ids to their public-key text in selection order', () => {
    expect(resolveSshKeys([3, 1], catalogue)).toEqual([
      'ssh-ed25519 CCCC alice2',
      'ssh-ed25519 AAAA alice',
    ]);
  });

  it('drops unknown ids (a key removed mid-wizard)', () => {
    expect(resolveSshKeys([1, 99], catalogue)).toEqual(['ssh-ed25519 AAAA alice']);
  });

  it('returns an empty list when nothing is selected', () => {
    expect(resolveSshKeys([], catalogue)).toEqual([]);
  });

  it('skips a key whose public-key text is blank', () => {
    const withBlank = [...catalogue, sshKey({ id: 4, publicKey: '   ' })];
    expect(resolveSshKeys([4], withBlank)).toEqual([]);
  });
});

describe('groupSshKeysByOwner — keys from all team members, grouped by owner', () => {
  it('groups keys by owning user, owners sorted, all keys preserved', () => {
    const catalogue = [
      sshKey({ id: 1, owner: 'bob', name: 'desk' }),
      sshKey({ id: 2, owner: 'alice', name: 'laptop' }),
      sshKey({ id: 3, owner: 'alice', name: 'phone' }),
    ];
    const groups = groupSshKeysByOwner(catalogue);
    expect(groups.map((g) => g.owner)).toEqual(['alice', 'bob']);
    expect(groups[0].keys.map((k) => k.id)).toEqual([2, 3]);
    expect(groups[1].keys.map((k) => k.id)).toEqual([1]);
  });

  it('returns no groups for an empty catalogue', () => {
    expect(groupSshKeysByOwner([])).toEqual([]);
  });

  it('every grouped key remains individually selectable (carries its id)', () => {
    const groups = groupSshKeysByOwner([sshKey({ id: 7 })]);
    expect(groups[0].keys[0].id).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// toCloudInitPreviewRequest — the form → cloudinitPreview body
// ---------------------------------------------------------------------------

describe('toCloudInitPreviewRequest', () => {
  const catalogue = [sshKey({ id: 1, publicKey: 'ssh-ed25519 AAAA alice' })];

  it('maps the editor form to the wire CloudInitForm with the source kind', () => {
    const req = toCloudInitPreviewRequest(
      editorForm({ ciuser: 'ubuntu', cipassword: 's3cret', sshKeyIds: [1] }),
      catalogue,
      'cloud-image'
    );
    expect(req.ciuser).toBe('ubuntu');
    expect(req.cipassword).toBe('s3cret');
    expect(req.sshkeys).toEqual(['ssh-ed25519 AAAA alice']);
    expect(req.source_kind).toBe('cloud-image');
  });

  it('nulls a blank ciuser / cipassword and trims string fields', () => {
    const req = toCloudInitPreviewRequest(
      editorForm({ ciuser: '  ', cipassword: '', ipAddress: ' 10.0.0.5/24 ' }),
      [],
      'blank-iso'
    );
    expect(req.ciuser).toBeNull();
    expect(req.cipassword).toBeNull();
    expect(req.ip_address).toBe('10.0.0.5/24');
  });

  it('strips blank nameserver / package / runcmd entries', () => {
    const req = toCloudInitPreviewRequest(
      editorForm({
        nameservers: ['1.1.1.1', '  ', '8.8.8.8'],
        packages: ['curl', ''],
        runcmd: ['  echo hi  '],
      }),
      [],
      'cloud-image'
    );
    expect(req.nameservers).toEqual(['1.1.1.1', '8.8.8.8']);
    expect(req.packages).toEqual(['curl']);
    expect(req.runcmd).toEqual(['echo hi']);
  });
});

// ---------------------------------------------------------------------------
// toQemuCloudInitFields — the form → CreateQemuRequest cloud-init fields
// ---------------------------------------------------------------------------

describe('toQemuCloudInitFields', () => {
  const catalogue = [
    sshKey({ id: 1, publicKey: 'ssh-ed25519 AAAA alice' }),
    sshKey({ id: 2, publicKey: 'ssh-rsa BBBB bob' }),
  ];

  it('produces the ci_user / ci_password / ssh_public_keys create fields', () => {
    const fields = toQemuCloudInitFields(
      editorForm({ ciuser: 'ubuntu', cipassword: 's3cret', sshKeyIds: [1, 2] }),
      catalogue
    );
    expect(fields.ci_user).toBe('ubuntu');
    expect(fields.ci_password).toBe('s3cret');
    expect(fields.ssh_public_keys).toBe('ssh-ed25519 AAAA alice\nssh-rsa BBBB bob');
  });

  it('nulls ssh_public_keys when no key is selected', () => {
    const fields = toQemuCloudInitFields(editorForm({ ciuser: 'ubuntu' }), catalogue);
    expect(fields.ssh_public_keys).toBeNull();
  });

  it('nulls a blank ci_user', () => {
    const fields = toQemuCloudInitFields(editorForm({ ciuser: '' }), catalogue);
    expect(fields.ci_user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Verdict predicates — block-hard / warn-soft (D-12, VM-07)
// ---------------------------------------------------------------------------

describe('cloudInitBlocksNext — hard errors disable the wizard CTA', () => {
  it('blocks Next when the verdict has any hard error', () => {
    const v = verdict({
      hard_errors: [{ field: 'cipassword', message: 'A password is required.' }],
      ok: false,
    });
    expect(cloudInitBlocksNext(v)).toBe(true);
  });

  it('does NOT block Next for a soft-warning-only verdict (D-12)', () => {
    const v = verdict({ soft_warnings: ['DNS set on a DHCP NIC.'] });
    expect(cloudInitBlocksNext(v)).toBe(false);
  });

  it('does NOT block Next before the first preview (null verdict)', () => {
    expect(cloudInitBlocksNext(null)).toBe(false);
  });

  it('does NOT block Next for a fully-clean verdict', () => {
    expect(cloudInitBlocksNext(verdict())).toBe(false);
  });
});

describe('hardErrorFor — the inline offending-field message', () => {
  const v = verdict({
    hard_errors: [
      { field: 'cipassword', message: 'A password is required.' },
      { field: 'ip_address', message: 'The IP address is not valid CIDR.' },
    ],
    ok: false,
  });

  it('returns the message for an offending field', () => {
    expect(hardErrorFor(v, 'cipassword')).toBe('A password is required.');
    expect(hardErrorFor(v, 'ip_address')).toBe('The IP address is not valid CIDR.');
  });

  it('returns null for a clean field', () => {
    expect(hardErrorFor(v, 'ciuser')).toBeNull();
  });

  it('returns null for a null verdict', () => {
    expect(hardErrorFor(null, 'cipassword')).toBeNull();
  });
});

describe('hasSoftWarnings', () => {
  it('is true when soft warnings exist', () => {
    expect(hasSoftWarnings(verdict({ soft_warnings: ['DNS on DHCP'] }))).toBe(true);
  });

  it('is false for a clean / null verdict', () => {
    expect(hasSoftWarnings(verdict())).toBe(false);
    expect(hasSoftWarnings(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linesToList / listToLines — the multi-line textarea fields
// ---------------------------------------------------------------------------

describe('linesToList / listToLines', () => {
  it('parses a textarea value into a trimmed, blank-free list', () => {
    expect(linesToList('curl\n  wget  \n\nhtop\n')).toEqual(['curl', 'wget', 'htop']);
  });

  it('round-trips a list back to a one-per-line textarea value', () => {
    expect(listToLines(['curl', 'wget'])).toBe('curl\nwget');
  });

  it('an empty textarea yields an empty list', () => {
    expect(linesToList('   \n  ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// No code-editor dependency — UI-SPEC Design System (the checker validates it)
// ---------------------------------------------------------------------------

describe('no code-editor / syntax-highlighter dependency', () => {
  const wizardDir = fileURLToPath(
    new URL('../src/lib/components/wizard/', import.meta.url)
  );
  const forbidden = /\b(monaco|codemirror|prismjs|shiki)\b/i;

  for (const file of [
    'cloudinit-form.ts',
    'CloudInitEditor.svelte',
    'CloudInitYamlPane.svelte',
  ]) {
    it(`${file} imports no code-editor library`, () => {
      const src = readFileSync(wizardDir + file, 'utf8');
      // Strip line + block comments so the assertion checks real imports,
      // not prose that legitimately names the forbidden libraries.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      expect(code).not.toMatch(forbidden);
    });
  }
});

# Persistence Schema Spec

Status: active spec. Goal: exact v1 persisted/shareable artifact shapes and migration strategy for the new core.

## Principles

- New rebuild starts at schema version `1`.
- No compatibility with previous prototype schemas.
- Every persisted/shareable artifact has explicit `kind` and `version`.
- `kind` prevents parsing the wrong artifact type.
- `version` drives migration.
- Migration mechanism exists from day one and is tested, even when only v1 exists.
- Secrets remain encrypted at rest.

## Artifact Kinds

```txt
better-age/home-state
better-age/private-key
better-age/payload
better-age/public-identity
```

## Version Policy

```txt
current home state version: 2
current private key plaintext version: 1
current payload version: 1
current public identity string version: 1
```

Rules:

- version is an integer.
- unsupported future version => `*_CLI_TOO_OLD`.
- older supported version with migration path => migrate.
- older version without migration path => `*_MIGRATION_PATH_MISSING`.
- malformed version/kind/body => `*_INVALID`.

## HomeStateDocument v2

Shape:

```ts
type HomeStateDocumentV2 = {
  kind: "better-age/home-state";
  version: 2;
  ownerId: OwnerId;
  displayName: DisplayName;
  identityUpdatedAt: IsoUtcTimestamp;
  currentKey: {
    publicKey: string;
    fingerprint: KeyFingerprint;
    encryptedPrivateKeyRef: string;
    createdAt: IsoUtcTimestamp;
  };
  retiredKeys: Array<{
    publicKey: string;
    fingerprint: KeyFingerprint;
    encryptedPrivateKeyRef: string;
    createdAt: IsoUtcTimestamp;
    retiredAt: IsoUtcTimestamp;
  }>;
  knownIdentities: Array<{
    ownerId: OwnerId;
    publicKey: string;
    displayName: DisplayName;
    identityUpdatedAt: IsoUtcTimestamp;
    localAlias: LocalAlias | null;
  }>;
  preferences: {
    rotationTtl: RotationTtl;
    editorCommand: string | null;
  };
};
```

Rules:

- encrypted private key material is not embedded in the public identity string.
- `encryptedPrivateKeyRef` points to a separate age-encrypted private-key blob.
- known identities are home-local address book entries.
- local aliases are stored only in home state.
- retired keys are local decryptability state, not exportable public identity.
- `editorCommand` stores a remembered editor preference, or `null` when none is configured.

## HomeStateDocument v1

Status: supported input only, migrated to v2 on load.

Difference from v2:

```ts
type HomeStateDocumentV1 = Omit<HomeStateDocumentV2, "version" | "preferences"> & {
  version: 1;
  preferences: {
    rotationTtl: RotationTtl;
  };
};
```

Migration:

```ts
v1.preferences.editorCommand = null
```

## Encrypted Private Key Storage

Layout:

```txt
home-state.json
keys/
  <fingerprint>.age
```

Reference shape:

```txt
type EncryptedPrivateKeyRef = "keys/<fingerprint>.age"
```

Plaintext before age encryption:

```ts
type PrivateKeyPlaintextV1 = {
  kind: "better-age/private-key";
  version: 1;
  ownerId: OwnerId;
  publicKey: string;
  privateKey: string;
  fingerprint: KeyFingerprint;
  createdAt: IsoUtcTimestamp;
};
```

Rules:

- key blobs use age-native encrypted file format.
- the project does not invent a custom outer crypto container.
- the product remains an age wrapper with better UX, persistence, and flow policy.
- private key plaintext exists only inside decrypted in-memory command scope.
- passphrase change decrypts and reencrypts all current and retired key blobs.
- identity rotation writes a new key blob and moves previous current key metadata to retired keys.
- deleting/forgetting known identities never touches key blobs.
- public identity export never reads key blobs.

## PayloadDocument v1

Logical plaintext envelope before encryption:

```ts
type PayloadPlaintextV1 = {
  kind: "better-age/payload";
  version: 1;
  payloadId: PayloadId;
  createdAt: IsoUtcTimestamp;
  lastRewrittenAt: IsoUtcTimestamp;
  envText: EnvText;
  recipients: Array<{
    ownerId: OwnerId;
    publicKey: string;
    displayName: DisplayName;
    identityUpdatedAt: IsoUtcTimestamp;
  }>;
};
```

Persisted file:

```ts
type PayloadDocumentV1 = {
  kind: "better-age/payload";
  version: 1;
  encryptedPayload: string;
};
```

Rules:

- persisted payload file exposes only envelope kind/version plus encrypted payload bytes.
- recipients are duplicated inside encrypted payload plaintext for UX after decrypt.
- granting stores the recipient public identity snapshot.
- revoking removes recipient by OwnerId.
- updating rewrites to current schema and refreshes self recipient when needed.

## PublicIdentityString v1

Decoded payload:

```ts
type PublicIdentityStringV1 = {
  kind: "better-age/public-identity";
  version: 1;
  ownerId: OwnerId;
  displayName: DisplayName;
  publicKey: string;
  identityUpdatedAt: IsoUtcTimestamp;
};
```

Rules:

- contains current public identity only.
- never contains private key material.
- never contains retired keys.
- local alias is not part of public identity string.

## Migration Contract

Migration API shape:

```ts
type MigrationResult<TCurrent> =
  | { kind: "already-current"; document: TCurrent }
  | {
      kind: "migrated";
      document: TCurrent;
      fromVersion: number;
      toVersion: number;
    };
```

Rules:

- migration functions are pure over decoded JSON.
- repository adapters own read/write bytes.
- migration does not perform crypto.
- home state migration may persist through preflight.
- payload read migration may be in-memory only.
- payload persisted migration happens only through `updatePayload`.

## Required Fixtures

Fixture categories:

```txt
valid current v1 home state
valid current v1 payload plaintext
valid current v1 encrypted payload document
valid current v1 public identity string
valid current v1 encrypted private key blob
wrong key blob passphrase
private key plaintext wrong kind
private key plaintext future version
wrong kind for each artifact parser
future version for each artifact parser
malformed version for each artifact parser
invalid missing required field for each artifact parser
valid v1 migration no-op for each artifact type
synthetic older version migration fixture once v2 exists
```

Rules:

- v1 no-op migration tests must exist immediately.
- future-version tests must exist immediately.
- wrong-kind tests must exist immediately.
- encrypted key blob round-trip tests must exist immediately.
- passphrase change must prove all key blobs decrypt with the new passphrase and not the old one.
- no prototype-schema fixture compatibility tests.

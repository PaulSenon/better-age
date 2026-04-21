import { describe, expect, it } from "vitest";
import {
	normalizeArtifactToCurrent,
	type VersionedArtifactDefinition,
} from "./ArtifactMigration.js";

type FakeArtifact = {
	readonly history?: ReadonlyArray<string>;
	readonly payload: string;
	readonly schemaVersion: number;
};

describe("ArtifactMigration", () => {
	it("classifies current artifact as current without applying migration steps", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 2,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [],
		};
		const artifact: FakeArtifact = {
			payload: "current",
			schemaVersion: 2,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
			}),
		).toEqual({
			_tag: "current",
			artifact,
			artifactId: "fake-artifact",
			version: 2,
		});
	});

	it("migrates one legacy version through one explicit adjacent step", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 2,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						payload: `${artifact.payload}-migrated`,
						schemaVersion: 2,
					}),
					toVersion: 2,
				},
			],
		};
		const artifact: FakeArtifact = {
			payload: "legacy",
			schemaVersion: 1,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
			}),
		).toEqual({
			_tag: "migrated",
			appliedSteps: [{ fromVersion: 1, toVersion: 2 }],
			artifact: {
				payload: "legacy-migrated",
				schemaVersion: 2,
			},
			artifactId: "fake-artifact",
			fromVersion: 1,
			toVersion: 2,
		});
	});

	it("migrates several legacy versions through ordered adjacent hops until current", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						history: [...(artifact.history ?? []), "1->2"],
						schemaVersion: 2,
					}),
					toVersion: 2,
				},
				{
					fromVersion: 2,
					migrate: (artifact) => ({
						...artifact,
						history: [...(artifact.history ?? []), "2->3"],
						payload: `${artifact.payload}-current`,
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
			],
		};
		const artifact: FakeArtifact = {
			history: [],
			payload: "legacy",
			schemaVersion: 1,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
			}),
		).toEqual({
			_tag: "migrated",
			appliedSteps: [
				{ fromVersion: 1, toVersion: 2 },
				{ fromVersion: 2, toVersion: 3 },
			],
			artifact: {
				history: ["1->2", "2->3"],
				payload: "legacy-current",
				schemaVersion: 3,
			},
			artifactId: "fake-artifact",
			fromVersion: 1,
			toVersion: 3,
		});
	});

	it("fails with missing-path when an adjacent step is missing", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						history: [...(artifact.history ?? []), "1->3"],
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
				{
					fromVersion: 2,
					migrate: (artifact) => ({
						...artifact,
						history: [...(artifact.history ?? []), "2->3"],
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
			],
		};
		const artifact: FakeArtifact = {
			history: [],
			payload: "legacy",
			schemaVersion: 1,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
			}),
		).toEqual({
			_tag: "missing-path",
			artifactId: "fake-artifact",
			artifactVersion: 1,
			currentVersion: 3,
			missingFromVersion: 1,
			missingToVersion: 2,
		});
	});

	it("fails as unsupported-newer when artifact version is ahead of runtime", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [],
		};
		const artifact: FakeArtifact = {
			payload: "future",
			schemaVersion: 4,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
			}),
		).toEqual({
			_tag: "unsupported-newer",
			artifactId: "fake-artifact",
			artifactVersion: 4,
			currentVersion: 3,
		});
	});

	it("fails as hard-broken when policy explicitly blocks an otherwise migratable old version", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 2,
					}),
					toVersion: 2,
				},
				{
					fromVersion: 2,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
			],
		};
		const artifact: FakeArtifact = {
			payload: "legacy",
			schemaVersion: 1,
		};

		expect(
			normalizeArtifactToCurrent({
				artifact,
				definition,
				policy: {
					hardBreakAtOrBelowVersion: 1,
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "fake-artifact",
			artifactVersion: 1,
			currentVersion: 3,
		});
	});

	it("treats hard-break cutoff and explicit blocked-version table as additive", () => {
		const definition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 2,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
			],
		};

		expect(
			normalizeArtifactToCurrent({
				artifact: {
					payload: "blocked-by-table",
					schemaVersion: 2,
				},
				definition,
				policy: {
					hardBreakAtOrBelowVersion: 1,
					hardBreakVersions: [2],
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "fake-artifact",
			artifactVersion: 2,
			currentVersion: 3,
		});
	});

	it("distinguishes current, migrated, unsupported-newer, hard-broken, and missing-path branches", () => {
		const fullDefinition: VersionedArtifactDefinition<FakeArtifact> = {
			artifactId: "fake-artifact",
			currentVersion: 3,
			readVersion: (artifact) => artifact.schemaVersion,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 2,
					}),
					toVersion: 2,
				},
				{
					fromVersion: 2,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 3,
					}),
					toVersion: 3,
				},
			],
		};
		const missingPathDefinition: VersionedArtifactDefinition<FakeArtifact> = {
			...fullDefinition,
			steps: [
				{
					fromVersion: 1,
					migrate: (artifact) => ({
						...artifact,
						schemaVersion: 2,
					}),
					toVersion: 2,
				},
			],
		};

		const outcomes = [
			normalizeArtifactToCurrent({
				artifact: { payload: "current", schemaVersion: 3 },
				definition: fullDefinition,
			}),
			normalizeArtifactToCurrent({
				artifact: { payload: "legacy", schemaVersion: 1 },
				definition: fullDefinition,
			}),
			normalizeArtifactToCurrent({
				artifact: { payload: "future", schemaVersion: 4 },
				definition: fullDefinition,
			}),
			normalizeArtifactToCurrent({
				artifact: { payload: "blocked", schemaVersion: 2 },
				definition: fullDefinition,
				policy: { hardBreakVersions: [2] },
			}),
			normalizeArtifactToCurrent({
				artifact: { payload: "missing", schemaVersion: 2 },
				definition: missingPathDefinition,
			}),
		];

		expect(outcomes.map((outcome) => outcome._tag)).toEqual([
			"current",
			"migrated",
			"unsupported-newer",
			"hard-broken",
			"missing-path",
		]);
	});
});

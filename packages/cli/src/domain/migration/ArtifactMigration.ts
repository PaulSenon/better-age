export type ArtifactMigrationStep<TArtifact> = {
	readonly fromVersion: number;
	readonly migrate: (artifact: TArtifact) => TArtifact;
	readonly toVersion: number;
};

export type VersionedArtifactDefinition<TArtifact> = {
	readonly artifactId: string;
	readonly currentVersion: number;
	readonly readVersion: (artifact: TArtifact) => number;
	readonly steps: ReadonlyArray<ArtifactMigrationStep<TArtifact>>;
};

export type ArtifactMigrationPolicy = {
	readonly hardBreakAtOrBelowVersion?: number;
	readonly hardBreakVersions?: ReadonlyArray<number>;
};

export type NormalizeArtifactResult<TArtifact> =
	| {
			readonly _tag: "current";
			readonly artifact: TArtifact;
			readonly artifactId: string;
			readonly version: number;
	  }
	| {
			readonly _tag: "migrated";
			readonly appliedSteps: ReadonlyArray<{
				readonly fromVersion: number;
				readonly toVersion: number;
			}>;
			readonly artifact: TArtifact;
			readonly artifactId: string;
			readonly fromVersion: number;
			readonly toVersion: number;
	  }
	| {
			readonly _tag: "unsupported-newer";
			readonly artifactId: string;
			readonly artifactVersion: number;
			readonly currentVersion: number;
	  }
	| {
			readonly _tag: "hard-broken";
			readonly artifactId: string;
			readonly artifactVersion: number;
			readonly currentVersion: number;
	  }
	| {
			readonly _tag: "missing-path";
			readonly artifactId: string;
			readonly artifactVersion: number;
			readonly currentVersion: number;
			readonly missingFromVersion: number;
			readonly missingToVersion: number;
	  };

const isHardBrokenVersion = (
	policy: ArtifactMigrationPolicy | undefined,
	version: number,
) => {
	const isBlockedByCutoff =
		policy?.hardBreakAtOrBelowVersion !== undefined
			? version <= policy.hardBreakAtOrBelowVersion
			: false;
	const isBlockedByExplicitVersion =
		policy?.hardBreakVersions?.includes(version) ?? false;

	return isBlockedByCutoff || isBlockedByExplicitVersion;
};

const findAdjacentStep = <TArtifact>(
	definition: VersionedArtifactDefinition<TArtifact>,
	version: number,
) =>
	definition.steps.find(
		(step) => step.fromVersion === version && step.toVersion === version + 1,
	);

export const normalizeArtifactToCurrent = <TArtifact>(input: {
	readonly artifact: TArtifact;
	readonly definition: VersionedArtifactDefinition<TArtifact>;
	readonly policy?: ArtifactMigrationPolicy;
}): NormalizeArtifactResult<TArtifact> => {
	const artifactVersion = input.definition.readVersion(input.artifact);

	if (artifactVersion === input.definition.currentVersion) {
		return {
			_tag: "current",
			artifact: input.artifact,
			artifactId: input.definition.artifactId,
			version: artifactVersion,
		};
	}

	if (artifactVersion > input.definition.currentVersion) {
		return {
			_tag: "unsupported-newer",
			artifactId: input.definition.artifactId,
			artifactVersion,
			currentVersion: input.definition.currentVersion,
		};
	}

	if (isHardBrokenVersion(input.policy, artifactVersion)) {
		return {
			_tag: "hard-broken",
			artifactId: input.definition.artifactId,
			artifactVersion,
			currentVersion: input.definition.currentVersion,
		};
	}

	let nextArtifact = input.artifact;
	let nextVersion = artifactVersion;
	const appliedSteps: Array<{
		readonly fromVersion: number;
		readonly toVersion: number;
	}> = [];

	while (nextVersion < input.definition.currentVersion) {
		const adjacentStep = findAdjacentStep(input.definition, nextVersion);

		if (adjacentStep === undefined) {
			return {
				_tag: "missing-path",
				artifactId: input.definition.artifactId,
				artifactVersion,
				currentVersion: input.definition.currentVersion,
				missingFromVersion: nextVersion,
				missingToVersion: nextVersion + 1,
			};
		}

		nextArtifact = adjacentStep.migrate(nextArtifact);
		nextVersion = input.definition.readVersion(nextArtifact);
		appliedSteps.push({
			fromVersion: adjacentStep.fromVersion,
			toVersion: adjacentStep.toVersion,
		});
	}

	return {
		_tag: "migrated",
		appliedSteps,
		artifact: nextArtifact,
		artifactId: input.definition.artifactId,
		fromVersion: artifactVersion,
		toVersion: nextVersion,
	};
};

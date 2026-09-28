// Repo-owned release boundaries. Future workflows/scripts should read from here
// instead of duplicating publishable package assumptions in YAML.
export const stableBaseBranch = "main";

export const releasePrTitle = "chore(release): version packages";
export const releasePrCommitMessage = releasePrTitle;
export const releasePrHeadRef = `changeset-release/${stableBaseBranch}`;

export const publishedPackages = Object.freeze([
	{
		name: "@better-age/cli",
		path: "packages/cli",
		expectedPackedFiles: ["LICENSE", "README.md", "dist/bage", "package.json"],
	},
	{
		name: "@better-age/varlock",
		path: "packages/varlock",
		expectedPackedFiles: [
			"LICENSE",
			"README.md",
			"dist/plugin.cjs",
			"dist/plugin.cjs.map",
			"package.json",
		],
	},
	// TODO: enable when public
	// {
	// 	name: "@better-age/core",
	// 	path: "packages/core",
	// },
]);

export const stableDistTag = "latest";
export const prereleaseDistTag = "next";

export const releaseTarballDirectory = ".release-tarballs";
export const releaseTarballManifestPath = `${releaseTarballDirectory}/manifest.json`;

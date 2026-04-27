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
	},
	{
		name: "@better-age/varlock",
		path: "packages/varlock",
	},
]);

export const stableDistTag = "latest";
export const prereleaseDistTag = "next";

export const publishedPackageNames = Object.freeze(
	publishedPackages.map((publishedPackage) => publishedPackage.name),
);

export const isPublishedPackage = (packageName) =>
	publishedPackageNames.includes(packageName);

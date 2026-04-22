// Repo-owned release boundaries. Future workflows/scripts should read from here
// instead of duplicating publishable package assumptions in YAML.
export const publishedPackages = Object.freeze(["@better-age/cli", "@better-age/varlock"]);

export const stableDistTag = "latest";
export const prereleaseDistTag = "next";

export const isPublishedPackage = (packageName) => publishedPackages.includes(packageName);

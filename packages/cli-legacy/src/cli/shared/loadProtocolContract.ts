export const PROTOCOL_VERSION = "1";

export const renderMissingProtocolVersionMessage = () =>
	[
		"Missing required protocol version",
		`Run with: --protocol-version=${PROTOCOL_VERSION}`,
		"",
	].join("\n");

export const renderUnsupportedProtocolVersionMessage = (
	receivedVersion: string,
) =>
	[
		`Unsupported protocol version: ${receivedVersion}`,
		`This better-age CLI supports protocol version ${PROTOCOL_VERSION}.`,
		"Update the caller/plugin to a compatible version.",
		"",
	].join("\n");

export const renderLoadUpdateRequiredMessage = (path: string) =>
	["Payload must be updated before load", `Run: bage update ${path}`, ""].join(
		"\n",
	);

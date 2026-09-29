import { describe, expect, it } from "vitest";
import {
	makeTestCli,
	otherIdentityString,
	passphrase,
	type ScriptedTerminal,
	setupHome,
} from "../support/TestCli.js";

const secret = { secret: () => passphrase } satisfies ScriptedTerminal;

const sharedSetup = async () => {
	const sarah = await otherIdentityString("Sarah");
	const nora = await otherIdentityString("Nora\u001b]0;pwned\u0007");
	const cli = makeTestCli();
	await setupHome(cli);
	await cli.run(["identity", "import", sarah, "--alias", "ops"]);
	await cli.run(["identity", "import", nora], { text: () => "" });
	await cli.run(["create", ".env.enc"], secret);
	return { cli, sarah, nora };
};

const recipientsOf = async (cli: ReturnType<typeof makeTestCli>) =>
	(await cli.run(["inspect", ".env.enc"], secret)).stdout
		.split("Recipients\n")[1]
		?.trim()
		.split("\n")
		.map((line) => line.trim());

describe("grant", () => {
	it("grants exact references: known alias or identity string", async () => {
		const { cli } = await sharedSetup();
		const other = await otherIdentityString("Zed");

		expect(await cli.run(["grant", ".env.enc", "ops"], secret)).toMatchObject({
			exitCode: 0,
			stderr: expect.stringMatching(
				/^\[OK\] Recipient granted: ops#fp_\w{16}\n$/,
			),
		});
		expect(
			(await cli.run(["grant", ".env.enc", "ops"], secret)).stderr,
		).toMatch(/^\[OK\] Recipient unchanged: ops#fp_\w+\n$/);
		expect(
			(await cli.run(["grant", ".env.enc", other], secret)).stderr,
		).toMatch(/^\[OK\] Recipient granted: Zed#fp_\w+\n$/);
		expect(
			(await cli.run(["grant", ".env.enc", "nobody"], secret)).stderr,
		).toBe(
			"[ERROR] RECIPIENT_REFERENCE_NOT_FOUND: recipient reference not found\n",
		);
		expect((await cli.run(["grant", ".env.enc", "Isaac"], secret)).stderr).toBe(
			"[ERROR] CANNOT_GRANT_SELF: you are always a recipient of your payloads\n",
		);
		expect(await recipientsOf(cli)).toEqual([
			expect.stringMatching(/^Isaac owner_\S+ \[you\]$/),
			expect.stringMatching(/^ops \(Sarah\) owner_\S+$/),
			expect.stringMatching(/^Zed owner_\S+$/),
		]);
	});

	it("guides with disabled self/granted rows and sanitized labels", async () => {
		const { cli } = await sharedSetup();
		await cli.run(["grant", ".env.enc", "ops"], secret);

		const result = await cli.run(["grant", ".env.enc"], {
			...secret,
			select: (_label, choices) =>
				choices.find((choice) => choice.label.startsWith("Nora"))?.value ?? "",
		});
		const picker = result.prompts.find((prompt) => prompt.kind === "select");

		expect(result.exitCode).toBe(0);
		expect(picker?.kind === "select" && picker.choices).toEqual([
			{
				value: expect.any(String),
				label: expect.stringMatching(/^Isaac owner_\S+ \[you\]$/),
				disabled: true,
			},
			{
				value: expect.any(String),
				label: expect.stringMatching(/^ops \(Sarah\) owner_\S+ \[granted\]$/),
				disabled: true,
			},
			{
				value: expect.any(String),
				label: expect.stringMatching(/^Nora\\x1b\]0;pwned\\x07 owner_\S+$/),
			},
			{ value: "__enter_identity_string__", label: "Enter identity string" },
			{ value: "cancel", label: "Cancel" },
		]);
		expect(result.stderr).not.toContain("\u001b");
	});

	it("imports a guided identity string before granting it", async () => {
		const { cli } = await sharedSetup();
		const zed = await otherIdentityString("Zed");
		const strings = ["garbage", zed];

		const result = await cli.run(["grant", ".env.enc"], {
			...secret,
			select: () => "__enter_identity_string__",
			text: () => strings.shift() ?? "",
		});

		expect(result.stderr).toMatch(
			/^\[ERROR\] IDENTITY_STRING_INVALID: identity string is invalid\n\[OK\] Recipient granted: Zed#fp_\w+\n$/,
		);
		expect((await cli.run(["identity", "list"])).stdout).toContain("Zed");
	});
});

describe("reference resolution", () => {
	it("refuses a display name shared by several identities", async () => {
		const first = await otherIdentityString("Sam");
		const second = await otherIdentityString("Sam");
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "import", first], { interactive: false });
		await cli.run(["identity", "import", second, "--alias", "sam2"], {
			interactive: false,
		});
		await cli.run(["create", ".env.enc"], secret);

		expect((await cli.run(["grant", ".env.enc", "Sam"], secret)).stderr).toBe(
			"[ERROR] IDENTITY_REFERENCE_AMBIGUOUS: several identities match; use the owner id or a local alias\n",
		);
		expect(
			(await cli.run(["grant", ".env.enc", "sam2"], secret)).stderr,
		).toMatch(/^\[OK\] Recipient granted: sam2#fp_\w+\n$/);
		expect((await cli.run(["identity", "forget", "Sam"])).stderr).toContain(
			"IDENTITY_REFERENCE_AMBIGUOUS",
		);
	});

	it("pushes a trusted key update of a known identity by name", async () => {
		const sarah = makeTestCli();
		await setupHome(sarah, "Sarah");
		const before = (await sarah.run(["identity", "export"])).stdout.trim();
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "import", before, "--alias", "sarah"]);
		await cli.run(["create", ".env.enc"], secret);
		await cli.run(["grant", ".env.enc", "sarah"], secret);

		await sarah.run(["identity", "rotate"], secret);
		const after = (await sarah.run(["identity", "export"])).stdout.trim();
		await cli.run(["identity", "import", after, "--trust-key-update"], {
			interactive: false,
		});

		expect(
			(await cli.run(["grant", ".env.enc", "sarah"], secret)).stderr,
		).toMatch(/^\[OK\] Recipient updated: sarah#fp_\w+\n$/);
	});
});

describe("revoke", () => {
	it("revokes exact and guided recipients but never self", async () => {
		const { cli } = await sharedSetup();
		await cli.run(["grant", ".env.enc", "ops"], secret);

		const guided = await cli.run(["revoke", ".env.enc"], {
			...secret,
			select: (_label, choices) => choices[1]?.value ?? "",
		});
		const picker = guided.prompts.find((prompt) => prompt.kind === "select");
		expect(picker?.kind === "select" && picker.choices).toEqual([
			{
				value: expect.any(String),
				label: expect.stringMatching(/\[you\]$/),
				disabled: true,
			},
			{
				value: expect.any(String),
				label: expect.stringMatching(/^ops \(Sarah\)/),
				disabled: false,
			},
			{ value: "cancel", label: "Cancel" },
		]);
		expect(guided.stderr).toMatch(/^\[OK\] Recipient revoked: owner_\S+\n$/);

		expect((await cli.run(["revoke", ".env.enc", "ops"], secret)).stderr).toBe(
			"[ERROR] RECIPIENT_REFERENCE_NOT_FOUND: recipient reference not found\n",
		);
		expect(
			(await cli.run(["revoke", ".env.enc", "Isaac"], secret)).stderr,
		).toBe(
			"[ERROR] CANNOT_REVOKE_SELF: cannot revoke yourself from a payload\n",
		);
	});

	it("requires update before exact sharing changes on outdated payloads", async () => {
		const { cli } = await sharedSetup();
		await cli.run(["identity", "rotate"], secret);

		expect(
			(await cli.run(["grant", ".env.enc", "ops"], secret)).stderr,
		).toContain("[ERROR] PAYLOAD_UPDATE_REQUIRED");
		expect(
			(
				await cli.run(["revoke", ".env.enc"], {
					...secret,
					select: (label) =>
						label === "Payload update required" ? "back" : "cancel",
				})
			).exitCode,
		).toBe(130);
	});
});

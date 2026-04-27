import type { RotationTtl } from "./HomeState.js";

const addUtcMonths = (value: Date, months: number) => {
	const next = new Date(value);
	next.setUTCMonth(next.getUTCMonth() + months);
	return next;
};

export const getRotationDueAt = (
	identityUpdatedAt: string,
	rotationTtl: RotationTtl,
): string => {
	const from = new Date(identityUpdatedAt);

	switch (rotationTtl) {
		case "1w":
			return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
		case "1m":
			return addUtcMonths(from, 1).toISOString();
		case "3m":
			return addUtcMonths(from, 3).toISOString();
		case "6m":
			return addUtcMonths(from, 6).toISOString();
		case "9m":
			return addUtcMonths(from, 9).toISOString();
		case "1y":
			return addUtcMonths(from, 12).toISOString();
	}
};

import { moment } from 'obsidian';

export const DAY_FORMAT = 'YYYY-MM-DD';

export function dayKey(timestamp = Date.now()): string {
	return moment(timestamp).format(DAY_FORMAT);
}

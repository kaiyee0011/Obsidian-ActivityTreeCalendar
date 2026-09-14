import { Plugin, TFile } from 'obsidian';
import { dayKey } from './date';
import type { ActivityData, ActivitySettings } from './types';

export const DEFAULT_MAX_HEAT_FILES = 10;
export const MIN_MAX_HEAT_FILES = 1;
export const MAX_MAX_HEAT_FILES = 100;

const DEFAULT_SETTINGS: ActivitySettings = {
	maxHeatFiles: DEFAULT_MAX_HEAT_FILES,
};
const DEFAULT_DATA: ActivityData = {
	initialized: false,
	days: {},
	settings: DEFAULT_SETTINGS,
};

function normalizeMaxHeatFiles(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_MAX_HEAT_FILES;
	}
	return Math.min(
		MAX_MAX_HEAT_FILES,
		Math.max(MIN_MAX_HEAT_FILES, Math.round(value)),
	);
}

export class ActivityStore {
	private data: ActivityData = structuredClone(DEFAULT_DATA);
	private saveTimer: number | null = null;

	constructor(private readonly plugin: Plugin) {}

	async load(): Promise<void> {
		const loaded = (await this.plugin.loadData()) as Partial<ActivityData> | null;
		this.data = {
			initialized: loaded?.initialized === true,
			days: loaded?.days ?? {},
			settings: {
				maxHeatFiles: normalizeMaxHeatFiles(
					loaded?.settings?.maxHeatFiles,
				),
			},
		};
	}

	async bootstrap(files: TFile[]): Promise<void> {
		if (this.data.initialized) return;
		for (const file of files) {
			this.add(file.path, dayKey(file.stat.mtime), false);
		}
		this.data.initialized = true;
		await this.flush();
	}

	record(file: TFile): void {
		this.add(file.path, dayKey(), true);
	}

	rename(oldPath: string, newPath: string): void {
		let changed = false;
		const oldPrefix = `${oldPath}/`;
		const newPrefix = `${newPath}/`;

		for (const entries of Object.values(this.data.days)) {
			for (const path of Object.keys(entries)) {
				if (path !== oldPath && !path.startsWith(oldPrefix)) continue;
				const renamed = path === oldPath
					? newPath
					: newPrefix + path.slice(oldPrefix.length);
				const count = entries[path] ?? 0;
				entries[renamed] = (entries[renamed] ?? 0) + count;
				delete entries[path];
				changed = true;
			}
		}

		if (changed) this.scheduleSave();
	}

	pathsFor(day: string): string[] {
		return Object.keys(this.data.days[day] ?? {}).sort((a, b) =>
			a.localeCompare(b),
		);
	}

	countFor(day: string): number {
		return Object.keys(this.data.days[day] ?? {}).length;
	}

	maxHeatFiles(): number {
		return this.data.settings.maxHeatFiles;
	}

	async setMaxHeatFiles(value: number): Promise<void> {
		const normalized = normalizeMaxHeatFiles(value);
		if (normalized === this.data.settings.maxHeatFiles) return;
		this.data.settings.maxHeatFiles = normalized;
		await this.flush();
	}

	async close(): Promise<void> {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
			await this.flush();
		}
	}

	private add(path: string, day: string, schedule: boolean): void {
		const entries = (this.data.days[day] ??= {});
		entries[path] = (entries[path] ?? 0) + 1;
		if (schedule) this.scheduleSave();
	}

	private scheduleSave(): void {
		if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.flush();
		}, 1000);
	}

	private async flush(): Promise<void> {
		await this.plugin.saveData(this.data);
	}
}

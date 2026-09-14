import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import {
	ActivityStore,
	DEFAULT_MAX_HEAT_FILES,
	MAX_MAX_HEAT_FILES,
	MIN_MAX_HEAT_FILES,
} from './activity-store';
import { getMessages } from './i18n';

const MAX_HEAT_FILES_KEY = 'maxHeatFiles';
type ActivitySettingKey = typeof MAX_HEAT_FILES_KEY;

export class ActivityTreeCalendarSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly store: ActivityStore,
		private readonly onSettingsChanged: () => void,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<ActivitySettingKey>[] {
		const messages = getMessages();
		return [
			{
				name: messages.maxHeatFilesName,
				desc: messages.maxHeatFilesDescription,
				control: {
					type: 'slider',
					key: MAX_HEAT_FILES_KEY,
					defaultValue: DEFAULT_MAX_HEAT_FILES,
					min: MIN_MAX_HEAT_FILES,
					max: MAX_MAX_HEAT_FILES,
					step: 1,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === MAX_HEAT_FILES_KEY) return this.store.maxHeatFiles();
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key !== MAX_HEAT_FILES_KEY || typeof value !== 'number') return;
		await this.store.setMaxHeatFiles(value);
		this.onSettingsChanged();
	}

	// Imperative fallback for Obsidian versions earlier than 1.13.0.
	display(): void {
		const messages = getMessages();
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName(messages.maxHeatFilesName)
			.setDesc(messages.maxHeatFilesDescription)
			.addSlider((slider) => {
				slider
					.setLimits(MIN_MAX_HEAT_FILES, MAX_MAX_HEAT_FILES, 1)
					.setValue(this.store.maxHeatFiles())
					.onChange((value) => {
						void this.setControlValue(MAX_HEAT_FILES_KEY, value);
					});
			});
	}
}

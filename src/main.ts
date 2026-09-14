import { Plugin, TFile } from 'obsidian';
import { ActivityStore } from './activity-store';
import {
	ActivityTreeView,
	VIEW_TYPE_ACTIVITY_TREE,
} from './calendar-view';
import { getMessages } from './i18n';
import { ActivityTreeCalendarSettingTab } from './settings';

export default class ActivityTreeCalendarPlugin extends Plugin {
	private store!: ActivityStore;

	async onload(): Promise<void> {
		this.store = new ActivityStore(this);
		await this.store.load();

		this.registerView(
			VIEW_TYPE_ACTIVITY_TREE,
			(leaf) => new ActivityTreeView(leaf, this.store),
		);
		const messages = getMessages();
		this.addRibbonIcon('calendar-days', messages.openView, () => {
			void this.activateView();
		});
		this.addCommand({
			id: 'open-activity-calendar',
			name: messages.openView,
			callback: () => void this.activateView(),
		});
		this.addSettingTab(
			new ActivityTreeCalendarSettingTab(
				this.app,
				this,
				this.store,
				() => this.refreshViews(),
			),
		);

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.vault.on('modify', (file) => {
					if (file instanceof TFile) this.record(file);
				}),
			);
			this.registerEvent(
				this.app.vault.on('create', (file) => {
					if (file instanceof TFile) this.record(file);
				}),
			);
			this.registerEvent(
				this.app.vault.on('rename', (file, oldPath) => {
					this.store.rename(oldPath, file.path);
					this.refreshViews();
				}),
			);
			void this.store
				.bootstrap(this.app.vault.getMarkdownFiles())
				.then(() => this.refreshViews());
		});
	}

	onunload(): void {
		void this.store.close();
	}

	private record(file: TFile): void {
		if (file.extension !== 'md') return;
		this.store.record(file);
		this.refreshViews();
	}

	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVITY_TREE)) {
			if (leaf.view instanceof ActivityTreeView) leaf.view.refresh();
		}
	}

	private async activateView(): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVITY_TREE)[0];
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE_ACTIVITY_TREE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}
}

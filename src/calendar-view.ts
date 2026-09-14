import { ItemView, moment, TFile, WorkspaceLeaf } from 'obsidian';
import { ActivityStore } from './activity-store';
import { DAY_FORMAT, dayKey } from './date';
import { heatLevel } from './heat';
import { getMessages } from './i18n';
import { buildTree } from './tree';
import type { TreeNode } from './types';

export const VIEW_TYPE_ACTIVITY_TREE = 'activity-tree-calendar-view';

export class ActivityTreeView extends ItemView {
	private selectedDay = dayKey();
	private monthTimestamp = moment().startOf('month').valueOf();

	constructor(
		leaf: WorkspaceLeaf,
		private readonly store: ActivityStore,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_ACTIVITY_TREE;
	}

	getDisplayText(): string {
		return getMessages().viewName;
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {}

	refresh(): void {
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass('activity-tree-calendar');
		this.renderCalendar(this.contentEl.createDiv({ cls: 'activity-calendar' }));
		this.renderFiles(this.contentEl.createDiv({ cls: 'activity-files' }));
	}

	private renderCalendar(container: HTMLElement): void {
		const messages = getMessages();
		const monthStart = moment(this.monthTimestamp).startOf('month');
		const monthNav = container.createDiv({ cls: 'activity-month-nav' });
		this.createMonthButton(monthNav, '‹', messages.previousMonth, -1);
		monthNav.createDiv({
			text: monthStart.format(messages.monthFormat),
			cls: 'activity-month',
		});
		this.createMonthButton(monthNav, '›', messages.nextMonth, 1);

		const grid = container.createDiv({ cls: 'activity-grid' });
		grid.createDiv({
			text: messages.weekLabel,
			cls: 'activity-weekday activity-week-label',
		});
		for (const weekday of messages.weekdays) {
			grid.createDiv({ text: weekday, cls: 'activity-weekday' });
		}

		const mondayOffset = (monthStart.day() + 6) % 7;
		const daysInMonth = monthStart.daysInMonth();
		const weekCount = Math.ceil((mondayOffset + daysInMonth) / 7);
		const gridStart = monthStart.clone().subtract(mondayOffset, 'days');
		const maxHeatFiles = this.store.maxHeatFiles();

		for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
			const rowMonday = gridStart.clone().add(weekIndex * 7, 'days');
			grid.createDiv({
				text: String(rowMonday.isoWeek()),
				cls: 'activity-week-number',
				attr: { 'aria-label': messages.weekNumber(rowMonday.isoWeek()) },
			});

			for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex += 1) {
				const dayIndex = weekIndex * 7 + weekdayIndex - mondayOffset;
				if (dayIndex < 0 || dayIndex >= daysInMonth) {
					grid.createDiv({ cls: 'activity-day-placeholder' });
					continue;
				}

				const date = monthStart.clone().add(dayIndex, 'days');
				const key = date.format(DAY_FORMAT);
				const count = this.store.countFor(key);
				const level = heatLevel(count, maxHeatFiles);
				const cell = grid.createEl('button', {
					cls: `activity-day activity-heat-${level}`,
					attr: {
						type: 'button',
						'aria-label': messages.dayActivity(
							date.format(messages.dayFormat),
							count,
						),
					},
				});
				cell.createSpan({ text: date.format('D') });
				cell.toggleClass('is-today', key === dayKey());
				cell.toggleClass('is-selected', key === this.selectedDay);
				cell.onclick = () => {
					this.selectedDay = key;
					this.render();
				};
			}
		}
	}

	private renderFiles(container: HTMLElement): void {
		const paths = this.store.pathsFor(this.selectedDay);
		if (paths.length === 0) {
			container.createDiv({ text: getMessages().emptyDay, cls: 'activity-empty' });
			return;
		}
		this.renderTreeNode(container, buildTree(paths));
	}

	private renderTreeNode(parent: HTMLElement, node: TreeNode): void {
		for (const [name, child] of [...node.folders.entries()].sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			const collapsed = this.collapseFolderPath(name, child);
			const details = parent.createEl('details', { cls: 'activity-folder' });
			details.open = true;
			details.createEl('summary', { text: collapsed.label });
			const body = details.createDiv({ cls: 'activity-folder-body' });
			this.renderTreeNode(body, collapsed.node);
		}

		for (const path of node.files.sort((a, b) => a.localeCompare(b))) {
			this.renderFile(parent, path, path.split('/').pop() ?? path);
		}
	}

	private createMonthButton(
		parent: HTMLElement,
		text: string,
		label: string,
		offset: number,
	): void {
		const button = parent.createEl('button', {
			text,
			cls: 'activity-month-button',
			attr: { type: 'button', 'aria-label': label },
		});
		button.onclick = () => {
			const targetMonth = moment(this.monthTimestamp)
				.add(offset, 'month')
				.startOf('month');
			const selectedDate = moment(this.selectedDay, DAY_FORMAT);
			const targetDay = Math.min(selectedDate.date(), targetMonth.daysInMonth());
			this.monthTimestamp = targetMonth.valueOf();
			this.selectedDay = targetMonth.clone().date(targetDay).format(DAY_FORMAT);
			this.render();
		};
	}

	private collapseFolderPath(
		initialName: string,
		initialNode: TreeNode,
	): { label: string; node: TreeNode } {
		let label = initialName;
		let node = initialNode;

		while (node.files.length === 0 && node.folders.size === 1) {
			const next = node.folders.entries().next().value;
			if (!next) break;
			label += `/${next[0]}`;
			node = next[1];
		}

		return { label, node };
	}

	private renderFile(parent: HTMLElement, path: string, label: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		const button = parent.createEl('button', {
			text: label,
			cls: 'activity-file',
			attr: { type: 'button', title: path },
		});
		if (!(file instanceof TFile)) {
			button.addClass('is-missing');
			button.disabled = true;
			return;
		}
		button.onclick = () => {
			void this.app.workspace.getLeaf(false).openFile(file);
		};
	}
}

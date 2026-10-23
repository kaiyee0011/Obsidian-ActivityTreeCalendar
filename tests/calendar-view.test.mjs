import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const moment = require('moment');
const bundle = await build({
	stdin: {
		contents: "export { default as CalendarPlugin } from './src/main'; export { ActivityTreeView } from './src/calendar-view';",
		resolveDir: process.cwd(),
		loader: 'ts',
	},
	bundle: true, platform: 'node', format: 'cjs', external: ['obsidian'], write: false,
});

// Only the host API is replaced; the real view renders its calendar and handles clicks.
class Element {
	children = [];
	classes = new Set();
	constructor({ text = '', cls = '', attr = {} } = {}) {
		this.text = text;
		this.attr = attr;
		for (const name of cls.split(' ')) this.classes.add(name);
	}
	empty() { this.children = []; }
	addClass(name) { this.classes.add(name); }
	toggleClass(name, enabled) { if (enabled) this.classes.add(name); else this.classes.delete(name); }
	createEl(tag, options) { const child = new Element(options); child.tag = tag; this.children.push(child); return child; }
	createDiv(options) { return this.createEl('div', options); }
	createSpan(options) { return this.createEl('span', options); }
	all() { return [this, ...this.children.flatMap(child => child.all())]; }
}

function setup(iso = '2026-10-23T12:00:00') {
	let now = new Date(iso).valueOf();
	moment.now = () => now;
	const intervals = [];
	const focusHandlers = [];
	class ItemView {
		contentEl = new Element();
		app = { vault: { getAbstractFileByPath() { return null; } } };
		registerInterval(id) { return id; }
		registerDomEvent(target, type, handler) { if (type === 'focus') focusHandlers.push(handler); }
	}
	const module = { exports: {} };
	vm.runInNewContext(bundle.outputFiles[0].text, {
		module, exports: module.exports, structuredClone,
		Date: class extends Date { static now() { return now; } },
		window: { setInterval(callback) { intervals.push(callback); return intervals.length; } },
		require(id) {
			if (id === 'obsidian') return { ItemView, moment, TFile: class {}, Plugin: class {}, PluginSettingTab: class {} };
			return require(id);
		},
	});
	let displayedDay;
	const store = {
		maxHeatFiles: () => 10, countFor: () => 0,
		pathsFor(day) { displayedDay = day; return []; },
	};
	const { ActivityTreeView, CalendarPlugin } = module.exports;
	const view = new ActivityTreeView({}, store);
	return {
		view, CalendarPlugin, intervals, focusHandlers,
		advance(iso) { now = new Date(iso).valueOf(); },
		get displayedDay() { return displayedDay; },
		day(number) { return view.contentEl.all().find(el => el.classes.has('activity-day') && el.children[0]?.text === String(number)); },
		selected() { return view.contentEl.all().filter(el => el.classes.has('is-selected')).map(el => el.children[0].text); },
		previousMonth() { view.contentEl.all().find(el => el.attr['aria-label'] === 'Previous month').onclick(); },
	};
}

test('a new calendar selects local today even without activity', async () => {
	const state = setup();
	await state.view.onOpen();
	assert.deepEqual(state.selected(), ['23']);
	assert.equal(state.displayedDay, '2026-10-23');
});

test('opening an existing calendar returns from a historical month to today', async () => {
	const state = setup();
	await state.view.onOpen();
	state.previousMonth();
	state.day(7).onclick();
	const plugin = new state.CalendarPlugin();
	const leaf = { view: state.view };
	plugin.app = { workspace: { getLeavesOfType: () => [leaf], revealLeaf: async () => {} } };
	await plugin.activateView();
	assert.equal(state.displayedDay, '2026-10-23');
	assert.deepEqual(state.selected(), ['23']);
});

test('reopening a view after midnight initializes the new local day and month', async () => {
	const state = setup('2026-10-31T23:59:00');
	state.advance('2026-11-01T00:01:00');
	await state.view.onOpen();
	assert.equal(state.displayedDay, '2026-11-01');
	assert.deepEqual(state.selected(), ['1']);
});

test('refresh preserves a date chosen manually', async () => {
	const state = setup();
	await state.view.onOpen();
	state.day(7).onclick();
	state.view.refresh();
	assert.equal(state.displayedDay, '2026-10-07');
});

test('refresh follows today across midnight and a month boundary', async () => {
	const state = setup('2026-10-31T23:59:00');
	await state.view.onOpen();
	state.advance('2026-11-01T00:01:00');
	state.view.refresh();
	assert.equal(state.displayedDay, '2026-11-01');
	assert.deepEqual(state.selected(), ['1']);
});

test('midnight refresh preserves a manually selected historical date', async () => {
	const state = setup('2026-10-31T23:59:00');
	await state.view.onOpen();
	state.day(7).onclick();
	state.advance('2026-11-01T00:01:00');
	state.view.refresh();
	assert.equal(state.displayedDay, '2026-10-07');
});

test('clicking yesterday just after midnight keeps that manual selection', async () => {
	const state = setup('2026-10-23T23:59:00');
	await state.view.onOpen();
	state.advance('2026-10-24T00:00:10');
	state.day(23).onclick();
	state.view.refresh();
	assert.equal(state.displayedDay, '2026-10-23');
});

test('navigating back to yesterday before the rollover check keeps the manual selection', async () => {
	const state = setup('2026-10-23T23:59:00');
	await state.view.onOpen();
	state.previousMonth();
	state.advance('2026-10-24T00:00:10');
	state.view.contentEl.all().find(el => el.attr['aria-label'] === 'Next month').onclick();
	state.view.refresh();
	assert.equal(state.displayedDay, '2026-10-23');
});

test('an idle open calendar follows the new day on its registered timer', async () => {
	const state = setup('2026-12-31T23:59:00');
	await state.view.onOpen();
	state.advance('2027-01-01T00:01:00');
	assert.ok(state.intervals.length > 0, 'the view must check for date rollover while idle');
	state.intervals.forEach(callback => callback());
	assert.equal(state.displayedDay, '2027-01-01');
});

test('returning to the app after sleep refreshes today', async () => {
	const state = setup('2026-10-23T23:59:00');
	await state.view.onOpen();
	state.advance('2026-10-24T08:00:00');
	assert.ok(state.focusHandlers.length > 0, 'the view must refresh after app focus');
	state.focusHandlers.forEach(callback => callback());
	assert.equal(state.displayedDay, '2026-10-24');
});

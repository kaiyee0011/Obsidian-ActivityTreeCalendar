import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

async function fixture(t) {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'activity-download-test-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return {
		directory,
		async run(stats, date = '2026-10-23') {
			const input = path.join(directory, 'stats.json');
			await writeFile(input, JSON.stringify(stats));
			return spawnSync(process.execPath, ['scripts/update-download-history.mjs', '--stats-file', input, '--output-dir', directory, '--date', date], { encoding: 'utf8' });
		},
		async history() { return JSON.parse(await readFile(path.join(directory, 'data/download-history.json'), 'utf8')); },
		async chart() { return readFile(path.join(directory, 'assets/download-history-chart.svg'), 'utf8'); },
	};
}

const stats = downloads => ({ 'activity-tree-calendar': { downloads, updated: 1789379473000, '1.0.0': downloads } });

test('records real daily snapshots and replaces same-day observations', async t => {
	const f = await fixture(t);
	for (const [date, downloads] of [['2026-10-22', 113], ['2026-10-23', 120], ['2026-10-23', 125]]) {
		const result = await f.run(stats(downloads), date);
		assert.equal(result.status, 0, result.stderr);
	}
	const history = await f.history();
	assert.deepEqual(history.observations, [{ date: '2026-10-22', downloads: 113 }, { date: '2026-10-23', downloads: 125 }]);
	assert.match(history.source, /obsidianmd\/obsidian-releases/);
	assert.match(await f.chart(), /125 downloads/);
});

test('first observation and zero downloads produce an SVG without invented earlier points', async t => {
	const f = await fixture(t);
	const result = await f.run(stats(0));
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual((await f.history()).observations, [{ date: '2026-10-23', downloads: 0 }]);
	const svg = await f.chart();
	assert.match(svg, /<svg/);
	assert.match(svg, /0 downloads/);
	assert.doesNotMatch(svg, /NaN|Infinity/);
	assert.match(svg, /<path/);
});

test('missing plugin or invalid counts fail without overwriting existing history or chart', async t => {
	const f = await fixture(t);
	assert.equal((await f.run(stats(113))).status, 0);
	const beforeHistory = await f.history();
	const beforeChart = await f.chart();
	for (const input of [{}, stats(-1), stats('114'), stats(1.5)]) {
		const result = await f.run(input);
		assert.notEqual(result.status, 0);
		assert.deepEqual(await f.history(), beforeHistory);
		assert.equal(await f.chart(), beforeChart);
	}
});

test('records source corrections faithfully instead of forcing counts upward', async t => {
	const f = await fixture(t);
	assert.equal((await f.run(stats(113), '2026-10-22')).status, 0);
	assert.equal((await f.run(stats(110), '2026-10-23')).status, 0);
	assert.deepEqual((await f.history()).observations, [{ date: '2026-10-22', downloads: 113 }, { date: '2026-10-23', downloads: 110 }]);
});

test('rejects invalid dates and corrupted stored history', async t => {
	const f = await fixture(t);
	assert.notEqual((await f.run(stats(113), '2026-02-30')).status, 0);
	assert.equal((await f.run(stats(113))).status, 0);
	await writeFile(path.join(f.directory, 'data/download-history.json'), '{broken');
	assert.notEqual((await f.run(stats(114))).status, 0);
	assert.equal(await readFile(path.join(f.directory, 'data/download-history.json'), 'utf8'), '{broken');
});

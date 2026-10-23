import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { renderChart } from './download-chart.mjs';

const pluginId = 'activity-tree-calendar';
const source = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json';

function validDate(date) {
	return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
		&& Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

function validCount(count) {
	return Number.isSafeInteger(count) && count >= 0;
}

async function loadHistory(file) {
	let history;
	try {
		history = JSON.parse(await readFile(file, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return { pluginId, source, observations: [] };
		throw error;
	}
	if (history.pluginId !== pluginId || history.source !== source || !Array.isArray(history.observations)) {
		throw new Error('Unexpected download history format; refusing to overwrite it.');
	}
	const dates = new Set();
	for (const point of history.observations) {
		if (!point || !validDate(point.date) || !validCount(point.downloads) || dates.has(point.date)) {
			throw new Error('Invalid or duplicate download history observation.');
		}
		dates.add(point.date);
	}
	return history;
}

async function writeAtomic(file, content) {
	await mkdir(path.dirname(file), { recursive: true });
	const temporary = `${file}.tmp`;
	await writeFile(temporary, content);
	await rename(temporary, file);
}

async function main() {
	const { values } = parseArgs({ options: {
		'stats-file': { type: 'string' },
		'output-dir': { type: 'string', default: fileURLToPath(new URL('../', import.meta.url)) },
		date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
	} });
	const date = values.date;
	if (!validDate(date)) throw new Error('Collection date must be a real date in YYYY-MM-DD format (UTC).');
	let stats;
	if (values['stats-file']) {
		stats = JSON.parse(await readFile(values['stats-file'], 'utf8'));
	} else {
		const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`Obsidian statistics request failed: HTTP ${response.status}`);
		stats = await response.json();
	}
	const downloads = stats?.[pluginId]?.downloads;
	if (!validCount(downloads)) throw new Error('Official statistics are missing a valid download count for this plugin.');
	const root = path.resolve(values['output-dir']);
	const historyPath = path.join(root, 'data/download-history.json');
	const history = await loadHistory(historyPath);
	const existing = history.observations.find(point => point.date === date);
	if (existing) existing.downloads = downloads;
	else history.observations.push({ date, downloads });
	history.observations.sort((a, b) => a.date.localeCompare(b.date));
	// Render and validate everything before replacing either tracked output.
	const svg = renderChart(history);
	await writeAtomic(historyPath, `${JSON.stringify(history, null, 2)}\n`);
	await writeAtomic(path.join(root, 'assets/download-history-chart.svg'), svg);
	console.log(`${pluginId}: ${downloads} downloads observed on ${date} (UTC).`);
}

main().catch(error => {
	console.error(`Download history update failed: ${error.message}`);
	process.exitCode = 1;
});

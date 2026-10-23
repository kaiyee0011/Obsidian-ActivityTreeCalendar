import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';

const font = opentype.loadSync(fileURLToPath(new URL('./fonts/PatrickHand-Regular.ttf', import.meta.url)));
const ink = '#262522';
const accent = '#e64d2e';
const muted = '#78736c';
const dayMilliseconds = 86_400_000;

function lettering(value, x, y, size, { fill = ink, align = 'left' } = {}) {
	const width = font.getAdvanceWidth(value, size);
	const start = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0);
	return font.getPath(value, start, y, size).toSVG(2).replace('<path ', `<path fill="${fill}" `);
}

// A fixed seed keeps the hand-drawn outlines stable between daily updates.
function sketchLine(x1, y1, x2, y2, color = ink, width = 2) {
	const length = Math.hypot(x2 - x1, y2 - y1);
	const steps = Math.max(2, Math.ceil(length / 25));
	const points = Array.from({ length: steps + 1 }, (_, index) => {
		const t = index / steps;
		const wobble = index === 0 || index === steps ? 0 : Math.sin(index * 2.1 + x1 + y1) * 0.8;
		return `${(x1 + (x2 - x1) * t + wobble * (y2 - y1) / length).toFixed(2)},${(y1 + (y2 - y1) * t - wobble * (x2 - x1) / length).toFixed(2)}`;
	});
	return `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function niceMaximum(value) {
	const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
	const scaled = value / power;
	return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}

export function renderChart(history) {
	const observations = history.observations;
	const latest = observations.at(-1);
	const first = observations[0];
	const release = observations.find(point => point.type === 'release');
	const left = 100;
	const right = 875;
	const top = 150;
	const bottom = 410;
	const maximum = niceMaximum(Math.max(...observations.map(point => point.downloads), 1) * 1.15);
	const start = Date.parse(first.date);
	const span = Date.parse(latest.date) - start;
	const xFor = date => span === 0 ? (left + right) / 2 : left + ((Date.parse(date) - start) / span) * (right - left);
	const yFor = downloads => bottom - (downloads / maximum) * (bottom - top);
	const label = `${latest.downloads.toLocaleString('en-US')} downloads`;
	const parts = [
		'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="title description">',
		`<title id="title">Download History - Activity Tree Calendar - ${label}</title>`,
		`<desc id="description">Cumulative download history. ${observations.length} recorded points from ${first.date} to ${latest.date} (UTC). Latest: ${label}.${release ? ` Maintainer-provided release baseline: ${release.date}, ${release.downloads} downloads.` : ''} Lines connect recorded totals; intermediate daily values are not inferred.</desc>`,
		'<rect x="1" y="1" width="958" height="538" rx="14" fill="#fffefa" stroke="#e6e2db"/>',
		lettering('Download History', 480, 51, 35, { align: 'center' }),
		lettering('Activity Tree Calendar', 480, 82, 21, { align: 'center', fill: muted }),
		`<rect x="103" y="109" width="10" height="10" rx="3" fill="${accent}"/>`,
		lettering('Obsidian downloads', 123, 120, 20),
		lettering(label, 883, 122, 26, { align: 'right', fill: accent }),
	];
	for (let index = 0; index <= 4; index += 1) {
		const value = maximum * index / 4;
		const y = yFor(value);
		if (index > 0) parts.push(`<path d="M ${left} ${y} H ${right}" stroke="#eeebe5" stroke-dasharray="3 7"/>`);
		parts.push(lettering(value.toLocaleString('en-US', { maximumFractionDigits: 2 }), left - 15, y + 6, 18, { align: 'right', fill: muted }));
	}
	parts.push(sketchLine(left, top - 8, left, bottom + 2), sketchLine(left - 1, bottom, right + 6, bottom));
	parts.push(`<g transform="translate(29 283) rotate(-90)">${lettering('Downloads', 0, 0, 20, { align: 'center', fill: muted })}</g>`);
	const tickCount = span === 0 ? 1 : Math.min(5, Math.floor(span / dayMilliseconds) + 1);
	for (let index = 0; index < tickCount; index += 1) {
		const date = tickCount === 1 ? latest.date : new Date(start + Math.round((span / dayMilliseconds) * index / (tickCount - 1)) * dayMilliseconds).toISOString().slice(0, 10);
		const x = xFor(date);
		parts.push(sketchLine(x, bottom, x, bottom + 6, muted, 1.2));
		parts.push(lettering(date, x, bottom + 30, 17, { align: 'center', fill: muted }));
	}
	if (observations.length > 1) {
		const dataPath = observations.map((point, index) => `${index === 0 ? 'M' : 'L'}${xFor(point.date).toFixed(2)} ${yFor(point.downloads).toFixed(2)}`).join(' ');
		parts.push(`<path d="${dataPath}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
	}
	for (const point of observations) {
		parts.push(`<circle cx="${xFor(point.date).toFixed(2)}" cy="${yFor(point.downloads).toFixed(2)}" r="${point === latest ? 5 : point.type === 'release' ? 4 : 2.2}" fill="${accent}"/>`);
		if (point.type === 'release') {
			parts.push(lettering('Released', xFor(point.date) + 10, yFor(point.downloads) - 13, 19, { fill: muted }));
		}
	}
	if (observations.length === 1) {
		parts.push(lettering('The first snapshot. A little history starts here.', 480, 373, 22, { align: 'center', fill: muted }));
	}
	parts.push(
		lettering('Date (UTC)', 480, 471, 19, { align: 'center', fill: muted }),
		lettering(release ? 'Source: Obsidian stats; release baseline: maintainer' : 'Source: Obsidian official download stats', 37, 513, 17, { fill: muted }),
		lettering(`Last collected: ${latest.date} (UTC)`, 923, 513, 17, { align: 'right', fill: muted }),
		'</svg>',
	);
	return `${parts.join('\n')}\n`;
}

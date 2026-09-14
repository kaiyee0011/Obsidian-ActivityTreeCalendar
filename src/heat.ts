export function heatLevel(count: number, maxHeatFiles: number): number {
	if (count <= 0) return 0;
	if (maxHeatFiles <= 1 || count >= maxHeatFiles) return 4;
	return 1 + Math.floor(((count - 1) * 3) / (maxHeatFiles - 1));
}

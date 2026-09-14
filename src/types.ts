export interface ActivitySettings {
	maxHeatFiles: number;
}

export interface ActivityData {
	initialized: boolean;
	days: Record<string, Record<string, number>>;
	settings: ActivitySettings;
}

export interface TreeNode {
	folders: Map<string, TreeNode>;
	files: string[];
}

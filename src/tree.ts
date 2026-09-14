import type { TreeNode } from './types';

function emptyNode(): TreeNode {
	return { folders: new Map(), files: [] };
}

export function buildTree(paths: string[]): TreeNode {
	const root = emptyNode();

	for (const path of paths) {
		const parts = path.split('/');
		const fileName = parts.pop();
		if (!fileName) continue;

		let node = root;
		for (const folder of parts) {
			let child = node.folders.get(folder);
			if (!child) {
				child = emptyNode();
				node.folders.set(folder, child);
			}
			node = child;
		}
		node.files.push(path);
	}

	return root;
}

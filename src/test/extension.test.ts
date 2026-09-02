import * as assert from 'assert';
import { buildTree } from '../extension';

suite('Extension Test Suite', () => {
	test('builds a sorted directory tree', () => {
		const nodes = buildTree([
			'.zshrc',
			'.config/yadm/config',
			'.config/git/config',
			'AGENTS.md',
		]);

		assert.deepStrictEqual(nodes.map(node => node.name), ['.config', '.zshrc', 'AGENTS.md']);
		assert.deepStrictEqual(nodes[0].children.map(node => node.name), ['git', 'yadm']);
		assert.strictEqual(nodes[0].children[0].children[0].relativePath, '.config/git/config');
		assert.strictEqual(nodes[0].children[0].children[0].isDirectory, false);
	});
});

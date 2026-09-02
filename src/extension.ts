import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

interface TrackedNode {
	name: string;
	relativePath: string;
	isDirectory: boolean;
	children: TrackedNode[];
}

class TrackedFilesProvider implements vscode.TreeDataProvider<TrackedNode> {
	private readonly changes = new vscode.EventEmitter<TrackedNode | undefined>();
	readonly onDidChangeTreeData = this.changes.event;

	refresh(): void {
		this.changes.fire(undefined);
	}

	getTreeItem(node: TrackedNode): vscode.TreeItem {
		const collapsibleState = node.isDirectory
			? vscode.TreeItemCollapsibleState.Collapsed
			: vscode.TreeItemCollapsibleState.None;
		const item = new vscode.TreeItem(node.name, collapsibleState);

		if (node.isDirectory) {
			item.contextValue = 'yadmTrackedDirectory';
			item.iconPath = new vscode.ThemeIcon('folder');
			return item;
		}

		item.contextValue = 'yadmTrackedFile';
		item.resourceUri = vscode.Uri.file(`${homedir()}/${node.relativePath}`);
		item.command = {
			command: 'vscode.open',
			title: 'Open File',
			arguments: [item.resourceUri],
		};
		item.tooltip = node.relativePath;
		return item;
	}

	async getChildren(node?: TrackedNode): Promise<TrackedNode[]> {
		if (node) {
			return node.children;
		}

		const stdout = await runYadm(['ls-files', '-z']);
		return buildTree(stdout.split('\0').filter(Boolean));
	}
}

function getYadmExecutable(): string {
	const configuredPath = vscode.workspace.getConfiguration('yadm').get<string>('executablePath');
	if (configuredPath) {
		return configuredPath;
	}

	const gitPath = vscode.workspace.getConfiguration('git').get<string | string[]>('path');
	if (typeof gitPath === 'string' && /(^|[/\\])yadm$/.test(gitPath)) {
		return gitPath;
	}

	return 'yadm';
}

async function runYadm(args: string[]): Promise<string> {
	const { stdout } = await execFileAsync(getYadmExecutable(), args, {
		cwd: homedir(),
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	});
	return stdout;
}

function selectedUris(first?: vscode.Uri | TrackedNode, selection?: vscode.Uri[]): vscode.Uri[] {
	if (selection?.length) {
		return selection;
	}

	if (first instanceof vscode.Uri) {
		return [first];
	}

	if (first) {
		return [vscode.Uri.file(resolve(homedir(), first.relativePath))];
	}

	const activeUri = vscode.window.activeTextEditor?.document.uri;
	return activeUri?.scheme === 'file' ? [activeUri] : [];
}

function homeRelativePaths(uris: vscode.Uri[]): string[] {
	const home = homedir();
	return uris.map(uri => {
		if (uri.scheme !== 'file') {
			throw new Error('Yadm can only manage local files.');
		}

		const path = relative(home, uri.fsPath);
		if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
			throw new Error('Select a file or folder inside your home directory.');
		}

		return path;
	});
}

async function refresh(provider: TrackedFilesProvider): Promise<void> {
	provider.refresh();
	await vscode.commands.executeCommand('git.refresh');
}

async function track(
	provider: TrackedFilesProvider,
	first?: vscode.Uri | TrackedNode,
	selection?: vscode.Uri[],
): Promise<void> {
	const paths = homeRelativePaths(selectedUris(first, selection));
	if (!paths.length) {
		void vscode.window.showInformationMessage('Open or select a file inside your home directory first.');
		return;
	}

	await runYadm(['add', '--', ...paths]);
	await refresh(provider);
	void vscode.window.showInformationMessage(`Yadm is now tracking ${paths.length} selected item(s).`);
}

async function stopTracking(
	provider: TrackedFilesProvider,
	first?: vscode.Uri | TrackedNode,
	selection?: vscode.Uri[],
): Promise<void> {
	const paths = homeRelativePaths(selectedUris(first, selection));
	if (!paths.length) {
		void vscode.window.showInformationMessage('Open or select a tracked file inside your home directory first.');
		return;
	}

	const confirmation = await vscode.window.showWarningMessage(
		`Stop tracking ${paths.length} selected item(s)? The local files will be kept.`,
		{ modal: true },
		'Stop Tracking',
	);
	if (confirmation !== 'Stop Tracking') {
		return;
	}

	await runYadm(['rm', '--cached', '-r', '--', ...paths]);
	await refresh(provider);
	void vscode.window.showInformationMessage(`Yadm stopped tracking ${paths.length} selected item(s).`);
}

function showCommandError(error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	void vscode.window.showErrorMessage(`Yadm: ${message}`);
}

export function buildTree(paths: string[]): TrackedNode[] {
	const root: TrackedNode = { name: '', relativePath: '', isDirectory: true, children: [] };

	for (const relativePath of paths) {
		const segments = relativePath.split('/');
		let parent = root;

		for (const [index, segment] of segments.entries()) {
			const nodePath = segments.slice(0, index + 1).join('/');
			const isDirectory = index < segments.length - 1;
			let child = parent.children.find(candidate => candidate.name === segment);

			if (!child) {
				child = { name: segment, relativePath: nodePath, isDirectory, children: [] };
				parent.children.push(child);
			}

			parent = child;
		}
	}

	const sortNodes = (nodes: TrackedNode[]): TrackedNode[] => nodes
		.sort((left, right) => Number(right.isDirectory) - Number(left.isDirectory)
			|| left.name.localeCompare(right.name))
		.map(node => ({ ...node, children: sortNodes(node.children) }));

	return sortNodes(root.children);
}

export function activate(context: vscode.ExtensionContext): void {
	const provider = new TrackedFilesProvider();

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('yadm.trackedFiles', provider),
		vscode.commands.registerCommand('yadm.refreshTrackedFiles', () => provider.refresh()),
		vscode.commands.registerCommand('yadm.track', (first?: vscode.Uri, selection?: vscode.Uri[]) =>
			track(provider, first, selection).catch(showCommandError)),
		vscode.commands.registerCommand('yadm.stopTracking', (first?: vscode.Uri | TrackedNode, selection?: vscode.Uri[]) =>
			stopTracking(provider, first, selection).catch(showCommandError)),
	);
}

export function deactivate(): void {}

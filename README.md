# Yadm Manager

Manage yadm-tracked dotfiles without asking Git to scan every untracked file in
your home directory.

## Requirements

- [yadm](https://yadm.io/) installed and initialized.
- VS Code 1.85 or newer.

## Features

- Browse tracked files in the **Yadm Tracked Files** Explorer view.
- Track selected Explorer files or the active editor with **Yadm: Track with Yadm**.
- Stop tracking files while keeping them locally with **Yadm: Stop Tracking with Yadm**.
- Refresh the tracked-files tree and VS Code's built-in Git Source Control view.

The extension always passes selected paths directly to yadm without invoking a
shell. It never runs a whole-home untracked-file scan. Stop Tracking uses
`yadm rm --cached` and requires confirmation.

## Configuration

`yadm.executablePath` optionally sets the yadm executable. When empty, the
extension uses `git.path` if it points to yadm, then falls back to `yadm` on
`PATH`.

To use VS Code's built-in Source Control UI with yadm as well, create a dedicated
VS Code profile and set these profile settings:

```json
{
	"git.path": "/path/to/yadm",
	"git.untrackedChanges": "hidden"
}
```

Hiding untracked changes is important because otherwise VS Code runs
`git status -uall` across the entire home directory. New files can still be
added with **Yadm: Track with Yadm**.

## Installation

Install from the VS Code Marketplace when available. GitHub releases also
contain a VSIX that can be installed into a specific profile:

```bash
code --profile Dotfiles --install-extension yadm-vscode-0.0.1.vsix
```

## Development

```bash
npm ci
npm run compile
npm run lint
npm test
npm run package
```

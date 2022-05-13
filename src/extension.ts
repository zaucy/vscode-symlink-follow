import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	let lastRealFilePath = '';

	const disposable = vscode.window.onDidChangeActiveTextEditor(async ed => {
		if (!ed || ed.document.uri.scheme !== 'file') return;
		const filePath = ed.document.fileName!;

		// Skipping the file we just opened.
		if (filePath === lastRealFilePath) return;

		fs.realpath(filePath, async (err, realFilePath) => {
			if (err) {
				// No need to burden user with error
				return;
			}

			// Not a symlink. No need to open real path.
			if (filePath === realFilePath) return;
			const symlinkFollowConfig = vscode.workspace.getConfiguration('symlink-follow');
			const onlyFollowWithinWorkspace = symlinkFollowConfig.get('onlyFollowWithinWorkspace');
			const realFileUri = vscode.Uri.file(realFilePath);

			if (onlyFollowWithinWorkspace) {
				if (!vscode.workspace.getWorkspaceFolder(realFileUri)) {
					// Our file isn't within any workspace folder and the user has asked
					// to only follow symlink files within the workspace folder(s). Skip!
					return;
				}
			}

			const showFileInExplorer = symlinkFollowConfig.get('showFileInExplorerAfterSymlinkFollow');
			const followSymlink = async () => {
				lastRealFilePath = realFilePath;
				if (vscode.window.activeTextEditor?.document.fileName == filePath) {
					vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				}
				await vscode.commands.executeCommand('vscode.open', realFileUri);
				if (showFileInExplorer) {
					await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
				}
			};

			const autoFollow = symlinkFollowConfig.get('autoFollow');
			if (!autoFollow) {
				const item = await vscode.window.showInformationMessage(
					`${vscode.workspace.asRelativePath(filePath)} is a symlink`,
					{ modal: true, detail: `The real path is ${vscode.workspace.asRelativePath(realFilePath)}` },
					'Follow Symlink',
				);

				if (item) {
					followSymlink();
				}
			} else {
				followSymlink();
			}
		});

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

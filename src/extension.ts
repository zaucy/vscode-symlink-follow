import * as vscode from 'vscode';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	let lastRealFilePath = '';

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor: vscode.TextEditor | undefined) => {
		if (!editor || editor.document.uri.scheme !== 'file') {
			return;
		}
		const filePath = editor.document.fileName!;

		// Skipping the file we just opened.
		if (filePath === lastRealFilePath) {
			return;
		}

		fs.realpath(filePath, async (err, realFilePath) => {
			if (err) {
				// No need to burden user with error
				return;
			}

			if (filePath === realFilePath) {
				// Not a symlink. No need to open real path.
				lastRealFilePath = realFilePath;
				return;
			}
			if (lastRealFilePath === realFilePath) {
				// We are in symlink that points to previously opened file - we got here by "Go Back", do it once again
				vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				vscode.commands.executeCommand('workbench.action.navigateBack');
				return;
			}

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

			// get current selection and scroll position
			const targetSelection = editor.selection;
			const targetScrollTop = editor.visibleRanges[0]?.start ?? targetSelection.active;

			const showFileInExplorer = symlinkFollowConfig.get('showFileInExplorerAfterSymlinkFollow');
			const followSymlink = async () => {
				lastRealFilePath = realFilePath;
				if (vscode.window.activeTextEditor?.document.fileName === filePath) {
					vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				}
				await vscode.commands.executeCommand('vscode.open', realFileUri);

				// apply selection and scroll position
				const newEditor = vscode.window.activeTextEditor;
				if (newEditor) {
					newEditor.selection = targetSelection;
					newEditor.revealRange(new vscode.Range(targetScrollTop, targetScrollTop), vscode.TextEditorRevealType.AtTop);
				}

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
	}));
}

// this method is called when your extension is deactivated
export function deactivate() { }

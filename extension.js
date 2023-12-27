const vscode = require('vscode');
const { exec } = require('child_process');


function getWorkingFolder() {
    const { workspaceFolders } = vscode.workspace;

    if (workspaceFolders) {
        // Assuming the first folder is the primary workspace folder
        const firstWorkspaceFolder = workspaceFolders[0];
        return firstWorkspaceFolder.uri.fsPath;
    } else {
        // No workspace folders
        return null;
    }
}

let environment
let channel
let ctx

async function activate(context) {
    ctx = context
    environment = context.environmentVariableCollection;
    channel = vscode.window.createOutputChannel("nix develop");
    let e = ctx.workspaceState.get('nixdevelopcache')
    if (e !== undefined) {
        updateEnv(e)
        vscode.window.showInformationMessage('Reloaded with nix environment');
    }

    let disposable = vscode.commands.registerCommand('extension.nixdevelop', async function () {
        try {
            await storeEnv()
            await tryReload()
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });


    context.subscriptions.push(disposable);
}

function parseEnv(e) {
    var arr = []
    e.split("\n").forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
            arr.push(parts)
        }
    });
    return arr
}


async function getEnv() {
    channel.appendLine("Running nix develop")
    return new Promise((resolve, reject) => {
        exec("nix develop --command bash -c 'env'", {
            cwd: getWorkingFolder()
        }, (error, stdout, stderr) => {
            if (stdout.length > 0) {
                channel.appendLine("Env parse ok")
                resolve(stdout)
            } else {
                channel.appendLine("Env parse fail")
                reject(stderr)
            }
        });
    })
}

function updateEnv(e) {
    try {
        for (const i of e) {
            const [k, v] = i
            process.env[k] = v
            environment.replace(k, v)
        }
    } catch (err) {

    }
}

async function storeEnv() {
    let e = await getEnv()
    let map = parseEnv(e)
    ctx.workspaceState.update('nixdevelopcache', map)
}

async function tryReload() {
    const choice = await vscode.window.showWarningMessage(
        `nix develop: Environment updated. Restart extensions?`,
        'Restart',
    )
    if (choice === 'Restart') {
        await vscode.commands.executeCommand('workbench.action.restartExtensionHost')
    }
}


exports.activate = activate;

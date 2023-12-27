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

    if (ctx.workspaceState.get('nixdevelopenable')) {
        let e = ctx.workspaceState.get('nixdevelopcache')
        if (e !== undefined) {
            updateEnv(e)
            vscode.window.showInformationMessage('Reloaded with nix environment');
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.nixdevelopupdate', async function () {
            try {
                let nixdevelopenv = await getNixDevelopEnv()
                if (nixdevelopenv) {
                    await storeEnv(nixdevelopenv, 'nixdevelopcache')
                }
                await tryReload()
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.nixdevelopenable', async function () {
            ctx.workspaceState.update('nixdevelopenable', true)

            let b = ctx.workspaceState.get('nixdevelopbackup')

            if (b === undefined) {
                await storeEnv(await getPlainEnv(), 'nixdevelopbackup')
            }

        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.nixdevelopdisable', async function () {
            ctx.workspaceState.update('nixdevelopenable', false)

            let b = ctx.workspaceState.get('nixdevelopbackup')
            if (b) {
                restoreProcessEnvWithEnvironment(b)
                ctx.workspaceState.update('nixdevelopbackup', undefined)
            }

            ctx.workspaceState.update('nixdevelopcache', undefined)
        })
    );
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

function getShellEnv() {
    var env = {}
    environment.forEach((variable, mutator, collection) => {
        var result = ""
        if (mutator.length) {
            mutator.forEach((type, value) => {
                switch (type) {
                    case 1:
                        result = value
                    case 2:
                        result = result + value
                    case 3:
                        result = value + result
                }
            })
        } else {
            result = mutator.value
        }
        env[variable] = result
    });
}


async function getEnv(cmd) {
    channel.appendLine("Running nix develop")
    return new Promise((resolve, reject) => {
        exec(cmd, {
            cwd: getWorkingFolder(),
            // env: getShellEnv()
        }, (error, stdout, stderr) => {
            if (stdout.length > 0) {
                channel.appendLine("Env parse ok")
                resolve(stdout)
            } else {
                channel.appendLine("Env parse fail")
                channel.append(error)
                channel.append(stderr)
                reject(stderr)
            }
        });
    })
}

function restoreProcessEnvWithEnvironment(e) {
    for (let key in process.env) {
        delete process.env[key]
    }
    environment.clear()
    for (const i of e) {
        const [k, v] = i
        process.env[k] = v
        environment.replace(k, v)
    }
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

const keyValueArray2Dict = (arr) => {
    arr.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {})
}

function restoreEnv(e) {
    try {
        for (const i of e) {
            const [k, v] = i
            process.env[k] = v
            environment.replace(k, v)
        }
    } catch (err) {

    }
}

async function getNixDevelopEnv() {
    return await getEnv("nix develop --command bash -c 'env'")
}

async function getPlainEnv() {
    return await getEnv("bash -c 'env'")
}

async function storeEnv(env, name) {
    let map = parseEnv(env)
    ctx.workspaceState.update(name, map)
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

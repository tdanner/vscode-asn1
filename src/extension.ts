import * as vscode from 'vscode';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';
import AdmZip, { IZipEntry } from 'adm-zip';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

const GITHUB_REPO = 'tdanner/asn1-lsp';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Activating vscode-asn1 extension');
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);

  const disposable = vscode.commands.registerCommand('vscode-asn1.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from vscode-asn1!');
  });
  context.subscriptions.push(disposable);

  await startLanguageClient(context);
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<void> {
  try {
    const serverCommand = await resolveServerBinary(context);
    const executable: Executable = {
      command: serverCommand,
      args: []
    };
    const serverOptions: ServerOptions = executable;
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: 'asn1' }]
    };

    client = new LanguageClient('asn1Lsp', 'ASN.1 Language Server', serverOptions, clientOptions);
    context.subscriptions.push(client);
    await client.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to start ASN.1 language server: ${message}`);
    console.error('Failed to start ASN.1 language server', error);
  }
}

async function resolveServerBinary(context: vscode.ExtensionContext): Promise<string> {
  const configuration = vscode.workspace.getConfiguration('asn1Lsp');
  const configuredPath = configuration.get<string>('serverPath');
  if (configuredPath && configuredPath.trim().length > 0) {
    return expandHome(configuredPath.trim());
  }

  const releaseChannel = configuration.get<string>('releaseChannel', 'latest');
  const platform = getPlatform();
  const assetName = getAssetName(platform);
  const release = await fetchRelease(releaseChannel);
  const releaseIdentifier = `${releaseChannel}-${release.tag_name}`;
  const releaseDir = vscode.Uri.joinPath(context.globalStorageUri, releaseIdentifier);
  await vscode.workspace.fs.createDirectory(releaseDir);

  const binaryName = platform.isWindows ? 'asn1-lsp.exe' : 'asn1-lsp';
  const binaryUri = vscode.Uri.joinPath(releaseDir, binaryName);

  try {
    await vscode.workspace.fs.stat(binaryUri);
    return binaryUri.fsPath;
  } catch {
    // Need to download below
  }

  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) {
    throw new Error(`Could not find asset ${assetName} in ${release.tag_name} release.`);
  }

  const assetBytes = await downloadAsset(asset.browser_download_url);
  const zip = new AdmZip(assetBytes);
  const entry = zip
    .getEntries()
    .find((zipEntry: IZipEntry) => path.basename(zipEntry.entryName) === binaryName);
  if (!entry) {
    throw new Error(`Downloaded archive did not contain ${binaryName}.`);
  }

  zip.extractEntryTo(entry, releaseDir.fsPath, false, true);

  if (!platform.isWindows) {
    await fs.chmod(binaryUri.fsPath, 0o755);
  }

  return binaryUri.fsPath;
}

function expandHome(targetPath: string): string {
  if (targetPath.startsWith('~')) {
    return path.join(os.homedir(), targetPath.slice(1));
  }
  return targetPath;
}

function getPlatform(): { os: 'linux' | 'macos' | 'windows'; arch: 'x86_64' | 'aarch64'; isWindows: boolean } {
  const isWindows = process.platform === 'win32';
  let osName: 'linux' | 'macos' | 'windows';
  if (process.platform === 'linux') {
    osName = 'linux';
  } else if (process.platform === 'darwin') {
    osName = 'macos';
  } else if (isWindows) {
    osName = 'windows';
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  let arch: 'x86_64' | 'aarch64';
  if (process.arch === 'x64') {
    arch = 'x86_64';
  } else if (process.arch === 'arm64') {
    arch = 'aarch64';
  } else {
    throw new Error(`Unsupported architecture: ${process.arch}`);
  }

  return { os: osName, arch, isWindows };
}

function getAssetName(platform: { os: 'linux' | 'macos' | 'windows'; arch: 'x86_64' | 'aarch64' }): string {
  return `asn1-lsp-${platform.os}-${platform.arch}.zip`;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

async function fetchRelease(channel: string): Promise<GitHubRelease> {
  const baseUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
  const url = channel === 'nightly' ? `${baseUrl}/tags/nightly` : `${baseUrl}/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vscode-asn1-extension'
    }
  });
  if (!response.ok) {
    throw new Error(`Unable to query ${channel} release information (HTTP ${response.status}).`);
  }
  return (await response.json()) as GitHubRelease;
}

async function downloadAsset(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'vscode-asn1-extension'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download language server binary (HTTP ${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

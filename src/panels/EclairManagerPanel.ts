import * as vscode from "vscode";
import fs, { accessSync, existsSync } from "fs";
import path from "path";
import os from "os";
import yaml from "yaml";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";
import { execCommandWithEnv, execShellCommandWithEnv, getOutputChannel, classifyShell, getShellExe, concatCommands } from "../utils/execUtils";
import { getInternalDirRealPath } from "../utils/utils";
import { getExtraPaths, normalizePath, setExtraPath } from "../utils/envYamlUtils";
import type { IEclairExtension } from "../ext/eclair_api";
import type { ExtensionMessage, WebviewMessage } from "../utils/eclairEvent";
import { extract_yaml_from_ecl_content, parse_eclair_template_from_any } from "../utils/eclair/template_utils";
import { EclairPresetTemplateSource, EclairScaConfig } from "../utils/eclair/config";
import { build_cmake_args } from "./EclairManagerPanel/eclair_cmake_args";
import { ensureRepoCheckout } from "./EclairManagerPanel/repo_manage";

export class EclairManagerPanel {
  /**
   * Recursively walks `obj` and replaces every string that starts with the
   * workspace folder path with `${workspaceFolder}/...`.
   * TODO: this is a blunt recursive string replacement — a more precise
   * approach would target known path fields explicitly.
   */
  private deepTokenizePaths(obj: any): any {
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) return obj;
    const wsPath = folderUri.fsPath.replace(/\\/g, "/");
    const walk = (val: any): any => {
      if (typeof val === "string") {
        const n = val.replace(/\\/g, "/");
        if (n === wsPath || n.startsWith(wsPath + "/")) {
          return "${workspaceFolder}" + n.slice(wsPath.length);
        }
        return val;
      }
      if (Array.isArray(val)) return val.map(walk);
      if (val && typeof val === "object") {
        const out: any = {};
        for (const k of Object.keys(val)) out[k] = walk(val[k]);
        return out;
      }
      return val;
    };
    return walk(obj);
  }

  /**
   * Recursively walks `obj` and expands `${workspaceFolder}` in every string
   * to the actual workspace folder path.
   */
  private deepResolvePaths(obj: any): any {
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) return obj;
    const fsPath = folderUri.fsPath;
    const walk = (val: any): any => {
      if (typeof val === "string") {
        return val.replace(/\$\{workspaceFolder\}/g, fsPath);
      }
      if (Array.isArray(val)) return val.map(walk);
      if (val && typeof val === "object") {
        const out: any = {};
        for (const k of Object.keys(val)) out[k] = walk(val[k]);
        return out;
      }
      return val;
    };
    return walk(obj);
  }

  /**
   * Expands `${workspaceFolder}` in a single string.
   * Used when sending stored paths back to the webview.
   */
  private resolveVsCodeVariables(p: string): string {
    if (!p || !p.includes("${workspaceFolder}")) return p;
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) return p;
    return p.replace(/\$\{workspaceFolder\}/g, folderUri.fsPath);
  }

  // Gets the west workspace path from settings.json configuration.
  private getWestWorkspacePath(): string | undefined {
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) return undefined;
    
    const config = vscode.workspace.getConfiguration(undefined, folderUri);
    const westWorkspace = config.get<string>("zephyr-workbench.westWorkspace");
    
    if (westWorkspace && fs.existsSync(westWorkspace)) {
      // Verify it has .west folder
      if (fs.existsSync(path.join(westWorkspace, ".west"))) {
        return westWorkspace;
      }
    }
    
    return undefined;
  }

  // Find the most likely application folder (prefers one with CMakeLists.txt)
  private resolveApplicationFolderUri(): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders ?? [];

    const hasTopLevelCMakeLists = (uri: vscode.Uri | undefined) => {
      if (!uri) return false;
      try {
        return fs.existsSync(path.join(uri.fsPath, "CMakeLists.txt"));
      } catch {
        return false;
      }
    };

    // 1) Prefer the folder that created the panel, if it looks like an app
    if (hasTopLevelCMakeLists(this._workspaceFolder?.uri)) {
      return this._workspaceFolder!.uri;
    }

    // 2) Prefer active editor's workspace folder, if it looks like an app
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const wf = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
      if (hasTopLevelCMakeLists(wf?.uri)) return wf!.uri;
    }

    // 3) Find any workspace folder that looks like an app
    const match = folders.find(f => hasTopLevelCMakeLists(f.uri));
    if (match) return match.uri;

    // 4) Fall back (best effort)
    return this._workspaceFolder?.uri ?? folders[0]?.uri;
  }

  /**
   * Save the ECLAIR path in env.yml without checks, always overwrites.
   * Usage: EclairManagerPanel.saveEclairAbsolutePath("/path/to/eclair");
   */
  public static saveEclairAbsolutePath(dir: string) {
    try {
      const envYamlPath = path.join(getInternalDirRealPath(), "env.yml");
      let envObj: any = {};
      if (fs.existsSync(envYamlPath)) {
        envObj = yaml.parse(fs.readFileSync(envYamlPath, "utf8")) || {};
      }
      if (!envObj.other) envObj.other = {};
      if (!envObj.other.EXTRA_TOOLS) envObj.other.EXTRA_TOOLS = {};
      envObj.other.EXTRA_TOOLS.path = [normalizePath(dir)];
      fs.writeFileSync(envYamlPath, yaml.stringify(envObj), "utf8");
    } catch (err) {
      vscode.window.showErrorMessage("ECLAIR is not installed. Please install ECLAIR and try again.");
    }
  }
  /**
   * Detects the Zephyr SDK installation directory from common environment variables and paths.
   */
  private detectZephyrSdkDir(): string | undefined {
    // Try reading settings.json (user/project configuration)
    const folderUri = this.resolveApplicationFolderUri();
    const config = vscode.workspace.getConfiguration(undefined, folderUri);
    const sdkFromSettings = config.get<string>("zephyr-workbench.sdk");
    if (sdkFromSettings && fs.existsSync(sdkFromSettings)) {
      return sdkFromSettings;
    }

    // TODO: Improve the Fallback  
    const candidates = [
      process.env.ZEPHYR_SDK_INSTALL_DIR,
      path.join(process.env.USERPROFILE ?? "", ".zinstaller", "tools", "zephyr-sdk"),
    ];

    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return undefined;
  }

  public static currentPanel: EclairManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _workspaceFolder: vscode.WorkspaceFolder | undefined;
  private _settingsRoot: string | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _didInitialProbe = false;
  private _envWatcher: fs.FSWatcher | undefined;
  private envData: any | undefined;
  private envYamlDoc: any | undefined;
  private _reportServerTerminal: vscode.Terminal | undefined;

  /**
   * Dynamically detects the ECLAIR directory for PATH (env.yml, PATH, system).
   * Never uses installPath from the UI for execution.
   */
  private async detectEclairDir(): Promise<string | undefined> {
    // Try env.yml (EXTRA_TOOLS)
    const eclairInfo = this.getEclairPathFromEnv();
    if (eclairInfo && eclairInfo.path && fs.existsSync(eclairInfo.path)) {
      return eclairInfo.path;
    }
    // Try system PATH
    try {
      const whichCmd = process.platform === "win32"
        ? 'powershell -NoProfile -Command "$c=Get-Command eclair -ErrorAction SilentlyContinue; if ($c) { $c.Source }"'
        : 'which eclair';
      const execSync = require("child_process").execSync;
      const out = execSync(whichCmd, { encoding: "utf8" });
      const lines = out.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      if (lines[0] && fs.existsSync(lines[0])) {
        return path.dirname(lines[0]);
      }
    } catch { /* ignore */ }

    return undefined;
  }



  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder, settingsRoot?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._workspaceFolder = workspaceFolder;
    this._settingsRoot = settingsRoot;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Load env.yml and watch for external edits so the path field stays in sync
    this.loadEnvYaml();
    this.startEnvWatcher();
  }

  public static render(extensionUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder, settingsRoot?: string) {
    if (EclairManagerPanel.currentPanel) {
      EclairManagerPanel.currentPanel._workspaceFolder = workspaceFolder;
      EclairManagerPanel.currentPanel._settingsRoot = settingsRoot;
      EclairManagerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "zephyr-workbench.eclair-manager.panel",
      "ECLAIR Manager",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      }
    );
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "res", "icons", "light", "eclair.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "res", "icons", "dark", "eclair.svg"),
    };

    EclairManagerPanel.currentPanel = new EclairManagerPanel(panel, extensionUri, workspaceFolder, settingsRoot);
    EclairManagerPanel.currentPanel.createContent();
  }

  public dispose() {
    EclairManagerPanel.currentPanel = undefined;
    if (this._envWatcher) {
      try { this._envWatcher.close(); } catch { /* ignore */ }
    }
    // Dispose report server terminal if running
    if (this._reportServerTerminal) {
      try {
        this._reportServerTerminal.dispose();
      } catch {
        /* ignore */
      }
      this._reportServerTerminal = undefined;
    }
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }

  /**
   * Utility: Given a path, returns its directory if it's an executable, or the path itself if already a directory.
   * Used to normalize the ECLAIR install path.
   */
  private toInstallDir(p?: string): string | undefined {
    if (!p) return undefined;
    const trimmed = p.trim();
    if (!trimmed) return undefined;
    if (trimmed.toLowerCase().endsWith("eclair.exe")) {
      const d = path.dirname(trimmed);
      if (d === "." || d === "") return undefined;
      return d;
    }
    return trimmed;
  }

  /**
   * Finds the ECLAIR PROJECT.ecd database file in the build directory.
   * Searches in build/sca/eclair/PROJECT.ecd path.
   */
  private findEclairDatabase(): string | undefined {
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) {
      return undefined;
    }

    const appDir = folderUri.fsPath;
    const config = vscode.workspace.getConfiguration(undefined, folderUri);
    const configs = config.get<any[]>("zephyr-workbench.build.configurations") ?? [];
    const activeIdx = configs.findIndex(c => c?.active === true || c?.active === "true");
    const idx = activeIdx >= 0 ? activeIdx : 0;

    const buildDir = this.getBuildDir(configs, idx, appDir);
    const ecdPath = path.join(buildDir, "sca", "eclair", "PROJECT.ecd");

    if (fs.existsSync(ecdPath)) {
      return ecdPath;
    }

    return undefined;
  }

  /**
   * Starts the ECLAIR report server and opens it in the browser.
   */
  private async startReportServer(): Promise<void> {
    const dbPath = this.findEclairDatabase();
    
    if (!dbPath) {
      vscode.window.showErrorMessage("ECLAIR database (PROJECT.ecd) not found. Please run an analysis first.");
      return;
    }

    // Check if server is already running
    if (this._reportServerTerminal) {
      vscode.window.showInformationMessage("ECLAIR report server is already running.");
      return;
    }

    const eclairDir = await this.detectEclairDir();
    const eclairReportCmd = eclairDir 
      ? path.join(eclairDir, process.platform === "win32" ? "eclair_report.exe" : "eclair_report")
      : "eclair_report";

    const cmd = `"${eclairReportCmd}" -db="${dbPath}" -browser -server=restart`;

    try {
      const out = getOutputChannel();
      out.appendLine(`[ECLAIR Report] Starting report server...`);
      out.appendLine(`[ECLAIR Report] Database: ${dbPath}`);
      out.appendLine(`[ECLAIR Report] Command: ${cmd}`);

      // Start background processes
      const terminal = vscode.window.createTerminal({
        name: "ECLAIR Report Server",
        hideFromUser: false
      });
      terminal.sendText(cmd);
      terminal.show();

      await this.tryActivateEclairExtension("ECLAIR Report");

      // Store terminal reference
      this._reportServerTerminal = terminal;
      const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
      post_message({ command: "report-server-started" });
      vscode.window.showInformationMessage("ECLAIR report server started. Check your browser.");
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to start ECLAIR report server: ${err.message || err}`);
    }
  }

  /**
   * Stops the ECLAIR report server.
   */
  private async stopReportServer() {
    if (!this._reportServerTerminal) {
      vscode.window.showInformationMessage("ECLAIR report server is not running.");
      return;
    }

    // Dispose the terminal (this will kill the process)
    this._reportServerTerminal.dispose();
    this._reportServerTerminal = undefined;
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
    post_message({ command: "report-server-stopped" });
    vscode.window.showInformationMessage("ECLAIR report server stopped.");
  }

  /**
   * Attempts to activate the ECLAIR VS Code extension if it's installed.
   */
  private async tryActivateEclairExtension(ctx: string): Promise<void> {
    const out = getOutputChannel();

    try {
      const eclairExt = vscode.extensions.getExtension<IEclairExtension>('bugseng.eclair');
      if (!eclairExt) {
        out.appendLine(`[${ctx}] ECLAIR extension not found.`);
        vscode.window.showInformationMessage("ECLAIR VS Code extension not found. To install it, use the VSIX file provided with ECLAIR (see manual for details).");
        return;
      }

      if (!eclairExt.isActive) {
        out.appendLine(`[${ctx}] Activating ECLAIR extension...`);
        await eclairExt.activate();
        out.appendLine(`[${ctx}] ECLAIR extension activated.`);
      }

      if (!eclairExt.exports || typeof eclairExt.exports.enable !== 'function') {
        out.appendLine(`[${ctx}] ECLAIR extension enable function not found.`);
        vscode.window.showWarningMessage("ECLAIR VS Code extension may be outdated. The enable function is not available. Please make sure the extension is up to date.");
        return;
      }

      out.appendLine(`[${ctx}] Enabling ECLAIR extension...`);
      eclairExt.exports.enable();
      out.appendLine(`[${ctx}] ECLAIR extension enabled.`);
    } catch (err: any) {
      let e = `Could not activate ECLAIR extension: ${err.message || err}`;
      out.appendLine(`[${ctx}] ${e}`);
      vscode.window.showErrorMessage(e);
    }
  }

  /**
   * Loads the env.yml file into memory (this.envData and this.envYamlDoc).
   * Used to keep the UI and backend in sync with external changes.
   */
  private loadEnvYaml() {
    try {
      const envYamlPath = path.join(getInternalDirRealPath(), "env.yml");
      if (fs.existsSync(envYamlPath)) {
        const envYaml = fs.readFileSync(envYamlPath, "utf8");
        this.envData = yaml.parse(envYaml);
        this.envYamlDoc = yaml.parseDocument(envYaml);
      }
    } catch {
      this.envData = undefined;
      this.envYamlDoc = undefined;
    }
  }

  /**
   * Starts a file watcher on env.yml to reload it if changed externally.
   * Keeps the UI fields in sync with manual edits or other tools.
   */
  private startEnvWatcher() {
    if (this._envWatcher) return;
    const envYamlPath = path.join(getInternalDirRealPath(), "env.yml");
    if (!fs.existsSync(envYamlPath)) return;

    this._envWatcher = fs.watch(envYamlPath, async () => {
      this.loadEnvYaml();
      if (this._panel.visible) {
        const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
        const eclairInfo = this.getEclairPathFromEnv();
        const path = (typeof eclairInfo === 'object' && typeof eclairInfo.path === 'string') ? eclairInfo.path : '';
        const pathToShow = (!path || path === "") ? "Not Found" : path;
        post_message({ command: "set-install-path", path: pathToShow });
        post_message({ command: "set-path-status", text: pathToShow });
        post_message({ command: "set-install-path-placeholder", text: pathToShow });
      }
    });
  }

  /**
   * Returns the ECLAIR path from env.yml (EXTRA_TOOLS), if present.
   * Used to display the current ECLAIR path in the UI and for auto-detection logic.
   */
  private getEclairPathFromEnv(): { path: string | undefined, index: number } {
    try {
      const arr = (this.envData as any)?.other?.EXTRA_TOOLS?.path;
      if (Array.isArray(arr) && arr.length > 0) {
        const idx = arr.length - 1;
        return { path: normalizePath(arr[idx]), index: idx };
      }
    } catch {
      // ignore
    }
    // Fallback: read directly from env.yml helpers in case in-memory parse failed
    const arr = getExtraPaths("EXTRA_TOOLS");
    if (arr.length > 0) {
      const idx = arr.length - 1;
      return { path: normalizePath(arr[idx]), index: idx };
    }
    return { path: undefined, index: -1 };
  }

  /**
   * Persists the ECLAIR install path to env.yml (EXTRA_TOOLS).
   * Called when the user sets or updates the ECLAIR path from the UI.
   */
  private saveEclairPathToEnv(installPath?: string) {
    const dir = this.toInstallDir(installPath);
    if (!dir) return;
    const normalized = normalizePath(dir);
    // Allows you to save any value
    if (!normalized) return;
    // get current paths
    const arr = getExtraPaths("EXTRA_TOOLS");
    // find index where eclair is detected or matches current UI
    let idx = this.getEclairPathFromEnv().index;
    if (idx < 0) idx = 0;
    // use setExtraPath helper to update env.yml
    require("../utils/envYamlUtils").setExtraPath("EXTRA_TOOLS", idx, normalized);
    // reload in-memory state
    this.loadEnvYaml();
    this.startEnvWatcher();
    // persist in UI immediately with the saved value
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
    post_message({ command: 'set-path-status', text: normalized });
    post_message({ command: 'set-install-path-placeholder', text: normalized });
  }

  /**
   * Minimal: Save the detected ECLAIR path ONCE if EXTRA_TOOLS.path is not an array
   * with at least one value. This will never append or touch the file if the
   * path array already exists and has entries.
   */
  private saveEclairPathOnceIfMissing(detectedDir: string) {
    try {
      const envYamlPath = path.join(getInternalDirRealPath(), "env.yml");
      let envObj: any = {};
      if (fs.existsSync(envYamlPath)) {
        envObj = yaml.parse(fs.readFileSync(envYamlPath, "utf8")) || {};
      }
      if (!envObj.other) envObj.other = {};
      if (!envObj.other.EXTRA_TOOLS) envObj.other.EXTRA_TOOLS = {};
      const current = envObj.other.EXTRA_TOOLS.path;
      // If it's already a non-empty array with a valid first entry, do nothing
      if (Array.isArray(current) && current.length > 0 && current[0] && String(current[0]).trim() !== "") {
        return;
      }
      // If it's a string or an empty array, overwrite
      envObj.other.EXTRA_TOOLS.path = [normalizePath(detectedDir)];
      fs.writeFileSync(envYamlPath, yaml.stringify(envObj), "utf8");
    } catch (err) {
    }
  }

  /**
   * Initializes the webview content and sets up message listeners.
   * Also triggers initial probe and loads config fields into the UI.
   */
  public async createContent() {
    this._panel.webview.html = await this._getWebviewContent(this._panel.webview, this._extensionUri);
    this._setWebviewMessageListener(this._panel.webview);

    // Save the ECLAIR path in env.yml as soon as you open the panel, if it's installed and there's no path.
    try {
      // Detect ECLAIR in system PATH
      let exePath: string | undefined = undefined;
      if (process.platform === "win32") {
        const whichCmd = 'powershell -NoProfile -Command "$c=Get-Command eclair -ErrorAction SilentlyContinue; if ($c) { $c.Source }"';
        const execSync = require("child_process").execSync;
        const out = execSync(whichCmd, { encoding: "utf8" });
        const lines = out.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
        if (lines[0] && fs.existsSync(lines[0])) exePath = lines[0];
      } else {
        const execSync = require("child_process").execSync;
        const out = execSync("which eclair", { encoding: "utf8" });
        const lines = out.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
        if (lines[0] && fs.existsSync(lines[0])) exePath = lines[0];
      }
      if (exePath) {
        // Check if we already have a valid path in env.yml
        const arr = getExtraPaths("EXTRA_TOOLS");
        const alreadyHas = Array.isArray(arr) && arr.length > 0 && arr[0] && String(arr[0]).trim() !== "";
        if (!alreadyHas) {
          EclairManagerPanel.saveEclairAbsolutePath(path.dirname(exePath));
        }
      }
    } catch (err) {
      vscode.window.showErrorMessage("ECLAIR is not installed. Please install ECLAIR and try again.");
    }

    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);

    this._panel.onDidChangeViewState(async () => {
      if (this._panel.visible) {
        try {
          post_message({ command: "toggle-spinner", show: true });
          await this.runEclair();
        } finally {
          post_message({ command: "toggle-spinner", show: false });
        }
        // Restore saved SCA config whenever the panel becomes visible again
        await this.loadScaConfig();
      }
    }, null, this._disposables);

    if (!this._didInitialProbe) {
      this._didInitialProbe = true;
      try {
        post_message({ command: "toggle-spinner", show: true });
        await this.runEclair();
      } finally {
        post_message({ command: "toggle-spinner", show: false });
      }
    }
    
    // Initialize report server button states
    if (this._reportServerTerminal) {
      post_message({ command: "report-server-started" });
    } else {
      post_message({ command: "report-server-stopped" });
    }
  }

  /**
   * Handles messages from the webview (frontend), such as path updates, config saves, etc.
   * This is the main bridge between UI actions and backend logic.
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);

    webview.onDidReceiveMessage(async (m: WebviewMessage) => {
      switch (m.command) {
        case "update-path": {
          const { tool, newPath } = m;
          if (tool === "eclair") {
            this.saveEclairPathToEnv(newPath);
            const eclairInfo = this.getEclairPathFromEnv();
            const path = eclairInfo?.path || "";
            // TODO post_message({ command: "path-updated", tool, path, success: true });
          }
          break;
        }
        case "browse-path": {
          const { tool } = m;
          if (tool === "eclair") {
            const pick = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: "Select the ECLAIR installation" });
            if (pick && pick[0]) {
              const chosen = pick[0].fsPath.trim();
              this.saveEclairPathToEnv(chosen);
              const eclairInfo = this.getEclairPathFromEnv();
              const path = eclairInfo?.path || "";
              // TODO post_message({ command: "path-updated", tool, path, success: true, FromBrowse: true });
            }
          }
          break;
        }
        case "manage-license":
          vscode.env.openExternal(vscode.Uri.parse("http://localhost:1947"));
          break;
        case "request-trial":
          vscode.env.openExternal(vscode.Uri.parse("https://www.bugseng.com/eclair-request-trial/"));
          break;
        case "about-eclair":
          vscode.env.openExternal(vscode.Uri.parse("https://www.bugseng.com/eclair-static-analysis-tool/"));
          break;
        case "refresh-status": {
          try {
            post_message({ command: "toggle-spinner", show: true });
            await this.runEclair();
            const eclairInfo = this.getEclairPathFromEnv();
            const path = eclairInfo?.path || "";
            post_message({ command: "set-install-path", path });
            post_message({ command: "set-path-status", text: path });
            post_message({ command: "set-install-path-placeholder", text: path });
          } finally {
            post_message({ command: "toggle-spinner", show: false });
          }
          // Webview is now mounted and ready — restore the full saved SCA config
          await this.loadScaConfig();
          break;
        }
        case "browse-extra-config": {
          const folderUri = this.resolveApplicationFolderUri();
          const pick = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: folderUri,
            title: "Select the additional configuration",
            filters: {
              "ECL file": ["ecl", "eclair", "cmake"],
              "All files": ["*"]
            }
          });
          if (pick?.[0]) {
            const chosen = pick[0].fsPath;
            post_message({ command: "set-extra-config", path: chosen });
          }
          break;
        }

        case "save-sca-config": {
          const cfg = m.config;
          await this.saveScaConfig(cfg);
          break;
        }
        case "run-command": {
          const cfg = m.config;
          await this.saveScaConfig(cfg);

          // Determine application directory
          const folderUri = this.resolveApplicationFolderUri();
          const appDir = folderUri?.fsPath;

          if (!appDir) {
            vscode.window.showErrorMessage("Unable to determine application directory for west build.");
            break;
          }

          // Determine folder URI for configuration
          const config = vscode.workspace.getConfiguration(undefined, folderUri);
          const configs = config.get<any[]>("zephyr-workbench.build.configurations") ?? [];
          const activeIdx = configs.findIndex(c => c?.active === true || c?.active === "true");
          const idx = activeIdx >= 0 ? activeIdx : 0;

          // Resolve BOARD from configuration (configurations[].board > zephyr-workbench.board > env)
          const board =
            (configs?.[idx]?.board?.toString()?.trim() || "") ||
            (config.get<string>("zephyr-workbench.board")?.trim() || "") ||
            (process.env.BOARD?.trim() || "");

          if (!board) {
            vscode.window.showErrorMessage(
              "BOARD not set. Please set it before running ECLAIR analysis."
            );
            break;
          }

          const buildDir = this.getBuildDir(configs, idx, appDir);
          // TODO: deepResolvePaths is a blunt recursive replacement — replace with targeted field handling.
          const cmakeArgs = build_cmake_args(this.deepResolvePaths(cfg));

          const cmd = [
            "west",
            "build",
            "--pristine",
            `-s "${appDir}"`,
            `-d "${buildDir}"`,
            `--board=${board}`,
            "--",
            cmakeArgs
          ].filter(Boolean).join(" ");

          /*

          // Run from west workspace 
          const westTopdir = this.getWestWorkspacePath();
          
          if (!westTopdir) {
            vscode.window.showErrorMessage("West workspace not found.");
            break;
          }

          // Determine extra paths for environment
          const extraPaths: string[] = [];
          const sdk = process.env.ZEPHYR_SDK_INSTALL_DIR;
          if (sdk) {
            extraPaths.push(path.join(sdk, "arm-zephyr-eabi", "bin"));
            extraPaths.push(path.join(sdk, "cmake", "bin"));
            extraPaths.push(path.join(sdk, "ninja"));
          }
          const westFromInstaller = path.join(
            process.env.USERPROFILE ?? "",
            ".zinstaller",
            ".venv",
            "Scripts"
          );
          if (existsSync(westFromInstaller)) {
            extraPaths.push(westFromInstaller);
          }
          // Add ECLAIR dir
          const eclairDir = await this.detectEclairDir();
          if (eclairDir && existsSync(eclairDir)) {
            extraPaths.push(eclairDir);
          }

          // Ensure all env values are strings (not undefined)
          const mergedEnv: { [key: string]: string } = {};
          for (const [k, v] of Object.entries(process.env)) {
            if (typeof v === "string") mergedEnv[k] = v;
            else mergedEnv[k] = "";
          }

          // Disable ccache for SCA/ECLAIR (breaks wrapper script)
          mergedEnv.CCACHE_DISABLE = "1";
          mergedEnv.PATH =
            (extraPaths.length ? extraPaths.join(path.delimiter) + path.delimiter : "") +
            (process.env.PATH || "");

          // Inject Zephyr SDK and essential variables into the environment
          // Detect SDK (can be hardcoded for your test case)
          let zephyrSdk = this.detectZephyrSdkDir();
          // If not found, try buildDir (in case SDK is in the project)
          if (!zephyrSdk && buildDir) {
            const guess = path.join(path.dirname(buildDir), "zephyr-sdk-0.17.4");
            if (fs.existsSync(guess)) zephyrSdk = guess;
          }
          if (zephyrSdk) {
            mergedEnv.ZEPHYR_SDK_INSTALL_DIR = zephyrSdk;
            mergedEnv.ZEPHYR_TOOLCHAIN_VARIANT = "zephyr";
            mergedEnv.CMAKE_PREFIX_PATH = [
              zephyrSdk,
              path.join(zephyrSdk, "cmake"),
              process.env.CMAKE_PREFIX_PATH
            ].filter(Boolean).join(path.delimiter);
            mergedEnv.PATH = [
              path.join(zephyrSdk, "arm-zephyr-eabi", "bin"),
              path.join(zephyrSdk, "cmake", "bin"),
              mergedEnv.PATH
            ].join(path.delimiter);
          }

          const out = getOutputChannel();
          out.appendLine(`[ECLAIR cwd: ${westTopdir}`);
          out.appendLine(`[ECLAIR cmd: ${cmd}`);
          out.appendLine(`[ECLAIR ZEPHYR_SDK_INSTALL_DIR=${mergedEnv.ZEPHYR_SDK_INSTALL_DIR}`);
          out.appendLine(`[ECLAIR ZEPHYR_TOOLCHAIN_VARIANT=${mergedEnv.ZEPHYR_TOOLCHAIN_VARIANT}`);
          out.appendLine(`[ECLAIR CMAKE_PREFIX_PATH=${mergedEnv.CMAKE_PREFIX_PATH}`);

          try {
            await execShellCommandWithEnv("ECLAIR Analysis", cmd, {
              cwd: westTopdir,
              env: mergedEnv,
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to run ECLAIR: ${err}`);
          }*/
          break;
        }

        case "probe-eclair":
          this.runEclair();
          break;
        case "browse-user-ruleset-path": {
          const pick = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Select Ruleset path"
          });
          if (pick && pick[0]) {
            const chosen = pick[0].fsPath.trim();
            post_message({ command: "set-user-ruleset-path", path: chosen });
            // save path select from the browse dialog
            const folderUri = this.resolveApplicationFolderUri();
            if (!folderUri) break;
            const config = vscode.workspace.getConfiguration(undefined, folderUri);
            const configs = config.get<any[]>("zephyr-workbench.build.configurations") ?? [];
            const activeIdx = configs.findIndex(c => c?.active === true || c?.active === "true");
            const idx = activeIdx >= 0 ? activeIdx : 0;
            if (configs[idx] && Array.isArray(configs[idx].sca) && configs[idx].sca.length > 0) {
              configs[idx].sca[0].userRulesetPath = this.deepTokenizePaths(chosen);
              await config.update("zephyr-workbench.build.configurations", configs, vscode.ConfigurationTarget.WorkspaceFolder);
            }
          }
          break;
        }
        case "browse-custom-ecl-path": {
          const folderUri = this.resolveApplicationFolderUri();
          const pick = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: folderUri,
            title: "Select custom ECL configuration file",
            filters: {
              "ECL file": ["ecl"],
              "All files": ["*"]
            }
          });
          if (pick && pick[0]) {
            const chosen = pick[0].fsPath.trim();
            post_message({ command: "set-custom-ecl-path", path: chosen });
          }
          break;
        }
        case "start-report-server": {
          await this.startReportServer();
          break;
        }
        case "stop-report-server": {
          await this.stopReportServer();
          break;
        }
        case "load-preset-from-path": {
          load_preset_from_path(m.path, post_message);
          break;
        }
        case "load-preset-from-repo": {
          // Look up origin & ref from the stored config — the webview only knows
          // the logical name and the relative file path.
          const folderUri = this.resolveApplicationFolderUri();
          const wsCfg = folderUri ? vscode.workspace.getConfiguration(undefined, folderUri) : undefined;
          const wsCfgs = wsCfg?.get<any[]>("zephyr-workbench.build.configurations") ?? [];
          const activeIdx2 = wsCfgs.findIndex((c: any) => c?.active === true || c?.active === "true");
          const cfgIdx = activeIdx2 >= 0 ? activeIdx2 : 0;
          const scaCfgRaw = wsCfgs[cfgIdx]?.sca?.[0]?.cfg;
          const repos = (scaCfgRaw?.repos ?? {}) as Record<string, { origin: string; ref: string }>;
          const entry = repos[m.name];
          if (!entry) {
            const src: EclairPresetTemplateSource = { type: "repo-path", repo: m.name, path: m.path };
            post_message({ command: "preset-content", source: src, template: { error: `Repository '${m.name}' not found in repos configuration.` } });
            break;
          }
          load_preset_from_repo(m.name, entry.origin, entry.ref, m.path, post_message);
          break;
        }
        case "scan-repo": {
          // Immediately check out the repo and scan all .ecl files, sending
          // back preset-content messages so the webview picker is updated.
          scanAllRepoPresets(m.name, m.origin, m.ref, post_message);
          break;
        }
        case "pick-preset-path": {          const kind = m.kind;
          const pick = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: "Select preset file",
            filters: {
              "ECL presets": ["ecl"],
              "All files": ["*"]
            }
          });
          if (pick && pick[0]) {
            const chosen = pick[0].fsPath.trim();
            post_message({ command: "template-path-picked", kind, path: chosen });
          }
          break;
        }
      }
    }, undefined, this._disposables);
  }

  private getBuildDir(configs: any, idx: number, appDir: string): string {
    return (
      configs[idx]?.build?.dir ||
        configs[idx]?.buildDir ||
        path.join(appDir, "build", configs[idx]?.name || "primary")
    );
  }

  /**
   * Reads the saved SCA configuration from settings.json and sends it back to
   * the webview so the UI can restore its full state.  This is called both on
   * initial panel creation and whenever the panel becomes visible again.
   */
  private async loadScaConfig() {
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
    const out = getOutputChannel();
    try {
      const folderUri = this.resolveApplicationFolderUri();
      if (!folderUri) return;
      const config = vscode.workspace.getConfiguration(undefined, folderUri);
      const configs = config.get<any[]>("zephyr-workbench.build.configurations") ?? [];
      const activeIdx = configs.findIndex(c => c?.active === true || c?.active === "true");
      const idx = activeIdx >= 0 ? activeIdx : 0;
      if (!configs[idx] || !Array.isArray(configs[idx].sca) || configs[idx].sca.length === 0) {
        return;
      }
      const raw = configs[idx].sca[0]?.cfg;
      if (!raw) return;
      // Expand ${workspaceFolder} tokens that were stored during save
      const resolved = this.deepResolvePaths(raw);
      // Validate the shape before sending; if it doesn't parse, just skip
      const { EclairScaConfigSchema } = await import("../utils/eclair/config.js");
      const parsed = EclairScaConfigSchema.safeParse(resolved);
      if (!parsed.success) {
        console.warn("[EclairManagerPanel] loadScaConfig: saved config failed validation:", parsed.error);
        return;
      }
      post_message({ command: "set-sca-config", config: parsed.data });

      // If the config references system-path presets, load them now so the
      // webview has the template content when it renders the restored config.
      if (parsed.data.config.type === "preset") {
        const { ruleset, variants, tailorings } = parsed.data.config;
        const allPresets = [ruleset, ...variants, ...tailorings];
        for (const p of allPresets) {
          if (p?.source?.type === "system-path" && p.source.path) {
            load_preset_from_path(p.source.path, post_message);
          }
        }
      }

      out.appendLine("[EclairManagerPanel] Loaded SCA config:");
      out.appendLine(JSON.stringify(parsed.data, null, 2));
      // Scan all configured repos so the frontend has the full preset catalogue.
      if (parsed.data.repos && Object.keys(parsed.data.repos).length > 0) {
        // Don't await — scanning may involve network I/O; let it stream results.
        out.appendLine("[EclairManagerPanel] Scanning configured repos for presets...");
        // EclairRepos uses `ref`; scanRepoPresets expects `ref` — remap here.
        const reposForScan: Record<string, { origin: string; ref: string }> = {};
        for (const [name, entry] of Object.entries(parsed.data.repos)) {
          reposForScan[name] = { origin: entry.origin, ref: entry.ref };
        }
        this.scanRepoPresets(reposForScan);
      }
    } catch (err) {
      out.appendLine(`[EclairManagerPanel] Error loading SCA config: ${err}`);
      console.error("[EclairManagerPanel] loadScaConfig error:", err);
    }
  }

  /**
   * For each repo in the saved SCA config's `repos` map, ensures it is
   * checked out and then scans all `.ecl` files in the working tree.  Each
   * file that parses as an ECLAIR preset template is posted to the webview
   * as a `preset-content` message so the UI can list it as an available
   * preset.
   *
   * Called automatically at the end of `loadScaConfig` so the frontend always
   * has an up-to-date view of what the configured repos provide.
   */
  private async scanRepoPresets(repos: Record<string, { origin: string; ref: string }>) {
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
    // Fire off all repos concurrently — each one is independent.
    await Promise.allSettled(
      Object.entries(repos).map(([name, entry]) =>
        scanAllRepoPresets(name, entry.origin, entry.ref, post_message)
      )
    );
  }

  private async saveScaConfig(cfg: EclairScaConfig) {
    const folderUri = this.resolveApplicationFolderUri();
    if (!folderUri) return;

    // If an installPath was provided in the UI, persist it to env.yml
    if (cfg.install_path) {
      this.saveEclairPathToEnv(cfg.install_path);
    }

    const config = vscode.workspace.getConfiguration(undefined, folderUri);
    const existing = config.get<any[]>("zephyr-workbench.build.configurations") ?? [];
    const configs: any[] = Array.isArray(existing) ? [...existing] : [];
    const activeIdx = configs.findIndex(c => c?.active === true || c?.active === "true");
    const idx = activeIdx >= 0 ? activeIdx : 0;
    if (!configs[idx]) {
      configs[idx] = { name: "primary", active: true };
    }

    const scaArray: { [key: string]: any } = {
      name: "eclair",
      // TODO: deepTokenizePaths is a blunt recursive replacement, replace with targeted field handling.
      cfg: this.deepTokenizePaths(cfg),
    };

    // TODO maybe useless now
    // Defensive cleanup
    Object.keys(scaArray).forEach(k => {
      if (!scaArray[k]) delete scaArray[k];
    });

    configs[idx].sca = [scaArray];

    await config.update("zephyr-workbench.build.configurations", configs, vscode.ConfigurationTarget.WorkspaceFolder);
  }

  /**
   * Probes the system for ECLAIR installation, gets version, and updates the UI accordingly.
   * If ECLAIR is found and not present in env.yml, adds it automatically.
   */
  private async runEclair() {
    this.loadEnvYaml();
    const post_message = (m: ExtensionMessage) => this._panel.webview.postMessage(m);
    post_message({ command: "toggle-spinner", show: true });
    post_message({ command: "set-path-status", text: "Checking" });
    post_message({ command: "set-install-path-placeholder", text: "Checking" });

    const readStdout = async (proc: any) => {
      let out = "";
      await new Promise<void>((resolve) => {
        proc.stdout?.on("data", (c: Buffer) => out += c.toString());
        proc.on("close", () => resolve());
        proc.on("error", () => resolve());
      });
      return out;
    };

    let exePath: string | undefined;
    try {
      const cmd = process.platform === "win32"
        ? 'powershell -NoProfile -Command "$c=Get-Command eclair -ErrorAction SilentlyContinue; if ($c) { $c.Source }"'
        : 'which eclair';
      const proc = await execCommandWithEnv(cmd);
      const outStd = await readStdout(proc);
      const lines = outStd.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      exePath = lines[0];
    } catch {
      exePath = undefined;
    }

    let version: string | undefined;
    try {
      const proc = await execCommandWithEnv(exePath ? `"${exePath}" -version` : "eclair -version");
      const out = await readStdout(proc);
      const m1 = out.match(/ECLAIR\s+version\s+([0-9]+(?:\.[0-9]+)*)/i);
      const m2 = out.match(/\b([0-9]+(?:\.[0-9]+)*)\b/);
      version = (m1?.[1] || m2?.[1] || "").trim() || undefined;
    } catch {
      version = undefined;
    }

    const installed = !!version;


    let eclairInfo = this.getEclairPathFromEnv();
    // ECLAIR is detected but not present in env.yml, add it automatically (minimal approach)
    if (
      installed &&
      exePath &&
      (!eclairInfo.path || eclairInfo.path.trim() === "")
    ) {
      const detectedDir = normalizePath(path.dirname(exePath));
      this.saveEclairPathOnceIfMissing(detectedDir);
      this.loadEnvYaml();
      eclairInfo = this.getEclairPathFromEnv();
    }

    const eclairPath = (typeof eclairInfo === 'object' && typeof eclairInfo.path === 'string') ? eclairInfo.path : '';
    post_message({ command: 'set-install-path', path: eclairPath });
    post_message({ command: 'set-path-status', text: eclairPath });
    post_message({ command: 'set-install-path-placeholder', text: eclairPath });

    post_message({ command: 'eclair-status', installed, version: installed ? version! : 'unknown' });
    post_message({ command: "toggle-spinner", show: false });

  }

  private async _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): Promise<string> {
    const nonce = getNonce();
    const scriptUri = getUri(webview, extensionUri, ["out", "eclairmanager.js"]);
    const styleUri = getUri(webview, extensionUri, ["out", "style.css"]);
    const codiconUri = getUri(webview, extensionUri, ["out", "codicon.css"]);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" nonce="${nonce}" href="${styleUri}">
<link rel="stylesheet" nonce="${nonce}" href="${codiconUri}">
<title>ECLAIR Manager</title>
</head>
<body id="eclair-manager-body">
<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

async function load_preset_from_path(
  preset_path: string,
  post_message: (m: ExtensionMessage) => void,
) {
  preset_path = preset_path.trim();
  if (!preset_path) {
    post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { error: "Invalid preset path." } });
    return;
  }

  post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { loading: "reading file" } });
  try {
    // TODO check and switch on extension
    const content = await fs.promises.readFile(preset_path, { encoding: "utf8" });
    post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { loading: "parsing file" } });

    const yaml_content = extract_yaml_from_ecl_content(content);
    if (yaml_content === undefined) {
      post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { error: "The selected file does not contain valid ECL template content." } });
      return;
    }

    let data: any;
    try {
      data = yaml.parse(yaml_content);
    } catch (err: any) {
      post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { error: `Failed to parse preset: ${err?.message || err}` } });
      return;
    }

    post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { loading: "validating file" } });

    let template: any;
    try {
      template = parse_eclair_template_from_any(data);
    } catch (err: any) {
      post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { error: `Invalid preset content: ${err?.message || err}` } });
      return;
    }

    post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template });
  } catch (err: any) {
    post_message({ command: "preset-content", source: { type: "system-path", path: preset_path }, template: { error: `Failed to read preset: ${err?.message || err}` } });
  }
}

/**
 * Loads a single preset file from a named repository.
 * `origin` and `ref` are internal parameters used by `ensureRepoCheckout`;
 * they do NOT appear in the `repo-path` source emitted to the webview.
 *
 * @param name Logical repo name (matches EclairScaConfig.repos key).
 * @param origin Git remote URL (internal only).
 * @param ref Branch, tag, or commit SHA (internal only).
 * @param filePath Preset file path relative to the repository root.
 * @param post_message Webview message poster.
 */
async function load_preset_from_repo(
  name: string,
  origin: string,
  ref: string,
  filePath: string,
  post_message: (m: ExtensionMessage) => void,
): Promise<void> {
  const source: EclairPresetTemplateSource = { type: "repo-path", repo: name, path: filePath };

  post_message({ command: "preset-content", source, template: { loading: "cloning repository" } });

  let checkoutDir: string;
  try {
    checkoutDir = await ensureRepoCheckout(name, origin, ref);
  } catch (err: any) {
    post_message({ command: "preset-content", source, template: { error: `Failed to checkout repository: ${err?.message || err}` } });
    return;
  }

  const absolutePath = path.join(checkoutDir, filePath);

  post_message({ command: "preset-content", source, template: { loading: "reading file" } });

  let content: string;
  try {
    content = await fs.promises.readFile(absolutePath, { encoding: "utf8" });
  } catch (err: any) {
    post_message({ command: "preset-content", source, template: { error: `Failed to read file '${filePath}' from repo '${name}': ${err?.message || err}` } });
    return;
  }

  post_message({ command: "preset-content", source, template: { loading: "parsing file" } });

  const yaml_content = extract_yaml_from_ecl_content(content);
  if (yaml_content === undefined) {
    post_message({ command: "preset-content", source, template: { error: "The file does not contain valid ECL template content." } });
    return;
  }

  let data: any;
  try {
    data = yaml.parse(yaml_content);
  } catch (err: any) {
    post_message({ command: "preset-content", source, template: { error: `Failed to parse preset: ${err?.message || err}` } });
    return;
  }

  post_message({ command: "preset-content", source, template: { loading: "validating file" } });

  let template: any;
  try {
    template = parse_eclair_template_from_any(data);
  } catch (err: any) {
    post_message({ command: "preset-content", source, template: { error: `Invalid preset content: ${err?.message || err}` } });
    return;
  }

  post_message({ command: "preset-content", source, template });
}

/**
 * Recurses through `dir` and collects all files whose name ends with `.ecl`.
 */
async function findEclFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findEclFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ecl")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Checks out the repository identified by `name`/`origin`@`ref`, then walks
 * every `.ecl` file in the working tree and attempts to parse each as an
 * ECLAIR preset template.  For every file a `preset-content` message is
 * posted — either with the parsed template on success or an error/skip on
 * failure.  Files that contain no YAML front-matter are silently skipped.
 *
 * This is the batch counterpart of `load_preset_from_repo` and is called
 * automatically from `EclairManagerPanel.scanRepoPresets`.
 */
async function scanAllRepoPresets(
  name: string,
  origin: string,
  ref: string,
  post_message: (m: ExtensionMessage) => void,
): Promise<void> {
  let checkoutDir: string;
  const out = getOutputChannel();
  try {
    out.appendLine(`[EclairManagerPanel] Scanning repo '${name}' for presets...`);
    checkoutDir = await ensureRepoCheckout(name, origin, ref);
    out.appendLine(`[EclairManagerPanel] Checked out repo '${name}' to '${checkoutDir}'.`);
  } catch (err: any) {
    out.appendLine(`[EclairManagerPanel] Failed to checkout repo '${name}': ${err}`);
    post_message({
      command: "repo-scan-failed",
      name,
      message: err?.message || String(err),
    });
    return;
  }

  const eclFiles = await findEclFiles(checkoutDir);

  // Fire off all files concurrently within the repo.
  await Promise.allSettled(
    eclFiles.map(async (absPath) => {
      const relPath = path.relative(checkoutDir, absPath).replace(/\\/g, "/");
      const source: EclairPresetTemplateSource = { type: "repo-path", repo: name, path: relPath };

      let content: string;
      try {
        content = await fs.promises.readFile(absPath, { encoding: "utf8" });
      } catch (err: any) {
        post_message({ command: "preset-content", source, template: { error: `Could not read file: ${err?.message || err}` } });
        return;
      }

      const yaml_content = extract_yaml_from_ecl_content(content);
      if (yaml_content === undefined) {
        // Not a template file — silently skip.
        return;
      }

      let data: any;
      try {
        data = yaml.parse(yaml_content);
      } catch (err: any) {
        post_message({ command: "preset-content", source, template: { error: `Failed to parse preset: ${err?.message || err}` } });
        return;
      }

      try {
        const template = parse_eclair_template_from_any(data);
        post_message({ command: "preset-content", source, template });
      } catch (err: any) {
        post_message({ command: "preset-content", source, template: { error: `Invalid preset content: ${err?.message || err}` } });
      }
    })
  );

  // All files have been processed — notify the webview so it can update the status badge.
  post_message({ command: "repo-scan-done", name });
}


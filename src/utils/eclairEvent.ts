import { EclairPresetTemplateSource, EclairRepos, EclairScaConfig, EclairScaMainConfig } from "./eclair/config";
import { EclairTemplate, EclairTemplateKind } from "./eclair/template";


// Commands sent FROM extension backend TO webview frontend
export type ExtensionMessage = {
  command: "toggle-spinner",
  show: boolean,
} | {
  command: "eclair-status",
  installed: boolean,
  version: string,
} | {
  command: "set-install-path",
  path: string,
} | {
  command: "set-extra-config",
  path: string,
} | {
  command: "set-path-status",
  text: string,
} | {
  command: "set-install-path-placeholder",
  text: string,
} | {
  command: "set-user-ruleset-name",
  name: string,
} | {
  command: "set-user-ruleset-path",
  path: string,
} | {
  command: "set-custom-ecl-path",
  path: string,
} | {
  command: "report-server-started",
} | {
  command: "report-server-stopped",
} | {
  command: "preset-content",
  source: EclairPresetTemplateSource,
  template: EclairTemplate | { loading: string } | { error: string },
} | {
  command: "template-path-picked",
  kind: EclairTemplateKind,
  path: string,
} | {
  // Restore the full saved SCA configuration into the webview
  command: "set-sca-config",
  config: EclairScaConfig,
} | {
  /** Sent when the backend begins scanning a repository for preset templates. */
  command: "repo-scan-done",
  name: string,
} | {
  /** Sent when an entire repository scan fails (e.g. checkout error). */
  command: "repo-scan-failed",
  name: string,
  message: string,
};

// Commands sent FROM webview frontend TO extension backend
export type WebviewMessage = {
  command: "refresh-status",
} | {
  command: "probe-eclair",
} | {
  command: "update-path",
  newPath: string,
} | {
  command: "browse-path",
} | {
  command: "browse-extra-config",
} | {
  command: "browse-user-ruleset-path",
} | {
  command: "browse-custom-ecl-path",
} | {
  command: "save-sca-config",
  config: EclairScaConfig,
} | {
  command: "run-command",
  config: EclairScaConfig,
} | {
  command: "start-report-server",
} | {
  command: "stop-report-server",
} | {
  command: "about-eclair",
} | {
  command: "manage-license",
} | {
  command: "request-trial",
} | {
  command: "load-preset",
  source: EclairPresetTemplateSource,
  repos: EclairRepos,
} | {
  command: "pick-preset-path",
  kind: EclairTemplateKind,
} | {
  /**
   * Ask the backend to check out a named repository and scan it for preset
   * templates, sending back `preset-content` messages for each discovered
   * template.  Used when a new repo is added in the UI so the preset picker
   * is populated immediately without requiring a full reload.
   */
  command: "scan-repo",
  name: string,
  origin: string,
  ref: string,
};
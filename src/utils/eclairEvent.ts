import { EclairPresetTemplateSource, EclairScaConfig } from "./eclair/config";
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
};

// Commands sent FROM webview frontend TO extension backend
export type WebviewMessage = {
  command: "refresh-status",
} | {
  command: "probe-eclair",
} | {
  command: "update-path",
  tool: string,
  newPath: string,
} | {
  command: "browse-path",
  tool: string,
} | {
  command: "update-extra-config",
  newPath: string,
} | {
  command: "browse-extra-config",
} | {
  command: "browse-user-ruleset-path",
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
  command: "load-preset-from-path",
  path: string,
} | {
  command: "pick-preset-path",
  kind: EclairTemplateKind,
};
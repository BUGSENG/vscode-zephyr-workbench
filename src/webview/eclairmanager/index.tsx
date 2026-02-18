import React, { useState, useEffect, useCallback, useReducer } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionMessage, WebviewMessage } from "../../utils/eclairEvent.js";
import { AnalysisConfigurationState, EclairState, EclairStateAction, ExtraConfigState, InstallPathState, PresetsSelectionState, ReportsState, default_eclair_state, default_ruleset_state, eclairReducer } from "./state.js";
import { Summary } from "./components/summary.js";
import { ReportsSection } from "./components/reports_section.js";
import { ExtraConfigSection } from "./components/extra_config_section.js";
import { CommandSection } from "./components/command_section.js";
import { ReportViewerSection } from "./components/report_viewer.js";
import { MainAnalysisConfigurationSection } from "./components/main_configuration.js";
import { match } from "ts-pattern";
import { EclairScaConfig, EclairScaMainConfig, EclairScaPresetConfig } from "../../utils/eclair/config.js";
import { Result } from "../../utils/typing_utils.js";

const BODY_ID = "eclair-manager-body";

// VSCode API type
declare const acquireVsCodeApi: any;

export async function main() {
  const mod = await import("@vscode/webview-ui-toolkit");
  const { provideVSCodeDesignSystem, allComponents } = mod as any;
  provideVSCodeDesignSystem().register(allComponents);

  const body = document.getElementById(BODY_ID);
  if (!body) return;

  const root = createRoot(body);
  root.render(<EclairManagerPanel />);
}

function EclairManagerPanel() {
  const [api] = useState(() => acquireVsCodeApi());
  const [state, dispatch_state] = useReducer(eclairReducer, default_eclair_state());
  const [collected_config, set_collected_config] = useState<Result<EclairScaConfig, string>>({ err: "Not configured" });

  const post_message = useCallback((message: WebviewMessage) => {
    api.postMessage(message);
  }, [api]);

  // Collect config for sending to backend
  // Note: this does not depend on the full state but only on the relevant parts
  // TODO refactor the state to group the relevant parts together and avoid passing
  // so many individual dependencies to this function (because this requires
  // keeping the reps and the args in sync here).
  useEffect(() => {
    try {
      let config = collect_config_from_state({
        install_path: state.install_path,
        analysis_configuration: state.analysis_configuration,
        extra_config: state.extra_config,
        reports: state.reports,
      });
      set_collected_config({ ok: config });
    } catch (e) {
      set_collected_config({ err: e instanceof Error ? e.message : String(e) });
    }
  }, [
    state.install_path,
    state.analysis_configuration,
    state.extra_config,
    state.reports,
  ]);

  // setup message handler
  useEffect(() => {
    const handle_message = (message: MessageEvent) => handleMessage(dispatch_state, message);
    window.addEventListener("message", handle_message);
    return () => window.removeEventListener("message", handle_message);
  }, [api]);

  // Trigger initial status refresh on mount
  useEffect(() => {
    try {
      post_message({ command: "refresh-status" });
    } catch (e) {
      console.error("Failed to post message to VSCode extension backend:", e);
    }
  }, [post_message]);

  return (
    <div>
      <h1>ECLAIR Manager</h1>

      <Summary
        status={state.status}
        installPath={state.install_path}
        post_message={post_message}
        dispatch_state={dispatch_state}
      />

      <MainAnalysisConfigurationSection
        state={state}
        dispatch_state={dispatch_state}
        post_message={post_message}
      />

      <ReportsSection
        reports={state.reports}
        dispatch_state={dispatch_state}
      />

      <ExtraConfigSection
        extra_config={state.extra_config}
        dispatch_state={dispatch_state}
        post_message={post_message}
      />

      <CommandSection
        post_message={post_message}
        config={collected_config}
      />

      <ReportViewerSection
        reportServer={state.report_server}
        post_message={post_message}
      />
    </div>
  );
}

window.addEventListener("load", main);


function handleMessage(
  dispatch: React.Dispatch<EclairStateAction>,
  event: MessageEvent
) {
  const msg: ExtensionMessage = event.data;

  switch (msg.command) {
    case "toggle-spinner":
      dispatch({ type: "toggle-spinner", show: !!msg.show });
      break;
    case "eclair-status":
      dispatch({
        type: "set-eclair-status",
        installed: !!msg.installed,
        version: msg.installed ? String(msg.version || "").trim() || "Unknown" : "Unknown",
      });
      break;
    case "set-install-path":
      dispatch({ type: "set-install-path", path: String(msg.path ?? "") });
      break;
    case "set-extra-config":
      dispatch({ type: "set-extra-config", path: String(msg.path ?? "") });
      break;
    case "set-path-status":
      dispatch({ type: "set-path-status", text: String(msg.text ?? "") });
      break;
    case "set-user-ruleset-name":
      dispatch({ type: "set-user-ruleset-name", name: String(msg.name ?? "") });
      break;
    case "set-user-ruleset-path":
      const path = String(msg.path ?? "");
      dispatch({ type: "set-user-ruleset-path", path });
      break;
    case "set-custom-ecl-path":
      const eclPath = String(msg.path ?? "");
      dispatch({ type: "set-custom-ecl-path", path: eclPath });
      break;
    case "report-server-started":
      dispatch({ type: "report-server-started" });
      break;
    case "report-server-stopped":
      dispatch({ type: "report-server-stopped" });
      break;
    case "preset-content": {
      const { source, template } = msg;
      dispatch({ type: "preset-content", source, template });
      break;
    }
    case "template-path-picked": {
      const { kind, path } = msg;
      dispatch({ type: "set-preset-path", kind, path });
      break;
    }
  }
}

function collect_config_from_state(state: {
  install_path: InstallPathState,
  analysis_configuration: AnalysisConfigurationState | null,
  extra_config: ExtraConfigState,
  reports: ReportsState,
}): EclairScaConfig {
  if (state.analysis_configuration === null) {
    throw new Error("No analysis configuration selected");
  }

  return {
    install_path: state.install_path.path,
    extra_config: state.extra_config.path,
    config: collect_eclair_analysis_config(state.analysis_configuration),
    reports: state.reports.selected,
  };
}

function collect_eclair_analysis_config(config: AnalysisConfigurationState): EclairScaMainConfig {
  return match(config)
    .with({ type: "preset" }, (cfg) => {
      const state = cfg.state;
      const config = collect_eclair_sca_preset_config(state);
      return { type: "preset", ...config } as EclairScaMainConfig;
    })
    .with({ type: "custom-ecl" }, (cfg) => {
      const state = cfg.state;
      if (state.ecl === undefined) {
        throw new Error("Custom ECL path is not set");
      }
      return { type: "custom-ecl", ecl_path: state.ecl } as EclairScaMainConfig;
    })
    .with({ type: "zephyr-ruleset" }, (cfg) => {
      const ruleset = cfg.ruleset;
      return {
        type: "zephyr-ruleset",
        ruleset: ruleset.selected,
        userRulesetName: ruleset.userRulesetName,
        userRulesetPath: ruleset.userRulesetPath,
      } as EclairScaMainConfig;
    })
    .exhaustive();
}

function collect_eclair_sca_preset_config(state: PresetsSelectionState): EclairScaPresetConfig {
  if (state.ruleset_state.preset === undefined) {
    throw new Error("No preset ruleset selected");
  }

  return {
    ruleset: state.ruleset_state.preset,
    variants: state.variants_state.presets,
    tailorings: state.tailorings_state.presets,
  };
}


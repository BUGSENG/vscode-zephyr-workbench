import React, { useState, useEffect, useCallback, useReducer } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionMessage, WebviewMessage } from "../../utils/eclairEvent.js";
import { EclairState, EclairStateAction, default_eclair_state, eclairReducer } from "./state.js";
import { Summary } from "./components/summary.js";
import { RulesetSection } from "./components/ruleset_section.js";
import { ReportsSection } from "./components/reports_section.js";
import { ExtraConfigSection } from "./components/extra_config_section.js";
import { CommandSection } from "./components/command_section.js";
import { ReportViewerSection } from "./components/report_viewer.js";

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

  const post_message = useCallback((message: WebviewMessage) => {
    api.postMessage(message);
  }, [api]);

  // Collect config for sending to backend
  const collectConfig = useCallback(() => {
    return {
      installPath: state.installPath.path,
      extraConfig: state.extraConfig.path,
      ruleset: state.ruleset.selected,
      userRulesetName: state.ruleset.userRulesetName,
      userRulesetPath: state.ruleset.userRulesetPath,
      reports: state.reports.selected,
    };
  }, [state]);

  // setup message handler
  useEffect(() => {
    const handle_message = (message: MessageEvent) => handleMessage(dispatch_state, post_message, collectConfig, message);
    window.addEventListener("message", handle_message);
    return () => window.removeEventListener("message", handle_message);
  }, [api, collectConfig, state]);

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
        installPath={state.installPath}
        post_message={post_message}
        dispatch_state={dispatch_state}
      />

      <RulesetSection
        ruleset={state.ruleset}
        dispatch_state={dispatch_state}
        post_message={post_message}
        collectConfig={collectConfig}
      />

      <ReportsSection
        reports={state.reports}
        dispatch_state={dispatch_state}
      />

      <ExtraConfigSection
        extraConfig={state.extraConfig}
        dispatch_state={dispatch_state}
        post_message={post_message}
      />

      <CommandSection
        post_message={post_message}
        collectConfig={collectConfig}
      />

      <ReportViewerSection
        reportServer={state.reportServer}
        post_message={post_message}
      />
    </div>
  );
}

window.addEventListener("load", main);


function handleMessage(
  dispatch: React.Dispatch<EclairStateAction>,
  post_message: (message: WebviewMessage) => void,
  collectConfig: () => any,
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
      // Auto-save when backend sends a new path (from file browser)
      post_message({
        command: "save-sca-config",
        data: { ...collectConfig(), userRulesetPath: path },
      });
      break;
    case "report-server-started":
      dispatch({ type: "report-server-started" });
      break;
    case "report-server-stopped":
      dispatch({ type: "report-server-stopped" });
      break;
  }
}

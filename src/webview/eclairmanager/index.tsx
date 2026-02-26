import React, { useState, useEffect, useCallback, useReducer, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionMessage, WebviewMessage } from "../../utils/eclairEvent.js";
import { MainAnalysisConfigurationState, EclairState, EclairStateAction, ExtraConfigState, InstallPathState, PresetsSelectionState, ReportsState, default_eclair_state, default_ruleset_state, eclairReducer, EclairConfig } from "./state.js";
import { Summary } from "./components/summary.js";
import { ReportsSection } from "./components/reports_section.js";
import { ExtraConfigSection } from "./components/extra_config_section.js";
import { CommandSection } from "./components/command_section.js";
import { ReportViewerSection } from "./components/report_viewer.js";
import { MainAnalysisConfigurationSection } from "./components/main_configuration.js";
import { match } from "ts-pattern";
import { EclairRepos, FullEclairScaConfig, EclairScaMainConfig, EclairScaPresetConfig, EclairScaConfig } from "../../utils/eclair/config.js";
import { Result } from "../../utils/typing_utils.js";
import { EditableTextField, RichHelpTooltip, SearchableDropdown, VscodeButton, VscodePanel } from "./components/common_components.js";
import { EasyMark } from "./components/easymark_render.js";
import { enableMapSet } from "immer";

const BODY_ID = "eclair-manager-body";

// VSCode API type
declare const acquireVsCodeApi: any;

export async function main() {
  enableMapSet();

  const body = document.getElementById(BODY_ID);
  if (!body) return;

  const root = createRoot(body);
  root.render(<EclairManagerPanel />);

  import_wui().catch((e) => {
    console.error("Failed to load VSCode Webview UI Toolkit:", e);
  });
}

export async function import_wui() {
  const mod = await import("@vscode/webview-ui-toolkit");
  const { provideVSCodeDesignSystem, allComponents } = mod as any;
  provideVSCodeDesignSystem().register(allComponents);
}

function EclairManagerPanel() {
  const [api] = useState(() => acquireVsCodeApi());
  const [state, dispatch_state] = useReducer(eclairReducer, default_eclair_state());
  const [collected_config, set_collected_config] = useState<Result<FullEclairScaConfig, string>>({ err: "Not configured" });

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
        configs: state.configs,
        current_config_index: state.current_config_index,
        repos: state.repos,
      });
      set_collected_config({ ok: config });
    } catch (e) {
      set_collected_config({ err: e instanceof Error ? e.message : String(e) });
    }
  }, [
    state.install_path,
    state.configs,
    state.current_config_index,
    state.repos,
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

  const current: EclairConfig | undefined = state.configs[state.current_config_index];

  const config_items = useMemo(() => state.configs.map((config, index) => ({ id: index, name: config.name, description: "", index })), [state.configs]);
  const current_config_item = config_items[state.current_config_index];

  return (
    <div>
      <h1>
        ECLAIR Manager
        <RichHelpTooltip>
          <p>
            Bugseng <a href="https://www.bugseng.com/eclair-static-analysis-tool/">ECLAIR</a> is a certified static analysis tool and platform for software verification.
          </p>
          <p>
            This panel allows to configure ECLAIR SCA analysis for Zephyr projects.
          </p>
        </RichHelpTooltip>
      </h1>

      <Summary
        status={state.status}
        installPath={state.install_path}
        post_message={post_message}
        dispatch_state={dispatch_state}
      />


      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
        Configuration:
        <SearchableDropdown
          id="configuration-selector"
          label=""
          placeholder="Select configuration"
          items={config_items}
          selectedItem={current_config_item || null}
          onSelectItem={(item) => dispatch_state({ type: "select-configuration", index: item.index })}
        />
        <VscodeButton
          appearance="primary"
          onClick={() => {
            dispatch_state({ type: "add-new-configuration", name: `Config ${state.configs.length + 1}` });
          }}
        >
          New
        </VscodeButton>
        {current && (
          <VscodeButton
            appearance="secondary"
            onClick={() => {
              dispatch_state({ type: "delete-configuration", index: state.current_config_index });
            }}
          >
            <span className="codicon codicon-trash" />
          </VscodeButton>
        )/* TODO maybe an export/import button */}
      </div>

      {current && (<>
        <div style={{ margin: "8px" }}>
          <EditableTextField
            name="Name"
            value={current.name}
            placeholder="Configuration name"
            style={{ margin: "0", maxWidth: "10em", flexShrink: 1 }}
            on_selected={(new_name) => {
              const trimmed = new_name.trim();
              if (!trimmed || trimmed === current.name) {
                return;
              }
              dispatch_state({ type: "update-configuration-name", name: trimmed });
            }}
          />
        </div>

        <EditableConfigDescription
          value={current.description_md}
          onSave={(description_md) => dispatch_state({ type: "update-configuration-description", description_md })}
        />

        <MainAnalysisConfigurationSection
          state={state}
          current={current}
          dispatch_state={dispatch_state}
          post_message={post_message}
        />

        <ReportsSection
          reports={current.reports}
          dispatch_state={dispatch_state}
        />

        <ExtraConfigSection
          extra_config={current.extra_config}
          dispatch_state={dispatch_state}
          post_message={post_message}
        />
      </>)}

      <CommandSection
        post_message={post_message}
        config={collected_config}
        dispatch_state={dispatch_state}
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

  match(msg)
    .with({ command: "toggle-spinner" }, ({ show }) => dispatch({ type: "toggle-spinner", show: !!show }))
    .with({ command: "eclair-status" }, ({ installed, version }) => dispatch({
      type: "set-eclair-status",
      installed: !!installed,
      version: installed ? String(version || "").trim() || "Unknown" : "Unknown",
    }))
    .with({ command: "set-install-path" }, ({ path }) => dispatch({ type: "set-install-path", path: String(path ?? "") }))
    .with({ command: "set-install-path-placeholder" }, ({ text }) => dispatch({ type: "set-install-path-placeholder", text: String(text ?? "") }))
    .with({ command: "set-extra-config" }, ({ path }) => dispatch({ type: "set-extra-config", path: String(path ?? "") }))
    .with({ command: "set-path-status" }, ({ text }) => dispatch({ type: "set-path-status", text: String(text ?? "") }))
    .with({ command: "set-user-ruleset-name" }, ({ name }) => dispatch({ type: "set-user-ruleset-name", name: String(name ?? "") }))
    .with({ command: "set-user-ruleset-path" }, ({ path }) => dispatch({ type: "set-user-ruleset-path", path: String(path ?? "") }))
    .with({ command: "set-custom-ecl-path" }, ({ path }) => dispatch({ type: "set-custom-ecl-path", path: String(path ?? "") }))
    .with({ command: "report-server-started" }, () => dispatch({ type: "report-server-started" }))
    .with({ command: "report-server-stopped" }, () => dispatch({ type: "report-server-stopped" }))
    .with({ command: "preset-content" }, ({ source, template }) => dispatch({ type: "preset-content", source, template }))
    .with({ command: "template-path-picked" }, ({ kind, path }) => dispatch({ type: "set-preset-path", kind, path }))
    .with({ command: "set-sca-config" }, ({ config }) => dispatch({ type: "load-sca-config", config }))
    .with({ command: "repo-scan-done" }, ({ name }) => dispatch({ type: "repo-scan-done", name }))
    .with({ command: "repo-scan-failed" }, ({ name, message }) => dispatch({ type: "repo-scan-failed", name, message: String(message ?? "") }))
    .exhaustive();
}

function collect_config_from_state(state: {
  install_path: InstallPathState,
  configs: EclairConfig[],
  current_config_index: number;
  repos: EclairRepos,
}): FullEclairScaConfig {
  const configs: EclairScaConfig[] = state.configs.map(config => {
    return {
      name: config.name,
      description_md: config.description_md,
      main_config: collect_eclair_analysis_config(config.main_config),
      extra_config: config.extra_config.path,
      reports: config.reports.selected,
    };
  });

  return {
    install_path: state.install_path.path,
    configs: configs,
    current_config_index: state.current_config_index,
    repos: state.repos,
  };
}

function collect_eclair_analysis_config(config: MainAnalysisConfigurationState): EclairScaMainConfig {
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



function EditableConfigDescription(props: { value: string; onSave: (description_md: string) => void }) {
  const [editing, set_editing] = useState<boolean>(false);
  const [draft, set_draft] = useState<string>(props.value);

  // Reset local UI state when switching configurations.
  useEffect(() => {
    set_editing(false);
    set_draft(props.value);
  }, [props.value]);

  return (<VscodePanel style={{ marginBottom: "12px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <h2 style={{ margin: 0, fontSize: "1.1em" }}>Notes</h2>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <VscodeButton
          appearance="icon"
          title={editing ? "Save notes" : "Edit notes"}
          aria-label={editing ? "Save notes" : "Edit notes"}
          onClick={() => {
            if (editing) {
              props.onSave(draft);
              set_editing(false);
            } else {
              set_draft(props.value);
              set_editing(true);
            }
          }}
        >
          <span className={`codicon ${editing ? "codicon-check" : "codicon-edit"}`} aria-hidden="true" />
        </VscodeButton>
        {editing && (
          <VscodeButton
            appearance="icon"
            title="Cancel"
            aria-label="Cancel"
            onClick={() => {
              set_draft(props.value);
              set_editing(false);
            }}
          >
            <span className="codicon codicon-x" aria-hidden="true" />
          </VscodeButton>
        )}
      </div>
    </div>

    {!editing ? (
      props.value.trim() ? (
        <div style={{ marginTop: "8px" }}>
          <EasyMark text={props.value} />
        </div>
      ) : (
        <div style={{ marginTop: "8px", color: "var(--vscode-descriptionForeground)" }}>
          No notes.
        </div>
      )
    ) : (
      <div style={{ marginTop: "8px" }}>
        {React.createElement("vscode-text-area", {
          value: draft,
          rows: 8,
          resize: "vertical",
          placeholder: "Write notes in Markdown",
          style: { width: "100%" },
          onInput: (e: any) => set_draft(e.target.value),
          onChange: (e: any) => set_draft(e.target.value),
          onKeyDown: (e: any) => {
            if (e.key === "Escape") {
              set_draft(props.value);
              set_editing(false);
            }
          },
        })}
      </div>
    )}
  </VscodePanel>);
}
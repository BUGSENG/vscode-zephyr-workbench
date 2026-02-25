import React from "react";
import { EclairPresetTemplateSource, EclairRepos, FullEclairScaConfig, PresetSelectionState } from "../../utils/eclair/config";
import { EclairTemplate, EclairTemplateKind } from "../../utils/eclair/template";
import { match } from "ts-pattern";
import { produce, WritableDraft } from "immer";
import { Monospace } from "./components/common_components";

const DEFAULT_INSTALL_PATH_PLACEHOLDER = "Enter the tool's path if not in the global PATH";
const BUGSENG_REPO_URL = "https://github.com/BUGSENG/zephyr-workbench-eclair-presets";
export const BUGSENG_REPO_LINK = <a href={BUGSENG_REPO_URL}><Monospace>BUGSENG/zephyr-workbench-eclair-presets</Monospace></a>;

export interface EclairState {
  status: StatusState;
  install_path: InstallPathState;
  report_server: ReportServerState;
  repos: EclairRepos;
  configs: EclairConfig[];
  current_config_index: number;
  /** Per-repo scan status (loading / success with template count / error). */
  repos_scan_state: Record<string, RepoScanState>;

  available_presets: AvailablePresetsState;
}

export interface EclairConfig {
  name: string;
  description_md: string;
  main_config: MainAnalysisConfigurationState;
  extra_config: ExtraConfigState;
  reports: ReportsState;
}

export function default_eclair_state(): EclairState {
  return {
    status: {
      version: "Checking",
      installed: false,
      showSpinner: false,
    },
    install_path: {
      path: "",
      placeholder: DEFAULT_INSTALL_PATH_PLACEHOLDER,
      disabled: true,
      editing: false,
    },
    configs: [],
    current_config_index: -1,
    report_server: {
      running: false,
    },
    repos: {
      "BUGSENG presets": {
        origin: BUGSENG_REPO_URL,
        ref: "main",
      },
      "invalid": {
        // TODO remove this example
        origin: "https://example.com/repo.git",
        ref: "deadbeef",
      },
    },
    repos_scan_state: {},
    available_presets: {
      by_path: new Map(),
      by_repo_path: new Map(),
    },
  };
}

export interface StatusState {
  version: string;
  installed: boolean;
  showSpinner: boolean;
}

export type MainAnalysisConfigurationState = {
  type: "preset",
  state: PresetsSelectionState,
} | {
  type: "custom-ecl",
  state: CustomEclState,
} | {
  type: "zephyr-ruleset",
  ruleset: ZephyrRulesetState,
};

export interface InstallPathState {
  path: string;
  placeholder: string;
  disabled: boolean;
  editing: boolean;
}

export interface ExtraConfigState {
  path: string;
}

export interface ZephyrRulesetState {
  selected: string;
  userRulesetName: string;
  userRulesetNameEditing: boolean;
  userRulesetPath: string;
  userRulesetPathEditing: boolean;
}

export function default_ruleset_state(): ZephyrRulesetState {
  return {
    selected: "ECLAIR_RULESET_FIRST_ANALYSIS",
    userRulesetName: "",
    userRulesetNameEditing: false,
    userRulesetPath: "",
    userRulesetPathEditing: false,
  };
}

export interface CustomEclState {
  ecl?: string;
}

export interface PresetsSelectionState {
  ruleset_state: SinglePresetSelectionState;
  variants_state: MultiPresetSelectionState;
  tailorings_state: MultiPresetSelectionState;
}

function default_presets_selection_state(): PresetsSelectionState {
  return {
    ruleset_state: { edit_path: "" },
    variants_state: { presets: [], edit_path: "" },
    tailorings_state: { presets: [], edit_path: "" },
  };
};

export interface AvailablePresetsState {
  /** Preset templates loaded from local filesystem paths. */
  by_path: Map<string, EclairTemplate | { loading: string } | { error: string }>;
  /**
   * Preset templates loaded from named repository entries.
   * Outer key: logical repo name (matches EclairScaConfig.repos key).
   * Inner key: file path relative to the repo root.
   */
  by_repo_path: Map<string, Map<string, EclairTemplate | { loading: string } | { error: string }>>;
}

export function get_preset_template_by_source(presets: AvailablePresetsState, source: EclairPresetTemplateSource): EclairTemplate | { loading: string } | { error: string } | undefined {
  return match(source)
    .with({ type: "system-path" }, ({ path }) => presets.by_path.get(path))
    .with({ type: "repo-path" }, ({ repo, path }) => presets.by_repo_path.get(repo)?.get(path))
    .exhaustive();
}

export interface SinglePresetSelectionState {
  preset?: PresetSelectionState;
  edit_path: string;
}

export interface MultiPresetSelectionState {
  presets: PresetSelectionState[];
  edit_path: string;
}

export function preset_template_source_id(source: EclairPresetTemplateSource): string {
  // TODO consider using a canonical stringification instead or hashing
  return JSON.stringify(source);
}
export interface ReportsState {
  selected: string[];
}

export interface ReportServerState {
  running: boolean;
}

/** Tracks the scan/load status of a single preset repository. */
export type RepoScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; templateCount: number }
  | { status: "error"; message: string };


export type EclairStateAction =
  // Bulk actions
  | { type: "reset-to-defaults" }
  | { type: "load-sca-config"; config: FullEclairScaConfig }
  // Toggle actions
  | { type: "select-configuration"; index: number }
  | { type: "add-new-configuration"; name: string }
  | { type: "delete-configuration"; index: number }
  | { type: "toggle-install-path-editing" }
  | { type: "toggle-user-ruleset-name-editing" }
  | { type: "toggle-user-ruleset-path-editing" }
  // Update actions
  | { type: "update-configuration-name"; name: string }
  | { type: "update-configuration-description"; description_md: string }
  | { type: "update-install-path"; path: string }
  | { type: "update-extra-config-path"; path: string }
  | { type: "update-configuration-type"; configurationType: MainAnalysisConfigurationState["type"] }
  | { type: "update-ruleset-selection"; ruleset: string }
  | { type: "update-user-ruleset-name"; name: string }
  | { type: "update-user-ruleset-path"; path: string }
  | { type: "update-custom-ecl-path"; path: string }
  | { type: "toggle-report"; report: string; checked: boolean }
  // Message-based actions
  | { type: "toggle-spinner"; show: boolean }
  | { type: "set-eclair-status"; installed: boolean; version: string }
  | { type: "set-install-path"; path: string }
  | { type: "set-install-path-placeholder"; text: string }
  | { type: "set-extra-config"; path: string }
  | { type: "set-path-status"; text: string }
  | { type: "set-user-ruleset-name"; name: string }
  | { type: "set-user-ruleset-path"; path: string }
  | { type: "set-custom-ecl-path"; path: string }
  | { type: "report-server-started" }
  | { type: "report-server-stopped" }
  | { type: "set-preset-option"; source: EclairPresetTemplateSource; option_id: string; value: boolean | string }
  | { type: "clear-preset-option"; source: EclairPresetTemplateSource; option_id: string }
  | { type: "remove-selected-preset"; kind: EclairTemplateKind; index: number }
  | { type: "preset-content"; source: EclairPresetTemplateSource; template: EclairTemplate | { loading: string } | { error: string } }
  | { type: "set-preset-path"; kind: EclairTemplateKind; path: string }
  | { type: "set-or-add-preset"; kind: EclairTemplateKind; source: EclairPresetTemplateSource; }
  // Repo management actions
  | { type: "add-repo"; name: string; origin: string; rev: string }
  | { type: "remove-repo"; name: string }
  | { type: "update-repo"; name: string; origin: string; rev: string }
  // Repo scan status actions
  | { type: "repo-scan-started"; name: string }
  | { type: "repo-scan-done"; name: string }
  | { type: "repo-scan-failed"; name: string; message: string }
  | { type: "update-state", updater: (state: WritableDraft<EclairState>) => EclairState | undefined };

function build_configs(cfg: FullEclairScaConfig): EclairConfig[] {
  return cfg.configs.map((config) => {
    const main_config: MainAnalysisConfigurationState = match(config.main_config)
      .with({ type: "zephyr-ruleset" }, (c) => ({
        type: "zephyr-ruleset" as const,
        ruleset: {
          selected: c.ruleset,
          userRulesetName: c.userRulesetName ?? "",
          userRulesetNameEditing: false,
          userRulesetPath: c.userRulesetPath ?? "",
          userRulesetPathEditing: false,
        },
      }))
      .with({ type: "custom-ecl" }, (c) => ({
        type: "custom-ecl" as const,
        state: { ecl: c.ecl_path },
      }))
      .with({ type: "preset" }, (c) => {
        const toPreset = (p: PresetSelectionState) => ({ source: p.source, edited_flags: { ...p.edited_flags } });
        return {
          type: "preset" as const,
          state: {
            ruleset_state: { preset: toPreset(c.ruleset), edit_path: "" },
            variants_state: { presets: c.variants.map(toPreset), edit_path: "" },
            tailorings_state: { presets: c.tailorings.map(toPreset), edit_path: "" },
          },
        };
      })
      .exhaustive();

    return {
      name: config.name,
      description_md: config.description_md ?? "",
      main_config,
      extra_config: { path: config.extra_config ?? "" },
      reports: { selected: config.reports && config.reports.length > 0 ? [...config.reports] : ["ALL"] },
    };
  });
}

export function eclairReducer(state: EclairState, action: EclairStateAction): EclairState {
  console.log("action: ", action);
  return produce(state, draft => match(action)
    .with({ type: "reset-to-defaults" }, () => default_eclair_state())
    .with({ type: "load-sca-config" }, ({ config: cfg }) => {
      // When reloading config, reset scan states for any new/removed repos.
      const newRepos = cfg.repos ?? {};
      const newScanState: Record<string, RepoScanState> = {};
      for (const name of Object.keys(newRepos)) {
        // Preserve existing scan state if the repo entry didn't change.
        const existing = state.repos[name];
        const incoming = newRepos[name];
        if (existing && existing.origin === incoming.origin && existing.ref === incoming.ref) {
          newScanState[name] = state.repos_scan_state[name] ?? { status: "idle" };
        } else {
          newScanState[name] = { status: "idle" };
        }
      }
      draft.configs = build_configs(cfg);
      draft.current_config_index = cfg.current_config_index < draft.configs.length ? cfg.current_config_index : -1;
      draft.repos = newRepos;
      draft.repos_scan_state = newScanState;
    })
    .with({ type: "select-configuration" }, ({ index }) => {
      draft.current_config_index = index;
    })
    .with({ type: "add-new-configuration" }, ({ name }) => {
      draft.configs.push({
        name,
        description_md: "",
        main_config: { type: "zephyr-ruleset" as const, ruleset: default_ruleset_state() },
        extra_config: { path: "" },
        reports: { selected: ["ALL"] },
      });
      draft.current_config_index = draft.configs.length - 1;
    })
    .with({ type: "delete-configuration" }, ({ index }) => {
      if (index < 0 || index >= draft.configs.length) {
        console.error("Cannot delete configuration: index out of range", index);
        return;
      }

      draft.configs.splice(index, 1);

      if (draft.configs.length === 0) {
        draft.current_config_index = -1;
        return;
      }

      if (draft.current_config_index === index) {
        // Keep the selection on the next item (or the last one if we deleted the last).
        draft.current_config_index = Math.min(index, draft.configs.length - 1);
      } else if (draft.current_config_index > index) {
        // Shift left because indices after the deleted element move down.
        draft.current_config_index = draft.current_config_index - 1;
      }
    })
    .with({ type: "update-configuration-name" }, ({ name }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update configuration name: no current config");
        return;
      }
      current.name = name;
    })
    .with({ type: "update-configuration-description" }, ({ description_md }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update configuration description: no current config");
        return;
      }
      current.description_md = description_md;
    })
    .with({ type: "toggle-install-path-editing" }, () => {
      draft.install_path.editing = !draft.install_path.editing;
      draft.install_path.disabled = !draft.install_path.editing;
    })
    .with({ type: "toggle-user-ruleset-name-editing" }, () => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot toggle user ruleset name editing: no current config");
        return;
      }

      const main_config = current.main_config;

      if (main_config === null || main_config.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset name editing: configuration is not zephyr-ruleset type");
        return;
      }
      main_config.ruleset.userRulesetNameEditing = !main_config.ruleset.userRulesetNameEditing;
    })
    .with({ type: "toggle-user-ruleset-path-editing" }, () => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot toggle user ruleset path editing: no current config");
        return;
      }

      const main_config = current.main_config;
      if (main_config === null || main_config.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset path editing: configuration is not zephyr-ruleset type");
        return;
      }
      main_config.ruleset.userRulesetPathEditing = !main_config.ruleset.userRulesetPathEditing;
    })
    .with({ type: "update-install-path" }, ({ path }) => {
      draft.install_path.path = path;
    })
    .with({ type: "update-extra-config-path" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update extra config path: no current config");
        return;
      }
      current.extra_config.path = path;
    })
    .with({ type: "update-configuration-type" }, ({ configurationType }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update configuration type: no current config");
        return;
      }
      current.main_config = match(configurationType)
        .with("preset", () => ({ type: "preset" as const, state: default_presets_selection_state() }))
        .with("custom-ecl", () => ({ type: "custom-ecl" as const, state: {} }))
        .with("zephyr-ruleset", () => ({ type: "zephyr-ruleset" as const, ruleset: default_ruleset_state() }))
        .exhaustive();
    })
    .with({ type: "update-ruleset-selection" }, ({ ruleset: newRuleset }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update ruleset selection: no current config");
        return;
      }
      if (current.main_config.type !== "zephyr-ruleset") {
        console.error("Cannot update ruleset selection: configuration is not zephyr-ruleset type");
        return;
      }
      current.main_config.ruleset.selected = newRuleset;
    })
    .with({ type: "update-user-ruleset-name" }, ({ name }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update user ruleset name: no current config");
        return;
      }
      if (current.main_config.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset name: configuration is not zephyr-ruleset type");
        return;
      }
      current.main_config.ruleset.userRulesetName = name;
    })
    .with({ type: "update-user-ruleset-path" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update user ruleset path: no current config");
        return;
      }
      if (current.main_config.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset path: configuration is not zephyr-ruleset type");
        return;
      }
      current.main_config.ruleset.userRulesetPath = path;
    })
    .with({ type: "update-custom-ecl-path" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot update custom ECL path: no current config");
        return;
      }
      if (current.main_config.type !== "custom-ecl") {
        console.error("Cannot update custom ECL path: configuration is not custom-ecl type");
        return;
      }
      current.main_config.state.ecl = path;
    })
    .with({ type: "toggle-report" }, ({ report, checked }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot toggle report: no current config");
        return;
      }
      if (report === "ALL") {
        current.reports.selected = checked ? ["ALL"] : [];
      } else {
        current.reports.selected = current.reports.selected.filter(r => r !== "ALL");
        if (checked) {
          current.reports.selected.push(report);
        } else {
          current.reports.selected = current.reports.selected.filter(r => r !== report);
        }
      }
    })
    .with({ type: "toggle-spinner" }, ({ show }) => {
      draft.status.showSpinner = show;
    })
    .with({ type: "set-eclair-status" }, ({ installed, version }) => {
      draft.status.installed = installed;
      draft.status.version = installed ? version.trim() || "Unknown" : "Unknown";
    })
    .with({ type: "set-install-path" }, ({ path }) => {
      draft.install_path.path = path;
      draft.install_path.placeholder = path ? "" : DEFAULT_INSTALL_PATH_PLACEHOLDER;
      draft.install_path.disabled = false;
      draft.install_path.editing = false;
    })
    .with({ type: "set-install-path-placeholder" }, ({ text }) => {
      draft.install_path.placeholder = text;
    })
    .with({ type: "set-extra-config" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set extra config path: no current config");
        return;
      }
      current.extra_config.path = path;
    })
    .with({ type: "set-path-status" }, ({ text }) => {
      if (text.trim().toLowerCase() === "checking") {
        draft.install_path = { path: "", placeholder: "Checking", disabled: true, editing: false };
      } else if (text.trim() === "") {
        draft.install_path.path = "";
        draft.install_path.placeholder = DEFAULT_INSTALL_PATH_PLACEHOLDER;
        draft.install_path.disabled = true;
      } else {
        draft.install_path.path = text;
        draft.install_path.placeholder = "";
        draft.install_path.disabled = true;
      }
    })
    .with({ type: "set-user-ruleset-name" }, ({ name }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set user ruleset name: no current config");
        return;
      }
      if (current.main_config.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset name: configuration is not zephyr-ruleset type");
        return;
      }
      current.main_config.ruleset.userRulesetName = name;
      current.main_config.ruleset.userRulesetNameEditing = false;
    })
    .with({ type: "set-user-ruleset-path" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set user ruleset path: no current config");
        return;
      }
      if (current.main_config.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset path: configuration is not zephyr-ruleset type");
        return;
      }
      current.main_config.ruleset.userRulesetPath = path;
      current.main_config.ruleset.userRulesetPathEditing = false;
    })
    .with({ type: "set-custom-ecl-path" }, ({ path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set custom ECL path: no current config");
        return;
      }
      if (current.main_config.type !== "custom-ecl") {
        console.error("Cannot set custom ECL path: configuration is not custom-ecl type");
        return;
      }
      current.main_config.state.ecl = path;
    })
    .with({ type: "report-server-started" }, () => {
      draft.report_server.running = true;
    })
    .with({ type: "report-server-stopped" }, () => {
      draft.report_server.running = false;
    })
    .with({ type: "set-preset-option" }, ({ source, option_id, value }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set preset option: no current config");
        return;
      }
      if (current.main_config.type !== "preset") return;
      const sourceId = preset_template_source_id(source);
      const updatePreset = (preset: WritableDraft<PresetSelectionState>) => {
        if (preset_template_source_id(preset.source) !== sourceId) return;
        if (!preset.edited_flags) preset.edited_flags = {};
        preset.edited_flags[option_id] = value;
      };
      const s = current.main_config.state;
      if (s.ruleset_state.preset) updatePreset(s.ruleset_state.preset);
      s.variants_state.presets.forEach(updatePreset);
      s.tailorings_state.presets.forEach(updatePreset);
    })
    .with({ type: "clear-preset-option" }, ({ source, option_id }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot clear preset option: no current config");
        return;
      }
      if (current.main_config.type !== "preset") return;
      const sourceId = preset_template_source_id(source);
      const updatePreset = (preset: WritableDraft<PresetSelectionState>) => {
        if (preset_template_source_id(preset.source) !== sourceId) return;
        if (preset.edited_flags) delete preset.edited_flags[option_id];
      };
      const s = current.main_config.state;
      if (s.ruleset_state.preset) updatePreset(s.ruleset_state.preset);
      s.variants_state.presets.forEach(updatePreset);
      s.tailorings_state.presets.forEach(updatePreset);
    })
    .with({ type: "remove-selected-preset" }, ({ kind, index }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot remove selected preset: no current config");
        return;
      }
      if (current.main_config.type !== "preset") return;
      const s = current.main_config.state;
      match(kind)
        .with("ruleset", () => {
          s.ruleset_state = { edit_path: "" };
          s.variants_state.presets = [];
          s.tailorings_state.presets = [];
        })
        .with("variant", () => {
          s.variants_state.presets.splice(index, 1);
        })
        .with("tailoring", () => {
          s.tailorings_state.presets.splice(index, 1);
        })
        .exhaustive();
    })
    .with({ type: "preset-content" }, ({ source, template }) => {
      match(source)
        .with({ type: "system-path" }, ({ path }) => {
          draft.available_presets.by_path.set(path, template);
        })
        .with({ type: "repo-path" }, ({ repo, path }) => {
          let byPath = draft.available_presets.by_repo_path.get(repo);
          if (!byPath) {
            byPath = new Map();
            draft.available_presets.by_repo_path.set(repo, byPath);
          }
          byPath.set(path, template);
        })
        .exhaustive();
    })
    .with({ type: "set-preset-path" }, ({ kind, path }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set preset edit path: no current config");
        return;
      }
      if (current.main_config.type !== "preset") return;
      const s = current.main_config.state;
      match(kind)
        .with("ruleset", () => { s.ruleset_state.edit_path = path; })
        .with("variant", () => { s.variants_state.edit_path = path; })
        .with("tailoring", () => { s.tailorings_state.edit_path = path; })
        .exhaustive();
    })
    .with({ type: "set-or-add-preset" }, ({ kind, source }) => {
      const current = draft.configs[draft.current_config_index];
      if (!current) {
        console.error("Cannot set or add preset: no current config");
        return;
      }
      if (current.main_config.type !== "preset") return;
      const s = current.main_config.state;
      const new_preset = { source, edited_flags: {} };
      match(kind)
        .with("ruleset", () => { s.ruleset_state.preset = new_preset; })
        .with("variant", () => { s.variants_state.presets.push(new_preset); })
        .with("tailoring", () => { s.tailorings_state.presets.push(new_preset); })
        .exhaustive();
    })
    .with({ type: "add-repo" }, ({ name, origin, rev }) => {
      draft.repos[name] = { origin, ref: rev };
      // Reset scan state when a repo is added or its configuration changes.
      draft.repos_scan_state[name] = { status: "idle" };
    })
    .with({ type: "update-repo" }, ({ name, origin, rev }) => {
      draft.repos[name] = { origin, ref: rev };
      // Reset scan state when a repo's configuration changes.
      draft.repos_scan_state[name] = { status: "idle" };
    })
    .with({ type: "remove-repo" }, ({ name }) => {
      delete draft.repos[name];
      delete draft.repos_scan_state[name];
      // Also clear all preset-content entries for this repo.
      draft.available_presets.by_repo_path.delete(name);
    })
    .with({ type: "repo-scan-started" }, ({ name }) => {
      draft.repos_scan_state[name] = { status: "loading" };
    })
    .with({ type: "repo-scan-done" }, ({ name }) => {
      // Count successfully loaded templates for this repo.
      const byPath = draft.available_presets.by_repo_path.get(name);
      const templateCount = byPath
        ? [...byPath.values()].filter(t => !("loading" in t) && !("error" in t)).length
        : 0;
      draft.repos_scan_state[name] = { status: "success", templateCount };
    })
    .with({ type: "repo-scan-failed" }, ({ name, message }) => {
      draft.repos_scan_state[name] = { status: "error", message };
    })
    .with({ type: "update-state" }, ({ updater }) => updater(draft))
    .exhaustive());
}

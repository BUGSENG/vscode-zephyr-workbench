import React from "react";
import { EclairPresetTemplateSource, EclairRepos, EclairScaConfig, PresetSelectionState } from "../../utils/eclair/config";
import { EclairTemplate, EclairTemplateKind } from "../../utils/eclair/template";
import { match } from "ts-pattern";

const DEFAULT_INSTALL_PATH_PLACEHOLDER = "Enter the tool's path if not in the global PATH";
const BUGSENG_REPO_URL = "https://github.com/BUGSENG/zephyr-workbench-eclair-presets";
export const BUGSENG_REPO_LINK = <a href={BUGSENG_REPO_URL}><code>BUGSENG/zephyr-workbench-eclair-presets</code></a>;

export interface EclairState {
  status: StatusState;
  install_path: InstallPathState;
  analysis_configuration: AnalysisConfigurationState;
  extra_config: ExtraConfigState;
  reports: ReportsState;
  report_server: ReportServerState;
  repos: EclairRepos;

  /** Per-repo scan status (loading / success with template count / error). */
  repos_scan_state: Record<string, RepoScanState>;

  available_presets: AvailablePresetsState;
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
    analysis_configuration: {
      type: "preset",
      state: default_presets_selection_state(),
    },
    extra_config: {
      path: "",
    },
    reports: {
      selected: ["ALL"],
    },
    report_server: {
      running: false,
    },
    repos: {
      "BUGSENG presets": {
        origin: BUGSENG_REPO_URL,
        ref: "main",
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

export type AnalysisConfigurationState = {
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
  | { type: "load-sca-config"; config: EclairScaConfig }
  // Toggle actions
  | { type: "toggle-install-path-editing" }
  | { type: "toggle-user-ruleset-name-editing" }
  | { type: "toggle-user-ruleset-path-editing" }
  // Update actions
  | { type: "update-install-path"; path: string }
  | { type: "update-extra-config-path"; path: string }
  | { type: "update-configuration-type"; configurationType: AnalysisConfigurationState["type"] }
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
  | { type: "set-preset-flag"; source: EclairPresetTemplateSource; flagId: string; value: boolean }
  | { type: "clear-preset-flag"; source: EclairPresetTemplateSource; flagId: string }
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
  | { type: "repo-scan-failed"; name: string; message: string };

function build_analysis_configuration_from_config(cfg: EclairScaConfig): AnalysisConfigurationState {
  return match(cfg.config)
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
}

export function eclairReducer(state: EclairState, action: EclairStateAction): EclairState {
  console.log("action: ", action);
  return match(action)
    .with({ type: "reset-to-defaults" }, () =>
      // Preserve live status/install-path (managed by the probe, not stored config)
      default_eclair_state()
    )
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
      return {
        ...state,
        analysis_configuration: build_analysis_configuration_from_config(cfg),
        extra_config: { path: cfg.extra_config ?? "" },
        reports: { selected: cfg.reports && cfg.reports.length > 0 ? [...cfg.reports] : ["ALL"] },
        repos: newRepos,
        repos_scan_state: newScanState,
      } as EclairState;
    })
    .with({ type: "toggle-install-path-editing" }, () => ({
      ...state,
      install_path: {
        ...state.install_path,
        editing: !state.install_path.editing,
        disabled: !state.install_path.editing,
      },
    }))
    .with({ type: "toggle-user-ruleset-name-editing" }, () => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset name editing: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetNameEditing: !ruleset.userRulesetNameEditing },
        },
      };
    })
    .with({ type: "toggle-user-ruleset-path-editing" }, () => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset path editing: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetPathEditing: !ruleset.userRulesetPathEditing },
        },
      };
    })
    .with({ type: "update-install-path" }, ({ path }) => ({
      ...state,
      install_path: { ...state.install_path, path },
    }))
    .with({ type: "update-extra-config-path" }, ({ path }) => ({
      ...state,
      extra_config: { ...state.extra_config, path },
    }))
    .with({ type: "update-configuration-type" }, ({ configurationType }) =>
      match(configurationType)
        .with("preset", () => ({
          ...state,
          analysis_configuration: { type: "preset" as const, state: default_presets_selection_state() },
        }))
        .with("custom-ecl", () => ({
          ...state,
          analysis_configuration: { type: "custom-ecl" as const, state: {} },
        }))
        .with("zephyr-ruleset", () => ({
          ...state,
          analysis_configuration: { type: "zephyr-ruleset" as const, ruleset: default_ruleset_state() },
        }))
        .exhaustive()
    )
    .with({ type: "update-ruleset-selection" }, ({ ruleset: newRuleset }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update ruleset selection: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, selected: newRuleset },
        },
      };
    })
    .with({ type: "update-user-ruleset-name" }, ({ name }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset name: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetName: name },
        },
      };
    })
    .with({ type: "update-user-ruleset-path" }, ({ path }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset path: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetPath: path },
        },
      };
    })
    .with({ type: "update-custom-ecl-path" }, ({ path }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "custom-ecl") {
        console.error("Cannot update custom ECL path: configuration is not custom-ecl type");
        return state;
      }
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: { ...state.analysis_configuration.state, ecl: path },
        },
      };
    })
    .with({ type: "toggle-report" }, ({ report, checked }) => {
      let newReports = [...state.reports.selected];
      if (report === "ALL") {
        newReports = checked ? ["ALL"] : [];
      } else {
        newReports = newReports.filter(r => r !== "ALL");
        if (checked) {
          newReports.push(report);
        } else {
          newReports = newReports.filter(r => r !== report);
        }
      }
      return { ...state, reports: { selected: newReports } };
    })
    .with({ type: "toggle-spinner" }, ({ show }) => ({
      ...state,
      status: { ...state.status, showSpinner: show },
    }))
    .with({ type: "set-eclair-status" }, ({ installed, version }) => ({
      ...state,
      status: {
        ...state.status,
        installed,
        version: installed ? version.trim() || "Unknown" : "Unknown",
      },
    }))
    .with({ type: "set-install-path" }, ({ path }) => ({
      ...state,
      install_path: {
        path,
        placeholder: path ? "" : DEFAULT_INSTALL_PATH_PLACEHOLDER,
        disabled: false,
        editing: false,
      },
    }))
    .with({ type: "set-install-path-placeholder" }, ({ text }) => ({
      ...state,
      install_path: {
        ...state.install_path,
        placeholder: text,
      },
    }))
    .with({ type: "set-extra-config" }, ({ path }) => ({
      ...state,
      extra_config: { path },
    }))
    .with({ type: "set-path-status" }, ({ text }) => ({
      ...state,
      install_path: text.trim().toLowerCase() === "checking"
        ? { path: "", placeholder: "Checking", disabled: true, editing: false }
        : text.trim() === ""
          ? { ...state.install_path, path: "", placeholder: DEFAULT_INSTALL_PATH_PLACEHOLDER, disabled: true }
          : { ...state.install_path, path: text, placeholder: "", disabled: true },
    }))
    .with({ type: "set-user-ruleset-name" }, ({ name }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset name: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetName: name, userRulesetNameEditing: false },
        },
      };
    })
    .with({ type: "set-user-ruleset-path" }, ({ path }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset path: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: { ...ruleset, userRulesetPath: path, userRulesetPathEditing: false },
        },
      };
    })
    .with({ type: "set-custom-ecl-path" }, ({ path }) => {
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "custom-ecl") {
        console.error("Cannot set custom ECL path: configuration is not custom-ecl type");
        return state;
      }
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: { ...state.analysis_configuration.state, ecl: path },
        },
      };
    })
    .with({ type: "report-server-started" }, () => ({
      ...state,
      report_server: { running: true },
    }))
    .with({ type: "report-server-stopped" }, () => ({
      ...state,
      report_server: { running: false },
    }))
    .with({ type: "set-preset-flag" }, ({ source, flagId, value }) => {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      const sourceId = preset_template_source_id(source);
      const updatePreset = (preset: PresetSelectionState): PresetSelectionState => {
        if (preset_template_source_id(preset.source) !== sourceId) return preset;
        return {
          ...preset,
          edited_flags: { ...(preset.edited_flags ?? {}), [flagId]: value },
        };
      };
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: {
            ...current_state,
            ruleset_state: {
              ...current_state.ruleset_state,
              preset: current_state.ruleset_state.preset
                ? updatePreset(current_state.ruleset_state.preset)
                : current_state.ruleset_state.preset,
            },
            variants_state: {
              ...current_state.variants_state,
              presets: current_state.variants_state.presets.map(updatePreset),
            },
            tailorings_state: {
              ...current_state.tailorings_state,
              presets: current_state.tailorings_state.presets.map(updatePreset),
            },
          },
        },
      };
    })
    .with({ type: "clear-preset-flag" }, ({ source, flagId }) => {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      const sourceId = preset_template_source_id(source);
      const updatePreset = (preset: PresetSelectionState): PresetSelectionState => {
        if (preset_template_source_id(preset.source) !== sourceId) return preset;
        const { [flagId]: _removed, ...rest } = preset.edited_flags ?? {};
        return { ...preset, edited_flags: rest };
      };
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: {
            ...current_state,
            ruleset_state: {
              ...current_state.ruleset_state,
              preset: current_state.ruleset_state.preset
                ? updatePreset(current_state.ruleset_state.preset)
                : current_state.ruleset_state.preset,
            },
            variants_state: {
              ...current_state.variants_state,
              presets: current_state.variants_state.presets.map(updatePreset),
            },
            tailorings_state: {
              ...current_state.tailorings_state,
              presets: current_state.tailorings_state.presets.map(updatePreset),
            },
          },
        },
      };
    })
    .with({ type: "remove-selected-preset" }, ({ kind, index }) => {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      return match(kind)
        .with("ruleset", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...current_state,
              ruleset_state: { edit_path: "" },
              variants_state: { ...current_state.variants_state, presets: [] },
              tailorings_state: { ...current_state.tailorings_state, presets: [] },
            },
          } as AnalysisConfigurationState,
        }))
        .with("variant", () => {
          const new_variants = [...current_state.variants_state.presets];
          new_variants.splice(index, 1);
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                variants_state: { ...current_state.variants_state, presets: new_variants },
              },
            } as AnalysisConfigurationState,
          };
        })
        .with("tailoring", () => {
          const new_tailorings = [...current_state.tailorings_state.presets];
          new_tailorings.splice(index, 1);
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                tailorings_state: { ...current_state.tailorings_state, presets: new_tailorings },
              },
            } as AnalysisConfigurationState,
          };
        })
        .exhaustive();
    })
    .with({ type: "preset-content" }, ({ source, template }) => {
      const newPresets = new Map(state.available_presets.by_path);
      const newRepoPresets = new Map(state.available_presets.by_repo_path);
      return match(source)
        .with({ type: "system-path" }, ({ path }) => {
          newPresets.set(path, template);
          return {
            ...state,
            available_presets: { by_path: newPresets, by_repo_path: newRepoPresets },
          };
        })
        .with({ type: "repo-path" }, ({ repo, path }) => {
          let byPath = newRepoPresets.get(repo);
          if (!byPath) {
            byPath = new Map();
            newRepoPresets.set(repo, byPath);
          }
          byPath.set(path, template);
          return {
            ...state,
            available_presets: { by_path: newPresets, by_repo_path: newRepoPresets },
          };
        })
        .exhaustive();
    })
    .with({ type: "set-preset-path" }, ({ kind, path }) => {
      if (state.analysis_configuration.type !== "preset") {
        return state;
      }
      const s = state.analysis_configuration.state;
      return match(kind)
        .with("ruleset", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...s,
              ruleset_state: {
                ...s.ruleset_state,
                edit_path: path,
              },
            },
          } as AnalysisConfigurationState,
        }))
        .with("variant", () => {
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...s,
                variants_state: {
                  ...s.variants_state,
                  edit_path: path,
                },
              },
            } as AnalysisConfigurationState,
          };
        })
        .with("tailoring", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...s,
              tailorings_state: {
                ...s.tailorings_state,
                edit_path: path,
              },
            },
          } as AnalysisConfigurationState,
        }))
        .exhaustive();
    })
    .with({ type: "set-or-add-preset" }, ({ kind, source }) => {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      const new_preset = { source, edited_flags: {} };
      return match(kind)
        .with("ruleset", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...current_state,
              ruleset_state: { ...current_state.ruleset_state, preset: new_preset },
            },
          } as AnalysisConfigurationState,
        }))
        .with("variant", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...current_state,
              variants_state: {
                ...current_state.variants_state,
                presets: [...current_state.variants_state.presets, new_preset],
              },
            },
          } as AnalysisConfigurationState,
        }))
        .with("tailoring", () => ({
          ...state,
          analysis_configuration: {
            ...state.analysis_configuration,
            state: {
              ...current_state,
              tailorings_state: {
                ...current_state.tailorings_state,
                presets: [...current_state.tailorings_state.presets, new_preset],
              },
            },
          } as AnalysisConfigurationState,
        }))
        .exhaustive();
    })
    .with({ type: "add-repo" }, ({ name, origin, rev }) => ({
      ...state,
      repos: { ...state.repos, [name]: { origin, ref: rev } },
      // Reset scan state when a repo is added or its configuration changes.
      repos_scan_state: { ...state.repos_scan_state, [name]: { status: "idle" } },
    } as EclairState))
    .with({ type: "update-repo" }, ({ name, origin, rev }) => ({
      ...state,
      repos: { ...state.repos, [name]: { origin, ref: rev } },
      // Reset scan state when a repo's configuration changes.
      repos_scan_state: { ...state.repos_scan_state, [name]: { status: "idle" } },
    } as EclairState))
    .with({ type: "remove-repo" }, ({ name }) => {
      const { [name]: _removedRepo, ...restRepos } = state.repos;
      const { [name]: _removedScan, ...restScan } = state.repos_scan_state;
      // Also clear all preset-content entries for this repo.
      const newByRepoPath = new Map(state.available_presets.by_repo_path);
      newByRepoPath.delete(name);
      return {
        ...state,
        repos: restRepos,
        repos_scan_state: restScan,
        available_presets: { ...state.available_presets, by_repo_path: newByRepoPath },
      } as EclairState;
    })
    .with({ type: "repo-scan-started" }, ({ name }) => ({
      ...state,
      repos_scan_state: { ...state.repos_scan_state, [name]: { status: "loading" } },
    } as EclairState))
    .with({ type: "repo-scan-done" }, ({ name }) => {
      // Count successfully loaded templates for this repo.
      const byPath = state.available_presets.by_repo_path.get(name);
      const templateCount = byPath
        ? [...byPath.values()].filter(t => !("loading" in t) && !("error" in t)).length
        : 0;
      return {
        ...state,
        repos_scan_state: { ...state.repos_scan_state, [name]: { status: "success", templateCount } },
      } as EclairState;
    })
    .with({ type: "repo-scan-failed" }, ({ name, message }) => ({
      ...state,
      repos_scan_state: { ...state.repos_scan_state, [name]: { status: "error", message } },
    } as EclairState))
    .exhaustive();
}

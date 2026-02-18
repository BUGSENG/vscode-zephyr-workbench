import { EclairPresetTemplateSource, EclairRepos, EclairScaConfig, PresetSelectionState } from "../../utils/eclair/config";
import { EclairTemplate, EclairTemplateKind } from "../../utils/eclair/template";

const default_install_path_placeholder = "Enter the tool's path if not in the global PATH";

export interface EclairState {
  status: StatusState;
  install_path: InstallPathState;
  analysis_configuration: AnalysisConfigurationState | null;
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
      placeholder: default_install_path_placeholder,
      disabled: true,
      editing: false,
    },
    analysis_configuration: null,
    extra_config: {
      path: "",
    },
    reports: {
      selected: ["ALL"],
    },
    report_server: {
      running: false,
    },
    repos: {},
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
  switch (source.type) {
    case "system-path":
      return presets.by_path.get(source.path);
    case "repo-path": {
      const by_path = presets.by_repo_path.get(source.repo);
      if (!by_path) return undefined;
      return by_path.get(source.path);
    }
  }
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
  switch (cfg.config.type) {
    case "zephyr-ruleset":
      return {
        type: "zephyr-ruleset",
        ruleset: {
          selected: cfg.config.ruleset,
          userRulesetName: cfg.config.userRulesetName ?? "",
          userRulesetNameEditing: false,
          userRulesetPath: cfg.config.userRulesetPath ?? "",
          userRulesetPathEditing: false,
        },
      };
    case "custom-ecl":
      return {
        type: "custom-ecl",
        state: { ecl: cfg.config.ecl_path },
      };
    case "preset": {
      const toPreset = (p: PresetSelectionState) => ({ source: p.source, edited_flags: { ...p.edited_flags } });
      return {
        type: "preset",
        state: {
          ruleset_state: { preset: toPreset(cfg.config.ruleset), edit_path: "" },
          variants_state: { presets: cfg.config.variants.map(toPreset), edit_path: "" },
          tailorings_state: { presets: cfg.config.tailorings.map(toPreset), edit_path: "" },
        },
      };
    }
  }
}

export function eclairReducer(state: EclairState, action: EclairStateAction): EclairState {
  console.log("action: ", action);
  switch (action.type) {
    case "reset-to-defaults":
      // Preserve live status/install-path (managed by the probe, not stored config)
      return default_eclair_state();

    case "load-sca-config": {
      const cfg = action.config;
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
      };
    }

    case "toggle-install-path-editing":
      return {
        ...state,
        install_path: {
          ...state.install_path,
          editing: !state.install_path.editing,
          disabled: !state.install_path.editing,
        },
      };

    case "toggle-user-ruleset-name-editing":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset name editing: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset1 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset1,
            userRulesetNameEditing: !ruleset1.userRulesetNameEditing
          }
        }
      };

    case "toggle-user-ruleset-path-editing":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot toggle user ruleset path editing: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset2 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset2,
            userRulesetPathEditing: !ruleset2.userRulesetPathEditing
          }
        }
      };
    
    case "update-install-path":
      return {
        ...state,
        install_path: { ...state.install_path, path: action.path },
      };
    
    case "update-extra-config-path":
      return {
        ...state,
        extra_config: { ...state.extra_config, path: action.path },
      };
    
    case "update-configuration-type":
      switch (action.configurationType) {
        case "preset":
          return {
            ...state,
            analysis_configuration: { type: "preset", state: default_presets_selection_state() }
          };
        case "custom-ecl":
          return {
            ...state,
            analysis_configuration: { type: "custom-ecl", state: {} }
          };
        case "zephyr-ruleset":
          return {
            ...state,
            analysis_configuration: {
              type: "zephyr-ruleset",
              ruleset: default_ruleset_state()
            }
          };
      }
    
    case "update-ruleset-selection":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update ruleset selection: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset3 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset3,
            selected: action.ruleset
          }
        }
      };
    
    case "update-user-ruleset-name":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset name: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset4 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset4,
            userRulesetName: action.name
          }
        }
      };
    
    case "update-user-ruleset-path":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot update user ruleset path: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset5 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset5,
            userRulesetPath: action.path
          }
        }
      };
    
    case "update-custom-ecl-path":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "custom-ecl") {
        console.error("Cannot update custom ECL path: configuration is not custom-ecl type");
        return state;
      }
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: {
            ...state.analysis_configuration.state,
            ecl: action.path
          }
        }
      };
    
    case "toggle-report": {
      let newReports = [...state.reports.selected];
      
      if (action.report === "ALL") {
        newReports = action.checked ? ["ALL"] : [];
      } else {
        newReports = newReports.filter(r => r !== "ALL");
        if (action.checked) {
          newReports.push(action.report);
        } else {
          newReports = newReports.filter(r => r !== action.report);
        }
      }
      
      return { ...state, reports: { selected: newReports } };
    }
    
    case "toggle-spinner":
      return {
        ...state,
        status: { ...state.status, showSpinner: action.show },
      };
    
    case "set-eclair-status":
      return {
        ...state,
        status: {
          ...state.status,
          installed: action.installed,
          version: action.installed ? action.version.trim() || "Unknown" : "Unknown",
        },
      };
    
    case "set-install-path":
      return {
        ...state,
        install_path: {
          path: action.path,
          placeholder: action.path ? "" : default_install_path_placeholder,
          disabled: false,
          editing: false,
        },
      };
    
    case "set-extra-config":
      return {
        ...state,
        extra_config: { path: action.path },
      };
    
    case "set-path-status":
      return {
        ...state,
        install_path: action.text.trim().toLowerCase() === "checking"
          ? { path: "", placeholder: "Checking", disabled: true, editing: false }
          : action.text.trim() === ""
            ? { ...state.install_path, path: "", placeholder: default_install_path_placeholder, disabled: true }
            : { ...state.install_path, path: action.text, placeholder: "", disabled: true },
      };
    
    case "set-user-ruleset-name":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset name: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset6 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset6,
            userRulesetName: action.name,
            userRulesetNameEditing: false
          }
        }
      };
    
    case "set-user-ruleset-path":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "zephyr-ruleset") {
        console.error("Cannot set user ruleset path: configuration is not zephyr-ruleset type");
        return state;
      }
      const ruleset7 = state.analysis_configuration.ruleset;
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          ruleset: {
            ...ruleset7,
            userRulesetPath: action.path,
            userRulesetPathEditing: false
          }
        }
      };
    
    case "set-custom-ecl-path":
      if (state.analysis_configuration === null || state.analysis_configuration.type !== "custom-ecl") {
        console.error("Cannot set custom ECL path: configuration is not custom-ecl type");
        return state;
      }
      return {
        ...state,
        analysis_configuration: {
          ...state.analysis_configuration,
          state: {
            ...state.analysis_configuration.state,
            ecl: action.path
          }
        }
      };
    
    case "report-server-started":
      return {
        ...state,
        report_server: { running: true },
      };
    
    case "report-server-stopped":
      return {
        ...state,
        report_server: { running: false },
      };

    case "set-preset-flag": {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      const sourceId = preset_template_source_id(action.source);
      const updatePreset = (preset: PresetSelectionState): PresetSelectionState => {
        if (preset_template_source_id(preset.source) !== sourceId) return preset;
        return {
          ...preset,
          edited_flags: {
            ...(preset.edited_flags ?? {}),
            [action.flagId]: action.value,
          },
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
    }

    case "clear-preset-flag": {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      const sourceId = preset_template_source_id(action.source);
      const updatePreset = (preset: PresetSelectionState): PresetSelectionState => {
        if (preset_template_source_id(preset.source) !== sourceId) return preset;
        const { [action.flagId]: _removed, ...rest } = preset.edited_flags ?? {};
        return {
          ...preset,
          edited_flags: rest,
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
    }
    case "remove-selected-preset": {
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      switch (action.kind) {
        case "ruleset": {
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                ruleset_state: { edit_path: "" },
                variants_state: { ...current_state.variants_state, presets: [] },
                tailorings_state: { ...current_state.tailorings_state, presets: [] },
              }
            }
          };
        }
        case "variant": {
          const new_variants = [...current_state.variants_state.presets];
          new_variants.splice(action.index, 1);
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                variants_state: { ...current_state.variants_state, presets: new_variants },
              }
            }
          };
        }
        case "tailoring": {
          const new_tailorings = [...current_state.tailorings_state.presets];
          new_tailorings.splice(action.index, 1);
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                tailorings_state: { ...current_state.tailorings_state, presets: new_tailorings },
              }
            }
          };
        }
      }
    }
    case "preset-content": {
      const { source, template } = action;
      const newPresets = new Map(state.available_presets.by_path);
      const newRepoPresets = new Map(state.available_presets.by_repo_path);

      switch (source.type) {
        case "system-path":
          newPresets.set(source.path, template);
          break;
        case "repo-path": {
          let byPath = newRepoPresets.get(source.repo);
          if (!byPath) {
            byPath = new Map();
            newRepoPresets.set(source.repo, byPath);
          }
          byPath.set(source.path, template);
          break;
        }
      }
      
      return {
        ...state,
        available_presets: {
          by_path: newPresets,
          by_repo_path: newRepoPresets,
        }
      };
    }
    case "set-preset-path": {
      const { kind, path } = action;
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      //const s = state.analysis_configuration.state;
      switch (kind) {
        case "ruleset": {
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...state.analysis_configuration.state,
                ruleset_state: {
                  ...state.analysis_configuration.state.ruleset_state,
                  edit_path: path,
                }
              }
            }
          };
        }
        case "variant": {
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...state.analysis_configuration.state,
                variants_state: {
                  ...state.analysis_configuration.state.variants_state,
                  edit_path: path,
                }
              }
            }
          };
        }
        case "tailoring": {
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...state.analysis_configuration.state,
                tailorings_state: {
                  ...state.analysis_configuration.state.tailorings_state,
                  edit_path: path,
                }
              }
            }
          };
        }
      }
    }
    case "set-or-add-preset": {
      const { kind, source } = action;
      if (state.analysis_configuration?.type !== "preset") {
        return state;
      }
      const current_state = state.analysis_configuration.state;
      switch (kind) {
        case "ruleset": {
          const new_preset = { source, edited_flags: {} };
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                ruleset_state: {
                  ...current_state.ruleset_state,
                  preset: new_preset,
                }
              }
            }
          };
        }
        case "variant": {
          const new_preset = { source, edited_flags: {} };
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                variants_state: {
                  ...current_state.variants_state,
                  presets: [...current_state.variants_state.presets, new_preset],
                }
              }
            }
          };
        }
        case "tailoring": {
          const new_preset = { source, edited_flags: {} };
          return {
            ...state,
            analysis_configuration: {
              ...state.analysis_configuration,
              state: {
                ...current_state,
                tailorings_state: {
                  ...current_state.tailorings_state,
                  presets: [...current_state.tailorings_state.presets, new_preset],
                }
              }
            }
          };
        }
      }
    }
    case "add-repo":
    case "update-repo":
      return {
        ...state,
        repos: { ...state.repos, [action.name]: { origin: action.origin, ref: action.rev } },
        // Reset scan state when a repo is added or its configuration changes.
        repos_scan_state: { ...state.repos_scan_state, [action.name]: { status: "idle" } },
      };
    case "remove-repo": {
      const { [action.name]: _removedRepo, ...restRepos } = state.repos;
      const { [action.name]: _removedScan, ...restScan } = state.repos_scan_state;
      // Also clear all preset-content entries for this repo.
      const newByRepoPath = new Map(state.available_presets.by_repo_path);
      newByRepoPath.delete(action.name);
      return {
        ...state,
        repos: restRepos,
        repos_scan_state: restScan,
        available_presets: { ...state.available_presets, by_repo_path: newByRepoPath },
      };
    }

    case "repo-scan-started":
      return {
        ...state,
        repos_scan_state: { ...state.repos_scan_state, [action.name]: { status: "loading" } },
      };

    case "repo-scan-done": {
      // Count successfully loaded templates for this repo.
      const byPath = state.available_presets.by_repo_path.get(action.name);
      const templateCount = byPath
        ? [...byPath.values()].filter(t => !("loading" in t) && !("error" in t)).length
        : 0;
      return {
        ...state,
        repos_scan_state: { ...state.repos_scan_state, [action.name]: { status: "success", templateCount } },
      };
    }

    case "repo-scan-failed":
      return {
        ...state,
        repos_scan_state: { ...state.repos_scan_state, [action.name]: { status: "error", message: action.message } },
      };

      return state;
  }
}

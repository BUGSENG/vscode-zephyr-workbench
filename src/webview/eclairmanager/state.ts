import { EclairPresetTemplateSource, EclairTemplate, EclairTemplateKind } from "../../utils/eclair/template";

const default_install_path_placeholder = "Enter the tool's path if not in the global PATH";

export interface EclairState {
  status: StatusState;
  install_path: InstallPathState;
  analysis_configuration: AnalysisConfigurationState | null;
  extra_config: ExtraConfigState;
  reports: ReportsState;
  report_server: ReportServerState;

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
    available_presets: {
      by_path: new Map(),
      by_repo_rev_path: new Map(),
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
  by_path: Map<string, EclairTemplate | { loading: string } | { error: string }>;
  by_repo_rev_path: Map<string, Map<string, Map<string, EclairTemplate | { loading: string } | { error: string }>>>;
}

export function get_preset_template_by_source(presets: AvailablePresetsState, source: EclairPresetTemplateSource): EclairTemplate | { loading: string } | { error: string } | undefined {
  switch (source.type) {
    case "system-path":
      return presets.by_path.get(source.path);
    case "repo-rev-path":
      const by_rev = presets.by_repo_rev_path.get(source.repo);
      if (!by_rev) return undefined;
      const by_path = by_rev.get(source.rev);
      if (!by_path) return undefined;
      return by_path.get(source.path);
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

export interface PresetSelectionState {
  source: EclairPresetTemplateSource;
  edited_flags: Record<string, boolean>;
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


export type EclairStateAction =
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
  | { type: "toggle-report"; report: string; checked: boolean }
  // Message-based actions
  | { type: "toggle-spinner"; show: boolean }
  | { type: "set-eclair-status"; installed: boolean; version: string }
  | { type: "set-install-path"; path: string }
  | { type: "set-extra-config"; path: string }
  | { type: "set-path-status"; text: string }
  | { type: "set-user-ruleset-name"; name: string }
  | { type: "set-user-ruleset-path"; path: string }
  | { type: "report-server-started" }
  | { type: "report-server-stopped" }
  | { type: "set-preset-flag"; source: EclairPresetTemplateSource; flagId: string; value: boolean }
  | { type: "clear-preset-flag"; source: EclairPresetTemplateSource; flagId: string }
  | { type: "remove-selected-preset"; kind: EclairTemplateKind; index: number }
  | { type: "preset-content"; source: EclairPresetTemplateSource; template: EclairTemplate | { loading: string } | { error: string } }
  | { type: "set-preset-path"; kind: EclairTemplateKind; path: string }
  | { type: "set-or-add-preset"; kind: EclairTemplateKind; source: EclairPresetTemplateSource; };

export function eclairReducer(state: EclairState, action: EclairStateAction): EclairState {
  console.log("action: ", action);
  switch (action.type) {
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
      const newRepoRevPresets = new Map(state.available_presets.by_repo_rev_path);

      switch (source.type) {
        case "system-path":
          newPresets.set(source.path, template);
          break;
        case "repo-rev-path": {
          let byRev = newRepoRevPresets.get(source.repo);
          if (!byRev) {
            byRev = new Map();
            newRepoRevPresets.set(source.repo, byRev);
          }
          let byPath = byRev.get(source.rev);
          if (!byPath) {
            byPath = new Map();
            byRev.set(source.rev, byPath);
          }
          byPath.set(source.path, template);
          break;
        }
      }
      
      return {
        ...state,
        available_presets: {
          by_path: newPresets,
          by_repo_rev_path: newRepoRevPresets,
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
    default:
      return state;
  }
}

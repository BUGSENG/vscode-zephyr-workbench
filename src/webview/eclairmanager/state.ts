
export interface EclairState {
  status: StatusState;
  installPath: InstallPathState;
  extraConfig: ExtraConfigState;
  ruleset: RulesetState;
  reports: ReportsState;
  reportServer: ReportServerState;
}

export function default_eclair_state(): EclairState {
  return {
    status: {
      version: "Checking",
      installed: false,
      showSpinner: false,
    },
    installPath: {
      path: "",
      placeholder: "Enter the tool's path if not in the global PATH",
      disabled: true,
      editing: false,
    },
    extraConfig: {
      path: "",
      editing: false,
    },
    ruleset: {
      selected: "ECLAIR_RULESET_FIRST_ANALYSIS",
      userRulesetName: "",
      userRulesetNameEditing: false,
      userRulesetPath: "",
      userRulesetPathEditing: false,
    },
    reports: {
      selected: ["ALL"],
    },
    reportServer: {
      running: false,
    },
  };
}

export interface StatusState {
  version: string;
  installed: boolean;
  showSpinner: boolean;
}

export interface InstallPathState {
  path: string;
  placeholder: string;
  disabled: boolean;
  editing: boolean;
}

export interface ExtraConfigState {
  path: string;
  editing: boolean;
}

export interface RulesetState {
  selected: string;
  userRulesetName: string;
  userRulesetNameEditing: boolean;
  userRulesetPath: string;
  userRulesetPathEditing: boolean;
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
  | { type: "toggle-extra-config-editing" }
  | { type: "toggle-user-ruleset-name-editing" }
  | { type: "toggle-user-ruleset-path-editing" }
  // Update actions
  | { type: "update-install-path"; path: string }
  | { type: "update-extra-config-path"; path: string }
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
  | { type: "report-server-stopped" };

export function eclairReducer(state: EclairState, action: EclairStateAction): EclairState {
  switch (action.type) {
    case "toggle-install-path-editing":
      return {
        ...state,
        installPath: {
          ...state.installPath,
          editing: !state.installPath.editing,
          disabled: !state.installPath.editing,
        },
      };
    
    case "toggle-extra-config-editing":
      return {
        ...state,
        extraConfig: { ...state.extraConfig, editing: !state.extraConfig.editing },
      };
    
    case "toggle-user-ruleset-name-editing":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetNameEditing: !state.ruleset.userRulesetNameEditing },
      };
    
    case "toggle-user-ruleset-path-editing":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetPathEditing: !state.ruleset.userRulesetPathEditing },
      };
    
    case "update-install-path":
      return {
        ...state,
        installPath: { ...state.installPath, path: action.path },
      };
    
    case "update-extra-config-path":
      return {
        ...state,
        extraConfig: { ...state.extraConfig, path: action.path },
      };
    
    case "update-ruleset-selection":
      return {
        ...state,
        ruleset: { ...state.ruleset, selected: action.ruleset },
      };
    
    case "update-user-ruleset-name":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetName: action.name },
      };
    
    case "update-user-ruleset-path":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetPath: action.path },
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
        installPath: {
          path: action.path,
          placeholder: "",
          disabled: false,
          editing: false,
        },
      };
    
    case "set-extra-config":
      return {
        ...state,
        extraConfig: { path: action.path, editing: false },
      };
    
    case "set-path-status":
      return {
        ...state,
        installPath: action.text.trim().toLowerCase() === "checking"
          ? { path: "", placeholder: "Checking", disabled: true, editing: false }
          : { ...state.installPath, path: action.text, placeholder: "", disabled: true },
      };
    
    case "set-user-ruleset-name":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetName: action.name, userRulesetNameEditing: false },
      };
    
    case "set-user-ruleset-path":
      return {
        ...state,
        ruleset: { ...state.ruleset, userRulesetPath: action.path, userRulesetPathEditing: false },
      };
    
    case "report-server-started":
      return {
        ...state,
        reportServer: { running: true },
      };
    
    case "report-server-stopped":
      return {
        ...state,
        reportServer: { running: false },
      };
    
    default:
      return state;
  }
}

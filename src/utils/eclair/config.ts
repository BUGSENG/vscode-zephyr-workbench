
export interface EclairScaConfig {
  install_path?: string,
  config: EclairScaMainConfig,
  extra_config?: string,
  reports: string[],
}

export type EclairScaMainConfig =
  | ({ type: "preset" } & EclairScaPresetConfig)
  | ({ type: "custom-ecl" } & EclairScaCustomEclConfig)
  | ({ type: "zephyr-ruleset" } & EclairScaZephyrRulesetConfig);

export interface EclairScaPresetConfig {
  ruleset: PresetSelectionState,
  variants: PresetSelectionState[],
  tailorings: PresetSelectionState[],
}

export interface EclairScaCustomEclConfig {
  ecl_path: string,
}

export interface EclairScaZephyrRulesetConfig {
  ruleset: string,
  userRulesetName?: string,
  userRulesetPath?: string,
}

export interface PresetSelectionState {
  source: EclairPresetTemplateSource;
  edited_flags: Record<string, boolean>;
}


export type EclairPresetTemplateSource = {
  type: "system-path",
  path: string;
} | {
  type: "repo-rev-path",
  repo: string;
  rev: string;
  path: string;
};

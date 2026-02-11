import React from "react";
import { WebviewMessage } from "../../../utils/eclairEvent";
import { EclairState, EclairStateAction, ZephyrRulesetState } from "../state";
import { VscodeRadio, VscodeRadioGroup } from "./vscode";
import { RulesetSection } from "./main_configuration/ruleset_section";
import { CustomEclSection } from "./main_configuration/custom_ecl";
import { PresetSelection } from "./main_configuration/preset_selection";


export function MainAnalysisConfigurationSection({
  state,
  dispatch_state,
  post_message,
  collectConfig,
}: {
  state: EclairState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
  collectConfig: () => any;
}) {
  const rulesets = ["preset", "custom-ecl", "zephyr-ruleset"];
  const ruleset_description = {
    "preset": <>Use a preset configuration based on rulesets, variants and tailorings</>,
    "custom-ecl": <>Provide a custom ECL (<code>.ecl</code>) file</>,
    "zephyr-ruleset": <>Use a builtin Zephyr ruleset</>,
  };

  const configuration = state.analysis_configuration;

  return (
    <div className="section">
      <h2>Main Analysis Configuration</h2>

      <VscodeRadioGroup
        orientation="vertical"
        value={state.analysis_configuration?.type || null}
        onChange={(e: any) => {
          const type = e.target.value as "preset" | "custom-ecl" | "zephyr-ruleset";
          dispatch_state({ type: "update-configuration-type", configurationType: type });
        }}
      >
        {rulesets.map((r) => (
          <VscodeRadio key={r} name="ruleset" value={r}>
            <strong>{r === "USER" ? "user defined" : r}</strong>: {ruleset_description[r as keyof typeof ruleset_description]}
          </VscodeRadio>
        ))}
      </VscodeRadioGroup>

      {configuration?.type === "zephyr-ruleset" && (
        <RulesetSection
          ruleset={configuration.ruleset}
          dispatch_state={dispatch_state}
          post_message={post_message}
          collectConfig={collectConfig}
        />
      )}

      {configuration?.type === "preset" && (
        <PresetSelection
          state={configuration.state}
          available_presets={state.available_presets}
          dispatch_state={dispatch_state}
          post_message={post_message}
        />
      )}

      {configuration?.type === "custom-ecl" && (
        <CustomEclSection
          state={configuration.state}
          dispatch_state={dispatch_state}
          post_message={post_message}
        />
      )}

      {configuration === null && (
        <div>No configuration selected</div>
      )}
    </div>
  );
}
import React from "react";
import { ZephyrRulesetState, EclairStateAction } from "../../state";
import { VscodeButton, VscodeRadio, VscodeRadioGroup, VscodeTextField } from "../vscode";
import { WebviewMessage } from "../../../../utils/eclairEvent";

export function RulesetSection(props: {
  ruleset: ZephyrRulesetState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
  collectConfig: () => any;
}) {
  const rulesets = [
    "ECLAIR_RULESET_FIRST_ANALYSIS",
    "ECLAIR_RULESET_STU",
    "ECLAIR_RULESET_STU_HEAVY",
    "ECLAIR_RULESET_WP",
    "ECLAIR_RULESET_STD_LIB",
    "ECLAIR_RULESET_ZEPHYR_GUIDELINES",
    "USER",
  ];

  const showUserFields = props.ruleset.selected === "USER";

  const handleUserRulesetNameEdit = () => {
    if (props.ruleset.userRulesetNameEditing) {
      props.post_message({ command: "save-sca-config", data: props.collectConfig() });
    }
    props.dispatch_state({ type: "toggle-user-ruleset-name-editing" });
  };

  const handleUserRulesetPathEdit = () => {
    if (props.ruleset.userRulesetPathEditing) {
      props.post_message({ command: "save-sca-config", data: props.collectConfig() });
    }
    props.dispatch_state({ type: "toggle-user-ruleset-path-editing" });
  };

  return (
    <div className="section">
      <h2>Rulesets</h2>
      <VscodeRadioGroup
        orientation="vertical"
        value={props.ruleset.selected}
        onChange={(e: any) => props.dispatch_state({ type: "update-ruleset-selection", ruleset: e.target.value })}
      >
        {rulesets.map((r) => (
          <VscodeRadio key={r} name="ruleset" value={r}>
            {r === "USER" ? "user defined" : r}
          </VscodeRadio>
        ))}
      </VscodeRadioGroup>
      <div className={`grid-group-div ${showUserFields ? "" : "hidden"}`}>
        <VscodeTextField
          className="details-path-field"
          placeholder="Ruleset name (e.g. MYRULESET)"
          size="30"
          value={props.ruleset.userRulesetName}
          disabled={!props.ruleset.userRulesetNameEditing}
          onChange={(e: any) => props.dispatch_state({ type: "update-user-ruleset-name", name: e.target.value })}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" && props.ruleset.userRulesetNameEditing) {
              handleUserRulesetNameEdit();
            }
          }}
        >
          Ruleset Name:
        </VscodeTextField>
        <VscodeButton appearance="primary" onClick={handleUserRulesetNameEdit}>
          {props.ruleset.userRulesetNameEditing ? "Done" : "Edit"}
        </VscodeButton>
        <VscodeTextField
          className="details-path-field"
          placeholder="Path to analysis_<RULESET>.ecl (optional)"
          size="38"
          value={props.ruleset.userRulesetPath}
          disabled={!props.ruleset.userRulesetPathEditing}
          onChange={(e: any) => props.dispatch_state({ type: "update-user-ruleset-path", path: e.target.value })}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" && props.ruleset.userRulesetPathEditing) {
              handleUserRulesetPathEdit();
            }
          }}
        >
          Ruleset Path:
        </VscodeTextField>
        <VscodeButton
          className="browse-extra-input-button"
          appearance="secondary"
          disabled={!props.ruleset.userRulesetPathEditing}
          onClick={() => props.post_message({ command: "browse-user-ruleset-path" })}
        >
          <span className="codicon codicon-folder"></span>
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={handleUserRulesetPathEdit}>
          {props.ruleset.userRulesetPathEditing ? "Done" : "Edit"}
        </VscodeButton>
      </div>
    </div>
  );
}

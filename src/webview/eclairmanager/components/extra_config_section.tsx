import React from "react";
import { ExtraConfigState, EclairStateAction } from "../state";
import { VscodeButton, VscodeTextField } from "./vscode";
import { WebviewMessage } from "../../../utils/eclairEvent";

export function ExtraConfigSection(props: {
  extraConfig: ExtraConfigState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  const handleExtraConfigEdit = () => {
    if (props.extraConfig.editing) {
      props.post_message({
        command: "update-extra-config",
        newPath: props.extraConfig.path.trim(),
      });
    }
    props.dispatch_state({ type: "toggle-extra-config-editing" });
  };

  return (
    <div className="section">
      <h2>Additional Configuration (.ecl)</h2>
      <div className="grid-group-div">
        <VscodeTextField
          placeholder="path/to/config"
          size="50"
          value={props.extraConfig.path}
          disabled={!props.extraConfig.editing}
          onChange={(e: any) => props.dispatch_state({ type: "update-extra-config-path", path: e.target.value })}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" && props.extraConfig.editing) {
              handleExtraConfigEdit();
            }
          }}
        >
          Path:
        </VscodeTextField>
        <VscodeButton
          className="browse-extra-input-button"
          appearance="secondary"
          disabled={!props.extraConfig.editing}
          onClick={() => props.post_message({ command: "browse-extra-config" })}
        >
          <span className="codicon codicon-folder"></span>
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={handleExtraConfigEdit}>
          {props.extraConfig.editing ? "Done" : "Edit"}
        </VscodeButton>
      </div>
    </div>
  );
}

import React from "react";
import { WebviewMessage } from "../../../../utils/eclairEvent";
import { CustomEclState, EclairStateAction } from "../../state";
import { VscodeButton, VscodeTextField } from "../vscode";

export function CustomEclSection(props: {
  state: CustomEclState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  return (<>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <VscodeTextField
        className="details-path-field"
        placeholder="path/to/analysis_config.ecl"
        size="30"
        style={{ flexGrow: 1 }}
        value={props.state.ecl || ""}
        // TODO onChange
      >
        Custom ECL file:
      </VscodeTextField>
      <VscodeButton
        className="browse-extra-input-button"
        appearance="secondary"
        // TODO onClick
      >
        <span className="codicon codicon-folder"></span>
      </VscodeButton>
    </div>
  </>);
}

import React from "react";
import { WebviewMessage } from "../../../../utils/eclairEvent";
import { CustomEclState, EclairStateAction } from "../../state";
import { PickPath, VscodeButton, VscodeTextField } from "../vscode";

export function CustomEclSection(props: {
  state: CustomEclState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  return (<>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <PickPath
        value={props.state.ecl || ""}
        name="ECL file"
        placeholder="path/to/analysis_config.ecl"
        on_selected={() => {}} // TODO
        on_pick={() => {}} // TODO
      />
    </div>
  </>);
}

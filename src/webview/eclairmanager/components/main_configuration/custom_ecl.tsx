import React from "react";
import { WebviewMessage } from "../../../../utils/eclairEvent";
import { CustomEclState, EclairStateAction } from "../../state";
import { PickPath } from "../common_components";

export function CustomEclSection({
  state,
  dispatch_state,
  post_message,
}: {
  state: CustomEclState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  return (<>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <PickPath
        value={state.ecl || ""}
        name="ECL file"
        placeholder="path/to/analysis_config.ecl"
        on_selected={(value) => dispatch_state({ type: "update-custom-ecl-path", path: value })}
        on_pick={() => post_message({ command: "browse-custom-ecl-path" })}
      />
    </div>
  </>);
}

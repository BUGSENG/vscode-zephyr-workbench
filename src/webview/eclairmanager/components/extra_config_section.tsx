import React from "react";
import { ExtraConfigState, EclairStateAction } from "../state";
import { PickPath } from "./common_components";
import { WebviewMessage } from "../../../utils/eclairEvent";

export function ExtraConfigSection(props: {
  extra_config: ExtraConfigState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  return (
    <div className="section">
      <h2>Additional Configuration (.ecl)</h2>
      <PickPath
        value={props.extra_config.path}
        placeholder="path/to/config"
        on_selected={(newPath) => {
          props.dispatch_state({ type: "update-extra-config-path", path: newPath });
        }}
        on_pick={() => props.post_message({ command: "browse-extra-config" })}
      />
    </div>
  );
}

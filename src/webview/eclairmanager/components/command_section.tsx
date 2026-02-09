import React from "react";
import { VscodeButton } from "./vscode";
import { WebviewMessage } from "../../../utils/eclairEvent";

export function CommandSection(props: {
  post_message: (message: WebviewMessage) => void;
  collectConfig: () => any;
}) {
  return (
    <div className="section">
      <div className="grid-group-div command-actions">
        <VscodeButton appearance="secondary" onClick={() => props.post_message({ command: "save-sca-config", data: props.collectConfig() })}>
          Apply configuration
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={() => props.post_message({ command: "run-command", data: props.collectConfig() })}>
          Run Analysis
        </VscodeButton>
      </div>
    </div>
  );
}

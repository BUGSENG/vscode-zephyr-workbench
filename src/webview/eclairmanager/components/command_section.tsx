import React from "react";
import { VscodeButton, VscodeAlert } from "./vscode";
import { WebviewMessage } from "../../../utils/eclairEvent";
import { EclairScaConfig } from "../../../utils/eclair/config";
import { Result } from "../../../utils/typing_utils";
import { EclairStateAction } from "../state";

export function CommandSection({
  post_message,
  config,
  dispatch_state,
}: {
  post_message: (message: WebviewMessage) => void;
  config: Result<EclairScaConfig, string>;
  dispatch_state: React.Dispatch<EclairStateAction>;
}) {
  return (
    <div className="section">
      <h2>Analysis</h2>
      {"err" in config ? (
        <VscodeAlert type="warning">
          <strong>Invalid configuration:</strong> {config.err}
        </VscodeAlert>
      ) : null}
      <div className="grid-group-div command-actions">
        <VscodeButton appearance="secondary" onClick={() => dispatch_state({ type: "reset-to-defaults" })}>
          Restore Defaults
        </VscodeButton>
        <VscodeButton appearance="secondary" disabled={"err" in config} onClick={() => {
          if ("err" in config) {
            console.error("Cannot apply configuration due to error:", config.err);
            return;
          }
          post_message({ command: "save-sca-config", config: config.ok });
        }}>
          Apply configuration
        </VscodeButton>
        <VscodeButton appearance="primary" disabled={"err" in config} onClick={() => {
          if ("err" in config) {
            console.error("Cannot run analysis due to error:", config.err);
            return;
          }
          post_message({ command: "run-command", config: config.ok });
        }}>
          Run Analysis
        </VscodeButton>
      </div>
    </div>
  );
}

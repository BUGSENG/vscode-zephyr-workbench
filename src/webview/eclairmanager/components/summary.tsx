import React from "react";
import { StatusState, InstallPathState, EclairStateAction } from "../state";
import { VscodeButton, VscodeTextField } from "./vscode";
import { WebviewMessage } from "../../../utils/eclairEvent";

export function Summary(props: {
  status: StatusState;
  installPath: InstallPathState;
  post_message: (message: WebviewMessage) => void;
  dispatch_state: React.Dispatch<EclairStateAction>;
}) {
  const statusIcon = props.status.installed ? "codicon-check success-icon" : "codicon-warning warning-icon";
  const statusText = props.status.installed ? "Installed" : "Not installed";

  const post_message = props.post_message;

  const handleInstallPathEdit = () => {
    if (props.installPath.editing) {
      props.post_message({
        command: "update-path",
        tool: "eclair",
        newPath: props.installPath.path.trim(),
      });
    }
    props.dispatch_state({ type: "toggle-install-path-editing" });
  };

  return (
    <div className="summary">
      <div className="summary-title"><strong>ECLAIR</strong></div>
      <div>
        <strong>Version:</strong> <span>{props.status.version}</span>
        &nbsp;|&nbsp;
        <strong>Status:</strong>{" "}
        <span className={`codicon ${statusIcon}`}></span> <span>{statusText}</span>
        <span
          className={`codicon codicon-loading codicon-modifier-spin ${props.status.showSpinner ? "" : "hidden"}`}
          title="Detecting ECLAIR"
        ></span>
      </div>
      <div className="summary-actions">
        <div className="actions-title"><strong>Actions</strong></div>
        <VscodeButton appearance="primary" onClick={() => post_message({ command: "browse-path", tool: "eclair" })}>
          Refresh Status
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={() => post_message({ command: "about-eclair" })}>
          About ECLAIR
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={() => post_message({ command: "manage-license" })}>
          Manage ECLAIR License
        </VscodeButton>
        <VscodeButton appearance="primary" onClick={() => post_message({ command: "request-trial" })}>
          Request Trial License
        </VscodeButton>
      </div>
      <div className="grid-group-div">
        <VscodeTextField
          className="details-path-field"
          placeholder={props.installPath.placeholder}
          size="50"
          value={props.installPath.path}
          disabled={!props.installPath.editing}
          onChange={(e: any) => props.dispatch_state({ type: "update-install-path", path: e.target.value })}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" && props.installPath.editing) {
              handleInstallPathEdit();
            }
          }}
        >
          Path:
        </VscodeTextField>
        <VscodeButton
          className="browse-input-button"
          appearance="secondary"
          disabled={!props.installPath.editing}
          onClick={() => props.post_message({ command: "browse-path", tool: "eclair" })}
        >
          <span className="codicon codicon-folder"></span>
        </VscodeButton>
        <VscodeButton
          className="save-path-button"
          appearance="primary"
          onClick={handleInstallPathEdit}
        >
          {props.installPath.editing ? "Done" : "Edit"}
        </VscodeButton>
      </div>
    </div>
  );
}

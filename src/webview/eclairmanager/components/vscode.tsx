import React from "react";

// Web component wrappers for VSCode UI Toolkit
export function VscodeButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { appearance: "primary" | "secondary" }
) {
  return React.createElement("vscode-button", props, props.children);
}

export function VscodeTextField(props: any) {
  return React.createElement("vscode-text-field", props, props.children);
}

export function VscodeRadioGroup(props: any) {
  return React.createElement("vscode-radio-group", props, props.children);
}

export function VscodeRadio(props: any) {
  return React.createElement("vscode-radio", props, props.children);
}

export function VscodeCheckbox(props: any) {
  return React.createElement("vscode-checkbox", props, props.children);
}
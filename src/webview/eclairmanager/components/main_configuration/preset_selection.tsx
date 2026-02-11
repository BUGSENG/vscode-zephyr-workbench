import React, { useEffect, useMemo, useState } from "react";
import { WebviewMessage } from "../../../../utils/eclairEvent";
import { AvailablePresetsState, EclairStateAction, get_preset_template_by_source, MultiPresetSelectionState, PresetSelectionState, PresetsSelectionState, SinglePresetSelectionState } from "../../state";
import { PickPath, SearchableDropdown, SearchableItem, VscodeButton, VscodeCheckbox, VscodePanel, SimpleTooltip, RichTooltip } from "../vscode";
import { EclairPresetTemplateSource, EclairTemplate, EclairTemplateKind, EclairTemplateOption } from "../../../../utils/eclair/template";

export function PresetSelection(props: {
  state: PresetsSelectionState;
  available_presets: AvailablePresetsState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  return (<>
    <h3>
      Ruleset selection
      <SimpleTooltip text="Select a base ruleset that defines the default set of checks for the analysis." />
      <RichTooltip>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Ruleset info</div>
        <div style={{ fontSize: "0.9em" }}>
          Use a ruleset as the baseline for checks. Variants and tailorings can
          refine this selection.
        </div>
      </RichTooltip>
    </h3>
    Choose a base ruleset to run the analysis with.

    <SinglePresetSelection
      kind="ruleset"
      state={props.state.ruleset_state}
      available_presets={props.available_presets}
      dispatch_state={props.dispatch_state}
      post_message={props.post_message}
    />

    <h3>Variants selection</h3>
    Choose an analysis variant to run. Variants are modifications to the base
    ruleset that enable or disable certain checks, or change the behavior of
    some rules. You can select multiple variants to run them together.

    <MultiPresetSelection 
      kind="variant" 
      state={props.state.variants_state} 
      available_presets={props.available_presets}
      dispatch_state={props.dispatch_state}
      post_message={props.post_message}
    />

    <h3>Tailorings selection</h3>
    Choose a tailoring to apply to the analysis. Tailorings are modifications
    to the base ruleset that are applied on top of variants, and can be used
    to further customize the analysis configuration. You can select multiple
    tailorings to apply them together.

    <MultiPresetSelection 
      kind="tailoring" 
      state={props.state.tailorings_state} 
      available_presets={props.available_presets}
      dispatch_state={props.dispatch_state}
      post_message={props.post_message}
    />
  </>);
}

function SinglePresetSelection(props: {
  kind: EclairTemplateKind;
  state: SinglePresetSelectionState;
  available_presets: AvailablePresetsState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const preset = props.state.preset;

  if (preset) {
    const source = preset.source;
    const template = get_preset_template_by_source(props.available_presets, source);

    const on_remove = () => {
      props.dispatch_state({ type: "remove-selected-preset", kind: props.kind, index: -1 });
    };

    return (
      <VscodePanel style={{ marginTop: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <strong>Selected preset:</strong>
          <EclairPresetTemplateSourceDisplay source={source} />
          <VscodeButton appearance="secondary" onClick={on_remove} title="Remove preset">Remove</VscodeButton>
        </div>

        {template === undefined ? (<>
          <div style={{ color: "var(--vscode-errorForeground)" }}>Error: Preset not found in available presets</div>
        </>) : "loading" in template ? (<>
          <div>Loading preset...</div>
        </>) : "error" in template ? (<>
          <div style={{ color: "var(--vscode-errorForeground)" }}>Error loading preset: {template.error}</div>
        </>) : (<>
          <PresetSettings
            template={template}
            preset={preset}
            dispatch_state={props.dispatch_state}
          />
        </>)}
      </VscodePanel>
    );
  }

  return (<>
    <div style={{ marginTop: '10px' }}>
      <VscodeButton 
        appearance="primary" 
        onClick={() => setShowPicker(!showPicker)}
      >
        {showPicker ? "Hide Preset Selection" : "Select Preset"}
      </VscodeButton>
    </div>

    {showPicker && (
      <PresetPicker
        kind={props.kind}
        available_presets={props.available_presets}
        edit_path={props.state.edit_path}
        dispatch_state={props.dispatch_state}
        post_message={props.post_message}
      />
    )}
  </>);
}

function MultiPresetSelection(props: {
  kind: EclairTemplateKind;
  state: MultiPresetSelectionState;
  available_presets: AvailablePresetsState;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
}) {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const presets = props.state.presets;

  return (<>
    {presets.length > 0 && (
      <div style={{ marginTop: "10px" }}>
        {presets.map((preset, index) => {
          const source = preset.source;
          const template = get_preset_template_by_source(props.available_presets, source);

          const on_remove = () => {
            props.dispatch_state({ type: "remove-selected-preset", kind: props.kind, index });
          };

          return (
            <VscodePanel key={index}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <strong>Preset {index + 1}:</strong>
                <EclairPresetTemplateSourceDisplay source={source} />
                <VscodeButton appearance="secondary" onClick={on_remove} title="Remove preset">Remove</VscodeButton>
              </div>

              {template === undefined ? (<>
                <div style={{ color: "var(--vscode-errorForeground)" }}>Error: Preset not found in available presets</div>
              </>) : "loading" in template ? (<>
                <div>Loading preset...</div>
              </>) : "error" in template ? (<>
                <div style={{ color: "var(--vscode-errorForeground)" }}>Error loading preset: {template.error}</div>
              </>) : (<>
                <PresetSettings
                  template={template}
                  preset={preset}
                  dispatch_state={props.dispatch_state}
                />
              </>)}
            </VscodePanel>
          );
        })}
      </div>
    )}

    <div style={{ marginTop: '10px' }}>
      <VscodeButton 
        appearance="primary" 
        onClick={() => setShowPicker(!showPicker)}
      >
        {showPicker ? "Hide Preset Selection" : `Add ${presets.length > 0 ? "Another" : ""} Preset`}
      </VscodeButton>
    </div>

    {showPicker && (
      <PresetPicker
        kind={props.kind}
        available_presets={props.available_presets}
        edit_path={props.state.edit_path}
        dispatch_state={props.dispatch_state}
        post_message={props.post_message}
        onPresetSelected={() => setShowPicker(false)}
      />
    )}
  </>);
}

function PresetPicker(props: {
  kind: EclairTemplateKind;
  available_presets: AvailablePresetsState;
  edit_path: string;
  dispatch_state: React.Dispatch<EclairStateAction>;
  post_message: (message: WebviewMessage) => void;
  onPresetSelected?: () => void;
}) {
  type Item = SearchableItem & { source: EclairPresetTemplateSource };
  const [selectedPreset, setSelectedPreset] = React.useState<Item | null>(null);

  const available_preset_items: Item[] = useMemo(() => {
    let items: Item[] = [];
    for (const [path, preset] of props.available_presets.by_path) {
      if ("loading" in preset || "error" in preset) {
        continue;
      }
      if (preset.kind !== props.kind) {
        continue;
      }
      items.push({
        id: path,
        name: preset.title,
        description: preset.description,
        source: { type: "system-path", path },
      });
    }
    for (const [repo, by_rev_path] of props.available_presets.by_repo_rev_path) {
      for (const [rev, by_path] of by_rev_path) {
        for (const [path, preset] of by_path) {
          if ("loading" in preset || "error" in preset) {
            continue;
          }
          if (preset.kind !== props.kind) {
            continue;
          }
          items.push({
            id: `${repo}@${rev}:${path}`,
            name: preset.title,
            description: preset.description,
            source: { type: "repo-rev-path", repo, rev, path },
          });
        }
      }
    }
    return items;
  }, [props.available_presets]);

  return (<div style={{ 
    marginTop: '10px', 
    padding: '12px', 
    border: '1px solid var(--vscode-panel-border)', 
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-editor-background)'
  }}>
    <div style={{ marginBottom: '10px', fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)' }}>
      You can either select one of the available presets below, or provide a custom preset by specifying the path to a <code>.ecl</code> or <code>.yaml</code> file.
    </div>

    <SearchableDropdown
      id={`preset-search-${props.kind}`}
      label="Select from available presets:"
      placeholder="Search or select a preset..."
      items={available_preset_items}
      selectedItem={selectedPreset}
      onSelectItem={(preset: Item) => {
        setSelectedPreset(preset);
        props.dispatch_state({ type: "set-or-add-preset", kind: props.kind, source: preset.source });
        // TODO props.post_message({ command: "load-preset-from-source", source: preset.source });
        props.onPresetSelected?.();
      }}
    />

    <div style={{ marginTop: '10px' }}>
      Or provide a custom preset by specifying the path to a <code>.ecl</code> or <code>.yaml</code> file:
    </div>
    <PickPath
      value={props.edit_path}
      placeholder="Path to analysis_<RULESET>.<ecl|yaml>"
      on_selected={(path) => {
        props.dispatch_state({ type: "set-or-add-preset", kind: props.kind, source: { type: "system-path", path } });
        props.post_message({ command: "load-preset-from-path", path });
        props.onPresetSelected?.();
      }}
      on_pick={() => {
        props.post_message({ command: "pick-preset-path", kind: props.kind });
      }}
    />
  </div>);
}

function EclairPresetTemplateSourceDisplay({
  source,
}: {
  source: EclairPresetTemplateSource;
}) {
  if (source.type === "system-path") {
    return <>Path: <code>{source.path}</code></>;
  } else {
    return <>Custom source (<strong>TODO</strong>)</>;
  }
}

function PresetSettings({
  template,
  preset,
  dispatch_state,
}: {
  template: EclairTemplate,
  preset: PresetSelectionState,
  dispatch_state: React.Dispatch<EclairStateAction>,
}) {
  return (<div style={{ marginTop: "8px" }}>
    <div><strong>{template.title}</strong></div>
    <div style={{ fontSize: "0.9em", color: "var(--vscode-descriptionForeground)" }}>{template.description}</div>
    
    {template.options.length > 0 && (
      <details style={{ marginTop: "8px" }}>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          Options ({template.options.length})
        </summary>
        <div style={{ 
          marginTop: "8px", 
          maxHeight: "20em", 
          overflowY: "auto", 
          border: "1px solid var(--vscode-panel-border)", 
          padding: "8px", 
          borderRadius: "4px",
          backgroundColor: "var(--vscode-input-background)"
        }}>
          {template.options.map((option, idx) => (
            <TemplateOptionTree
              key={option.id || idx}
              option={option}
              level={0}
              editedFlags={preset.edited_flags ?? {}}
              onSetFlag={(flagId, value) => dispatch_state({
                type: "set-preset-flag",
                source: preset.source,
                flagId,
                value,
              })}
              onClearFlag={(flagId) => dispatch_state({
                type: "clear-preset-flag",
                source: preset.source,
                flagId,
              })}
            />
          ))}
        </div>
      </details>
    )}
  </div>);
}

function TemplateOptionTree({
  option,
  level = 0,
  editedFlags,
  onSetFlag,
  onClearFlag,
}: {
  option: EclairTemplateOption;
  level?: number;
  editedFlags: Record<string, boolean>;
  onSetFlag: (flagId: string, value: boolean) => void;
  onClearFlag: (flagId: string) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(true);

  const indentStyle: React.CSSProperties = {
    marginLeft: `${level * 20}px`,
    marginTop: "4px",
    marginBottom: "4px",
  };

  switch (option.variant.kind) {
    case "flag": {
      const defaultValue = option.variant.default ?? false;
      const editedValue = editedFlags[option.id];
      const isEdited = editedValue !== undefined;
      const checked = isEdited ? editedValue : defaultValue;

      return (
        <div style={indentStyle}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <VscodeCheckbox
              checked={checked}
              onChange={(e: any) => onSetFlag(option.id, !!e.target.checked)}
            >
              {option.title || option.id}
              {isEdited && (
                <span style={{ marginLeft: "6px", color: "var(--vscode-descriptionForeground)" }}>
                  *
                </span>
              )}
              {option.title && option.title !== option.id && (
                <span style={{ marginLeft: "8px", color: "var(--vscode-descriptionForeground)", fontSize: "0.9em" }}>
                  ({option.id})
                </span>
              )}
            </VscodeCheckbox>
            {isEdited && (
              <span
                className="no-icon-tooltip"
                data-tooltip="Reset to default"
                style={{ position: "relative", display: "inline-flex", marginLeft: "6px" }}
              >
                <button
                  type="button"
                  className="inline-icon-button codicon codicon-discard"
                  aria-label="Reset to default"
                  onClick={() => onClearFlag(option.id)}
                ></button>
              </span>
            )}
          </div>
        </div>
      );
    }
    case "group": {
      return (
        <div style={indentStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
              fontWeight: level === 0 ? "bold" : "normal",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <span style={{ marginRight: "6px", fontSize: "0.8em" }}>
              {expanded ? "▼" : "▶"}
            </span>
            <span>{option.title || option.id}</span>
            {option.title && option.title !== option.id && (
              <span style={{ marginLeft: "8px", color: "var(--vscode-descriptionForeground)", fontSize: "0.9em" }}>
                ({option.id})
              </span>
            )}
            <span style={{ marginLeft: "8px", color: "var(--vscode-descriptionForeground)", fontSize: "0.85em" }}>
              [{option.variant.children.length} {option.variant.children.length === 1 ? "option" : "options"}]
            </span>
          </div>
          {expanded && (
            <div>
              {option.variant.children.map((childOption, idx) => (
                <TemplateOptionTree
                  key={childOption.id || idx}
                  option={childOption}
                  level={level + 1}
                  editedFlags={editedFlags}
                  onSetFlag={onSetFlag}
                  onClearFlag={onClearFlag}
                />
              ))}
            </div>
          )}
        </div>
      );
    }
  }
}

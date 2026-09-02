import React from 'react';

type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: any[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: string[];
  additionalProperties?: boolean;
};

type SchemaEditorProps = {
  schema: Record<string, any>;
  value: Record<string, any>;
  onChange: (newValue: Record<string, any>) => void;
  disabled?: boolean;
  copy: Record<string, string>;
};

export function SchemaEditor({ schema, value, onChange, disabled, copy }: SchemaEditorProps) {
  const rootProperties = (schema?.properties as Record<string, SchemaProperty>) || {};

  function handleFieldChange(path: string[], fieldValue: any) {
    const nextConfig = deepSet(value || {}, path, fieldValue);
    onChange(nextConfig);
  }

  return (
    <div className="schema-editor">
      {Object.keys(rootProperties).length === 0 ? (
        <div className="hint">{copy.noSchemaProperties || 'No editable configuration fields found.'}</div>
      ) : (
        Object.entries(rootProperties).map(([key, propSchema]) => (
          <SchemaFieldGroup
            key={key}
            path={[key]}
            schema={propSchema}
            value={value?.[key]}
            onChange={(val) => handleFieldChange([key], val)}
            disabled={disabled}
            copy={copy}
          />
        ))
      )}
    </div>
  );
}

type SchemaFieldProps = {
  path: string[];
  schema: SchemaProperty;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  copy: Record<string, string>;
};

function SchemaFieldGroup({ path, schema, value, onChange, disabled, copy }: SchemaFieldProps) {
  const fieldName = path[path.length - 1];
  const label = schema.title || formatFieldName(fieldName);
  const type = schema.type;

  if (type === 'object' && schema.properties) {
    const objVal = typeof value === 'object' && value !== null ? value : {};
    return (
      <fieldset className="schema-section">
        <legend>{label}</legend>
        {schema.description ? <p className="field-hint">{schema.description}</p> : null}
        <div className="schema-section-body">
          {Object.entries(schema.properties).map(([subKey, subSchema]) => (
            <SchemaFieldGroup
              key={subKey}
              path={[...path, subKey]}
              schema={subSchema}
              value={objVal[subKey]}
              onChange={(newSubVal) => {
                const nextObj = { ...objVal, [subKey]: newSubVal };
                onChange(nextObj);
              }}
              disabled={disabled}
              copy={copy}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (type === 'array' && schema.items) {
    const arrVal = Array.isArray(value) ? value : [];
    const itemSchema = schema.items;

    const addItem = () => {
      const defaultItem = createDefaultForSchema(itemSchema);
      onChange([...arrVal, defaultItem]);
    };

    const removeItem = (index: number) => {
      const nextArr = arrVal.filter((_, i) => i !== index);
      onChange(nextArr);
    };

    const updateItem = (index: number, itemVal: any) => {
      const nextArr = [...arrVal];
      nextArr[index] = itemVal;
      onChange(nextArr);
    };

    return (
      <fieldset className="schema-section schema-array-section">
        <legend>{label}</legend>
        {schema.description ? <p className="field-hint">{schema.description}</p> : null}
        <div className="schema-array-list">
          {arrVal.map((item, index) => (
            <div key={index} className="schema-array-item">
              <div className="schema-array-item-header">
                <span>#{index + 1}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                >
                  {copy.remove || 'Remove'}
                </button>
              </div>
              <SchemaFieldGroup
                path={[...path, `${index}`]}
                schema={itemSchema}
                value={item}
                onChange={(newVal) => updateItem(index, newVal)}
                disabled={disabled}
                copy={copy}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={addItem}
          disabled={disabled}
        >
          + {copy.addItem || 'Add Item'}
        </button>
      </fieldset>
    );
  }

  return (
    <div className="form-field">
      <label htmlFor={path.join('.')}>{label}</label>
      <RenderControl
        id={path.join('.')}
        schema={schema}
        value={value}
        onChange={onChange}
        disabled={disabled}
        copy={copy}
      />
      {schema.description ? <span className="field-hint">{schema.description}</span> : null}
    </div>
  );
}

function RenderControl({
  id,
  schema,
  value,
  onChange,
  disabled,
  copy
}: {
  id: string;
  schema: SchemaProperty;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  copy: Record<string, string>;
}) {
  const type = schema.type;

  if (schema.enum && Array.isArray(schema.enum)) {
    const stringVal = value !== undefined && value !== null ? String(value) : '';
    return (
      <select
        id={id}
        value={stringVal}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="form-control"
      >
        {!schema.enum.includes(value) ? <option value="">-- {copy.select || 'Select'} --</option> : null}
        {schema.enum.map((opt: any) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'boolean') {
    return (
      <label className="toggle-label">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>{value ? (copy.enabled || 'Enabled') : (copy.disabled || 'Disabled')}</span>
      </label>
    );
  }

  if (type === 'integer' || type === 'number') {
    const numVal = value !== undefined && value !== null ? Number(value) : '';
    return (
      <input
        id={id}
        type="number"
        value={numVal}
        min={schema.minimum}
        max={schema.maximum}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        className="form-control"
      />
    );
  }

  if (type === 'string') {
    const isColor = schema.pattern?.includes('#') || id.includes('color') || id.includes('primary') || id.includes('secondary') || id.includes('background') || id.includes('text_color');
    const strVal = value !== undefined && value !== null ? String(value) : '';

    if (isColor) {
      const colorVal = /^#[0-9a-fA-F]{6}$/.test(strVal) ? strVal : '#000000';
      return (
        <div className="color-picker-group">
          <input
            type="color"
            value={colorVal}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="color-input"
          />
          <input
            id={id}
            type="text"
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            disabled={disabled}
            className="form-control"
          />
        </div>
      );
    }

    if (schema.maxLength && schema.maxLength > 200) {
      return (
        <textarea
          id={id}
          value={strVal}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          maxLength={schema.maxLength}
          disabled={disabled}
          className="form-control"
        />
      );
    }

    return (
      <input
        id={id}
        type="text"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        maxLength={schema.maxLength}
        disabled={disabled}
        className="form-control"
      />
    );
  }

  return (
    <div className="notice notice-warning">
      {copy.unsupportedField || 'Unsupported field type/schema construct'}: {type || 'unknown'}
    </div>
  );
}

function formatFieldName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deepSet(obj: Record<string, any>, path: string[], value: any): Record<string, any> {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  const copyObj = { ...(obj || {}) };

  if (tail.length === 0) {
    copyObj[head] = value;
  } else {
    copyObj[head] = deepSet(copyObj[head] || {}, tail, value);
  }

  return copyObj;
}

function createDefaultForSchema(schema: SchemaProperty): any {
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 0;
  if (schema.type === 'string') return '';
  if (schema.type === 'object' && schema.properties) {
    const res: Record<string, any> = {};
    for (const [k, s] of Object.entries(schema.properties)) {
      res[k] = createDefaultForSchema(s);
    }
    return res;
  }
  if (schema.type === 'array') return [];
  return null;
}

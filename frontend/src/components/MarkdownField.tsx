import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

export default function MarkdownField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  rows = 4,
}: MarkdownFieldProps) {
  const [previewing, setPreviewing] = useState(false);

  return (
    <div className="form-field">
      <div className="form-field-header">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="preview-toggle"
          onClick={() => setPreviewing((p) => !p)}
        >
          {previewing ? "Edit" : "Preview"}
        </button>
      </div>
      {previewing ? (
        <div className="markdown-preview markdown-body">
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="preview-empty">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={rows}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField(props: {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={props.id}>{props.label}</label>
      <div className="password-control">
        <input
          autoComplete={props.autoComplete}
          id={props.id}
          name={props.name}
          type={visible ? "text" : "password"}
          value={props.value}
          aria-describedby={props.describedBy}
          required={props.required ?? true}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          aria-label={visible ? `Sembunyikan ${props.label.toLowerCase()}` : `Tampilkan ${props.label.toLowerCase()}`}
          aria-pressed={visible}
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </div>
  );
}


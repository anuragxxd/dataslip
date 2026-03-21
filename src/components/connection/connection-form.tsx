import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { InputRenderable } from "@opentui/core";
import { useTheme } from "../../theme";
import { useConnectionsStore } from "../../store/connections";
import { useUIStore } from "../../store/ui";
import { Dialog } from "../ui/dialog";
import { KeybindBar } from "../ui/keybind-bar";
import { showToast } from "../ui/toast";
import type { ConnectionConfig } from "../../db/types";

interface FormField {
  key: string;
  label: string;
  placeholder: string;
}

const FIELD_DEFS: FormField[] = [
  { key: "name", label: "Name", placeholder: "My Database" },
  { key: "host", label: "Host", placeholder: "localhost" },
  { key: "port", label: "Port", placeholder: "5432" },
  { key: "database", label: "Database", placeholder: "mydb" },
  { key: "username", label: "Username", placeholder: "postgres" },
  { key: "password", label: "Password", placeholder: "" },
];

const LABEL_WIDTH = 11;
const SSL_FIELD_INDEX = FIELD_DEFS.length;

interface ConnectionFormProps {
  editConnection?: ConnectionConfig;
}

export function ConnectionForm({ editConnection }: ConnectionFormProps) {
  const theme = useTheme();
  const {
    addConnection,
    updateConnection,
    testConnectionConfig,
    isTesting,
    testResult,
    clearTestResult,
  } = useConnectionsStore();
  const { closeDialog } = useUIStore();

  const [values, setValues] = useState<Record<string, string>>({
    name: editConnection?.name || "",
    host: editConnection?.host || "localhost",
    port: editConnection?.port?.toString() || "5432",
    database: editConnection?.database || "",
    username: editConnection?.username || "",
    password: editConnection?.password || "",
  });
  const [sslEnabled, setSslEnabled] = useState(
    editConnection ? editConnection.ssl !== "disable" : false
  );
  const [focusedField, setFocusedField] = useState(0);
  const inputRefs = useRef<Array<InputRenderable | null>>([]);

  useEffect(() => {
    if (focusedField > SSL_FIELD_INDEX - 1) return;
    setTimeout(() => {
      const target = inputRefs.current[focusedField];
      if (!target || target.isDestroyed) return;
      target.focus();
    }, 1);
  }, [focusedField]);

  const statusText = useMemo(() => {
    if (isTesting) {
      return <text fg={theme.warning}>Testing...</text>;
    }

    if (testResult?.ok) {
      return <text fg={theme.success}>OK ({testResult.latency}ms)</text>;
    }

    if (testResult && !testResult.ok) {
      return <text fg={theme.error}>Error: {testResult.error}</text>;
    }

    return null;
  }, [isTesting, testResult, theme.error, theme.success, theme.warning]);

  const buildConfig = useCallback(() => {
    return {
      name: values.name || "Unnamed",
      host: values.host || "localhost",
      port: parseInt(values.port, 10) || 5432,
      database: values.database,
      username: values.username,
      password: values.password,
      ssl: sslEnabled ? ("require" as const) : ("disable" as const),
    };
  }, [sslEnabled, values]);

  const validate = useCallback(() => {
    if (!values.database.trim() || !values.username.trim()) {
      return "Database and username are required";
    }

    const port = parseInt(values.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "Port must be between 1 and 65535";
    }

    return null;
  }, [values.database, values.port, values.username]);

  const handleSave = useCallback(() => {
    const error = validate();
    if (error) {
      showToast(error, "error");
      return;
    }

    const config = buildConfig();
    if (editConnection) {
      updateConnection(editConnection.id, config);
      showToast("Connection updated", "success");
    } else {
      addConnection(config);
      showToast("Connection saved", "success");
    }
    closeDialog();
  }, [addConnection, buildConfig, closeDialog, editConnection, updateConnection, validate]);

  const handleTest = useCallback(async () => {
    const error = validate();
    if (error) {
      showToast(error, "error");
      return;
    }

    clearTestResult();
    await testConnectionConfig(buildConfig());
  }, [buildConfig, clearTestResult, testConnectionConfig, validate]);

  const handleFieldSubmit = useCallback(() => {
    if (focusedField < SSL_FIELD_INDEX) {
      setFocusedField((prev) => Math.min(SSL_FIELD_INDEX, prev + 1));
      return;
    }

    handleSave();
  }, [focusedField, handleSave]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "s") {
      handleSave();
    } else if (key.ctrl && key.name === "t") {
      void handleTest();
    } else if (key.name === "escape") {
      closeDialog();
    } else if (key.name === "tab") {
      if (key.shift) {
        setFocusedField((prev) => Math.max(0, prev - 1));
      } else {
        setFocusedField((prev) => Math.min(SSL_FIELD_INDEX, prev + 1));
      }
    } else if (focusedField === SSL_FIELD_INDEX) {
      if (
        key.name === "return" ||
        key.name === "space" ||
        key.sequence === " " ||
        key.name === "left" ||
        key.name === "right" ||
        key.name === "h" ||
        key.name === "l"
      ) {
        clearTestResult();
        setSslEnabled((prev) => !prev);
      } else {
        return;
      }
    } else {
      return;
    }

    key.stopPropagation();
  });

  return (
    <Dialog
      title={editConnection ? "Edit Connection" : "New Connection"}
      width={52}
      height={FIELD_DEFS.length * 2 + 10}
    >
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {FIELD_DEFS.map((field, idx) => {
          const isFocused = idx === focusedField;

          return (
            <box
              key={field.key}
              style={{
                flexDirection: "row",
                height: 1,
                alignItems: "center",
              }}
            >
              <box style={{ width: LABEL_WIDTH }}>
                <text fg={isFocused ? theme.accent : theme.textDim}>
                  {isFocused ? "▸" : " "} {field.label}
                </text>
              </box>
              <input
                ref={(value) => {
                  inputRefs.current[idx] = value;
                }}
                value={values[field.key]}
                placeholder={field.placeholder}
                focused={isFocused}
                textColor={isFocused ? theme.textBright : theme.text}
                backgroundColor="transparent"
                focusedBackgroundColor={theme.bgHighlight}
                placeholderColor={theme.textMuted}
                cursorColor={theme.accent}
                maxLength={500}
                onInput={(value: string) => {
                  clearTestResult();
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: field.key === "port"
                      ? value.replace(/[^0-9]/g, "")
                      : value,
                  }));
                }}
                onSubmit={handleFieldSubmit}
                style={{ flexGrow: 1 }}
              />
            </box>
          );
        })}

        <box
          style={{
            flexDirection: "row",
            height: 1,
            alignItems: "center",
            paddingTop: 1,
          }}
        >
          <box style={{ width: LABEL_WIDTH }}>
            <text fg={focusedField === SSL_FIELD_INDEX ? theme.accent : theme.textDim}>
              {focusedField === SSL_FIELD_INDEX ? "▸" : " "} SSL
            </text>
          </box>
          <text fg={focusedField === SSL_FIELD_INDEX ? theme.textBright : theme.text}>
            [{sslEnabled ? "x" : " "}] Enable SSL
          </text>
        </box>
      </box>

      {statusText && <box style={{ paddingTop: 1 }}>{statusText}</box>}

      <box style={{ paddingTop: 1 }}>
        <KeybindBar
          bindings={[
            { key: "Tab", label: "Next" },
            { key: "Enter", label: "Next/Save" },
            { key: "Space", label: "Toggle SSL" },
            { key: "Ctrl+S", label: "Save" },
            { key: "Ctrl+T", label: "Test" },
            { key: "Esc", label: "Close" },
          ]}
        />
      </box>
    </Dialog>
  );
}

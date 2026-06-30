use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const SETTINGS_DIR_NAME: &str = "ccusage-gui-for-mac";
const SETTINGS_FILE_NAME: &str = "settings.json";
const MIN_NODE_MAJOR: u32 = 20;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiTool {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentStatus {
    pub node_installed: bool,
    pub node_version: Option<String>,
    pub node_major: Option<u32>,
    pub node_meets_requirement: bool,
    pub ccusage_installed: bool,
    pub ccusage_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub active_tool_ids: Vec<String>,
    pub last_selected_tool_id: Option<String>,
    pub last_time_range_id: String,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(default = "default_language")]
    pub language: String,
}

#[tauri::command]
async fn check_environment() -> EnvironmentStatus {
    let node_version = run_shell_capture_blocking("node --version".to_string()).await.ok().map(clean_output);
    let node_major = node_version.as_deref().and_then(parse_node_major_version);
    let ccusage_version = run_shell_capture_blocking("ccusage --version".to_string()).await.ok().map(clean_output);

    EnvironmentStatus {
        node_installed: node_version.is_some(),
        node_version,
        node_major,
        node_meets_requirement: node_major.map(|major| major >= MIN_NODE_MAJOR).unwrap_or(false),
        ccusage_installed: ccusage_version.is_some(),
        ccusage_version,
    }
}

#[tauri::command]
async fn install_ccusage() -> Result<InstallResult, String> {
    let output = run_shell_blocking("npm install -g ccusage".to_string()).await?;

    Ok(InstallResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

#[tauri::command]
async fn list_supported_tools() -> Result<Vec<AiTool>, String> {
    let help_text = run_shell_capture_blocking("ccusage --help".to_string()).await?;
    Ok(parse_supported_tools(&help_text))
}

#[tauri::command]
async fn load_usage(tool: String, since: String) -> Result<Value, String> {
    validate_tool_id(&tool)?;
    validate_since(&since)?;

    let command = format!("ccusage {} session --since {} --json", tool, since);
    let stdout = run_shell_capture_blocking(command).await?;
    let mut report: Value = serde_json::from_str(&stdout).map_err(|error| {
        format!("Failed to parse ccusage JSON output: {error}")
    })?;

    attach_created_at_fields(&mut report);
    Ok(report)
}

#[tauri::command]
fn load_session_created_at(session_file: String) -> Result<Option<String>, String> {
    derive_session_created_at(&PathBuf::from(session_file))
}

#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(default_settings());
    }

    let contents = fs::read_to_string(path).map_err(|error| format!("Failed to read settings: {error}"))?;
    serde_json::from_str(&contents).map_err(|error| format!("Failed to parse settings: {error}"))
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create settings directory: {error}"))?;
    }

    let contents = serde_json::to_string_pretty(&settings).map_err(|error| format!("Failed to serialize settings: {error}"))?;
    fs::write(path, contents).map_err(|error| format!("Failed to write settings: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_environment,
            install_ccusage,
            list_supported_tools,
            load_usage,
            load_session_created_at,
            get_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn run_shell_capture_blocking(script: String) -> Result<String, String> {
    let output = run_shell_blocking(script).await?;
    if !output.status.success() {
        return Err(clean_output(String::from_utf8_lossy(&output.stderr).to_string()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn run_shell_blocking(script: String) -> Result<std::process::Output, String> {
    let script_for_error = script.clone();
    tauri::async_runtime::spawn_blocking(move || run_shell(&script))
        .await
        .map_err(|error| format!("Failed to join command `{script_for_error}`: {error}"))?
}

fn run_shell(script: &str) -> Result<std::process::Output, String> {
    Command::new("/bin/sh")
        .arg("-c")
        .arg(script)
        .env("PATH", command_path())
        .output()
        .map_err(|error| format!("Failed to run command `{script}`: {error}"))
}

fn command_path() -> String {
    let home = env::var("HOME").ok().map(PathBuf::from);
    let current_path = env::var("PATH").unwrap_or_default();
    build_command_path(home.as_deref(), &current_path)
}

fn build_command_path(home: Option<&Path>, current_path: &str) -> String {
    let mut paths = Vec::new();

    if let Some(home) = home {
        collect_node_manager_paths(home, &mut paths);
    }

    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/local/sbin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/sbin"),
    ]);

    paths.extend(current_path.split(':').filter(|path| !path.is_empty()).map(PathBuf::from));

    dedupe_paths(paths)
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(":")
}

fn collect_node_manager_paths(home: &Path, paths: &mut Vec<PathBuf>) {
    paths.push(home.join(".nvm").join("current").join("bin"));
    collect_child_bin_dirs(&home.join(".nvm").join("versions").join("node"), paths);

    paths.push(home.join(".volta").join("bin"));
    paths.push(home.join(".asdf").join("shims"));
    paths.push(home.join(".local").join("share").join("mise").join("shims"));
    paths.push(home.join(".mise").join("shims"));
    collect_fnm_bin_dirs(home, paths);
}

fn collect_child_bin_dirs(parent: &Path, paths: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(parent) else {
        return;
    };

    let mut version_dirs = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();
    version_dirs.sort();
    version_dirs.reverse();

    for version_dir in version_dirs {
        paths.push(version_dir.join("bin"));
    }
}

fn collect_fnm_bin_dirs(home: &Path, paths: &mut Vec<PathBuf>) {
    for parent in [
        home.join(".fnm").join("node-versions"),
        home.join("Library").join("Application Support").join("fnm").join("node-versions"),
    ] {
        let Ok(entries) = fs::read_dir(parent) else {
            continue;
        };

        let mut version_dirs = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect::<Vec<_>>();
        version_dirs.sort();
        version_dirs.reverse();

        for version_dir in version_dirs {
            paths.push(version_dir.join("installation").join("bin"));
        }
    }
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for path in paths {
        let path_string = path.to_string_lossy().to_string();
        if seen.insert(path_string) {
            deduped.push(path);
        }
    }

    deduped
}

fn clean_output(value: String) -> String {
    value.trim().to_string()
}

fn parse_node_major_version(version: &str) -> Option<u32> {
    version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|value| value.parse::<u32>().ok())
}

fn parse_supported_tools(help_text: &str) -> Vec<AiTool> {
    let aggregate_commands: HashSet<&str> = ["ccusage", "daily", "monthly", "weekly", "session", "blocks", "statusline"]
        .into_iter()
        .collect();

    help_text
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            let command = trimmed.split_whitespace().next()?;

            if !line.starts_with("  ") || aggregate_commands.contains(command) || !is_safe_tool_id(command) {
                return None;
            }

            Some(AiTool {
                id: command.to_string(),
                label: tool_label(command),
            })
        })
        .collect()
}

fn tool_label(id: &str) -> String {
    match id {
        "amp" => "Amp".to_string(),
        "claude" => "Claude Code".to_string(),
        "codebuff" => "Codebuff".to_string(),
        "codex" => "Codex".to_string(),
        "copilot" => "GitHub Copilot".to_string(),
        "droid" => "Droid".to_string(),
        "gemini" => "Gemini".to_string(),
        "goose" => "Goose".to_string(),
        "hermes" => "Hermes".to_string(),
        "kilo" => "Kilo".to_string(),
        "kimi" => "Kimi".to_string(),
        "openclaw" => "OpenClaw".to_string(),
        "opencode" => "OpenCode".to_string(),
        "pi" => "pi-agent".to_string(),
        "qwen" => "Qwen".to_string(),
        other => title_case(other),
    }
}

fn title_case(value: &str) -> String {
    value
        .split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn validate_tool_id(tool: &str) -> Result<(), String> {
    if is_safe_tool_id(tool) {
        Ok(())
    } else {
        Err("Invalid tool id".to_string())
    }
}

fn is_safe_tool_id(tool: &str) -> bool {
    !tool.is_empty() && tool.chars().all(|char| char.is_ascii_lowercase() || char.is_ascii_digit() || char == '-')
}

fn validate_since(since: &str) -> Result<(), String> {
    if since.len() == 8 && since.chars().all(|char| char.is_ascii_digit()) {
        Ok(())
    } else {
        Err("Invalid since date; expected YYYYMMDD".to_string())
    }
}

fn attach_created_at_fields(report: &mut Value) {
    if let Some(sessions) = report.get_mut("sessions").and_then(Value::as_array_mut) {
        for session in sessions {
            let Some(object) = session.as_object_mut() else {
                continue;
            };

            if object.get("createdAt").is_some() {
                continue;
            }

            let created_at = object
                .get("sessionFile")
                .and_then(Value::as_str)
                .and_then(|path| derive_session_created_at(&PathBuf::from(path)).ok().flatten());

            object.insert(
                "createdAt".to_string(),
                created_at.map(Value::String).unwrap_or(Value::Null),
            );
        }
    }
}

fn derive_session_created_at(path: &PathBuf) -> Result<Option<String>, String> {
    let contents = fs::read_to_string(path).map_err(|error| format!("Failed to read session file: {error}"))?;
    Ok(derive_session_created_at_from_text(&contents))
}

fn derive_session_created_at_from_text(contents: &str) -> Option<String> {
    let mut candidates = Vec::new();

    for line in contents.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            collect_timestamp_candidates(&value, &mut candidates);
        }
    }

    if candidates.is_empty() {
        if let Ok(value) = serde_json::from_str::<Value>(contents) {
            collect_timestamp_candidates(&value, &mut candidates);
        }
    }

    candidates.into_iter().min()
}

fn collect_timestamp_candidates(value: &Value, candidates: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            for (key, nested) in object {
                if is_timestamp_key(key) {
                    if let Some(timestamp) = nested.as_str().filter(|value| looks_like_timestamp(value)) {
                        candidates.push(timestamp.to_string());
                    }
                }
                collect_timestamp_candidates(nested, candidates);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_timestamp_candidates(item, candidates);
            }
        }
        _ => {}
    }
}

fn is_timestamp_key(key: &str) -> bool {
    matches!(
        key,
        "timestamp" | "created_at" | "createdAt" | "time" | "date" | "startTime"
    )
}

fn looks_like_timestamp(value: &str) -> bool {
    value.len() >= 10 && value.as_bytes().get(4) == Some(&b'-') && value.as_bytes().get(7) == Some(&b'-')
}

fn settings_path() -> Result<PathBuf, String> {
    let home = env::var("HOME").map_err(|_| "Cannot determine HOME for settings storage".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join(SETTINGS_DIR_NAME)
        .join(SETTINGS_FILE_NAME))
}

fn default_settings() -> AppSettings {
    AppSettings {
        active_tool_ids: vec!["codex".to_string()],
        last_selected_tool_id: Some("codex".to_string()),
        last_time_range_id: "7d".to_string(),
        theme_mode: default_theme_mode(),
        language: default_language(),
    }
}

fn default_theme_mode() -> String {
    "system".to_string()
}

fn default_language() -> String {
    "zh-CN".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_node_major_version() {
        assert_eq!(parse_node_major_version("v22.22.0"), Some(22));
        assert_eq!(parse_node_major_version("20.11.1"), Some(20));
        assert_eq!(parse_node_major_version("missing"), None);
    }

    #[test]
    fn parses_supported_tools_from_help() {
        let help = "COMMANDS:\n  daily   Daily report\n  codex   Show Codex token usage commands\n  goose   Show Goose usage commands\n\nFor more info:\n  ccusage daily --help\n";
        assert_eq!(
            parse_supported_tools(help),
            vec![
                AiTool {
                    id: "codex".to_string(),
                    label: "Codex".to_string()
                },
                AiTool {
                    id: "goose".to_string(),
                    label: "Goose".to_string()
                }
            ]
        );
    }

    #[test]
    fn rejects_unsafe_tool_ids() {
        assert!(validate_tool_id("codex").is_ok());
        assert!(validate_tool_id("codex;rm").is_err());
        assert!(validate_tool_id("../codex").is_err());
    }

    #[test]
    fn validates_since_date_shape() {
        assert!(validate_since("20260629").is_ok());
        assert!(validate_since("2026-06-29").is_err());
    }

    #[test]
    fn command_path_includes_nvm_node_versions_before_system_paths() {
        let home = env::temp_dir().join(format!("ccusage-gui-test-{}", std::process::id()));
        let nvm_bin = home.join(".nvm").join("versions").join("node").join("v22.22.0").join("bin");
        fs::create_dir_all(&nvm_bin).expect("create nvm test dir");

        let path = build_command_path(Some(&home), "/usr/bin:/bin");

        assert!(path.starts_with(&format!(
            "{}:{}",
            home.join(".nvm").join("current").join("bin").to_string_lossy(),
            nvm_bin.to_string_lossy()
        )));
        assert!(path.contains("/opt/homebrew/bin"));
        assert!(path.ends_with("/usr/sbin:/sbin"));

        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn blocking_shell_capture_can_be_awaited() {
        let output = tauri::async_runtime::block_on(run_shell_capture_blocking("printf async-ready".to_string()))
            .expect("run blocking shell command");

        assert_eq!(output, "async-ready");
    }

    #[test]
    fn derives_earliest_timestamp_from_json_lines() {
        let contents = r#"{"timestamp":"2026-06-29T09:00:00Z"}
{"timestamp":"2026-06-28T20:00:00Z"}"#;

        assert_eq!(
            derive_session_created_at_from_text(contents),
            Some("2026-06-28T20:00:00Z".to_string())
        );
    }
}

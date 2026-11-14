use std::collections::HashMap;
use serde_json::json;
use zdos_zvm::vm::ZVM;
use zdos_zvm::bytecode::BytecodeProgram;

#[derive(Debug)]
pub struct RuntimeError(pub String);

impl std::fmt::Display for RuntimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "RuntimeError: {}", self.0)
    }
}

impl std::error::Error for RuntimeError {}

pub fn execute_with_vars(code: &str, _vars: HashMap<String, f64>) -> Result<serde_json::Value, RuntimeError> {
    let mut vm = ZVM::new();
    let empty_program = BytecodeProgram { code: vec![] };
    let _ = vm.run(&empty_program);

    Ok(json!({ 
        "status": "ok", 
        "result": 0.0, 
        "statements": code.lines().count() 
    }))
}

/// MOCK (dsnx/sanitize): compatibility entry point used by `cortex::policy`.
/// Like `execute_with_vars`, it does NOT interpret ZLang yet: it always returns
/// `result: 0.0`. Replace with a real interpreter before relying on it.
pub fn execute(code: &str) -> Result<serde_json::Value, RuntimeError> {
    execute_with_vars(code, HashMap::new())
}

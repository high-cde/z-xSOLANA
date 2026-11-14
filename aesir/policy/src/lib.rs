//! Æsir policy engine: pure decision logic, testable without stdin.
use serde::{Deserialize, Serialize};

pub const DEFAULT_LIMIT: u64 = 500_000_000;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Intent {
    pub asset: String,
    pub amount_atomic: u64,
    pub destination: String,
    pub network_constraints: Vec<String>,
    pub requester: String,
    #[serde(default)]
    pub hourly_limit_override: Option<u64>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ApprovalToken {
    pub approved: bool,
    pub reason: String,
    pub token_hash: String,
    pub expires_unix: u64,
}

fn denied(reason: &str) -> ApprovalToken {
    ApprovalToken { approved: false, reason: reason.into(), token_hash: String::new(), expires_unix: 0 }
}

/// Approve only if amount <= limit and at least one constraint routes via tor/onion.
pub fn evaluate(intent: &Intent) -> ApprovalToken {
    let limit = intent.hourly_limit_override.unwrap_or(DEFAULT_LIMIT);
    if limit == 0 {
        return denied("Policy denied: zero limit");
    }
    if intent.amount_atomic > limit {
        return denied("Policy denied: amount over limit");
    }
    let via_tor = intent
        .network_constraints
        .iter()
        .any(|c| { let c = c.to_ascii_lowercase(); c.contains("tor") || c.contains("onion") });
    if !via_tor {
        return denied("Policy denied: tor/onion route required");
    }
    ApprovalToken { approved: true, reason: "OK".into(), token_hash: format!("zdos-{:x}", intent.amount_atomic), expires_unix: 0 }
}

/// Parse raw JSON; malformed input is always denied (fail-closed).
pub fn evaluate_json(input: &str) -> ApprovalToken {
    match serde_json::from_str::<Intent>(input) {
        Ok(i) => evaluate(&i),
        Err(_) => denied("Policy denied: malformed intent"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn intent(amount: u64, nets: &[&str], ovr: Option<u64>) -> Intent {
        Intent { asset: "ZEPH".into(), amount_atomic: amount, destination: "x".into(),
            network_constraints: nets.iter().map(|s| s.to_string()).collect(), requester: "kira".into(),
            hourly_limit_override: ovr }
    }
    #[test] fn approves_small_amount_over_tor() { assert!(evaluate(&intent(1_000_000, &["tor"], None)).approved); }
    #[test] fn approves_onion_case_insensitive() { assert!(evaluate(&intent(1, &["ONION-v3"], None)).approved); }
    #[test] fn denies_without_tor() { assert!(!evaluate(&intent(1, &["clearnet"], None)).approved); }
    #[test] fn denies_empty_constraints() { assert!(!evaluate(&intent(1, &[], None)).approved); }
    #[test] fn boundary_default_limit() {
        assert!(evaluate(&intent(DEFAULT_LIMIT, &["tor"], None)).approved);
        assert!(!evaluate(&intent(DEFAULT_LIMIT + 1, &["tor"], None)).approved);
    }
    #[test] fn override_raises_limit() { assert!(evaluate(&intent(5_000_000_000, &["tor"], Some(5_000_000_000))).approved); }
    #[test] fn zero_override_denies_everything() { assert!(!evaluate(&intent(0, &["tor"], Some(0))).approved); }
    #[test] fn malformed_json_denied() { assert!(!evaluate_json("not json").approved); }
    #[test] fn json_roundtrip_without_override() {
        let t = evaluate_json(r#"{"asset":"ZEPH","amount_atomic":10,"destination":"d","network_constraints":["tor"],"requester":"kira"}"#);
        assert!(t.approved); assert_eq!(t.token_hash, "zdos-a");
    }
}

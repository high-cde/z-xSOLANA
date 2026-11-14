use policy_engine::evaluate_json;
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).ok();
    println!("{}", serde_json::to_string(&evaluate_json(&input)).unwrap());
}

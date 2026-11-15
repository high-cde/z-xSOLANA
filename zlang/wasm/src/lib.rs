//! Wrapper WASM: espone il vero `Compiler` e la vera `ZVirtualMachine` di ZLang
//! (stessi file sorgente di `zlang/src/`, inclusi via #[path], non copiati).
//! ABI minimale senza wasm-bindgen: alloc/dealloc + funzioni che restituiscono
//! un puntatore a un buffer [len u32 LE][utf8 bytes].

#[path = "../../src/compiler/mod.rs"]
pub mod compiler;
#[path = "../../src/vm/mod.rs"]
pub mod vm;

use compiler::Compiler;
use vm::ZVirtualMachine;

#[no_mangle]
pub extern "C" fn zl_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len);
    let p = buf.as_mut_ptr();
    std::mem::forget(buf);
    p
}

#[no_mangle]
pub unsafe extern "C" fn zl_free(ptr: *mut u8, cap: usize) {
    drop(Vec::from_raw_parts(ptr, 0, cap));
}

fn pack(s: String) -> *mut u8 {
    let bytes = s.into_bytes();
    let mut out = Vec::with_capacity(bytes.len() + 4);
    out.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    out.extend_from_slice(&bytes);
    let p = out.as_mut_ptr();
    std::mem::forget(out);
    p
}

unsafe fn input(ptr: *const u8, len: usize) -> String {
    let slice = std::slice::from_raw_parts(ptr, len);
    String::from_utf8_lossy(slice).into_owned()
}

/// Compila con `Compiler::compile` e restituisce le istruzioni, una per riga.
#[no_mangle]
pub unsafe extern "C" fn zl_compile(ptr: *const u8, len: usize) -> *mut u8 {
    let src = input(ptr, len);
    let mut c = Compiler::new();
    pack(c.compile(&src).join("\n"))
}

/// Compila e poi esegue sulla `ZVirtualMachine` (vCPU 4 KB, max 3000 cicli).
#[no_mangle]
pub unsafe extern "C" fn zl_run(ptr: *const u8, len: usize) -> *mut u8 {
    let src = input(ptr, len);
    let mut c = Compiler::new();
    let instr = c.compile(&src);
    let mut vm = ZVirtualMachine::new();
    pack(vm.execute(instr))
}

#[no_mangle]
pub extern "C" fn zl_version() -> *mut u8 {
    pack(format!("zdos-zlang 2026.2.0 (src/compiler + src/vm) via WASM"))
}

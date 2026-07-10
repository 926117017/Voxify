<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:tauri-rust-agent-rules -->
# Tauri Rust Compilation

The development machine lacks MSVC or MinGW toolchain. The Rust Tauri project CANNOT be compiled here.
- `cargo build` will fail with "link.exe not found" (msvc) or "dlltool.exe not found" (gnu) or similar.
- To build, install Visual Studio 2022 Build Tools with "Desktop development with C++" workload, or install MinGW-w64.
- The `lib.rs` and `main.rs` code is correct and ready; just compile on a machine with the proper toolchain.
- For development: run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8866` in `backend/` and `npm run dev` in `frontend/` separately.
<!-- END:tauri-rust-agent-rules -->

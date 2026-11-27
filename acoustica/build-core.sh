#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
clang++ --target=wasm32 -std=c++20 -O3 -nostdlib -fno-builtin -Wl,--no-entry -Wl,--export-memory -Wl,--export=input -Wl,--export=output -Wl,--export=metrics -Wl,--export=analyze -Wl,--export=pitch -Wl,--export=field_init -Wl,--export=field_dt -Wl,--export=field_p -Wl,--export=field_u -Wl,--export=field_v -Wl,--export=field_step -Wl,--allow-undefined -Wl,--initial-memory=4194304 core.cpp -o core.wasm

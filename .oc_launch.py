#!/usr/bin/env python3
"""Robust OpenCode launcher for InKnowing PG migration.
Reads KIMI key from lisa/.env in pure Python (no shell mangling), sets a clean
env, and exec's opencode with the built-in kimi-for-coding provider.
Usage: python3 .oc_launch.py run 'prompt...'  [extra opencode args]
"""
import os, sys

LISA_ENV = "/home/elttilz/.hermes/profiles/lisa/.env"
JOEY_HOME = "/home/elttilz/.hermes/profiles/joey/home"

key = None
with open(LISA_ENV) as f:
    for line in f:
        if line.split("=", 1)[0].strip() == "KIMI_API_KEY" and "=" in line:
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
if not key:
    sys.stderr.write("FATAL: KIMI_API_KEY not found in lisa/.env\n")
    sys.exit(2)

env = dict(os.environ)
env["HOME"] = JOEY_HOME
env["KIMI_API_KEY"] = key

# Default to the built-in provider/model unless caller overrides --model
args = sys.argv[1:]
if "--model" not in args and len(args) >= 1 and args[0] == "run":
    args = [args[0], "--model", "kimi-for-coding/k2p6"] + args[1:]

os.execvpe("opencode", ["opencode"] + args, env)

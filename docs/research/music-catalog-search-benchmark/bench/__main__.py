"""`python -m bench <command>`: see run.sh and README.md for the workflow."""

import argparse

from bench import (
    export,
    loaders,
    lyrics,
    queries,
    ops,
    report,
    runner,
    throughput,
)


def main() -> None:
    parser = argparse.ArgumentParser(prog="bench")
    sub = parser.add_subparsers(dest="command", required=True)
    for module in (export, queries, loaders, runner, report, throughput, ops, lyrics):
        module.register(sub)
    args = parser.parse_args()
    args.func(args)


main()

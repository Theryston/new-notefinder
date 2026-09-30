"""Load the exported documents into one engine, one stage (quarter of the
sample) at a time."""

from bench import meili, sonic


def register(sub) -> None:
    for name, func, text in (
        ("sonic-load", lambda a: sonic.load_stage(a.stage), "push one stage to Sonic"),
        ("meili-load", lambda a: meili.load_stage(a.stage), "add one stage to Meilisearch"),
    ):
        parser = sub.add_parser(name, help=text)
        parser.add_argument("--stage", type=int, required=True, choices=[1, 2, 3, 4])
        parser.set_defaults(func=func)

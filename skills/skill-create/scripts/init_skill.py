#!/usr/bin/env python3
"""Create a portable Agent Skill skeleton."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ALLOWED_RESOURCES = {"references", "scripts", "assets"}


def normalize_name(raw: str) -> str:
    name = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    name = re.sub(r"-{2,}", "-", name)
    return name


def titleize(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split("-"))


def parse_resources(raw: str) -> list[str]:
    if not raw:
        return []
    resources = [part.strip() for part in raw.split(",") if part.strip()]
    unknown = sorted(set(resources) - ALLOWED_RESOURCES)
    if unknown:
        raise ValueError(f"unknown resource(s): {', '.join(unknown)}")
    return sorted(set(resources), key=resources.index)


def write_skill(skill_dir: Path, name: str, resources: list[str], force: bool) -> None:
    if skill_dir.exists() and any(skill_dir.iterdir()) and not force:
        raise FileExistsError(f"{skill_dir} already exists; use --force to write into it")
    skill_dir.mkdir(parents=True, exist_ok=True)

    title = titleize(name)
    skill_md = skill_dir / "SKILL.md"
    if skill_md.exists() and not force:
        raise FileExistsError(f"{skill_md} already exists; use --force to overwrite")

    skill_md.write_text(
        f"""---
name: {name}
description: >
  [TODO: Describe what this skill does and when to use it. Include concrete
  trigger phrases, artifacts, file types, or platforms that should activate it.]
---

# {title}

Use this skill to [TODO: one-sentence operating purpose].

## Procedure

1. [TODO: first action]
2. [TODO: second action]
3. [TODO: validation or finalization step]

## Guardrails

- [TODO: important constraint or boundary]
- [TODO: what this skill should not do]
""",
        encoding="utf-8",
    )

    for resource in resources:
        (skill_dir / resource).mkdir(exist_ok=True)

    agents_dir = skill_dir / "agents"
    agents_dir.mkdir(exist_ok=True)
    (agents_dir / "openai.yaml").write_text(
        f"""interface:
  display_name: "{title}"
  short_description: "[TODO: 25-64 char UI description]"
  default_prompt: "Use ${name} to [TODO: example starting prompt]."
""",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="skill name or title")
    parser.add_argument("--path", type=Path, default=Path("skills"), help="parent output directory")
    parser.add_argument(
        "--resources",
        default="",
        help="comma-separated optional resources: references,scripts,assets",
    )
    parser.add_argument("--force", action="store_true", help="write into an existing directory")
    args = parser.parse_args()

    name = normalize_name(args.name)
    if not name:
        print("[ERROR] normalized skill name is empty", file=sys.stderr)
        return 1
    if len(name) > 64:
        print("[ERROR] normalized skill name exceeds 64 characters", file=sys.stderr)
        return 1

    try:
        resources = parse_resources(args.resources)
        skill_dir = args.path / name
        write_skill(skill_dir, name, resources, args.force)
    except Exception as exc:  # noqa: BLE001 - CLI should print any setup failure
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(skill_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())

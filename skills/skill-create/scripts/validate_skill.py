#!/usr/bin/env python3
"""Validate a portable Agent Skill folder."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MAX_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
PORTABLE_KEYS = {"name", "description", "license", "compatibility", "metadata"}


def parse_frontmatter(text: str) -> tuple[dict[str, object], list[str]]:
    warnings: list[str] = []
    if not text.startswith("---\n"):
        raise ValueError("SKILL.md must start with YAML frontmatter")
    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError("SKILL.md frontmatter is not closed with ---")
    raw = text[4:end]

    try:
        import yaml  # type: ignore

        data = yaml.safe_load(raw)
        if not isinstance(data, dict):
            raise ValueError("frontmatter must parse to a mapping")
        return data, warnings
    except ModuleNotFoundError:
        pass

    data: dict[str, object] = {}
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        if line.startswith((" ", "\t")):
            i += 1
            continue
        match = re.match(r"^([A-Za-z0-9_-]+):(?:\s*(.*))?$", line)
        if not match:
            warnings.append(f"limited parser skipped frontmatter line: {line!r}")
            i += 1
            continue
        key, value = match.group(1), (match.group(2) or "").strip()
        if value in {">", "|", ">-", "|-"}:
            block: list[str] = []
            i += 1
            while i < len(lines) and (lines[i].startswith(" ") or not lines[i].strip()):
                block.append(lines[i].strip())
                i += 1
            data[key] = " ".join(part for part in block if part)
            continue
        data[key] = value.strip('"').strip("'")
        i += 1
    return data, warnings


def validate(skill_dir: Path, strict: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return ["SKILL.md not found"], warnings

    try:
        data, parse_warnings = parse_frontmatter(skill_md.read_text())
        warnings.extend(parse_warnings)
    except Exception as exc:  # noqa: BLE001 - validation should report any parse failure
        return [str(exc)], warnings

    unknown = sorted(set(data) - PORTABLE_KEYS)
    if unknown:
        message = f"non-portable frontmatter keys: {', '.join(unknown)}"
        (errors if strict else warnings).append(message)

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("frontmatter.name is required and must be a string")
    else:
        name = name.strip()
        if len(name) > MAX_NAME_LENGTH:
            errors.append(f"name is too long ({len(name)} > {MAX_NAME_LENGTH})")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
            errors.append("name must use lowercase letters, digits, and single hyphens")
        if skill_dir.name != name:
            errors.append(f"folder name {skill_dir.name!r} must match frontmatter name {name!r}")

    description = data.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append("frontmatter.description is required and must be a string")
    else:
        description = " ".join(description.split())
        if len(description) > MAX_DESCRIPTION_LENGTH:
            errors.append(
                f"description is too long ({len(description)} > {MAX_DESCRIPTION_LENGTH})"
            )
        if len(description) < 80:
            warnings.append("description may be too short for reliable discovery")
        if "<" in description or ">" in description:
            warnings.append("description contains angle brackets; some agents reject them")

    for resource in ("references", "scripts", "assets"):
        path = skill_dir / resource
        if path.exists() and not path.is_dir():
            errors.append(f"{resource}/ exists but is not a directory")

    if "[TODO:" in skill_md.read_text() or "TODO:" in skill_md.read_text():
        warnings.append("SKILL.md still contains TODO placeholder text")

    linked_refs = set(re.findall(r"\((references/[^)]+\.md)\)", skill_md.read_text()))
    for ref in sorted(linked_refs):
        if not (skill_dir / ref).exists():
            errors.append(f"linked reference missing: {ref}")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_dir", type=Path)
    parser.add_argument("--strict", action="store_true", help="treat non-portable keys as errors")
    args = parser.parse_args()

    errors, warnings = validate(args.skill_dir, strict=args.strict)
    for warning in warnings:
        print(f"[WARN] {warning}")
    for error in errors:
        print(f"[ERROR] {error}")
    if errors:
        return 1
    print("Skill is valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())

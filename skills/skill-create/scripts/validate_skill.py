#!/usr/bin/env python3
"""Validate a portable Agent Skill folder."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MAX_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
MAX_COMPATIBILITY_LENGTH = 500
SOFT_BODY_LINE_LIMIT = 500
PORTABLE_KEYS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}


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


def frontmatter_line_count(text: str) -> int:
    end = text.find("\n---", 4)
    if end == -1:
        return 0
    return text[: end + 4].count("\n") + 1


def validate(skill_dir: Path, strict: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return ["SKILL.md not found"], warnings
    skill_text = skill_md.read_text()

    try:
        data, parse_warnings = parse_frontmatter(skill_text)
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
        if name.startswith("-") or name.endswith("-"):
            errors.append("name cannot start or end with a hyphen")
        if "--" in name:
            errors.append("name cannot contain consecutive hyphens")
        if not re.fullmatch(r"[a-z0-9-]+", name):
            errors.append("name must use only lowercase letters, digits, and hyphens")
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
        # 80 chars is a soft floor: shorter descriptions tend to omit trigger context.
        if len(description) < 80:
            warnings.append("description may be too short for reliable discovery")
        if "<" in description or ">" in description:
            warnings.append("description contains angle brackets; some agents reject them")

    compatibility = data.get("compatibility")
    if compatibility is not None:
        if not isinstance(compatibility, str):
            errors.append("frontmatter.compatibility must be a string when present")
        elif not compatibility.strip():
            errors.append("frontmatter.compatibility cannot be empty when present")
        elif len(compatibility.strip()) > MAX_COMPATIBILITY_LENGTH:
            errors.append(
                "compatibility is too long "
                f"({len(compatibility.strip())} > {MAX_COMPATIBILITY_LENGTH})"
            )

    body_lines = max(0, len(skill_text.splitlines()) - frontmatter_line_count(skill_text))
    if body_lines > SOFT_BODY_LINE_LIMIT:
        warnings.append(
            f"SKILL.md body is {body_lines} lines; spec recommends <= {SOFT_BODY_LINE_LIMIT}"
        )

    for resource in ("references", "scripts", "assets"):
        path = skill_dir / resource
        if path.exists() and not path.is_dir():
            errors.append(f"{resource}/ exists but is not a directory")

    if "[TODO:" in skill_text or "TODO:" in skill_text:
        warnings.append("SKILL.md still contains TODO placeholder text")

    linked_paths = set(
        re.findall(r"\(((?:references|scripts|assets)/[^)\s]+)\)", skill_text)
    )
    for linked_path in sorted(linked_paths):
        if not (skill_dir / linked_path).exists():
            errors.append(f"linked path missing: {linked_path}")

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

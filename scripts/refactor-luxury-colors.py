#!/usr/bin/env python3
"""One-off refactor: map legacy Tailwind classes to luxury theme tokens."""
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "src")

# Order matters: longer / more specific first
REPLACEMENTS = [
    # Legacy brand blue → walnut / ink
    ("bg-primary-dark/[0.06]", "bg-walnut/[0.06]"),
    ("bg-primary-dark/10", "bg-walnut/10"),
    ("ring-primary-dark/20", "ring-walnut/20"),
    ("ring-primary-dark/30", "ring-walnut/30"),
    ("focus:ring-primary-dark/20", "focus:ring-walnut/20"),
    ("focus:ring-primary-dark/30", "focus:ring-walnut/30"),
    ("hover:border-primary-dark/45", "hover:border-walnut/45"),
    ("accent-primary-dark", "accent-walnut"),
    ("group-hover:text-primary-dark", "group-hover:text-ink"),
    ("hover:text-primary-dark", "hover:text-ink"),
    ("focus:border-primary-dark", "focus:border-walnut"),
    ("focus:ring-primary-dark", "focus:ring-walnut"),
    ("border-primary-dark", "border-walnut"),
    ("text-primary-dark", "text-ink"),
    ("bg-primary-dark", "bg-walnut"),
    ("ring-primary-dark", "ring-walnut"),
    ("divide-primary-dark", "divide-walnut"),
    ("stroke-primary-dark", "stroke-walnut"),
    ("fill-primary-dark", "fill-walnut"),
    ("from-primary-dark", "from-walnut"),
    ("to-primary-dark", "to-walnut"),
    # Primary buttons: warm text on walnut
    ("bg-walnut text-white", "bg-walnut text-blush"),
    ("bg-walnut text-white ", "bg-walnut text-blush "),
    # Borders
    ("border-gray-100", "border-pale"),
    ("border-gray-200", "border-pale"),
    ("border-gray-300", "border-pale"),
    # Backgrounds (page + surfaces)
    ("bg-gray-50", "bg-cream"),
    ("bg-gray-100", "bg-blush"),
    ("bg-gray-200", "bg-pale"),
    # Text hierarchy
    ("text-gray-900", "text-ink"),
    ("text-gray-800", "text-ink"),
    ("text-gray-700", "text-mid"),
    ("text-gray-600", "text-mid"),
    ("text-gray-500", "text-muted"),
    ("text-gray-400", "text-muted"),
    ("text-gray-300", "text-muted"),
    ("placeholder:text-gray-400", "placeholder:text-muted"),
    ("placeholder:text-gray-500", "placeholder:text-muted"),
    # Hovers
    ("hover:bg-gray-50", "hover:bg-blush"),
    ("hover:bg-gray-100", "hover:bg-blush"),
    ("hover:bg-gray-200", "hover:bg-pale"),
    # Lighter shadows
    ("shadow-2xl", "shadow-sm"),
    ("shadow-xl", "shadow-sm"),
    ("shadow-lg", "shadow-sm"),
    ("shadow-md", "shadow-sm"),
    # Blue tints in shadows → warm
    ("shadow-blue-900/10", "shadow-walnut/10"),
    ("shadow-blue-900/5", "shadow-walnut/5"),
]

EXTRA_PER_FILE = [
    # AppRouter or index might reference primary-dark in route meta — grep separately
]


def process_file(path: str) -> bool:
    with open(path, "r", encoding="utf-8") as f:
        s = f.read()
    orig = s
    for old, new in REPLACEMENTS:
        s = s.replace(old, new)
    if s != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
        return True
    return False


def main():
    changed = []
    for dirpath, _, filenames in os.walk(ROOT):
        for name in filenames:
            if not name.endswith((".jsx", ".js", ".tsx", ".ts")):
                continue
            if name.endswith(".d.ts"):
                continue
            p = os.path.join(dirpath, name)
            if process_file(p):
                changed.append(os.path.relpath(p, ROOT))
    print(f"Updated {len(changed)} files")
    for c in sorted(changed)[:80]:
        print(" ", c)
    if len(changed) > 80:
        print(f" ... and {len(changed) - 80} more")


if __name__ == "__main__":
    main()

# Are We Design Tokens Yet?

This is a static site, built with 11ty that takes inspiration from code coverage
tools to show design token propagation.

## How it works

As part of the build process, a script runs on a customizable set of path
patterns looking for CSS files. For each CSS file it generates an Abstract
Syntax Tree (AST) and walks that to look for a set of CSS properties that we
would expect to point to design tokens.

For a given property the associated value is looked at to determine whether or
not it's using a design token, or if it's a value that should be ignored. These
are then counted and expressed as percentage.

These percentages are then averaged at the directory level, and overall to
provide a guide of where we are versus design tokens having fully propagated.

## Goals

The tool was built with the idea that this could provide a guideline for where
we are in terms of design token propagation.

It's not designed to have perfect understanding of the code it's looking at, so
there will be corner cases and areas that it doesn't process correctly. If you
find files that have examples of cases that aren't correctly identified please
file a bug. See also the known limitations and the bugs filed against them.

### Expected use-cases

- Identifying areas of code that don't currently make use of design tokens.
- Highlighting areas that might benefit from the creation of new design tokens.

## Known Limitations

- This tool doesn't have any knowledge of the DOM related to the CSS it's
  processing.
- Var resolution is limited to the current file by default, but can be extended
  to look at other files based on configuration. Only vars in :root or :host are
  considered.
- The list of design token properties may be subject to change and affect the
  calculation propagation percentages as a result.
- Values that take multiple arguments are currently glossed over, the presence
  of at least one Design Token var would be considered a pass. The rationale is
  that if one of the values resolves to a design token then the author is
  considering token use.
- Files that have no relevant properties are excluded from calculations.

## Development

By default the site assumes a checkout of mozilla-central is in
`../mozilla-unified` (above the source directory) but you can override that by
setting the `MOZILLA_CENTRAL_REPO_PATH` env var as needed.

- `npm install`
- `npm run build:data`
- `npm start`

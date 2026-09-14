# Adjustable map outlines

Navimower Map Card keeps the main mower-local map outlines independently configurable from YAML and the Visual Editor.

## Current defaults

The current installation defaults use the same thin `1.5` px width for every supported mower-local outline:

| Setting | YAML key | Default |
| --- | --- | ---: |
| Zone border width | `zone_stroke_width` | `1.5` |
| Off-limit border width | `off_limit_stroke_width` | `1.5` |
| VF-off border width | `vf_off_stroke_width` | `1.5` |
| Channel line width | `channel_stroke_width` | `1.5` |
| Gate area border width | `gate_area_stroke_width` | `1.5` |
| Dock border width | `dock_stroke_width` | `1.5` |
| Custom area border width | `custom_area_stroke_width` | `1.5` |

The Visual Editor exposes these as slider controls. The runtime accepts the existing outline range from `0.5` to `12` screen pixels.

## Zoom behavior

Map outlines use non-scaling SVG strokes (or equivalent synchronized screen-width behavior in the prepared layers), so changing card zoom does not visually multiply the configured line thickness.

This is intentionally separate from mower/map scale. A `1.5` border remains a thin screen outline while the underlying mower-local geometry is zoomed or transformed inside a Multi mower site.

## Legacy configurations

Older cards may contain wider values from early 0.3.0-era defaults. Those explicit YAML/editor values remain configuration data; the `1.5` values above describe the current defaults for new cards rather than a forced migration that overwrites existing choices.

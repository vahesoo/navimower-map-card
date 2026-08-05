# Adjustable map outlines

Navimower Map Card `0.3.0-beta2` adds the following visual-editor and YAML controls under **Appearance**:

| Setting | YAML key | Default |
|---|---|---:|
| Zone border width | `zone_stroke_width` | `2.5` |
| Off-limit border width | `off_limit_stroke_width` | `5` |
| VF-off border width | `vf_off_stroke_width` | `5` |
| Channel line width | `channel_stroke_width` | `5` |
| Gate area border width | `gate_area_stroke_width` | `3` |
| Dock border width | `dock_stroke_width` | `3` |

Values are screen pixels from `0.5` to `12` in `0.5` steps. These SVG outlines use `non-scaling-stroke`, so their displayed width stays constant while zooming and panning.

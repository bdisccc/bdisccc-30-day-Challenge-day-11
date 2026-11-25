# POSE! — Public preview (V0.7.2)

Static browser photobooth. Built-in gestures remain enabled; the experimental Custom Gesture / AR Studio is hidden behind an under-construction panel. Its source is retained. Set `ENABLE_CUSTOM_STUDIO = true` in `app.js` to restore it for development. No microphone recognition is initialized by the disabled custom studio.

## GitHub Pages
Upload the contents of this folder to the repository root. In Settings > Pages, select Deploy from a branch, main (or your default branch), / (root), then Save. Open the published HTTPS URL and grant camera permission. Internet access is required for tracking models and web fonts. Multiplayer is not yet available.

# POSE! V0.5 — Face Mapping & Animated Backgrounds

Run using VS Code Live Server on index.html, or `npx serve . -l 8000` and open http://localhost:8000. Keep all source files together. Camera permissions and internet access for MediaPipe models are required.

## Background Studio
Upload an image, MP4/WebM or animated GIF. Fill camera is the default and preserves aspect ratio; Fit entire image may show bars. Use the position, zoom and rotation controls to adjust framing. Fill mode adds enough zoom to cover the canvas even when repositioned or rotated. Opacity and blur intentionally alter coverage/appearance. Video plays muted and loops by default. Enable person cutout to composite behind the camera subject. GIF decoding uses browser ImageDecoder; unsupported browsers should use MP4 or WebM instead. Audio is preview-only, not part of PNG/GIF. Video format support depends on browser codecs. Captures and live loops use the composited canvas.

## Face Mapping Studio
Enable camera and tracking. The first detected face generates a calibration portrait automatically; use Map my face to recapture a straight-on neutral face. Draw directly on the portrait. Adjust landmarks enables dragging anchors on the portrait. Optional gesture-assisted adjustment uses a pinch near a visible calibration point on the camera, then movement while pinched; remain in the original calibration position. Disable adjustment before painting. Remap & clear art resets the portrait and artwork. Face paint uses piecewise affine triangles over selected facial landmarks, rather than one global transform. Strong head turns and occlusion may distort or interrupt tracking. Guides are not included in captures. Calibration is session-local.

## Existing features
Camera, 1–6 shot layouts, PNG and adaptive palette GIF export, compact widgets, multi-finger fog, creative props, Air Drawing (pinch paint, two fingers erase, open palm pauses), side-by-side printing.

## Remaining backlog
Advanced Frame Designer; Custom Gesture Studio; automatic blowing detection and improved condensation; multiplayer rooms and seat swaps; collaborative camera/face/shared glass drawing with participant permission. Independent face-region paint layers, saved calibration profiles and freehand background dragging remain future refinements.

## Verification
JavaScript syntax, HTML ID checks, and mathematical mesh/fill smoke tests only. Live camera, codecs, tracking quality and segmentation require real-browser/device testing.

## V0.6 — Advanced Frame Designer
Open Frames > Advanced Frame Designer. Choose a starter template and 1–6 slots. Drag a slot, text, or uploaded decoration; drag the bottom-right handle to resize. Select a slot to change Fit/Fill. Upload a transparent frame as an image decoration, resize and position over the photo slots, then bring it forward. Apply frame to synchronize the booth's shot count. Existing basic frames remain available when custom frame is disabled. Save/load stores one design in this browser; export/import JSON supports additional reusable designs. PNG and live GIF share the custom layout and layer order. Upload-only sessions have no recorded motion. Browser and live-camera testing is still required. 

## V0.6.1
Upload decorations or full-frame PNG overlays, rotate selected objects by the round handle or degrees input, and upload a separate paper background with fill/fit controls. Background and rotation persist in JSON and use the shared PNG/GIF renderer.

## V0.6.2
Frame font picker includes 19 requested families; Avant Garde requires a locally installed or user-uploaded licensed copy (Montserrat fallback). Other web fonts require internet access. Custom font uploads up to 8 MB are embedded in saved/exported frame JSON; only share fonts you have permission to redistribute. Background zoom, position, rotation and opacity are saved with the design and used in PNG/GIF rendering.

## V0.6.3 — Gradient paper backgrounds
Choose a solid base color, linear gradient or radial gradient in Frames → Advanced Frame Designer. Set 2–8 color stops, their positions, direction (linear), center, spread and opacity. The base color remains underneath the gradient, and uploaded background images remain above it. The same canvas renderer is used for preview, PNG and GIF. Saved/imported designs retain gradient settings; older designs remain compatible.

## V0.6.4 frame editor
- Four corner handles; image aspect ratios preserved when resizing, including rotated objects.
- Nine original vector stickers; use the existing image transform and layer controls.
- Toggle snapping to frame and object edges/centers while moving objects. Guides are preview-only.
- Set canvas width and height (100–5000 pixels each); existing layout scales to match. Non-proportional canvas resizing changes object boxes; uploaded images retain their fit behavior.
- Select an uploaded transparent overlay, click Detect photo openings, and confirm replacing slots. Enclosed alpha holes are detected at reduced resolution; up to six rectangular bounding boxes are generated. Open-sided, translucent or touching holes may need manual placement. Irregular holes use rectangular slots underneath the overlay, not custom clipping masks.
- Apply frame after changing the detected slot count. PNG and GIF use the same document renderer.

## V0.7 Custom Gesture Studio
Enable camera and tracking, open Custom gestures, record a steady hand pose for two seconds, upload an effect, configure it and save. Test or repeat the pose to trigger it. Custom matching takes priority over built-in gestures; fog, air drawing and calibration pause custom recognition. Local storage holds the pose vectors and effect files (2 MB per file, subject to browser quota). This first version recognizes static poses, not motion sequences. Animated GIF assets may render as a still frame on canvas; use MP4/WebM for reliable animation. Effects are included in the existing capture pipeline. Browser and webcam testing required.

## V0.7.1 — AR Filter Designer
Open Custom gestures and scroll within the widget to AR Filter Designer. Choose Dog preset to see original vector ears and nose; open your mouth for the tongue. Upload multiple image or MP4/WebM assets (30 MB each); select a layer to edit anchor, offsets, size, rotation, opacity, blend, chroma key, animation and facial condition. Drag selected visible assets on the camera; Shift-drag scales, Alt-drag rotates. Numeric controls also work on touch. Add particles creates a configurable sparkle layer. Set global trigger to Always or choose expression, pose, two hands, motion, voice, or motion + voice. Record hand/motion triggers for two seconds; record again to replace samples. Voice requires browser SpeechRecognition and permission and may use a remote speech service. Save presets to IndexedDB or export/import JSON. Assets are composited before the still and live capture buffers. Keep one AR preset loaded at a time; the old individual gesture library is unchanged.

Limitations: expression and head-motion triggers are geometric heuristics, motion recognition compares a resampled 2D fingertip path, and animations approximate physics rather than simulate soft bodies. GIF assets may remain static; use supported video instead. No separate audio asset, frame-by-frame timeline, true four-corner transform handles, or multiplayer synchronization in this release. Test camera and microphone on Chrome/Edge via localhost. Imported presets should come from trusted sources.

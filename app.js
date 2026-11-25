import { createARStudio } from './ar-studio.js';
import { createCustomGestures } from './custom-gestures.js';
import { createFrameDesigner } from './frame-designer.js';
import { createFaceMap } from './face-map.js';
import { createBackground } from './background.js';
import { createAirDraw } from './air-draw.js';
const $ = id => document.getElementById(id), canvas = $('live'), ctx = canvas.getContext('2d'), video = $('video'), W = 960, H = 720;
let clips = [], liveRing = [], lastSample = 0, gifURL = null, printToken = 0, propWidth = 180, propSelected = false, transform = null;
let stream = null, total = 3, photos = [], busy = false, prop = null, px = 480, py = 360, drag = false, trackers = null, tracking = false, lastTrack = 0, face = null, hand = null, gesture = '', gestureSince = 0, gestureFired = false, lastMouth = 0, lastEffect = 0, particles = [], fog = false, prevFinger = null, printedURL = null;
let fogTracks = new Map();
const fogCanvas = document.createElement('canvas');
fogCanvas.width = W;
fogCanvas.height = H;
const fc = fogCanvas.getContext('2d');
function err(s = '') { $('error').textContent = s; }
let designer;
function renderSlots() { $('film').replaceChildren(); for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    if (photos[i]) {
        const im = document.createElement('img');
        im.src = photos[i];
        d.append(im);
        const b = document.createElement('button');
        b.textContent = '×';
        b.title = 'Remove this photo';
        b.onclick = () => { photos.splice(i, 1); clips.splice(i, 1); renderSlots(); };
        d.append(b);
    }
    else
        d.textContent = String(i + 1).padStart(2, '0');
    $('film').append(d);
} $('print').disabled = photos.length !== total; for (const b of $('layouts').children)
    b.classList.toggle('selected', +b.textContent === total); designer?.preview(); }
for (let i = 1; i <= 6; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.onclick = () => { $('designEnabled').checked=false; total = i; photos = photos.slice(0, i); clips = clips.slice(0, i); renderSlots(); };
    $('layouts').append(b);
}
renderSlots();
designer = createFrameDesigner({ $, getPhotos:()=>photos, setCount:n=>{total=n;photos=photos.slice(0,n);clips=clips.slice(0,n);renderSlots();}, loadImage });
$('enter').onclick = () => { $('landing').classList.add('hidden'); $('workspace').classList.add('active'); $('homeBtn').classList.remove('hidden'); setTimeout(() => $('curtain').classList.add('open'), 150); };
$('homeBtn').onclick = () => { stopCamera(); $('landing').classList.remove('hidden'); $('workspace').classList.remove('active'); $('homeBtn').classList.add('hidden'); $('curtain').classList.remove('open'); };
async function startCamera() { try {
    err();
    if (!navigator.mediaDevices?.getUserMedia)
        throw Error('Camera requires HTTPS or localhost.');
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    $('status').textContent = '● Camera on';
    $('cameraBtn').textContent = 'Camera off';
    if (!tracking) startTracking();
}
catch (e) {
    err(e.message);
} }
function stopCamera() { customGestures.stop(); arStudio.stop(); air.resetTracking(); fogTracks.clear(); stream?.getTracks().forEach(t => t.stop()); stream = null; liveRing = []; video.srcObject = null; $('status').textContent = 'Camera off'; $('cameraBtn').textContent = 'Enable camera'; face = hand = null; }
$('cameraBtn').onclick = () => stream ? stopCamera() : startCamera();
function cropDraw(c, img, w, h) { const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height; if (!iw || !ih)
    return; const r = Math.max(w / iw, h / ih), sw = w / r, sh = h / r; c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h); }
function point(p) { const iw = video.videoWidth || W, ih = video.videoHeight || H, r = Math.max(W / iw, H / ih); let x = p.x * iw * r - (iw * r - W) / 2; return { x: $('mirror').checked ? W - x : x, y: p.y * ih * r - (ih * r - H) / 2 }; }
function burst(kind) { let p = kind==='sparkles'&&hand ? point(hand[8]) : face ? point(face[10]) : { x: W / 2, y: H * .3 }; for (let i = 0; i < 24; i++)
    particles.push({ x: p.x + (Math.random() - .5) * 220, y: p.y + Math.random() * 80, vx: (Math.random() - .5) * 2.5, vy: -.7 - Math.random() * 2, life: 150 + Math.random() * 80, kind, anchor: kind==='sparkles'&&hand?'hand':face?'face':null, originX:p.x, originY:p.y, size: 16 + Math.random() * 24 }); lastEffect = performance.now(); }
function makeFog() { if (air.enabled) air.stop(); fogTracks.clear(); fog = true; fc.clearRect(0, 0, W, H); const g = fc.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .7); g.addColorStop(0, 'rgba(240,246,246,.92)'); g.addColorStop(1, 'rgba(221,232,233,.58)'); fc.fillStyle = g; fc.fillRect(0, 0, W, H); for (let i = 0; i < 2500; i++) {
    fc.fillStyle = 'rgba(80,105,110,.09)';
    fc.beginPath();
    fc.arc(Math.random() * W, Math.random() * H, Math.random() * 2.8, 0, Math.PI * 2);
    fc.fill();
} }
function wipe(a, b) { fc.save(); fc.globalCompositeOperation = 'destination-out'; fc.lineCap = 'round'; fc.lineWidth = 30; fc.strokeStyle = '#000'; fc.beginPath(); fc.moveTo(a.x, a.y); fc.lineTo(b.x + .1, b.y); fc.stroke(); fc.restore(); }
function effect(n) { if (n === 'fog')
    makeFog();
else if (n === 'clear') {
    fogTracks.clear();
    fog = false;
    particles = [];
    fc.clearRect(0, 0, W, H);
}
else
    burst(n); }
$('effects').onclick = e => { if (e.target.dataset.effect)
    effect(e.target.dataset.effect); };
async function capture() { if (busy || photos.length >= total)
    return; if (!stream) {
    err('Enable your camera or upload photos first.');
    return;
} busy = true; err(); for (let n = +$('timer').value; n > 0; n--) {
    $('count').textContent = n;
    await new Promise(r => setTimeout(r, 1000));
    if (!stream) {
        busy = false;
        $('count').textContent = '';
        return;
    }
} $('count').textContent = ''; photos.push(canvas.toDataURL('image/jpeg', .95)); clips.push(liveRing.slice()); $('count').style.background = '#fff'; setTimeout(() => $('count').style.background = '', 100); renderSlots(); busy = false; }
$('capture').onclick = capture;
$('reset').onclick = $('again').onclick = () => { photos = []; clips = []; liveRing = []; printToken++; renderSlots(); $('printer').classList.remove('active'); if (activeWidget === 'prints') openWidget('prints'); };
$('uploadBtn').onclick = () => $('files').click();
$('files').onchange = async (e) => { for (const f of [...e.target.files].slice(0, total - photos.length)) {
    const url = URL.createObjectURL(f);
    try {
        const im = await loadImage(url), c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        containDraw(c.getContext('2d'), im, W, H);
        photos.push(c.toDataURL('image/jpeg', .95));
        clips.push([]);
    }
    catch {
        err('Could not open an uploaded image.');
    }
    finally {
        URL.revokeObjectURL(url);
    }
} renderSlots(); e.target.value = ''; };
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const propBox = $('propBox');
const props = [];
let selected = null, segmenter = null, segmentOn = false, maskData = null, lastSegment = 0;
const cut = document.createElement('canvas');
cut.width = W;
cut.height = H;
const cutCtx = cut.getContext('2d');
const mask = document.createElement('canvas');
mask.width = W;
mask.height = H;
const mc = mask.getContext('2d');
function containDraw(c, img, w, h) { const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height; if (!iw || !ih)
    return; const r = Math.min(w / iw, h / ih); c.drawImage(img, (w - iw * r) / 2, (h - ih * r) / 2, iw * r, ih * r); }
function ph(p) { return p.w * p.im.height / p.im.width; }
function updateBox() { const p = selected; propBox.classList.toggle('hidden', !p || !propSelected); $('propDimensions').textContent = p ? Math.round(p.w) + ' × ' + Math.round(ph(p)) + ' px · ' + Math.round(p.a * 180 / Math.PI) + '°' : ''; if (!p)
    return; Object.assign(propBox.style, { left: 100 * (p.x - p.w / 2) / W + '%', top: 100 * (p.y - ph(p) / 2) / H + '%', width: 100 * p.w / W + '%', height: 100 * ph(p) / H + '%', transform: `rotate(${p.a}rad)` }); }
function layers() { const l = $('layerList'); l.replaceChildren(new Option('Choose a prop', '')); props.forEach((p, i) => l.add(new Option(p.name, String(i)))); l.value = selected ? String(props.indexOf(selected)) : ''; updateBox(); }
function select(p) { selected = p; propSelected = !!p; layers(); }
$('layerList').onchange = e => select(e.target.value === '' ? null : props[+e.target.value]);
$('propBtn').onclick = () => $('propFile').click();
$('propFile').onchange = async (e) => { for (const f of e.target.files) {
    const u = URL.createObjectURL(f);
    try {
        const im = await loadImage(u);
        const p = { im, name: f.name, x: W / 2, y: H / 2, w: Math.min(im.width, W * .6, H * .6 * im.width / im.height), a: 0 };
        props.push(p);
        select(p);
    }
    catch {
        err('Cannot open prop.');
    }
    finally {
        URL.revokeObjectURL(u);
    }
} e.target.value = ''; };
$('clearProp').onclick = () => { if (selected)
    props.splice(props.indexOf(selected), 1); select(props.at(-1) || null); };
$('selectProp').onclick = () => select(selected || props.at(-1) || null);
$('duplicateProp').onclick = () => { if (selected) {
    const p = { ...selected, x: selected.x + 25, y: selected.y + 25 };
    props.push(p);
    select(p);
} };
function reorder(d) { const i = props.indexOf(selected), j = i + d; if (i >= 0 && j >= 0 && j < props.length) {
    [props[i], props[j]] = [props[j], props[i]];
    layers();
} }
$('frontProp').onclick = () => reorder(1);
$('backProp').onclick = () => reorder(-1);
function pointer(e) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; }
function rot(x, y, a) { return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) }; }
function hit(p, q) { const z = rot(q.x - p.x, q.y - p.y, -p.a); return Math.abs(z.x) <= p.w / 2 && Math.abs(z.y) <= ph(p) / 2; }
function beginTransform(e, corner) { if (!selected)
    return; const q = pointer(e), p = selected, sx = corner?.includes('w') ? -1 : 1, sy = corner?.includes('n') ? -1 : 1; const off = rot(-sx * p.w / 2, -sy * ph(p) / 2, p.a); transform = { p, q, x: p.x, y: p.y, w: p.w, h: ph(p), a: p.a, corner, sx, sy, ax: p.x + off.x, ay: p.y + off.y, angle: Math.atan2(q.y - p.y, q.x - p.x) }; }
function moveTransform(e) { if (!transform)
    return; const t = transform, p = t.p, q = pointer(e); if (t.corner === 'rotate') {
    p.a = t.a + Math.atan2(q.y - t.y, q.x - t.x) - t.angle;
}
else if (t.corner) {
    const z = rot(q.x - t.q.x, q.y - t.q.y, -t.a), r = t.h / t.w;
    p.w = Math.max(12, Math.min(W * 4, t.w + (z.x * t.sx + z.y * t.sy * r) / (1 + r * r)));
    const off = rot(t.sx * p.w / 2, t.sy * p.w * r / 2, t.a);
    p.x = t.ax + off.x;
    p.y = t.ay + off.y;
}
else {
    p.x = t.x + q.x - t.q.x;
    p.y = t.y + q.y - t.q.y;
} updateBox(); }
propBox.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); propBox.setPointerCapture(e.pointerId); beginTransform(e, e.target.dataset.c); };
propBox.onpointermove = moveTransform;
propBox.onpointerup = propBox.onpointercancel = propBox.onlostpointercapture = () => transform = null;
canvas.onpointerdown = e => { const q = pointer(e), p = [...props].reverse().find(p => hit(p, q)); canvas.setPointerCapture(e.pointerId); if (p) {
    select(p);
    beginTransform(e);
}
else {
    propSelected = false;
    updateBox();
    if (fog) {
        drag = true;
        prevFinger = q;
        wipe(q, q);
    }
} };
canvas.onpointermove = e => { if (transform)
    moveTransform(e);
else if (drag && fog) {
    const p = pointer(e);
    wipe(prevFinger || p, p);
    prevFinger = p;
} };
canvas.onpointerup = canvas.onpointercancel = () => { drag = false; prevFinger = null; transform = null; };
const background = createBackground({ $, W, H, err, loadImage });
$('segmentBtn').onclick = async () => { if (segmentOn) {
    segmentOn = false;
    $('segmentBtn').textContent = 'Enable person cutout';
    return;
} try {
    $('segmentBtn').disabled = true;
    $('bgStatus').textContent = 'Loading cutout model…';
    if (!segmenter) {
        const { FilesetResolver, ImageSegmenter } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
        const v = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
        segmenter = await ImageSegmenter.createFromOptions(v, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
    }
    segmentOn = true;
    $('segmentBtn').textContent = 'Disable person cutout';
    $('bgStatus').textContent = 'Cutout enabled (experimental).';
}
catch (e) {
    $('bgStatus').textContent = 'Cutout model unavailable. Original camera retained.';
    console.error(e);
}
finally {
    $('segmentBtn').disabled = false;
} };
function updateMask(t) { if (!segmentOn || !segmenter || t - lastSegment < 100)
    return; lastSegment = t; try {
    segmenter.segmentForVideo(video, t, res => { const m = res.confidenceMasks?.at(-1); if (!m)
        return; const f = m.getAsFloat32Array(), c = document.createElement('canvas'); c.width = m.width; c.height = m.height; const x = c.getContext('2d'), id = x.createImageData(m.width, m.height); for (let i = 0; i < f.length; i++) {
        id.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (f[i] - .25) / .5)) * 255);
    } x.putImageData(id, 0, 0); maskData = c; });
}
catch (e) {
    segmentOn = false;
    $('bgStatus').textContent = 'Cutout stopped; original camera retained.';
} }
const pad = $('facePad'), pc = pad.getContext('2d'), inkCanvas = document.createElement('canvas');
inkCanvas.width = inkCanvas.height = 320;
const ic = inkCanvas.getContext('2d');
let inkDown = false, inkPrev = null, eraser = false, history = [];
function guide() { pc.clearRect(0, 0, 320, 320); if (faceMap.guide(pc)) { pc.drawImage(inkCanvas,0,0); return; } pc.strokeStyle = '#aa9583'; pc.lineWidth = 1.5; pc.beginPath(); pc.ellipse(160, 157, 99, 130, 0, 0, 7); pc.stroke(); for (const x of [112, 208]) {
    pc.beginPath();
    pc.ellipse(x, 132, 24, 10, 0, 0, 7);
    pc.stroke();
    pc.beginPath();
    pc.arc(x, 132, 4, 0, 7);
    pc.stroke();
} pc.beginPath(); pc.moveTo(160, 137); pc.lineTo(148, 183); pc.lineTo(169, 183); pc.moveTo(124, 218); pc.quadraticCurveTo(160, 199, 196, 218); pc.quadraticCurveTo(160, 239, 124, 218); pc.stroke(); pc.drawImage(inkCanvas, 0, 0); }
const faceMap = createFaceMap({ $, video, W, H, point, inkCanvas, refresh:guide, clearInk:()=>{ic.clearRect(0,0,320,320);history=[];} });
$('mapFace').onclick=()=>{if(faceMap.ready && !confirm('Remapping changes artwork alignment. Continue?'))return;faceMap.calibrate(face);};
$('mapReset').onclick=()=>{if(confirm('Clear face artwork and remap?'))faceMap.calibrate(face,true);};
for(const id of ['mapPortrait','mapPoints','mapEdit']) $(id).onchange=guide;
guide();
function inkPoint(e) { const b = pad.getBoundingClientRect(); return { x: (e.clientX - b.left) * 320 / b.width, y: (e.clientY - b.top) * 320 / b.height }; }
function inkStroke(a, b) { ic.save(); ic.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'; ic.strokeStyle = eraser ? '#000' : $('ink').value; ic.lineWidth = +$('brush').value; ic.lineCap = 'round'; ic.beginPath(); ic.moveTo(a.x, a.y); ic.lineTo(b.x + .01, b.y); ic.stroke(); ic.restore(); guide(); }
pad.onpointerdown = e => { if(faceMap.editing){pad.setPointerCapture(e.pointerId);inkDown=true;faceMap.choose(inkPoint(e));return;} history.push(ic.getImageData(0, 0, 320, 320)); if (history.length > 20)
    history.shift(); pad.setPointerCapture(e.pointerId); inkDown = true; inkPrev = inkPoint(e); inkStroke(inkPrev, inkPrev); };
pad.onpointermove = e => { if (inkDown) {
    const q = inkPoint(e);
    if(faceMap.editing){faceMap.move(q);return;}
    inkStroke(inkPrev, q);
    inkPrev = q;
} };
pad.onpointerup = pad.onpointercancel = () => inkDown = false;
$('eraseInk').onclick = () => { eraser = !eraser; $('eraseInk').textContent = 'Eraser ' + (eraser ? 'on' : 'off'); };
$('undoInk').onclick = () => { if (history.length) {
    ic.putImageData(history.pop(), 0, 0);
    guide();
} };
$('clearInk').onclick = () => { history.push(ic.getImageData(0, 0, 320, 320)); ic.clearRect(0, 0, 320, 320); guide(); };
// Tracking models are independent: a hand failure must not disable face paint.
let loadingTracking = false, modelErrors = {}, lastVideoTime = -1, kissNear = 0;
let lastPose = null;
const visionBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
function drawInk() { if(faceMap.ready)faceMap.render(ctx,face); }
async function startTracking() {
    if (loadingTracking || tracking) return;
    loadingTracking=true; $('track').disabled=true;
    $('trackStatus').textContent='Loading hand and face models…';
    trackers=trackers || {}; modelErrors={};
    try {
        const {FilesetResolver,GestureRecognizer,FaceLandmarker}=await import(visionBase+'/vision_bundle.mjs');
        const v=await FilesetResolver.forVisionTasks(visionBase+'/wasm');
        const base='https://storage.googleapis.com/mediapipe-models/';
        // Sequential initialization avoids competing WASM initialization.
        for (const [key,create] of [
            ['f',()=>FaceLandmarker.createFromOptions(v,{baseOptions:{modelAssetPath:base+'face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1})],
            ['g',()=>GestureRecognizer.createFromOptions(v,{baseOptions:{modelAssetPath:base+'gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.45})]
        ]) {
            if (trackers[key]) continue;
            try {trackers[key]=await create();} catch(e){modelErrors[key]=String(e.message||e);console.error(key,e);}
        }
        tracking=!!(trackers.f||trackers.g); lastVideoTime=-1;
        $('track').textContent=tracking?'Pause tracking':'Retry tracking';
        $('trackStatus').textContent=tracking?'Models ready · show your face and hand':Object.values(modelErrors).join(' | ');
    } catch(e) { $('trackStatus').textContent='Model loading failed: '+String(e.message||e); console.error(e); }
    finally { loadingTracking=false; $('track').disabled=false; }
}
$('track').onclick=()=>{
    if (!tracking) return startTracking();
    tracking=false; air.resetTracking(); fogTracks.clear(); face=hand=null; lastPose=null; lastMouth=0; kissNear=0;
    $('track').textContent='Enable tracking'; $('trackStatus').textContent='Tracking paused';
};
function fingerExtended(h,tip,pip,mcp) {
    const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    return d(h[tip],h[0])>d(h[pip],h[0])*1.12 && d(h[tip],h[mcp])>d(h[pip],h[mcp])*1.25;
}
$('fogFingers').onchange = () => fogTracks.clear();
const air = createAirDraw({width: W, height: H, canvas, point, fingerExtended, onStart: () => { effect('clear'); select(null); transform = null; drag = false; }});
// Public-release feature flag. Set true to restore the experimental editors.
const ENABLE_CUSTOM_STUDIO = false;
$('customDevTools').hidden = !ENABLE_CUSTOM_STUDIO;
$('customComingSoon').hidden = ENABLE_CUSTOM_STUDIO;
const inactiveStudio = { update: () => false, render: () => {}, stop: () => {}, recording: false };
const customGestures = ENABLE_CUSTOM_STUDIO ? createCustomGestures({ $, point, W, H }) : inactiveStudio;
const arStudio = ENABLE_CUSTOM_STUDIO ? createARStudio({ $, point, W, H, canvas }) : inactiveStudio;
function detect(t) {
    if (!tracking || !stream || video.readyState<2 || t-lastTrack<45 || video.currentTime===lastVideoTime) return;
    lastTrack=t; lastVideoTime=video.currentTime;
    if(trackers.f) try {face=trackers.f.detectForVideo(video,t).faceLandmarks?.[0]||null;} catch(e){face=null;modelErrors.f=String(e.message||e);}
    if(!face) lastPose=null;
    if(face&&!faceMap.ready)faceMap.calibrate(face);
    let g=null;
    if(trackers.g) try {g=trackers.g.recognizeForVideo(video,t);} catch(e){modelErrors.g=String(e.message||e);}
    const hands=g?.landmarks||[];
    hand=hands[0]||null;
    faceMap.gesture(hands,face);
    const arClaimed = arStudio.update(hands,t,faceMap.editing||fog||air.enabled,face);
    const customClaimed = customGestures.update(hands,t,faceMap.editing||fog||air.enabled||arClaimed) || arClaimed;
    let n='None';
    for(let i=0;i<hands.length;i++) {
        const h=hands[i], cat=g.gestures?.[i]?.[0];
        let label=cat&&cat.score>.48?cat.categoryName:'None';
        const ext=[8,12,16,20].map(k=>fingerExtended(h,k,k-2,k-3));
        if(label==='None'&&ext[0]&&ext[1]&&!ext[2]&&!ext[3]) label='Victory';
        if(label==='None'&&ext[0]&&!ext[1]&&!ext[2]&&!ext[3]) label='Pointing_Up';
        if(label!=='None'){n=label;hand=h;break;}
    }
    if(n!==gesture){gesture=n;gestureSince=t;gestureFired=false;}
    if(!customClaimed&&!faceMap.editing&&!fog&&!air.enabled&&!gestureFired&&t-gestureSince>250){
        if(n==='Thumb_Up'){capture();gestureFired=true;}
        if(n==='Victory'){burst('sparkles');gestureFired=true;}
    }
    if(!customClaimed&&!faceMap.editing&&!fog&&!air.enabled&&face&&hands.length){
        const mouth=point(face[13]), l=point(face[234]),r=point(face[454]);
        const fw=Math.max(80,Math.hypot(l.x-r.x,l.y-r.y));
        const dist=Math.min(...hands.flatMap(h=>[5,8,9,12,16,20].map(i=>{const p=point(h[i]);return Math.hypot(p.x-mouth.x,p.y-mouth.y);}))); 
        if(dist<fw*.40&&n!=='Thumb_Up'&&n!=='Victory'){lastMouth=t;kissNear=dist;}
        else if(lastMouth&&t-lastMouth<1800&&dist>fw*.64&&dist-kissNear>fw*.20&&t-lastEffect>1500){burst('hearts');lastMouth=0;}
    }
    air.update(hands,g,t,$('mirror').checked);
    if (fog) {
        const next = new Map();
        const all = $('fogFingers').value === 'all';
        const used = new Set();
        for (let i = 0; i < hands.length; i++) {
            const h = hands[i];
            const side = g.handedness?.[i]?.[0]?.categoryName || g.handednesses?.[i]?.[0]?.categoryName || '';
            const wrist = point(h[0]);
            for (const tip of (all ? [4, 8, 12, 16, 20] : [8])) {
                if (!fingerExtended(h, tip, tip - 2, tip - 3)) continue;
                const p = point(h[tip]);
                let best = null, distance = Infinity;
                for (const [key, old] of fogTracks) {
                    if (used.has(key) || old.tip !== tip || (side && old.side && side !== old.side) || t - old.t > 180) continue;
                    const d = Math.hypot(wrist.x-old.wrist.x,wrist.y-old.wrist.y);
                    if (d < distance) { best = key; distance = d; }
                }
                const old = best !== null && distance < 160 ? fogTracks.get(best) : null;
                if (old) used.add(best);
                const continuous = old && Math.hypot(p.x-old.p.x,p.y-old.p.y)<150;
                wipe(continuous ? old.p : p, p);
                next.set(`${i}:${tip}`, {p,wrist,side,tip,t});
            }
        }
        fogTracks = next;
        $('fogStatus').textContent = `${next.size} drawing fingertip(s) · ${hands.length} hand(s)`;
    } else {
        fogTracks.clear();
        $('fogStatus').textContent = 'Activate Fog glass to draw.';
    }
    $('trackStatus').textContent=`Face: ${face?'detected':trackers.f?'not visible':'model unavailable'} · Hands: ${hands.length} · Gesture: ${n.replaceAll('_',' ')}${Object.keys(modelErrors).length?' · '+Object.entries(modelErrors).map(([k,v])=>(k==='f'?'Face':'Hand')+': '+v).join(' | '):''}`;
    $('faceStatus').textContent=face?'Face detected — drawing follows your movement':'No face detected — look toward the camera';
}
function frame(t) { requestAnimationFrame(frame); detect(t); ctx.fillStyle = '#211d1a'; ctx.fillRect(0, 0, W, H); if (background.active) { background.draw(ctx,t); } if (stream && video.readyState >= 2) {
    if (background.active && segmentOn)
        updateMask(t);
    const useCut = background.active && segmentOn && maskData;
    const target = useCut ? cutCtx : ctx;
    target.clearRect(0, 0, useCut ? W : 0, useCut ? H : 0);
    target.save();
    target.filter = $('filter').value || 'none';
    if ($('mirror').checked) {
        target.translate(W, 0);
        target.scale(-1, 1);
    }
    cropDraw(target, video, W, H);
    target.restore();
    if (useCut) {
        target.save();
        target.globalCompositeOperation = 'destination-in';
        if ($('mirror').checked) {
            target.translate(W, 0);
            target.scale(-1, 1);
        }
        cropDraw(target, maskData, W, H);
        target.restore();
        ctx.drawImage(cut, 0, 0);
    }
}
else if (!background.active) {
    ctx.fillStyle = '#bca994';
    ctx.textAlign = 'center';
    ctx.font = '32px Georgia';
    ctx.fillText('Your camera goes here', W / 2, H / 2);
    ctx.font = '18px system-ui';
    ctx.fillText('Enable camera or upload a photo', W / 2, H / 2 + 45);
} drawInk(); for (const p of props) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.drawImage(p.im, -p.w / 2, -ph(p) / 2, p.w, ph(p));
    ctx.restore();
} for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.globalAlpha = Math.min(1, p.life / 35);
    ctx.fillStyle = p.kind === 'hearts' ? '#f86e9d' : '#ffe4a3';
    ctx.font = `${p.size}px Georgia`;
    const anchor=p.anchor==='face'&&face?point(face[10]):p.anchor==='hand'&&hand?point(hand[8]):null;
    ctx.fillText(p.kind === 'hearts' ? '♥' : '✦', p.x+(anchor?anchor.x-p.originX:0), p.y+(anchor?anchor.y-p.originY:0));
} ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0); if (fog) {
    fc.save();
    fc.globalCompositeOperation = 'destination-out';
    fc.fillStyle = 'rgba(0,0,0,.0007)';
    fc.fillRect(0, 0, W, H);
    fc.restore();
    ctx.drawImage(fogCanvas, 0, 0);
} air.render(ctx); customGestures.render(ctx,t,face); arStudio.render(ctx,t); faceMap.overlay(face); if (stream && video.readyState >= 2 && t - lastSample >= 125) {
    lastSample = t;
    sampleCtx.drawImage(canvas, 0, 0, 320, 240);
    liveRing.push(sampleCanvas.toDataURL('image/jpeg', .92));
    if (liveRing.length > 16)
        liveRing.shift();
} }
const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 320;
sampleCanvas.height = 240;
const sampleCtx = sampleCanvas.getContext('2d');
requestAnimationFrame(frame);
$('print').onclick = async () => { if (photos.length !== total)
    return; const token = ++printToken; const snapshot = photos.slice(), motion = clips.map(a => a.slice()); const grid = $('layout').value === 'grid', cols = grid && total > 1 ? 2 : 1, rows = Math.ceil(total / cols), pad = 35, gap = 16, sw = 480, sh = 360; const c = document.createElement('canvas'); c.width = cols * sw + (cols - 1) * gap + pad * 2; c.height = rows * sh + (rows - 1) * gap + pad * 2 + 90; const custom = designer.active ? designer.snapshot() : null; if(custom){c.width=custom.width;c.height=custom.height;await designer.prepare(custom);} const cc = c.getContext('2d'); if(custom){designer.paint(cc,custom,await Promise.all(snapshot.map(loadImage)));}else{cc.fillStyle = $('color').value; cc.fillRect(0, 0, c.width, c.height); for (let i = 0; i < snapshot.length; i++) {
    const im = await loadImage(snapshot[i]);
    cc.drawImage(im, pad + i % cols * (sw + gap), pad + Math.floor(i / cols) * (sh + gap), sw, sh);
} cc.fillStyle = '#38271f'; cc.textAlign = 'center'; cc.font = '30px Georgia'; cc.fillText($('caption').value, c.width / 2, c.height - 60, c.width - 30); cc.font = '18px Georgia'; cc.fillText('P O S E !', c.width / 2, c.height - 28); } printedURL = c.toDataURL('image/png'); $('paper').src = printedURL; $('printer').classList.remove('active'); void $('printer').offsetWidth; $('printer').classList.add('active'); openWidget('prints'); if (matchMedia('(max-width: 760px)').matches) $('printer').scrollIntoView({block:'nearest',behavior:'smooth'}); buildLive(c, motion, cols, pad, gap, sw, sh, token, custom, snapshot); };
$('download').onclick = () => { if (!printedURL)
    return; const a = document.createElement('a'); a.href = printedURL; a.download = 'pose-photo-strip.png'; a.click(); };
window.addEventListener('pagehide', stopCamera);
function saveURL(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
$('stillPreview').onclick = () => { if (printedURL)
    $('paper').src = printedURL; $('stillPreview').classList.add('active-choice'); $('livePreview').classList.remove('active-choice'); };
$('livePreview').onclick = () => { if (gifURL) {
    $('paper').src = gifURL;
    $('livePreview').classList.add('active-choice');
    $('stillPreview').classList.remove('active-choice');
} };
$('downloadGif').onclick = () => { if (gifURL)
    saveURL(gifURL, 'pose-live-strip.gif'); };
async function buildLive(base, motion, cols, pad, gap, sw, sh, token, custom, snapshot) { if (gifURL)
    URL.revokeObjectURL(gifURL); gifURL = null; $('downloadGif').disabled = $('livePreview').disabled = true; $('stillPreview').click(); if (!motion.some(a => a.length > 1)) {
    $('gifStatus').textContent = 'No motion recorded — upload-only strips are still photos.';
    return;
} $('gifStatus').textContent = 'Creating live GIF…'; try {
    const scale = Math.min(1, 640 / base.width, 1200 / base.height), c = document.createElement('canvas');
    c.width = Math.round(base.width * scale);
    c.height = Math.round(base.height * scale);
    const g = c.getContext('2d', { willReadFrequently: true }), frames = await Promise.all(motion.map(a => Promise.all(a.map(loadImage))));
    const stills=custom?await Promise.all(snapshot.map(loadImage)):[];
    const enc = new GifWriter(c.width, c.height);
    for (let j = 0; j < 16; j++) {
        if (token !== printToken)
            return;
        if(custom){g.save();g.scale(c.width/base.width,c.height/base.height);designer.paint(g,custom,stills.map((im,i)=>{const f=frames[i]||[];return f.length?f[Math.min(f.length-1,Math.max(0,f.length-16+j))]:im;}));g.restore();}else{g.drawImage(base, 0, 0, c.width, c.height);
        for (let i = 0; i < frames.length; i++) {
            const f = frames[i];
            if (f.length)
                g.drawImage(f[Math.min(f.length - 1, Math.max(0, f.length - 16 + j))], (pad + i % cols * (sw + gap)) * scale, (pad + Math.floor(i / cols) * (sh + gap)) * scale, sw * scale, sh * scale);
        }
        }
        enc.frame(g.getImageData(0, 0, c.width, c.height).data, 13);
        $('gifStatus').textContent = 'Creating live GIF… ' + Math.round((j + 1) / 16 * 100) + '%';
        await new Promise(r => setTimeout(r, 0));
    }
    if (token !== printToken)
        return;
    gifURL = URL.createObjectURL(enc.finish());
    $('downloadGif').disabled = $('livePreview').disabled = false;
    $('gifStatus').textContent = 'Both versions are ready · live loop about 2 seconds.';
}
catch (e) {
    console.error(e);
    $('gifStatus').textContent = 'GIF creation failed. Your PNG is still available.';
} }
// GIF89a with adaptive per-frame palettes and bounded literal LZW blocks.
class GifWriter {
    constructor(w, h) { this.w = w; this.h = h; this.parts = []; const a = []; const word = n => a.push(n & 255, n >> 8 & 255); a.push(...[..."GIF89a"].map(c => c.charCodeAt(0))); word(w); word(h); a.push(247, 0, 0); for (let i = 0; i < 256; i++)
        a.push(Math.round((i >> 5) * 255 / 7), Math.round((i >> 2 & 7) * 255 / 7), Math.round((i & 3) * 255 / 3)); a.push(33, 255, 11, ...[..."NETSCAPE2.0"].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0); this.parts.push(Uint8Array.from(a)); }
    frame(rgba, delay) { const a = [33, 249, 4, 4, delay & 255, delay >> 8, 0, 0, 44, 0, 0, 0, 0, this.w & 255, this.w >> 8, this.h & 255, this.h >> 8, 135]; const {palette, lookup} = adaptivePalette(rgba); a.push(...palette, 8); const bytes = []; let bits = 0, acc = 0, count = 0; const emit = v => { acc |= v << bits; bits += 9; while (bits >= 8) {
        bytes.push(acc & 255);
        acc >>>= 8;
        bits -= 8;
    } }; emit(256); for (let i = 0; i < rgba.length; i += 4) {
        if (count === 200) {
            emit(256);
            count = 0;
        }
        emit(lookup[(rgba[i] >> 3) * 1024 + (rgba[i + 1] >> 3) * 32 + (rgba[i + 2] >> 3)]);
        count++;
    } emit(257); if (bits)
        bytes.push(acc & 255); this.parts.push(Uint8Array.from(a)); for (let i = 0; i < bytes.length; i += 255) {
        const b = bytes.slice(i, i + 255);
        this.parts.push(Uint8Array.from([b.length, ...b]));
    } this.parts.push(Uint8Array.of(0)); }
    finish() { return new Blob([...this.parts, Uint8Array.of(59)], { type: 'image/gif' }); }
}

// Quantize each frame using its own color distribution, not a fixed RGB332 palette.
function adaptivePalette(rgba) {
    const hist = new Map();
    for (let i=0;i<rgba.length;i+=4) {
        const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=(r>>3)*1024+(g>>3)*32+(b>>3);
        let v=hist.get(key); if (!v) {v=[key,0,0,0,0];hist.set(key,v);}
        v[1]++;v[2]+=r;v[3]+=g;v[4]+=b;
    }
    const points=[...hist.values()].map(v=>({key:v[0],n:v[1],c:[v[2]/v[1],v[3]/v[1],v[4]/v[1]]}));
    function box(p) {
        const lo=[255,255,255],hi=[0,0,0];let n=0;
        for(const v of p){n+=v.n;for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v.c[k]);hi[k]=Math.max(hi[k],v.c[k]);}}
        const ranges=hi.map((v,k)=>(v-lo[k])*[1,1.2,.9][k]);const axis=ranges.indexOf(Math.max(...ranges));
        return {p,n,axis,score:p.length>1?ranges[axis]*Math.sqrt(n):0};
    }
    const boxes=[box(points)];
    while(boxes.length<256){let ix=0;for(let k=1;k<boxes.length;k++)if(boxes[k].score>boxes[ix].score)ix=k;
        const q=boxes[ix];if(!q.score)break;q.p.sort((a,b)=>a.c[q.axis]-b.c[q.axis]);let n=0,k=0;while(k<q.p.length-1&&n<q.n/2)n+=q.p[k++].n;k=Math.max(1,k);boxes.splice(ix,1,box(q.p.slice(0,k)),box(q.p.slice(k)));}
    const palette=new Uint8Array(768),lookup=new Uint8Array(32768);
    boxes.forEach((q,i)=>{let sum=[0,0,0];for(const v of q.p){lookup[v.key]=i;for(let k=0;k<3;k++)sum[k]+=v.c[k]*v.n;}for(let k=0;k<3;k++)palette[i*3+k]=Math.round(sum[k]/q.n);});
    return {palette,lookup};
}
let activeWidget = 'frames';
function openWidget(key) {
    if (key !== 'air' && air.enabled) air.stop();
    activeWidget = key;
    document.querySelectorAll('[data-widget]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.widget===key)));
    document.querySelectorAll('[data-widget-panel]').forEach(p=>p.hidden=p.dataset.widgetPanel!==key || (key==='prints'&&!p.classList.contains('active')));
    $('emptyPrint').hidden=key!=='prints'||$('printer').classList.contains('active');
    document.querySelector('.widget-content').scrollTop=0;
}
document.querySelectorAll('[data-widget]').forEach(b=>b.addEventListener('click',()=>openWidget(b.dataset.widget)));
$('backToGestures').onclick = () => openWidget('gestures');
openWidget('frames');
$('filter').addEventListener('change',()=>{liveRing=[];});

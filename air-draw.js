// Screen-space drawing layer. Only ink is composited into captures; guides are separate.
export function createAirDraw({width, height, canvas, point, fingerExtended, onStart}) {
    const $ = id => document.getElementById(id);
    const ink = document.createElement('canvas');
    ink.width = width; ink.height = height;
    const ctx = ink.getContext('2d');
    const guide = $('airGuide'), gc = guide.getContext('2d');
    let enabled = false, paths = new Map(), undo = [], redo = [], mouse = null;
    let lastMirror = false;
    const snapshot = () => ctx.getImageData(0, 0, width, height);
    function checkpoint() { undo.push(snapshot()); if (undo.length > 12) undo.shift(); redo = []; }
    function stroke(a, b, erase = false) {
        const brush = $('airBrush').value, size = +$('airSize').value, color = $('airColor').value;
        ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
        ctx.strokeStyle = ctx.fillStyle = color;
        if (erase || brush === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineWidth = size * 2; }
        else if (brush === 'neon') { ctx.shadowColor = color; ctx.shadowBlur = size * 2; ctx.lineWidth = size; }
        else if (brush === 'smoke') { ctx.globalAlpha = .13; ctx.shadowColor = color; ctx.shadowBlur = size; ctx.lineWidth = size * 2; }
        else ctx.lineWidth = size;
        if (brush === 'spray' && !erase) {
            const n = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
            for (let j=0;j<=n;j++) for(let k=0;k<16;k++) {
                const r=Math.random()*size, angle=Math.random()*Math.PI*2;
                ctx.globalAlpha=.25+Math.random()*.4; ctx.beginPath();
                ctx.arc(a.x+(b.x-a.x)*j/n+Math.cos(angle)*r,a.y+(b.y-a.y)*j/n+Math.sin(angle)*r,1+Math.random()*2,0,Math.PI*2);ctx.fill();
            }
        } else { ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x+.01,b.y);ctx.stroke(); }
        ctx.restore();
    }
    function drawGuide(cursors = []) {
        gc.clearRect(0,0,width,height); if (!enabled) return;
        const motif = $('airMotif').value; gc.save();gc.strokeStyle='rgba(255,255,255,.75)';gc.lineWidth=3;gc.setLineDash([12,12]);gc.beginPath();
        if(motif==='star') { for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?100:230,x=width/2+Math.cos(a)*r,y=height/2+Math.sin(a)*r;i?gc.lineTo(x,y):gc.moveTo(x,y);}gc.closePath(); }
        if(motif==='heart'){gc.moveTo(480,240);gc.bezierCurveTo(280,30,110,330,480,580);gc.bezierCurveTo(850,330,680,30,480,240);}
        if(motif==='circle')gc.arc(width/2,height/2,210,0,Math.PI*2);
        gc.stroke();gc.setLineDash([]);
        for(const p of cursors){gc.beginPath();gc.arc(p.x,p.y,12,0,Math.PI*2);gc.strokeStyle=p.mode==='erase'?'#ffbc88':p.mode==='paint'?'#61efbe':'white';gc.stroke();}
        gc.restore();
    }
    function update(hands, result, t, mirror) {
        if(!enabled)return;
        if(mirror!==lastMirror){paths.clear();lastMirror=mirror;}
        const next=new Map(), cursors=[], used=new Set();
        for(let i=0;i<hands.length;i++){
            const h=hands[i], p=point(h[8]), wrist=point(h[0]);
            const side=result?.handedness?.[i]?.[0]?.categoryName || result?.handednesses?.[i]?.[0]?.categoryName || '';
            const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
            const palm=Math.max(12,dist(point(h[0]),point(h[9])));
            let old=null, key=null, best=Infinity;
            for(const [k,v] of paths){if(used.has(k)||(side&&v.side&&side!==v.side)||t-v.t>200)continue;const d=dist(wrist,v.wrist);if(d<best&&d<180){best=d;old=v;key=k;}}
            if(key!==null)used.add(key);
            const ext=[8,12,16,20].map(k=>fingerExtended(h,k,k-2,k-3));
            const pinch=dist(point(h[4]),p)/palm < (old?.mode==='paint'?.43:.30);
            const mode=pinch?'paint':ext.every(Boolean)?'pause':ext[0]&&ext[1]&&!ext[2]&&!ext[3]?'erase':'hover';
            const smooth=old&&dist(old.p,p)<140?{x:old.p.x*.25+p.x*.75,y:old.p.y*.25+p.y*.75}:p;
            if(mode==='paint'||mode==='erase'){
                const continuous=old?.mode===mode&&dist(old.p,smooth)<140;
                if(!continuous)checkpoint();stroke(continuous?old.p:smooth,smooth,mode==='erase');
            }
            next.set(i,{p:smooth,wrist,side,t,mode});cursors.push({...smooth,mode});
        }
        paths=next;drawGuide(cursors);$('airStatus').textContent=hands.length?`${hands.length} hand(s) · ${cursors.map(p=>p.mode).join(' / ')}`:'No hands visible — show your hand';
    }
    function toggle(value){enabled=value;paths.clear();mouse=null;if(value)onStart();$('airToggle').textContent=value?'Done drawing':'Start air drawing';$('airStatus').textContent=value?'Pinch to paint, two fingers to erase.':'Drawing paused; ink is retained.';drawGuide();}
    $('airToggle').onclick=()=>toggle(!enabled);
    $('airMotif').onchange=()=>drawGuide();
    $('airUndo').onclick=()=>{if(undo.length){redo.push(snapshot());ctx.putImageData(undo.pop(),0,0);paths.clear();}};
    $('airRedo').onclick=()=>{if(redo.length){undo.push(snapshot());ctx.putImageData(redo.pop(),0,0);paths.clear();}};
    $('airClear').onclick=()=>{checkpoint();ctx.clearRect(0,0,width,height);paths.clear();};
    $('airSave').onclick=()=>{const a=document.createElement('a');a.href=ink.toDataURL('image/png');a.download='pose-air-drawing.png';a.click();};
    const pointer=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height};};
    canvas.addEventListener('pointerdown',e=>{if(!enabled)return;e.stopImmediatePropagation();e.preventDefault();canvas.setPointerCapture(e.pointerId);checkpoint();mouse=pointer(e);stroke(mouse,mouse);},true);
    canvas.addEventListener('pointermove',e=>{if(!enabled||!mouse)return;e.stopImmediatePropagation();const p=pointer(e);stroke(mouse,p);mouse=p;},true);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>mouse=null,true);
    return {get enabled(){return enabled;},update,stop:()=>toggle(false),resetTracking:()=>{paths.clear();drawGuide();},render:target=>target.drawImage(ink,0,0)};
}

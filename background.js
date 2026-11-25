// Local media background, drawn into the same canvas as photo and GIF captures.
export function createBackground({ $, W, H, err, loadImage }) {
    let media = null, url = null, generation = 0, gif = null;
    const video = () => media instanceof HTMLVideoElement;
    const status = text => $('bgStatus').textContent = text;
    function reset() {
        $('bgFit').value = 'cover';
        for (const [id, value] of Object.entries({bgZoom:100,bgX:0,bgY:0,bgRotation:0,bgBlur:0,bgBrightness:100,bgOpacity:100,bgSpeed:1})) $(id).value = value;
        $('bgLoop').checked = $('bgMute').checked = true;
        sync();
    }
    function sync() {
        if (video()) {
            media.loop = $('bgLoop').checked;
            media.muted = $('bgMute').checked;
            media.playbackRate = +$('bgSpeed').value;
        }
    }
    function release() {
        if (video()) { media.pause(); media.removeAttribute('src'); media.load(); }
        if (url) URL.revokeObjectURL(url);
        gif?.decoder.close(); gif?.frame?.close(); gif = null;
        url = media = null;
    }
    $('bgBtn').onclick = () => $('bgFile').click();
    $('bgVideoBtn').onclick = () => $('bgVideoFile').click();
    async function upload(e) {
        const file = e.target.files[0]; e.target.value = ''; if (!file) return;
        const token = ++generation; release(); reset();
        const local = URL.createObjectURL(file); url = local;
        status('Loading background…');
        try {
            if (file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)) {
                const v = document.createElement('video');
                v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
                await new Promise((resolve,reject) => { v.onloadeddata=resolve; v.onerror=()=>reject(Error('Video codec unsupported by this browser')); v.src=local; });
                if (token !== generation) { v.pause(); return; }
                media = v; sync(); await v.play().catch(()=>{});
            } else if (/\.gif$/i.test(file.name) || file.type === 'image/gif') {
                if (!globalThis.ImageDecoder || !(await ImageDecoder.isTypeSupported('image/gif'))) throw Error('Animated GIF backgrounds require ImageDecoder support (try Chrome or Edge), or upload MP4.');
                const decoder = new ImageDecoder({data: await file.arrayBuffer(), type:'image/gif'});
                await decoder.tracks.ready;
                const first = (await decoder.decode({frameIndex:0})).image;
                if (token !== generation) { first.close(); decoder.close(); return; }
                gif = {decoder,frame:first,index:0,count:decoder.tracks.selectedTrack.frameCount,next:0,pending:false,paused:false}; media = first;
            } else {
                const im = await loadImage(local); if (token !== generation) return; media=im;
            }
            $('bgVideoControls').hidden = !(video() || gif);
            $('bgMuteRow').hidden = !video();
            status('Background ready. Enable person cutout to appear in front of it.');
        } catch(e) { if(token===generation){release();status(e.message||'Cannot load background.');err(e.message||'Cannot load background.');} }
    }
    $('bgFile').onchange = $('bgVideoFile').onchange = upload;
    $('bgClear').onclick = () => { ++generation; release(); $('bgVideoControls').hidden=true; status('Background removed.'); };
    $('bgReset').onclick = reset;
    $('bgPlay').onclick = () => { if(video()){if(media.paused)media.play().catch(e=>status(e.message));else media.pause();}else if(gif){gif.paused=!gif.paused;} };
    for(const id of ['bgSpeed','bgLoop','bgMute']) $(id).onchange=sync;
    function draw(ctx,t) {
        if (!media) return;
        if (gif && !gif.paused && !gif.pending && t>=gif.next) {
            const g=gif; g.next=t+(g.frame.duration||100000)/1000/(+$('bgSpeed').value);
            if(g.index+1<g.count || $('bgLoop').checked){g.pending=true; const index=(g.index+1)%g.count;g.decoder.decode({frameIndex:index}).then(({image})=>{if(gif!==g){image.close();return;}g.frame.close();g.frame=media=image;g.index=index;}).catch(e=>{if(gif===g){g.paused=true;status(e.message);}}).finally(()=>g.pending=false);}
        }
        if(video() && media.readyState<2)return;
        const iw=media.videoWidth||media.naturalWidth||media.displayWidth||media.width, ih=media.videoHeight||media.naturalHeight||media.displayHeight||media.height;
        if(!iw||!ih)return;
        const a=+$('bgRotation').value*Math.PI/180, ca=Math.abs(Math.cos(a)),sa=Math.abs(Math.sin(a));
        const x=+$('bgX').value*W/100,y=+$('bgY').value*H/100, fill=$('bgFit').value==='cover';
        // Account for rotation and offsets so fill never exposes the blank canvas.
        const rw=W*ca+H*sa, rh=W*sa+H*ca;
        const ox=Math.abs(x*Math.cos(a)+y*Math.sin(a)),oy=Math.abs(-x*Math.sin(a)+y*Math.cos(a));
        const scale=(fill?Math.max((rw+2*ox)/iw,(rh+2*oy)/ih):Math.min(W/iw,H/ih))*(+$('bgZoom').value/100);
        ctx.save();ctx.translate(W/2+x,H/2+y);ctx.rotate(a);ctx.globalAlpha=+$('bgOpacity').value/100;ctx.filter=`blur(${$('bgBlur').value}px) brightness(${$('bgBrightness').value}%)`;
        ctx.drawImage(media,-iw*scale/2,-ih*scale/2,iw*scale,ih*scale);ctx.restore();
    }
    return {get active(){return !!media;},draw};
}

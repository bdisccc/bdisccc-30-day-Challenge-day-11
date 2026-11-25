// Private, local gesture templates. No camera footage is stored.
export function createCustomGestures({ $, point, W, H }) {
    const key = 'pose-custom-gestures-v1';
    let library = [], media = new Map(), recording = null, active = null, last = 0, pending = null, matches = new Map(), previous = null;
    const status = s => $('cgStatus').textContent = s;
    const feature = h => {
        const p = h[0], scale = Math.max(.001, Math.hypot(h[9].x-p.x,h[9].y-p.y,h[9].z-p.z));
        return h.slice(1).flatMap(q => [(q.x-p.x)/scale,(q.y-p.y)/scale,(q.z-p.z)/scale]);
    };
    const distance = (a,b) => Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
    function save() { try { localStorage.setItem(key,JSON.stringify(library)); return true; } catch { status('Browser storage is full. This session still works, but changes may not persist.'); return false; } }
    function asset(g) {
        if(media.has(g.id)) return media.get(g.id);
        const m = g.mime.startsWith('video/') ? document.createElement('video') : new Image();
        if(m.tagName==='VIDEO'){m.muted=true;m.loop=true;m.playsInline=true;}
        m.src=g.data; media.set(g.id,m); return m;
    }
    function refresh(){
        const list=$('cgLibrary');list.replaceChildren();
        for(const g of library){const row=document.createElement('div');row.className='studioTools';const name=document.createElement('span');name.textContent=g.name;const toggle=document.createElement('button');toggle.textContent=g.enabled?'Enabled':'Disabled';toggle.onclick=()=>{g.enabled=!g.enabled;if(active?.g===g)stop();save();refresh();};const test=document.createElement('button');test.textContent='Test';test.onclick=()=>trigger(g,performance.now(),null);const del=document.createElement('button');del.textContent='Delete';del.onclick=()=>{if(active?.g===g)stop();library=library.filter(x=>x!==g);media.delete(g.id);save();refresh();};row.append(name,toggle,test,del);list.append(row);}
    }
    try {library=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(library))library=[];} catch {library=[];}
    refresh();
    $('cgRecord').onclick=()=>{recording={start:performance.now(),samples:[]};pending=null;status('Hold your custom hand pose for 2 seconds.');};
    $('cgSave').onclick=async()=>{
        if(!pending){status('Record a gesture first.');return;}
        const file=$('cgFile').files[0];if(!file){status('Choose an effect file first.');return;}
        if(file.size>2*1024*1024){status('Choose an effect smaller than 2 MB for local storage.');return;}
        if(!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(file.type)){status('Unsupported effect format.');return;}
        const samples=pending, data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}).catch(()=>null);
        if(!data){status('Could not read effect.');return;}
        const g={id:crypto.randomUUID(),name:$('cgName').value.trim()||'My gesture',samples,data,mime:file.type,anchor:$('cgAnchor').value,size:+$('cgSize').value,duration:+$('cgDuration').value,motion:$('cgMotion').value,threshold:+$('cgSensitivity').value,enabled:true};
        library.push(g);pending=null;const stored=save();refresh();if(stored)status('Saved! Perform your pose again to activate the effect.');
    };
    function stop(){if(active){const m=media.get(active.g.id);if(m?.tagName==='VIDEO')m.pause();}active=null;}
    function trigger(g,t,h){stop();active={g,start:t,hand:h};const m=asset(g);if(m.tagName==='VIDEO'){try{m.currentTime=0;}catch{}m.play().catch(()=>status('Video playback failed. Try Test again.'));}status('Triggered: '+g.name);}
    function update(hands,t,blocked){
        previous=hands[0]||null;
        if(recording){if(hands.length)recording.samples.push(feature(hands[0]));if(t-recording.start>=2000){pending=recording.samples.length>=8?recording.samples.filter((_,i)=>i%3===0).slice(0,20):null;recording=null;status(pending?'Gesture recorded. Choose an effect and save.':'Not enough hand samples. Try again with one hand visible.');}return true;}
        if(blocked||!$('cgEnabled').checked){matches.clear();return false;}
        let claimed=false;
        for(const g of library){if(!g.enabled)continue;let best=Infinity,bh=null;for(const h of hands){const f=feature(h),d=Math.min(...g.samples.map(s=>distance(s,f)));if(d<best){best=d;bh=h;}}const old=matches.get(g.id);if(best<g.threshold){claimed=true;if(!old)matches.set(g.id,{since:t,fired:false});else if(!old.fired&&t-old.since>250&&t-last>900){trigger(g,t,bh);old.fired=true;last=t;}}else matches.delete(g.id);}
        return claimed;
    }
    function render(ctx,t,face){if(!active)return;const {g,start}=active,elapsed=(t-start)/1000;if(elapsed>g.duration){stop();return;}const m=asset(g),iw=m.videoWidth||m.naturalWidth,ih=m.videoHeight||m.naturalHeight;if(!iw||!ih)return;let p={x:W/2,y:H/2};if(g.anchor==='hand'&&previous)p=point(previous[8]);else if(face&&g.anchor!=='screen'&&g.anchor!=='hand'){p=point(face[g.anchor==='mouth'?13:g.anchor==='head'?10:1]);if(g.anchor==='head')p.y-=g.size*.35;}const w=g.anchor==='screen'?W:g.size,h=w*ih/iw;ctx.save();ctx.globalAlpha=Math.min(1,elapsed*6,(g.duration-elapsed)*5);if(g.motion==='float')p.y-=elapsed*25;ctx.translate(p.x,p.y);if(g.motion==='spin')ctx.rotate(elapsed*1.4);const scale=g.motion==='pulse'?1+.12*Math.sin(elapsed*8):1;ctx.scale(scale,scale);ctx.drawImage(m,-w/2,-h/2,w,h);ctx.restore();}
    return {update,render,stop,get recording(){return !!recording;}};
}

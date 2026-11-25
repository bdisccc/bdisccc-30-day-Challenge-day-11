// Editable frame documents use normalized positions in a fixed design canvas.
export function createFrameDesigner({ $, getPhotos, setCount, loadImage }) {
    const canvas = $('designCanvas'), ctx = canvas.getContext('2d');
    const templates = {
        vintage: ['#f4e7d0','#563827','little moments ♡','strip'],
        coquette: ['#f9d9e5','#ae4269','with love ♡','strip'],
        chrome: ['#20212c','#e2e6fa','★ after hours ★','grid'],
        botanical: ['#dbe6ce','#47634b','in bloom','strip'],
        minimal: ['#ffffff','#232323','a moment in time','grid'],
        blank: ['#ffffff','#333333','','grid']
    };
    let doc, selected = -1, drag = null, images = new Map(), guides = [];
    const copy = x => JSON.parse(JSON.stringify(x));
    const standardFonts = ["Playfair Display", "Quattrocento", "Oswald", "Fjalla One", "Libre Baskerville", "Cormorant Garamond", "Proza Libre", "Cinzel", "Sacramento", "Josefin Sans", "Montserrat", "Roboto", "Lora", "Quicksand", "Arvo", "Abril Fatface", "Poppins", "Nixie One"];
    const fontLoads = new Map();
    const fontCSS = name => name === 'Avant Garde' ? '"ITC Avant Garde Gothic", "Avant Garde", "Montserrat", sans-serif' : JSON.stringify(name) + ', sans-serif';
    const defaults = {zoom:100,x:0,y:0,rotation:0,opacity:100};
    const bgControls = {designBgZoom:'zoom',designBgX:'x',designBgY:'y',designBgRotation:'rotation',designBgOpacity:'opacity'};
    function fontOptions(){
        const select=$('designFont');
        for(const option of [...select.options])if(option.dataset.custom)option.remove();
        for(const item of doc.fonts||[]){const o=new Option(item.name,item.family);o.dataset.custom='1';select.add(o);}
    }
    async function ensureFont(name,d=doc){
        if(name==='Avant Garde')return ensureFont('Montserrat',d);
        const custom=(d.fonts||[]).find(f=>f.family===name);
        if(!custom&&!standardFonts.includes(name))return;
        const key=custom?custom.family+custom.data:name;
        if(!fontLoads.has(key))fontLoads.set(key,(async()=>{
            if(custom){const face=new FontFace(custom.family,`url(${JSON.stringify(custom.data)})`);await face.load();document.fonts.add(face);}
            else {const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(name).replace(/%20/g,'+')+'&display=swap';await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;document.head.append(link);});const loaded=await document.fonts.load(`30px ${JSON.stringify(name)}`);if(!loaded.length)throw Error('Font unavailable');}
        })().catch(err=>{fontLoads.delete(key);throw err;}));
        return fontLoads.get(key);
    }
    function previewFont(name){ensureFont(name).then(()=>preview()).catch(()=>{$('designFontStatus').textContent='Font could not load. A fallback font is shown; check your connection or upload the font.';});}
    const gradientDefaults = bg => ({type:'solid',angle:90,x:0,y:0,spread:100,opacity:100,stops:[{color:bg,position:0},{color:'#e7a9c3',position:100}]});
    const gradientControls = {designGradientAngle:'angle',designGradientX:'x',designGradientY:'y',designGradientSpread:'spread',designGradientOpacity:'opacity'};
    function getGradient(){return doc.gradient ??= gradientDefaults(doc.bg);}
    function paintBase(c,d){
        const w=d.width,h=d.height,g=d.gradient;
        c.save();c.fillStyle=d.bg;c.fillRect(0,0,w,h);
        if(g && g.type!=='solid'){
            const x=w*(.5+g.x/100),y=h*(.5+g.y/100),a=g.angle*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a);
            const extent=(Math.abs(dx)*w+Math.abs(dy)*h)/2*g.spread/100;
            const fill=g.type==='radial'?c.createRadialGradient(x,y,0,x,y,Math.hypot(w/2,h/2)*g.spread/100):c.createLinearGradient(x-dx*extent,y-dy*extent,x+dx*extent,y+dy*extent);
            for(const stop of [...g.stops].sort((a,b)=>a.position-b.position))fill.addColorStop(stop.position/100,stop.color);
            c.globalAlpha=g.opacity/100;c.fillStyle=fill;c.fillRect(0,0,w,h);
        }
        c.restore();
    }
    function syncGradient(){
        const g=getGradient();$('designGradientType').value=g.type;$('designGradientPanel').hidden=g.type==='solid';$('designGradientAngleRow').hidden=g.type!=='linear';
        for(const [id,key] of Object.entries(gradientControls))$(id).value=g[key];
        const list=$('designGradientStops');list.replaceChildren();
        g.stops.forEach((stop,i)=>{
            const row=document.createElement('div');row.className='line gradient-stop';
            const color=document.createElement('input');color.type='color';color.value=stop.color;color.setAttribute('aria-label',`Gradient color ${i+1}`);
            const position=document.createElement('input');position.type='range';position.min=0;position.max=100;position.value=stop.position;position.setAttribute('aria-label',`Color stop ${i+1} position`);
            const value=document.createElement('span');value.textContent=stop.position+'%';
            const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove color stop ${i+1}`);remove.disabled=g.stops.length<=2;
            color.oninput=()=>{stop.color=color.value;preview();};position.oninput=()=>{stop.position=+position.value;value.textContent=position.value+'%';preview();};remove.onclick=()=>{g.stops.splice(i,1);syncGradient();preview();};
            row.append(color,position,value,remove);list.append(row);
        });$('designGradientAdd').disabled=g.stops.length>=8;
    }
    function validateGradient(g){
        if(!g||!['solid','linear','radial'].includes(g.type)||!Array.isArray(g.stops)||g.stops.length<2||g.stops.length>8||g.stops.some(s=>!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.position)||s.position<0||s.position>100))throw Error('Invalid gradient');
        for(const [id,key] of Object.entries(gradientControls))if(!Number.isFinite(g[key])||g[key]<+$(id).min||g[key]>+$(id).max)throw Error('Invalid gradient adjustment');
    }
    function paintBackground(c,d){
        if(!d.background)return;
        const im=image(d.background);if(!im.complete||!im.naturalWidth)return;
        const b={...defaults,...d.backgroundAdjust},a=b.rotation*Math.PI/180;
        const w=d.width,h=d.height,dx=b.x*w/100,dy=b.y*h/100;
        let scale;
        if(d.backgroundFit==='contain')scale=Math.min(w/im.naturalWidth,h/im.naturalHeight);
        else {const co=Math.cos(a),si=Math.sin(a);scale=Math.max((Math.abs(co)*w+Math.abs(si)*h+2*Math.abs(co*dx+si*dy))/im.naturalWidth,(Math.abs(si)*w+Math.abs(co)*h+2*Math.abs(-si*dx+co*dy))/im.naturalHeight);}
        scale*=b.zoom/100;c.save();c.globalAlpha=b.opacity/100;c.translate(w/2+dx,h/2+dy);c.rotate(a);c.drawImage(im,-im.naturalWidth*scale/2,-im.naturalHeight*scale/2,im.naturalWidth*scale,im.naturalHeight*scale);c.restore();
    }

    function make(name, count) {
        const [bg,fg,text,layout] = templates[name];
        const cols = layout === 'grid' && count > 1 ? 2 : 1, rows = Math.ceil(count / cols);
        const width = cols*480+(cols-1)*16+70, height = rows*360+(rows-1)*16+150;
        return {width,height,bg,objects:[...Array.from({length:count},(_,i)=>({type:'slot',index:i,x:35+i%cols*496,y:35+Math.floor(i/cols)*376,w:480,h:360,fit:'contain'})),...(text?[{type:'text',text,x:35,y:height-94,w:width-70,h:62,color:fg,size:30,font:'Georgia'}]:[])]};
    }
    function image(src) { if (!images.has(src)) { const im = new Image(); im.src=src; images.set(src,im); im.onload=()=>preview(); } return images.get(src); }
    function drawMedia(c,im,o) { if(!im?.complete || !im.naturalWidth)return; const s=(o.fit==='cover'?Math.max:Math.min)(o.w/im.naturalWidth,o.h/im.naturalHeight); c.save();c.beginPath();c.rect(o.x,o.y,o.w,o.h);c.clip();c.drawImage(im,o.x+(o.w-im.naturalWidth*s)/2,o.y+(o.h-im.naturalHeight*s)/2,im.naturalWidth*s,im.naturalHeight*s);c.restore(); }
    function transformed(c,o,fn) {
        c.save(); c.translate(o.x+o.w/2,o.y+o.h/2); c.rotate((o.rotation||0)*Math.PI/180); c.translate(-o.x-o.w/2,-o.y-o.h/2); fn(); c.restore();
    }
    function paint(c,d,photos,placeholder=false) {
        paintBase(c,d);
        paintBackground(c,d);
        for(const o of d.objects)transformed(c,o,()=>{
            if(o.type==='slot'){
                const im=photos[o.index];
                if(im?.naturalWidth)drawMedia(c,im,o);
                else if(placeholder){c.fillStyle='#b5aaa0';c.fillRect(o.x,o.y,o.w,o.h);c.fillStyle='#fff';c.font='32px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(o.index+1).padStart(2,'0'),o.x+o.w/2,o.y+o.h/2);}
            }else if(o.type==='text'){c.fillStyle=o.color;c.font=`${o.size}px ${fontCSS(o.font)}`;c.textAlign='center';c.textBaseline='middle';c.fillText(o.text,o.x+o.w/2,o.y+o.h/2,o.w);}
            else if(o.type==='image')drawMedia(c,image(o.src),o);
        });
    }
    function local(p,o){const x=p.x-o.x-o.w/2,y=p.y-o.y-o.h/2,a=-(o.rotation||0)*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a)+o.w/2,y:x*Math.sin(a)+y*Math.cos(a)+o.h/2};}
    function preview(){if(!doc)return;canvas.width=doc.width;canvas.height=doc.height;paint(ctx,doc,getPhotos().map(image),true);const o=doc.objects[selected];if(o)transformed(ctx,o,()=>{const h=canvas.clientWidth?canvas.width/canvas.clientWidth*9:12;ctx.strokeStyle='#a52343';ctx.lineWidth=Math.max(2,h/4);ctx.setLineDash([8,5]);ctx.strokeRect(o.x,o.y,o.w,o.h);ctx.setLineDash([]);ctx.fillStyle='#fff';for(const [x,y] of [[o.x,o.y],[o.x+o.w,o.y],[o.x,o.y+o.h],[o.x+o.w,o.y+o.h]]){ctx.fillRect(x-h/2,y-h/2,h,h);ctx.strokeRect(x-h/2,y-h/2,h,h);}ctx.beginPath();ctx.moveTo(o.x+o.w/2,o.y);ctx.lineTo(o.x+o.w/2,o.y-h*2);ctx.stroke();ctx.beginPath();ctx.arc(o.x+o.w/2,o.y-h*2,h*.65,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.save();ctx.strokeStyle='#00a6ae';ctx.lineWidth=Math.max(1,canvas.width/(canvas.clientWidth||canvas.width));ctx.setLineDash([5,4]);for(const g of guides){ctx.beginPath();if(g.axis==='x'){ctx.moveTo(g.value,0);ctx.lineTo(g.value,doc.height);}else{ctx.moveTo(0,g.value);ctx.lineTo(doc.width,g.value);}ctx.stroke();}ctx.restore();}
    function sync(){$('designWidth').value=doc.width;$('designHeight').value=doc.height;fontOptions();syncGradient();for(const [id,key] of Object.entries(bgControls))$(id).value=(doc.backgroundAdjust||defaults)[key]??defaults[key];const o=doc.objects[selected];$('designBg').value=doc.bg;$('designBgFit').value=doc.backgroundFit||'cover';$('designRotation').value=o?.rotation||0;$('designObject').textContent=o?`${o.type==='slot'?'Photo '+(o.index+1):o.type} selected`:'Select an item on the frame';$('designText').value=o?.type==='text'?o.text:'';$('designInk').value=o?.color||'#563827';$('designFont').value=o?.font||'Georgia';$('designSize').value=o?.size||30;$('designFit').value=o?.fit||'contain';preview();}
    function reset(){$('designEnabled').checked=false;doc=make($('designTemplate').value,+$('designCount').value);selected=-1;sync();}
    function pos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
    canvas.onpointerdown=e=>{
        const p=pos(e),o=doc.objects[selected],h=canvas.width/(canvas.clientWidth||canvas.width)*9,q=o?local(p,o):null;
        const rotate=o&&Math.hypot(q.x-o.w/2,q.y+h*2)<h*1.4;
        const resize=o&&[[-1,-1],[1,-1],[-1,1],[1,1]].find(([sx,sy])=>Math.hypot(q.x-(sx>0?o.w:0),q.y-(sy>0?o.h:0))<h*1.4);
        if(!resize&&!rotate)selected=doc.objects.findLastIndex(a=>{const q=local(p,a);return q.x>=0&&q.x<=a.w&&q.y>=0&&q.y<=a.h;});
        if(selected>=0){drag={p,o:{...doc.objects[selected]},resize,rotate};canvas.setPointerCapture(e.pointerId);}sync();
    };
    canvas.onpointermove=e=>{
        if(!drag)return;const p=pos(e),o=doc.objects[selected],old=drag.o,dx=p.x-drag.p.x,dy=p.y-drag.p.y;
        if(drag.rotate){const cx=old.x+old.w/2,cy=old.y+old.h/2;let angle=(old.rotation||0)+(Math.atan2(p.y-cy,p.x-cx)-Math.atan2(drag.p.y-cy,drag.p.x-cx))*180/Math.PI;o.rotation=((angle+180)%360+360)%360-180;$('designRotation').value=Math.round(o.rotation);}
        else if(drag.resize){
            const [sx,sy]=drag.resize,a=(old.rotation||0)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),u=dx*co+dy*si,v=-dx*si+dy*co;
            let w=Math.max(30,old.w+sx*u),h=Math.max(30,old.h+sy*v);
            if(o.type==='image'){const k=Math.max(30/Math.min(old.w,old.h),1+(sx*u*old.w+sy*v*old.h)/(old.w**2+old.h**2));w=old.w*k;h=old.h*k;}
            const du=sx*(w-old.w)/2,dv=sy*(h-old.h)/2;
            o.x=old.x+old.w/2+du*co-dv*si-w/2;o.y=old.y+old.h/2+du*si+dv*co-h/2;o.w=w;o.h=h;
        }else{o.x=old.x+dx;o.y=old.y+dy;guides=[];if($('designSnap').checked)snap(o);}preview();
    };
    function bounds(o){const a=(o.rotation||0)*Math.PI/180,w=Math.abs(Math.cos(a))*o.w+Math.abs(Math.sin(a))*o.h,h=Math.abs(Math.sin(a))*o.w+Math.abs(Math.cos(a))*o.h;return {x:[o.x+o.w/2-w/2,o.x+o.w/2,o.x+o.w/2+w/2],y:[o.y+o.h/2-h/2,o.y+o.h/2,o.y+o.h/2+h/2]};}
    function snap(o){const b=bounds(o),threshold=7*doc.width/(canvas.clientWidth||doc.width);for(const axis of ['x','y']){const limit=axis==='x'?doc.width:doc.height;const targets=[0,limit/2,limit,...doc.objects.filter(a=>a!==o).flatMap(a=>bounds(a)[axis])];let best=threshold,delta=0,target=null;for(const t of targets)for(const v of b[axis])if(Math.abs(t-v)<best){best=Math.abs(t-v);delta=t-v;target=t;}if(target!==null){o[axis]+=delta;guides.push({axis,value:target});}}}
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;guides=[];preview();};
    $('designDimensions').onclick=()=>{const w=+$('designWidth').value,h=+$('designHeight').value;if(!Number.isInteger(w)||!Number.isInteger(h)||w<100||h<100||w>5000||h>5000){$('designStatus').textContent='Enter integer dimensions between 100 and 5000 pixels.';return;}const sx=w/doc.width,sy=h/doc.height;for(const o of doc.objects){o.x*=sx;o.y*=sy;o.w*=sx;o.h*=sy;if(o.type==='text')o.size*=Math.min(sx,sy);}doc.width=w;doc.height=h;sync();$('designStatus').textContent=`Canvas resized to ${w} × ${h}.`;};
    const stickers={Heart:'<path fill="#e86b92" d="M50 90C-28 37 15 -8 50 25C85 -8 128 37 50 90Z"/>',Star:'<path fill="#edba47" d="M50 4L64 35 98 39 73 62 80 96 50 79 20 96 27 62 2 39 36 35Z"/>',Bow:'<path fill="#e8a1b9" stroke="#a95372" stroke-width="3" d="M50 45Q0 -5 5 47Q5 80 50 55Q95 80 95 47Q100 -5 50 45L70 94 50 72 30 94Z"/>',Flower:'<g fill="#e9a5c1">'+Array.from({length:6},(_,i)=>`<ellipse cx="50" cy="25" rx="16" ry="24" transform="rotate(${i*60} 50 50)"/>`).join('')+'</g><circle cx="50" cy="50" r="13" fill="#f3d265"/>',Sparkle:'<path fill="#eac65c" d="M50 0Q55 45 100 50Q55 55 50 100Q45 55 0 50Q45 45 50 0Z"/>',Moon:'<path fill="#e3c86f" d="M65 4A48 48 0 1 0 96 76A40 40 0 0 1 65 4Z"/>',Cloud:'<path fill="#c0d8ee" d="M24 78A22 22 0 1 1 27 35A27 27 0 0 1 77 38A20 20 0 1 1 79 78Z"/>',Crown:'<path fill="#e8bf59" stroke="#a78036" stroke-width="3" d="M10 25L35 49 50 12 65 49 90 25 80 83H20Z"/>','Film':'<rect x="5" y="5" width="90" height="90" rx="8" fill="#403a3b"/><rect x="23" y="17" width="54" height="66" fill="#eadbc5"/>'+[16,36,56,76].map(y=>`<path stroke="#fff" stroke-width="7" d="M10 ${y}h7m66 0h7"/>`).join('')};
    for(const [name,svg] of Object.entries(stickers)){const src='data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${svg}</svg>`),button=document.createElement('button');button.type='button';button.title=name;button.setAttribute('aria-label','Add '+name);const icon=document.createElement('img');icon.src=src;icon.alt=name;icon.width=28;icon.height=28;button.append(icon);button.onclick=()=>{const size=Math.min(doc.width,doc.height)*.18;doc.objects.push({type:'image',src,x:(doc.width-size)/2,y:(doc.height-size)/2,w:size,h:size,fit:'contain',rotation:0});selected=doc.objects.length-1;sync();};$('designLibrary').append(button);}
    $('designTemplate').onchange=$('designCount').onchange=reset;
    $('designBg').oninput=e=>{doc.bg=e.target.value;preview();};
    $('designGradientType').onchange=e=>{getGradient().type=e.target.value;syncGradient();preview();};
    for(const [id,key] of Object.entries(gradientControls))$(id).oninput=e=>{getGradient()[key]=+e.target.value;preview();};
    $('designGradientAdd').onclick=()=>{const g=getGradient();if(g.stops.length>=8)return;const ordered=[...g.stops].sort((a,b)=>a.position-b.position);let left=ordered[0],right=ordered[1];for(let i=1;i<ordered.length;i++)if(ordered[i].position-ordered[i-1].position>right.position-left.position){left=ordered[i-1];right=ordered[i];}const color='#'+[1,3,5].map(i=>Math.round((parseInt(left.color.slice(i,i+2),16)+parseInt(right.color.slice(i,i+2),16))/2).toString(16).padStart(2,'0')).join('');g.stops.push({color,position:Math.round((left.position+right.position)/2)});syncGradient();preview();};
    $('designGradientReset').onclick=()=>{const type=getGradient().type;doc.gradient={...gradientDefaults(doc.bg),type};syncGradient();preview();};
    for(const [id,key] of [['designText','text'],['designInk','color'],['designFont','font'],['designSize','size'],['designFit','fit']])$(id).oninput=e=>{const o=doc.objects[selected];if(o){o[key]=key==='size'?+e.target.value:e.target.value;if(key==='font')previewFont(o.font);preview();}};
    $('designAddText').onclick=()=>{doc.objects.push({type:'text',text:'Your text',x:30,y:30,w:doc.width-60,h:60,color:'#563827',size:30,font:'Georgia'});selected=doc.objects.length-1;sync();};
    async function readUpload(file){if(!file)return null;const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const im=await loadImage(src);images.set(src,im);return {src,im};}
    async function upload(e,frame=false){try{const item=await readUpload(e.target.files[0]);if(!item)return;const {src,im}=item,scale=frame?Math.min(doc.width/im.naturalWidth,doc.height/im.naturalHeight):Math.min(1,180/Math.max(im.naturalWidth,im.naturalHeight));const w=im.naturalWidth*scale,h=im.naturalHeight*scale;doc.objects.push({type:'image',src,x:frame?(doc.width-w)/2:30,y:frame?(doc.height-h)/2:30,w,h,fit:'contain',rotation:0});selected=doc.objects.length-1;sync();}catch{$('designStatus').textContent='Could not open image.';}finally{e.target.value='';}}
    $('designSticker').onchange=e=>upload(e);
    $('designOverlay').onchange=e=>upload(e,true);
    $('designDetect').onclick=async()=>{
        const o=doc.objects[selected];if(o?.type!=='image'){ $('designStatus').textContent='Select an uploaded frame overlay first.';return; }
        try{const im=await loadImage(o.src);const scale=Math.min(1,900/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*scale)),h=Math.max(1,Math.round(im.naturalHeight*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,w,h);const data=g.getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),holes=[];
        for(let start=0;start<w*h;start++){if(seen[start]||data[start*4+3]>32)continue;let head=0,tail=1;queue[0]=start;seen[start]=1;let l=w,r=0,t=h,b=0,edge=false;while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);if(x===0||x===w-1||y===0||y===h-1)edge=true;for(const n of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(n>=0&&!seen[n]&&data[n*4+3]<=32){seen[n]=1;queue[tail++]=n;}}if(!edge&&tail>=w*h*.008&&r-l>=12&&b-t>=12)holes.push({l,r,t,b,area:tail});}
        if(!holes.length){$('designStatus').textContent='No enclosed transparent openings detected. Use a PNG with transparent photo holes.';return;}
        if(holes.length>6){$('designStatus').textContent='More than six openings detected. Use a simpler template or place slots manually.';return;}
        if(!confirm(`Replace existing photo slots with ${holes.length} detected openings?`))return;
        const fit=Math.min(o.w/im.naturalWidth,o.h/im.naturalHeight),iw=im.naturalWidth*fit,ih=im.naturalHeight*fit,a=(o.rotation||0)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;
        holes.sort((a,b)=>a.t-b.t||a.l-b.l);const slots=holes.map((v,index)=>{const sw=(v.r-v.l+1)/w*iw,sh=(v.b-v.t+1)/h*ih,dx=((v.l+v.r+1)/2/w-.5)*iw,dy=((v.t+v.b+1)/2/h-.5)*ih;return {type:'slot',index,x:cx+dx*co-dy*si-sw/2,y:cy+dx*si+dy*co-sh/2,w:sw,h:sh,fit:'cover',rotation:o.rotation||0};});doc.objects=doc.objects.filter(x=>x.type!=='slot');const at=doc.objects.indexOf(o);doc.objects.splice(at,0,...slots);selected=doc.objects.indexOf(o);$('designCount').value=slots.length;$('designEnabled').checked=false;sync();$('designStatus').textContent=`Detected ${slots.length} openings. Adjust slots if needed, then Apply frame.`;
        }catch(err){$('designStatus').textContent='Could not detect openings: '+err.message;}
    };
    $('designBackground').onchange=async e=>{try{const item=await readUpload(e.target.files[0]);if(item){doc.background=item.src;preview();}}catch{$('designStatus').textContent='Could not open background.';}finally{e.target.value='';}};
    for(const [id,key] of Object.entries(bgControls))$(id).oninput=e=>{doc.backgroundAdjust={...defaults,...doc.backgroundAdjust,[key]:+e.target.value};preview();};
    $('designBgReset').onclick=()=>{doc.backgroundAdjust={...defaults};sync();};
    $('designFontFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('Font exceeds 8 MB');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const item={name:file.name.replace(/\.[^.]+$/,''),family:'PoseCustom_'+crypto.randomUUID().replace(/-/g,''),data};await ensureFont(item.family,{fonts:[item]});(doc.fonts??=[]).push(item);const o=doc.objects[selected];if(o?.type==='text')o.font=item.family;sync();$('designFontStatus').textContent='Custom font loaded. Select a text object to apply it.';}catch(err){$('designFontStatus').textContent='Could not load font: '+err.message;}finally{e.target.value='';}};
    $('designBgFit').onchange=e=>{doc.backgroundFit=e.target.value;preview();};
    $('designBgRemove').onclick=()=>{delete doc.background;preview();};
    $('designRotation').oninput=e=>{const o=doc.objects[selected];if(o){o.rotation=+e.target.value;preview();}};
    $('designRotateReset').onclick=()=>{const o=doc.objects[selected];if(o){o.rotation=0;sync();}};
    $('designDelete').onclick=()=>{if(selected>=0&&doc.objects[selected].type!=='slot'){doc.objects.splice(selected,1);selected=-1;sync();}};
    function layer(delta){const j=selected+delta;if(selected<0||j<0||j>=doc.objects.length)return;[doc.objects[selected],doc.objects[j]]=[doc.objects[j],doc.objects[selected]];selected=j;sync();}
    $('designFront').onclick=()=>layer(1);$('designBack').onclick=()=>layer(-1);
    $('designSave').onclick=()=>{try{localStorage.setItem('pose-frame-design',JSON.stringify(doc));$('designStatus').textContent='Design saved on this browser.';}catch{ $('designStatus').textContent='Storage full. Export your design instead.';}};
    function restore(d){if(!d||!Array.isArray(d.objects)||!Number.isFinite(d.width)||!Number.isFinite(d.height)||d.width<100||d.height<100||d.width>5000||d.height>5000||d.objects.length>100)throw Error('Invalid design');const slots=d.objects.filter(o=>o.type==='slot');if(slots.length<1||slots.length>6||slots.some((o,i)=>!slots.some(s=>s.index===i)))throw Error('Invalid photo slots');for(const o of d.objects){if(!['slot','text','image'].includes(o.type)||![o.x,o.y,o.w,o.h].every(Number.isFinite)||o.w<=0||o.h<=0)throw Error('Invalid object');if(o.type==='image'&&!/^data:image\//.test(o.src))throw Error('Invalid image');}if(d.background&&!/^data:image\//.test(d.background))throw Error('Invalid background');for(const o of d.objects){if(o.rotation!==undefined&&!Number.isFinite(o.rotation))throw Error('Invalid rotation');}if(d.fonts&&(!Array.isArray(d.fonts)||d.fonts.some(f=>typeof f.name!=='string'||!/^PoseCustom_[a-f0-9]+$/.test(f.family)||typeof f.data!=='string'||!/^data:[^,]*;base64,[A-Za-z0-9+/=]+$/.test(f.data))))throw Error('Invalid fonts');if(d.backgroundAdjust){for(const [id,key] of Object.entries(bgControls)){const v=d.backgroundAdjust[key];if(v!==undefined&&(!Number.isFinite(v)||v<+$(id).min||v>+$(id).max))throw Error('Invalid background adjustment');}}if(d.gradient!==undefined)validateGradient(d.gradient);doc=d;for(const o of doc.objects)if(o.type==='text')previewFont(o.font);$('designEnabled').checked=false;selected=-1;$('designCount').value=slots.length;sync();}
    $('designLoad').onclick=()=>{try{restore(JSON.parse(localStorage.getItem('pose-frame-design')));$('designStatus').textContent='Saved design loaded.';}catch{$('designStatus').textContent='No valid saved design found.';}};
    $('designExport').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='pose-frame.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
    $('designImport').onchange=async e=>{try{restore(JSON.parse(await e.target.files[0].text()));$('designStatus').textContent='Design imported.';}catch{$('designStatus').textContent='Could not import design.';}e.target.value='';};
    $('designApply').onclick=()=>{setCount(doc.objects.filter(o=>o.type==='slot').length);$('designEnabled').checked=true;$('designStatus').textContent='Custom frame active. Capture photos and print!';};
    $('designEnabled').onchange=()=>{if($('designEnabled').checked)$('designApply').click();};
    reset();
    return {preview, get active(){return $('designEnabled').checked;}, snapshot(){return copy(doc);}, async prepare(d){await Promise.allSettled(d.objects.filter(o=>o.type==='text').map(o=>ensureFont(o.font,d)));await Promise.all([...d.objects.filter(o=>o.type==='image').map(o=>o.src),...(d.background?[d.background]:[])].map(async src=>{const im=await loadImage(src);images.set(src,im);}));}, paint};
}

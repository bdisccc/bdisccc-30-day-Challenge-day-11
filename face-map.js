// Piecewise affine mapping from a user-calibrated portrait to live facial landmarks.
const ids = [10,152,234,454,127,356,172,397,58,288,33,133,160,144,263,362,387,373,70,63,105,66,107,336,296,334,293,300,168,6,1,2,98,327,195,4,61,291,0,17,13,14,37,267,84,314,78,308,81,311,178,402,205,425,50,280,197,5,94,19];
const names = {33:'Eye outer',133:'Eye inner',263:'Eye outer',362:'Eye inner',70:'Brow',300:'Brow',105:'Brow',334:'Brow',1:'Nose tip',98:'Nostril',327:'Nostril',13:'Upper lip',14:'Lower lip',61:'Mouth corner',291:'Mouth corner',10:'Forehead',152:'Chin',205:'Cheek',425:'Cheek'};
const corners = [{x:0,y:0},{x:320,y:0},{x:320,y:320},{x:0,y:320}];
function triangulate(points) {
    // Bowyer-Watson triangulation, including the canvas boundary for free accessories.
    const p=[...points,{x:-4000,y:-4000},{x:4400,y:-4000},{x:160,y:4400}];
    let triangles=[[points.length,points.length+1,points.length+2]];
    function contains(t,q){const [a,b,c]=t.map(i=>p[i]);const ax=a.x-q.x,ay=a.y-q.y,bx=b.x-q.x,by=b.y-q.y,cx=c.x-q.x,cy=c.y-q.y;const det=(ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx);const sign=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return det*sign>1e-7;}
    for(let i=0;i<points.length;i++){const bad=triangles.filter(t=>contains(t,p[i])),edges=new Map();for(const t of bad)for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}triangles=triangles.filter(t=>!bad.includes(t));for(const e of edges.values())triangles.push([...e,i]);}
    return triangles.filter(t=>t.every(i=>i<points.length));
}
function affine(a,b,c,A,B,C){const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y,d=ux*vy-uy*vx;if(Math.abs(d)<.01)return null;const x=B.x-A.x,y=B.y-A.y,z=C.x-A.x,w=C.y-A.y;const m=(x*vy-z*uy)/d,n=(y*vy-w*uy)/d,o=(z*ux-x*vx)/d,p=(w*ux-y*vx)/d;return [m,n,o,p,A.x-m*a.x-o*a.y,A.y-n*a.x-p*a.y];}
export function createFaceMap({ $, video, W, H, point, inkCanvas, refresh, clearInk }) {
    let source=null, triangles=[], portrait=null, reference=null, selected=null, pinching=false, mirrorAtMap=true;
    const pad=$('facePad'); const status=t=>$('mapStatus').textContent=t;
    function rebuild(){triangles=triangulate([...source,...corners]);}
    function calibrate(face,reset=false){if(!face){status('Look at the camera first.');return false;}if(reset)clearInk();const pts=ids.map(id=>point(face[id]));const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys),size=Math.max(r-l,b-t)*1.28;reference={x:(l+r-size)/2,y:(t+b-size)/2,size};source=pts.map(p=>({x:(p.x-reference.x)*320/size,y:(p.y-reference.y)*320/size}));mirrorAtMap=$('mirror').checked;portrait=document.createElement('canvas');portrait.width=portrait.height=320;const c=portrait.getContext('2d');const scale=Math.max(W/video.videoWidth,H/video.videoHeight);c.save();c.scale(320/size,320/size);c.translate(-reference.x,-reference.y);if(mirrorAtMap){c.translate(W,0);c.scale(-1,1);}c.drawImage(video,(W-video.videoWidth*scale)/2,(H-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);c.restore();rebuild();selected=null;refresh();status('Face mapped. Draw on your actual face, or adjust landmarks.');return true;}
    function guide(c){if(!source)return false;c.fillStyle='#eee5da';c.fillRect(0,0,320,320);if(portrait){c.save();c.globalAlpha=$('mapPortrait').checked?.8:0;c.drawImage(portrait,0,0);c.restore();}if($('mapPoints').checked || $('mapEdit').checked){c.font='9px system-ui';for(let i=0;i<source.length;i++){const p=source[i];c.fillStyle=i===selected?'#ffcc48':'#e8f8ff';c.strokeStyle='#18546c';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,i===selected?5:2.5,0,7);c.fill();c.stroke();if(i===selected){c.fillStyle='#102c3b';c.fillText(names[ids[i]]||`Landmark ${ids[i]}`,p.x+6,p.y-6);}}}return true;}
    function choose(p){if(!source)return;let best=Infinity;selected=null;source.forEach((q,i)=>{const d=Math.hypot(p.x-q.x,p.y-q.y);if(d<best&&d<30){best=d;selected=i;}});refresh();}
    function move(p){if(selected===null||!source)return;source[selected]={x:Math.max(1,Math.min(319,p.x)),y:Math.max(1,Math.min(319,p.y))};rebuild();refresh();}
    function gesture(hands,face){if(!$('mapEdit').checked||!$('mapGesture').checked||!source||!face||!hands.length){pinching=false;return;}const h=hands[0],a=point(h[8]),b=point(h[4]),w=point(h[0]),m=point(h[9]);const pinch=Math.hypot(a.x-b.x,a.y-b.y)<Math.max(12,Math.hypot(w.x-m.x,w.y-m.y)*.35);const p={x:(a.x-reference.x)*320/reference.size,y:(a.y-reference.y)*320/reference.size};if(pinch&&!pinching)choose(p);else if(pinch)move(p);pinching=pinch;}
    function render(ctx,face){
        if(!source||!face||!$('showInk').checked)return;
        const dest=ids.map(id=>point(face[id]));
        const anchors=[ids.indexOf(33),ids.indexOf(263),ids.indexOf(152)];
        const matrix=affine(...anchors.map(i=>source[i]),...anchors.map(i=>dest[i]));
        if(!matrix)return;
        const [a,b,c,d,e,f]=matrix;
        const dst=[...dest,...corners.map(p=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f}))],src=[...source,...corners];
        const expand=(pts,pad=1.15)=>{
            const cx=(pts[0].x+pts[1].x+pts[2].x)/3,cy=(pts[0].y+pts[1].y+pts[2].y)/3;
            return pts.map(p=>{const dx=p.x-cx,dy=p.y-cy,len=Math.hypot(dx,dy)||1;return {x:p.x+dx/len*pad,y:p.y+dy/len*pad};});
        };
        ctx.save();
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        for(const t of triangles){
            const s=t.map(i=>src[i]),q=t.map(i=>dst[i]),m=affine(...s,...q);
            if(!m)continue;
            const qq=expand(q,1.25);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(qq[0].x,qq[0].y);
            ctx.lineTo(qq[1].x,qq[1].y);
            ctx.lineTo(qq[2].x,qq[2].y);
            ctx.closePath();
            ctx.clip();
            ctx.transform(...m);
            ctx.drawImage(inkCanvas,0,0);
            ctx.restore();
        }
        ctx.restore();
    }
    function overlay(face){
        const c=$('mapGuide').getContext('2d');c.clearRect(0,0,W,H);
        if(!source||!face||!$('mapEdit').checked)return;
        c.strokeStyle='#ffda6d';c.fillStyle='#fff';c.lineWidth=2;
        for(let i=0;i<source.length;i++){
            const q=source[i],x=reference.x+q.x*reference.size/320,y=reference.y+q.y*reference.size/320;
            c.beginPath();c.arc(x,y,i===selected?8:4,0,7);c.fill();c.stroke();
            if(i===selected){c.font='14px system-ui';c.fillText(names[ids[i]]||`Landmark ${ids[i]}`,x+10,y-10);}
        }
    }
    return {calibrate,guide,choose,move,gesture,render,overlay,get ready(){return !!source;},get editing(){return $('mapEdit').checked;}};
}

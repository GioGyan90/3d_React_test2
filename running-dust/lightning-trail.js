import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/**
 * LightningRainbowTrail — reusable feet-attached speed FX for Three.js.
 *
 * Left and right foot emit only during their own backward swing window. The
 * trail remains behind the foot in world space and drifts toward -X. It uses
 * screen-facing, feathered rainbow light clouds rather than seven hard bands,
 * and separately draws jagged branching lightning with dynamic line buffers.
 *
 * API:
 *   const fx = new LightningRainbowTrail(scene);
 *   fx.trace(footIndex, {x, y, z}, dt, intensity);
 *   fx.impact(footIndex, {x, y, z}, intensity);
 *   fx.update(dt);
 *   fx.setEnabled(true);
 *   fx.setPalette('aurora' | 'sunset');
 *   fx.resize(height, dpr, fov);
 *   fx.clear(); fx.dispose();
 */
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const random = (a,b) => a + Math.random() * (b-a);
const smooth = (v) => { const x=clamp(v); return x*x*(3-2*x); };
const MAX_GLOW = 560;
const MAX_BOLTS = 65;
const NODES_PER_BOLT = 8;
const MAX_SEGMENTS = MAX_BOLTS * (NODES_PER_BOLT + 3);
const TONES = {
  aurora: ['#b9fff4','#72eff1','#7bbdff','#b6a5ff','#f2b1f4'],
  sunset: ['#ffe9ba','#ffbcad','#f898c8','#c69aff','#8fb7fb'],
};
const COLOR_KEYS = Object.fromEntries(
  Object.entries(TONES).map(([k, colors])=>[k,colors.map(hex=>new THREE.Color(hex))])
);

const cloudVertex = [
  'attribute vec3 aTint;',
  'attribute float aAlpha;',
  'attribute float aSize;',
  'attribute float aSpark;',
  'uniform float uScale;',
  'varying vec3 vTint;',
  'varying float vAlpha;',
  'varying float vSpark;',
  'void main() {',
  '  vTint=aTint; vAlpha=aAlpha; vSpark=aSpark;',
  '  vec4 mv=modelViewMatrix*vec4(position,1.0);',
  '  gl_Position=projectionMatrix*mv;',
  '  gl_PointSize=clamp(aSize*uScale/max(.15,-mv.z),1.0,126.0);',
  '}'
].join('\n');
const cloudFragment = [
  'varying vec3 vTint;',
  'varying float vAlpha;',
  'varying float vSpark;',
  'void main() {',
  '  vec2 xy=gl_PointCoord*2.0-1.0;',
  '  float d=length(xy);',
  '  if(d>1.0)discard;',
  '  float feather=pow(max(0.0,1.0-d*d),3.3)*exp(-2.7*d*d);',
  '  float cross=exp(-abs(xy.x)*18.0-abs(xy.y)*2.1)+exp(-abs(xy.y)*18.0-abs(xy.x)*2.1);',
  '  float spark=max(exp(-11.0*d*d),cross*.80);',
  '  float alpha=mix(feather,spark,vSpark)*vAlpha;',
  '  gl_FragColor=vec4(vTint,alpha);',
  '}'
].join('\n');
const boltVertex = [
  'attribute vec3 aTint;',
  'attribute float aAlpha;',
  'varying vec3 vTint;',
  'varying float vAlpha;',
  'void main() {',
  '  vTint=aTint;vAlpha=aAlpha;',
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
  '}'
].join('\n');
const boltFragment = [
  'varying vec3 vTint;',
  'varying float vAlpha;',
  'void main() { gl_FragColor=vec4(vTint,vAlpha); }'
].join('\n');

export class LightningRainbowTrail {
  constructor(targetScene) {
    if (!targetScene) throw new TypeError('LightningRainbowTrail needs a Three.js scene');
    this.scene=targetScene;
    this.enabled=true;
    this.palette='aurora';
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time=0;
    this.lightPool=Array.from({length:MAX_GLOW},()=>({active:false}));
    this.lightCursor=0;
    this.lightAcc=[0,0];
    this.arcAcc=[0,0];
    this.bolts=Array.from({length:MAX_BOLTS},()=>({active:false}));
    this.boltCursor=0;
    this.colorTmp=new THREE.Color();

    const p=new Float32Array(MAX_GLOW*3);
    const c=new Float32Array(MAX_GLOW*3);
    const a=new Float32Array(MAX_GLOW);
    const s=new Float32Array(MAX_GLOW);
    const spark=new Float32Array(MAX_GLOW);
    this.glowArrays={p,c,a,s,spark};
    this.glowGeometry=new THREE.BufferGeometry();
    this.glowGeometry.setAttribute('position',new THREE.BufferAttribute(p,3));
    this.glowGeometry.setAttribute('aTint',new THREE.BufferAttribute(c,3));
    this.glowGeometry.setAttribute('aAlpha',new THREE.BufferAttribute(a,1));
    this.glowGeometry.setAttribute('aSize',new THREE.BufferAttribute(s,1));
    this.glowGeometry.setAttribute('aSpark',new THREE.BufferAttribute(spark,1));
    this.glowGeometry.setDrawRange(0,0);
    this.glowMaterial=new THREE.ShaderMaterial({
      uniforms:{uScale:{value:500}},
      vertexShader:cloudVertex,fragmentShader:cloudFragment,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      toneMapped:false
    });
    this.glowPoints=new THREE.Points(this.glowGeometry,this.glowMaterial);
    this.glowPoints.frustumCulled=false;
    this.glowPoints.renderOrder=4;
    targetScene.add(this.glowPoints);

    const bp=new Float32Array(MAX_SEGMENTS*2*3);
    const bc=new Float32Array(MAX_SEGMENTS*2*3);
    const ba=new Float32Array(MAX_SEGMENTS*2);
    this.arcArrays={p:bp,c:bc,a:ba};
    this.arcGeometry=new THREE.BufferGeometry();
    this.arcGeometry.setAttribute('position',new THREE.BufferAttribute(bp,3));
    this.arcGeometry.setAttribute('aTint',new THREE.BufferAttribute(bc,3));
    this.arcGeometry.setAttribute('aAlpha',new THREE.BufferAttribute(ba,1));
    this.arcGeometry.setDrawRange(0,0);
    this.arcMaterial=new THREE.ShaderMaterial({
      vertexShader:boltVertex,fragmentShader:boltFragment,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      toneMapped:false
    });
    this.arcs=new THREE.LineSegments(this.arcGeometry,this.arcMaterial);
    this.arcs.frustumCulled=false;
    this.arcs.renderOrder=5;
    targetScene.add(this.arcs);
  }

  setEnabled(on) {
    this.enabled=Boolean(on);
    if(!this.enabled)this.clear();
  }
  setPalette(name) {
    if(COLOR_KEYS[name])this.palette=name;
  }

  // Continuous range of similar hues, interpolated between chosen shades.
  colorAt(foot,u,out=this.colorTmp) {
    const palette=COLOR_KEYS[this.palette];
    const fraction=clamp(u+(foot===0?-.12:.12))*(palette.length-1);
    const idx=Math.min(palette.length-2,Math.floor(fraction));
    const t=smooth(fraction-idx);
    return out.copy(palette[idx]).lerp(palette[idx+1],t);
  }

  emitLight(foot,origin,energy=1,burst=false) {
    const it=this.lightPool[this.lightCursor];
    this.lightCursor=(this.lightCursor+1)%MAX_GLOW;
    const strength=clamp(energy,.4,2.8);
    const life=burst?random(.27,.71):random(.45,1.08);
    const hue=random(0,1);
    it.active=true;
    it.age=0;it.life=life;
    it.foot=foot;it.hue=hue;
    it.x=origin.x-random(.05,.33);
    it.y=Math.max(.065,origin.y+random(-.06,.09));
    it.z=origin.z+random(-.23,.23);
    it.vx=-random(1.6,3.55)*(0.65+.55*strength);
    it.vy=random(-.09,.16);
    it.vz=random(-.23,.23);
    it.size=random(.19,.34)*(1+.28*strength);
    it.spark=Math.random()<.19?1:0;
    if(it.spark)it.size*=random(.62,1.14);
    it.energy=strength;
  }

  emitBolt(foot,origin,energy=1) {
    const b=this.bolts[this.boltCursor];
    this.boltCursor=(this.boltCursor+1)%MAX_BOLTS;
    b.active=true;
    b.age=0;
    b.life=random(.14,.37)*(energy>1.4?1.18:1);
    b.foot=foot;
    b.hue=random(0,1);
    b.x=origin.x-random(.04,.23);
    b.y=Math.max(.12,origin.y+random(.01,.22));
    b.z=origin.z+random(-.12,.12);
    b.length=random(.60,1.12)*(.65+.42*energy);
    b.energy=energy;
    b.seed=Math.random()*99;
    b.jags=Array.from({length:NODES_PER_BOLT},(_,j)=>({
      jx:j===0?0:random(-.075,.065),
      jy:j===0?0:random(-.19,.19),
      jz:j===0?0:random(-.20,.20)
    }));
  }

  // Foot tracing is active for the backward swing half-cycle of each leg.
  // Frame-independent accumulators avoid FX density changing at 30 vs 60 FPS.
  trace(foot,position,dt,intensity=1) {
    if(!this.enabled||dt<=0||!Number.isFinite(position.x))return;
    const strength=clamp(intensity,.45,2.6);
    const i=foot===0?0:1;
    this.lightAcc[i]+=dt*(this.reduced?19:45)*(0.7+.43*strength);
    const sparkRate=6.3+(strength-1)*6;
    this.arcAcc[i]+=dt*Math.max(2,sparkRate);
    let safeguard=0;
    while(this.lightAcc[i]>=1 && safeguard++<14){
      this.lightAcc[i]-=1;
      this.emitLight(i,position,strength);
    }
    safeguard=0;
    while(this.arcAcc[i]>=1 && safeguard++<4){
      this.arcAcc[i]-=1;
      this.emitBolt(i,position,strength);
    }
  }

  impact(foot,position,intensity=1) {
    if(!this.enabled)return;
    const str=clamp(intensity,.6,2.6);
    for(let i=0;i<(this.reduced?4:9);i++)this.emitLight(foot,position,str,true);
    for(let i=0;i<(this.reduced?1:3);i++)this.emitBolt(foot,position,str*1.04);
  }

  update(dt) {
    const step=clamp(dt,0,.05);
    this.time+=step;
    this.writeClouds(step);
    this.writeBolts(step);
  }

  writeClouds(dt) {
    const {p,c,a,s,spark}=this.glowArrays;
    let count=0;
    for(const it of this.lightPool){
      if(!it.active)continue;
      it.age+=dt;
      if(it.age>=it.life){it.active=false;continue;}
      const t=it.age/it.life;
      it.x+=it.vx*dt;
      it.y=Math.max(.057,it.y+it.vy*dt);
      it.z+=it.vz*dt;
      it.vx*=Math.exp(-.95*dt);
      const fade=Math.pow(1-smooth(t),1.45)*Math.min(1,it.age*16);
      const energy=it.energy;
      const k=count*3;
      p[k]=it.x;p[k+1]=it.y;p[k+2]=it.z;
      const color=this.colorAt(it.foot,it.hue);
      c[k]=color.r;c[k+1]=color.g;c[k+2]=color.b;
      a[count]=(it.spark?.86:.35)*fade*(.75+.25*Math.sin(this.time*16+it.hue*18)**2);
      s[count]=it.size*(.8+.55*t)*(it.spark?.72:1)*(.9+.15*energy);
      spark[count]=it.spark;
      count++;
    }
    this.glowGeometry.setDrawRange(0,count);
    for(const attr of Object.values(this.glowGeometry.attributes))attr.needsUpdate=true;
  }

  writeBolts(dt) {
    const {p,c,a}=this.arcArrays;
    let segments=0;
    const put=(x1,y1,z1,x2,y2,z2,col,alpha)=>{
      if(segments>=MAX_SEGMENTS)return;
      const k=segments*6;
      p[k]=x1;p[k+1]=y1;p[k+2]=z1;
      p[k+3]=x2;p[k+4]=y2;p[k+5]=z2;
      const v=segments*2;
      for(let index=0;index<2;index++){
        const q=k+index*3;
        c[q]=col.r;c[q+1]=col.g;c[q+2]=col.b;
        a[v+index]=alpha;
      }
      segments++;
    };
    for(const b of this.bolts) {
      if(!b.active)continue;
      b.age+=dt;
      if(b.age>=b.life){b.active=false;continue;}
      const t=b.age/b.life;
      const fade=(1-smooth(t))*(.72+.28*Math.sin(this.time*49+b.seed)**2);
      const slide=t*.30*b.energy;
      const baseX=b.x-slide,baseY=b.y,baseZ=b.z;
      const color=this.colorAt(b.foot,b.hue);
      let prev=[baseX,baseY,baseZ];
      for(let i=1;i<NODES_PER_BOLT;i++){
        const f=i/(NODES_PER_BOLT-1);
        const jag=b.jags[i];
        const next=[
          baseX-b.length*f+jag.jx,
          Math.max(.068,baseY+jag.jy*Math.sin(Math.PI*f)),
          baseZ+jag.jz*Math.sin(Math.PI*f)
        ];
        put(...prev,...next,color,(.43+.37*(1-f))*fade);
        prev=next;
        // Short randomized forks produce the crackling "acceleration" silhouette.
        if(i===3||i===5){
          const spread=i===3?1:-1;
          put(...next,next[0]-b.length*.22,
            Math.max(.07,next[1]+spread*.19),
            next[2]+spread*.15,color,.42*fade);
        }
      }
    }
    this.arcGeometry.setDrawRange(0,segments*2);
    for(const attr of Object.values(this.arcGeometry.attributes))attr.needsUpdate=true;
  }

  resize(viewportHeight,dpr=1,fieldOfView=41) {
    const height=Math.max(1,viewportHeight)*clamp(dpr,1,2);
    const focal=height/(2*Math.tan(THREE.MathUtils.degToRad(fieldOfView*.5)));
    this.glowMaterial.uniforms.uScale.value=focal;
  }
  get active() {
    return this.lightPool.reduce((n,p)=>n+(p.active?1:0),0)+
      this.bolts.reduce((n,p)=>n+(p.active?1:0),0);
  }
  clear() {
    for(const p of this.lightPool)p.active=false;
    for(const p of this.bolts)p.active=false;
    this.lightAcc=[0,0];this.arcAcc=[0,0];
    this.glowGeometry.setDrawRange(0,0);
    this.arcGeometry.setDrawRange(0,0);
  }
  dispose() {
    this.clear();
    this.scene.remove(this.glowPoints);
    this.scene.remove(this.arcs);
    this.glowGeometry.dispose();this.glowMaterial.dispose();
    this.arcGeometry.dispose();this.arcMaterial.dispose();
  }
}


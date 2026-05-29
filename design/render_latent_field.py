#!/usr/bin/env python3
# LATENT FIELD — Plate I.  PIL + supersampling.  Embeddings/latent-space soul.
import math, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = "/Users/nilayerol/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/05cde0dc-ca6f-484f-b9cc-6756e907ccdf/c9f2a369-d44e-4df2-93b3-6aace060c269/skills/canvas-design/canvas-fonts"
OUT   = "/Users/nilayerol/developer/tinnten/tinnten-cms/design/latent-field-dashboard.png"

S = 2
W, H = 2000, 2500
WS, HS = W*S, H*S

PAPER   = (243, 240, 232)
INK     = (24, 26, 31)
INK_SOFT= (74, 77, 84)
GREY    = (139, 135, 126)
GREY_LT = (188, 184, 174)
HAIR    = (214, 210, 200)
HAIR_LT = (227, 223, 214)
BLUE    = (19, 121, 240)
BLUE_DK = (11, 86, 188)

def F(name, size): return ImageFont.truetype(f"{FONTS}/{name}", int(round(size*S)))
jura_l  = lambda s: F("Jura-Light.ttf", s)
jura_m  = lambda s: F("Jura-Medium.ttf", s)
mono    = lambda s: F("GeistMono-Regular.ttf", s)
serif_i = lambda s: F("InstrumentSerif-Italic.ttf", s)

base = Image.new("RGBA", (WS, HS), PAPER + (255,))
d    = ImageDraw.Draw(base)
def new_layer(): return Image.new("RGBA", (WS, HS), (0,0,0,0))
def stamp(layer):
    # in-place so the ImageDraw handle `d` (bound to base) stays valid
    base.alpha_composite(layer)

def line(dr, x0,y0,x1,y1, fill, w=1.0):
    dr.line([x0*S,y0*S,x1*S,y1*S], fill=fill, width=max(1,int(round(w*S))))
def text(dr, x,y, s, font, fill, anchor="la"):
    dr.text((x*S,y*S), s, font=font, fill=fill, anchor=anchor)
def textlen(dr, s, font): return dr.textlength(s, font=font)/S
def tracked(dr, x,y, s, font, fill, track, anchor="lm"):
    ws=[dr.textlength(c,font=font)/S for c in s]
    total=sum(ws)+track*(len(s)-1); ax=anchor[0]
    sx = x-total/2 if ax=="m" else (x-total if ax=="r" else x)
    va = anchor[1] if len(anchor)>1 else "m"; cx=sx
    for c,w in zip(s,ws):
        dr.text((cx*S,y*S), c, font=font, fill=fill, anchor="l"+va); cx+=w+track
    return total
def reg_cross(dr, x,y, r, fill, w=1.0):
    line(dr, x-r,y, x+r,y, fill, w); line(dr, x,y-r, x,y+r, fill, w)
def circle(dr, cx,cy, r, fill=None, outline=None, w=1.0):
    dr.ellipse([(cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S], fill=fill, outline=outline,
               width=max(1,int(round(w*S))))

x0, x1 = 165, W-165

# corner + mid-margin registration
for (cx,cy) in [(72,72),(W-72,72),(72,H-72),(W-72,H-72)]:
    reg_cross(d, cx,cy, 16, GREY_LT, 1.0)
reg_cross(d, 72, H/2, 9, HAIR, 1.0); reg_cross(d, W-72, H/2, 9, HAIR, 1.0)

# ── HEADER ──
text(d, x0, 118, "LF · 001", mono(16), GREY, anchor="lm")
tracked(d, x1, 118, "FIELD NOTEBOOK", mono(16), GREY, 2.0, anchor="rm")
tracked(d, x0, 198, "LATENT FIELD", jura_l(62), INK, 16, anchor="lm")
tracked(d, x1, 198, "PLATE I", mono(17), INK_SOFT, 3.0, anchor="rm")
text(d, x0, 252, "an atlas of latent observation", serif_i(29), INK_SOFT, anchor="lm")
line(d, x0, 302, x1, 302, INK, 1.4); line(d, x0, 307, x1, 307, HAIR, 1.0)

# ── READINGS ──
readings = [
    ("OBSERVATIONS · n", "12 480", "vectors", False),
    ("DIMENSIONS · d",   "768",    "latent",  False),
    ("MEAN COSINE · r",  "0.412",  "similarity", True),
    ("CLUSTERS · k",     "328",    "resolved", False),
]
seg = (x1-x0)/len(readings)
ry_label, ry_num, ry_unit = 374, 454, 522
for i,(lab,val,unit,accent) in enumerate(readings):
    cx = x0 + seg*i + seg/2
    text(d, cx, ry_label, lab, mono(15.5), GREY, anchor="mm")
    text(d, cx, ry_num, val, jura_l(90), INK, anchor="mm")
    uw = textlen(d, unit, mono(15))
    circle(d, cx-uw/2-10, ry_unit, 2.7, fill=(BLUE if accent else GREY_LT))
    text(d, cx, ry_unit, unit, mono(15), GREY, anchor="mm")
    if i>0:
        dx=x0+seg*i; line(d, dx, ry_label-18, dx, ry_unit+16, HAIR, 1.0)
line(d, x0, 570, x1, 570, INK, 1.4)

# ── CENTRAL FIELD (landscape) ──
fy0, fy1 = 624, 1700
px0, px1 = x0+72, x1-16
py0, py1 = fy0+36, fy1-44
PW, PH = px1-px0, py1-py0

grid = new_layer(); gd = ImageDraw.Draw(grid)
NX, NY = 12, 8
for i in range(NX+1):
    gx=px0+PW*i/NX; line(gd, gx, py0, gx, py1, HAIR_LT+(140,), 0.7)
for j in range(NY+1):
    gy=py0+PH*j/NY; line(gd, px0, gy, px1, gy, HAIR_LT+(140,), 0.7)
stamp(grid)

def mapx(v): return px0+(v+3)/6*PW
def mapy(v): return py1-(v+2)/4*PH

rng = np.random.default_rng(42)
clusters = [
    dict(c=(mapx(-1.85),mapy(0.80)),  s=(122,80),  a=18,  n=360, kind="grey"),
    dict(c=(mapx(1.55), mapy(0.86)),  s=(150,92),  a=-14, n=410, kind="ink"),
    dict(c=(mapx(0.28), mapy(-0.82)), s=(124,82),  a=30,  n=330, kind="blue"),
    dict(c=(mapx(-1.78),mapy(-0.78)), s=(92,114),  a=6,   n=240, kind="grey"),
]
def pcol(kind, a):
    if kind=="blue": return BLUE+(a,)
    if kind=="ink":  return (40,43,50,a)
    return (122,118,109,a)

pts_layer=new_layer(); pd=ImageDraw.Draw(pts_layer)
cont_layer=new_layer(); cd=ImageDraw.Draw(cont_layer)
def ellipse_path(cx,cy,a,b,ang,steps=200):
    t=np.linspace(0,2*math.pi,steps); ca,sa=math.cos(math.radians(ang)),math.sin(math.radians(ang))
    xs=a*np.cos(t); ys=b*np.sin(t)
    X=cx+xs*ca-ys*sa; Y=cy+xs*sa+ys*ca
    return list(zip(X*S,Y*S))

cluster_pts=[]
for cl in clusters:
    cx,cy=cl["c"]; sx,sy=cl["s"]; ang=cl["a"]; kind=cl["kind"]
    u=rng.standard_normal(cl["n"]); v=rng.standard_normal(cl["n"])
    ca,sa=math.cos(math.radians(ang)),math.sin(math.radians(ang))
    X=cx+(u*sx)*ca-(v*sy)*sa; Y=cy+(u*sx)*sa+(v*sy)*ca
    dist=np.sqrt(u*u+v*v); cluster_pts.append((X,Y,dist,kind,cl))
    for xx,yy,dd in zip(X,Y,dist):
        if not (px0+4<xx<px1-4 and py0+4<yy<py1-4): continue
        if kind=="blue": a=int(max(105,252-50*dd)); r=2.9
        elif kind=="ink": a=int(max(62,228-58*dd)); r=2.3
        else: a=int(max(48,200-58*dd)); r=2.1
        pd.ellipse([(xx-r)*S,(yy-r)*S,(xx+r)*S,(yy+r)*S], fill=pcol(kind,a))
    ccol = BLUE+(150,) if kind=="blue" else (150,146,137,115)
    for k in (1.5,2.4):
        cd.line(ellipse_path(cx,cy,sx*k,sy*k,ang), fill=ccol, width=max(1,int(round(0.9*S))))
stamp(cont_layer); stamp(pts_layer)

bg=new_layer(); bgd=ImageDraw.Draw(bg)
for _ in range(120):
    xx=rng.uniform(px0+10,px1-10); yy=rng.uniform(py0+10,py1-10)
    bgd.ellipse([(xx-1.4)*S,(yy-1.4)*S,(xx+1.4)*S,(yy+1.4)*S], fill=(122,118,109,62))
stamp(bg)

for idx,(X,Y,dist,kind,cl) in enumerate(cluster_pts):
    cx,cy=cl["c"]; mc = BLUE_DK if kind=="blue" else INK
    circle(d, cx,cy, 8, outline=mc, w=1.2); reg_cross(d, cx,cy, 4, mc, 1.0)
    text(d, cx+14, cy-13, f"k{idx+1:02d}", mono(13.5),
         BLUE_DK if kind=="blue" else INK_SOFT, anchor="lm")

# nearest-neighbour gesture in blue cluster
Xb,Yb,db,_,_=cluster_pts[2]; order=np.argsort(db)
pa=(Xb[order[3]],Yb[order[3]]); pq=(Xb[order[0]],Yb[order[0]])
line(d, pa[0],pa[1], pq[0],pq[1], BLUE, 1.0)
text(d, (pa[0]+pq[0])/2+8, (pa[1]+pq[1])/2-10, "0.91", mono(13), BLUE_DK, anchor="lm")
reg_cross(d, pq[0],pq[1], 7, BLUE_DK, 1.1); circle(d, pq[0],pq[1], 4, outline=BLUE_DK, w=1.0)
text(d, pq[0]+12, pq[1]+14, "q · 0427", mono(13), BLUE_DK, anchor="lm")

# axis ticks
for vx in range(-3,4):
    gx=mapx(vx); line(d, gx, py1, gx, py1+7, GREY, 1.0)
    text(d, gx, py1+22, ("0" if vx==0 else f"{vx:+d}"), mono(12.5), GREY, anchor="mm")
for vy in range(-2,3):
    gy=mapy(vy); line(d, px0-7, gy, px0, gy, GREY, 1.0)
    text(d, px0-14, gy, ("0" if vy==0 else f"{vy:+d}"), mono(12.5), GREY, anchor="rm")
text(d, px1, py1+22, "z · 1", mono(13.5), INK_SOFT, anchor="rm")
vt=Image.new("RGBA",(int(160*S),int(34*S)),(0,0,0,0))
ImageDraw.Draw(vt).text((0,int(17*S)),"z · 2",font=mono(13.5),fill=INK_SOFT,anchor="lm")
vt=vt.rotate(90,expand=True); base.alpha_composite(vt,(int((px0-42)*S),int(py0*S)))

# frame + corner regs + caption
for (a,b,c,e) in [(px0,py0,px1,py0),(px0,py1,px1,py1),(px0,py0,px0,py1),(px1,py0,px1,py1)]:
    line(d,a,b,c,e,INK,1.2)
for (cx,cy) in [(px0,py0),(px1,py0),(px0,py1),(px1,py1)]:
    reg_cross(d, cx,cy, 10, INK, 1.0)
text(d, px0+14, py0+18, "FIG. 1 — projection of corpus onto two latent axes",
     mono(13.5), GREY, anchor="lm")

# ── LOWER : TIER 1 ──
by=1762
line(d, x0, by, x1, by, INK, 1.2)
leg=[("corpus",(40,43,50)),("indexed",(122,118,109)),("signal · query",BLUE)]
for i,(lab,cc) in enumerate(leg):
    yy=by+30+i*28; circle(d, x0+4, yy, 4.2, fill=cc)
    text(d, x0+20, yy, lab, mono(15.5), INK_SOFT, anchor="lm")
text(d, W/2, by+58, "meaning, resolved to geometry", serif_i(42), INK, anchor="mm")
line(d, W/2-46, by+90, W/2+46, by+90, BLUE, 1.2)
rx0,rx1=x1-300,x1; ryr=by+52
line(d, rx0, ryr, rx1, ryr, INK_SOFT, 1.1)
for i in range(11):
    tx=rx0+(rx1-rx0)*i/10; line(d, tx, ryr, tx, ryr-(8 if i%5==0 else 4), GREY, 1.0)
text(d, rx0, ryr+16, "0", mono(13), GREY, anchor="lm")
text(d, rx1, ryr+16, "1", mono(13), GREY, anchor="rm")
text(d, (rx0+rx1)/2, ryr+16, "cosine", mono(13), GREY, anchor="mm")
mxk=rx0+(rx1-rx0)*0.412
reg_cross(d, mxk, ryr, 6, BLUE_DK, 1.1); text(d, mxk, ryr-15, "0.412", mono(12.5), BLUE_DK, anchor="mm")

# ── LOWER : TIER 2 — marginal distribution histogram ──
line(d, x0, 1912, x1, 1912, HAIR, 1.0)
tracked(d, x0, 1948, "MARGINAL DISTRIBUTION", mono(15), GREY, 1.6, anchor="lm")
tracked(d, x1, 1948, "PAIRWISE COSINE", mono(15), GREY, 1.6, anchor="rm")
bins=64; centers=np.linspace(0,1,bins)
pdf=np.exp(-0.5*((centers-0.46)/0.155)**2)+0.28*np.exp(-0.5*((centers-0.80)/0.06)**2)
pdf*= (1+0.05*rng.standard_normal(bins)); pdf=np.clip(pdf,0,None); pdf/=pdf.max()
yb=2178; hmax=150; bw=(x1-x0)/bins
for i,(c,h) in enumerate(zip(centers,pdf)):
    bx=x0+bw*i; bh=h*hmax
    inblue = 0.385<=c<=0.45
    col = BLUE if inblue else (176,172,162)
    d.rectangle([(bx+bw*0.2)*S,(yb-bh)*S,(bx+bw*0.8)*S,yb*S], fill=col)
line(d, x0, yb, x1, yb, INK_SOFT, 1.1)
for frac,lab in [(0,"0"),(0.25,""),(0.5,"0.5"),(0.75,""),(1,"1")]:
    tx=x0+(x1-x0)*frac; line(d, tx, yb, tx, yb+7, GREY, 1.0)
    if lab: text(d, tx, yb+22, lab, mono(12.5), GREY, anchor="mm")
text(d, x0+(x1-x0)*0.412, yb+22, "0.412", mono(12.5), BLUE_DK, anchor="mm")
reg_cross(d, x0+(x1-x0)*0.412, yb, 6, BLUE_DK, 1.1)

# ── FOOTER ──
fy=H-150
line(d, x0, fy, x1, fy, INK, 1.2)
text(d, x0, fy+26, "LATENT FIELD — PLATE I", mono(14.5), INK_SOFT, anchor="lm")
text(d, W/2, fy+26, "01", mono(14.5), GREY, anchor="mm")
tracked(d, x1, fy+26, "tinnten · field notebook · MMXXVI", mono(14.5), INK_SOFT, 0.6, anchor="rm")

# ── grain + whisper vignette ──
arr=np.array(base).astype(np.int16)
arr[...,:3]=np.clip(arr[...,:3]+np.random.default_rng(7).normal(0,3.2,(HS,WS,1)),0,255)
yy,xx=np.mgrid[0:HS,0:WS]; cx,cy=WS/2,HS/2
r=np.sqrt(((xx-cx)/cx)**2+((yy-cy)/cy)**2)
vig=np.clip(1.0-0.05*np.clip(r-0.55,0,None)**2,0.93,1.0)[...,None]
arr[...,:3]=np.clip(arr[...,:3]*vig,0,255)
base=Image.fromarray(arr.astype(np.uint8),"RGBA")

final=base.convert("RGB").resize((W,H),Image.LANCZOS)
final.save(OUT,"PNG")
print("saved",OUT,final.size)

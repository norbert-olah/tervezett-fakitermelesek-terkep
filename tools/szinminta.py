# Színminta a fahasználati módokhoz: docs/img/szinminta.png
# A MODES és GROUPS tömböt az index.html-ből olvassa. Minden mód kitöltése 45%-os átlátszósággal, világos és sötét
# háttéren, valamint színtévesztés-szimulációval (deuteranópia, protanópia, tritanópia, 100%-os erősség) látszik.
# Futtatás (Python 3, Pillow, colorspacious; a Source Sans 3 betűtípus elérési útja: FONT):
#   pip install pillow colorspacious
#   python3 tools/szinminta.py index.html docs/img/szinminta.png
import re, sys, numpy as np, warnings
warnings.filterwarnings('ignore')
from PIL import Image, ImageDraw, ImageFont
from colorspacious import cspace_convert
html=open(sys.argv[1],encoding='utf8').read(); out=sys.argv[2]
G=[(m[0],m[1]) for m in re.findall(r"^ \{k:'([^']+)', n:'([^']+)',",html,re.M)]
M=re.findall(r"\{k:'([^']+)', g:'([^']+)', n:'([^']+)', c:'(#[0-9a-f]{6})'(?:, lc:'(#[0-9a-f]{6})')?",html)
DASH={'egy':(3,5),'biz':(10,6)}
import os
F=os.environ.get('FONT','/usr/share/fonts/truetype/google-fonts/ofl/sourcesans3/SourceSans3[wght].ttf')
f=ImageFont.truetype(F,17); f.set_variation_by_name('Regular'); fb=ImageFont.truetype(F,18); fb.set_variation_by_name('Bold'); fs=ImageFont.truetype(F,14); fs.set_variation_by_name('Regular')
def rgb(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)])/255
BG={'light':rgb('#eef0e6'),'dark':rgb('#3b4a32')}
cols=[('Világos háttér','light',None),('Sötét háttér','dark',None),('Deuteranópia','light','deuteranomaly'),('Protanópia','light','protanomaly'),('Tritanópia','light','tritanomaly')]
def sim(c,t): return c if t is None else np.clip(cspace_convert(c,{"name":"sRGB1+CVD","cvd_type":t,"severity":100},"sRGB1"),0,1)
T=lambda c: tuple(int(round(x*255)) for x in c)
rows=[]
for gk,gn in G:
    ms=[m for m in M if m[1]==gk]
    hv=[m for m in ms if m[3]=='#bcbddc']
    ms=[m for m in ms if m[3]!='#bcbddc']
    rows.append(('g',gn))
    for k,g,n,c,lc in ms: rows.append(('m',(k,g,n,c,lc)))
    if hv: rows.append(('m',(', '.join(m[0] for m in hv),gk,'haszonvételi módok',hv[0][3],hv[0][4])))
NW,SW,RH,HH,TOP=380,120,40,34,46
W=NW+SW*len(cols)+20; H=TOP+sum(HH if r[0]=='g' else RH for r in rows)+16
im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
for i,(lab,_,_) in enumerate(cols): d.text((NW+i*SW+SW/2,18),lab,font=fs,fill=(80,90,85),anchor='mm')
y=TOP
for kind,v in rows:
    if kind=='g':
        d.text((10,y+HH/2+2),v,font=fb,fill=(28,38,32),anchor='lm'); y+=HH; continue
    k,g,n,c,lc=v
    d.text((24,y+RH/2),f"{n}",font=f,fill=(28,38,32),anchor='lm')
    d.text((NW-12,y+RH/2),k,font=fs,fill=(93,107,98),anchor='rm')
    for i,(_,bgk,t) in enumerate(cols):
        x0=NW+i*SW+10; x1=x0+SW-20; y0=y+5; y1=y+RH-5
        bg=BG[bgk]; d.rectangle([x0-6,y0-4,x1+6,y1+4],fill=T(sim(bg,t)))
        fill=sim(rgb(c)*.45+bg*.55,t); line=T(sim(rgb(lc or c),t))
        d.rectangle([x0,y0,x1,y1],fill=T(fill))
        if g in DASH:
            on,off=DASH[g]
            for (ax,ay,bx,by) in [(x0,y0,x1,y0),(x0,y1,x1,y1),(x0,y0,x0,y1),(x1,y0,x1,y1)]:
                L=max(bx-ax,by-ay); p=0
                while p<L:
                    q=min(p+on,L)
                    if ax==bx: d.line([ax,ay+p,ax,ay+q],fill=line,width=3)
                    else: d.line([ax+p,ay,ax+q,ay],fill=line,width=3)
                    p+=on+off
        else: d.rectangle([x0,y0,x1,y1],outline=line,width=3)
    y+=RH
im.save(out,optimize=True); print(W,H)

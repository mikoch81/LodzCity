import json, math, re, random
src = open('/home/user/LodzCity/src/engine/data.ts').read()
D = []
for m in re.finditer(r'\{ id: "(\w+)", name: "([^"]+)".*?(town: true, )?x: (\d+), y: (\d+) \}', src):
    D.append(dict(id=m[1], name=m[2], town=bool(m[3]), x=round((int(m[4])-50)*1.25+60,2), y=int(m[5])+2.0))
edges = re.findall(r'\["(\w+)", "(\w+)"\]', src.split('const EDGES')[1].split('export const ADJ')[0])
# nudge a few to real geography (Zgierz further N, Stryków NE)
for d in D:
    if d['id']=='zgierz': d['x'],d['y']=30,6
    if d['id']=='strykow': d['x'],d['y']=106,8
    if d['id']=='aleksandrow': d['x'],d['y']=12,40
    if d['id']=='pabianice': d['x'],d['y']=28,92
def clip(poly, a, b, c):  # keep a*x+b*y<=c
    out=[]
    n=len(poly)
    for i in range(n):
        P=poly[i]; Q=poly[(i+1)%n]
        pin=a*P[0]+b*P[1]<=c; qin=a*Q[0]+b*Q[1]<=c
        if pin: out.append(P)
        if pin!=qin:
            t=(c-a*P[0]-b*P[1])/(a*(Q[0]-P[0])+b*(Q[1]-P[1]))
            out.append((P[0]+t*(Q[0]-P[0]),P[1]+t*(Q[1]-P[1])))
    return out
random.seed(7)
cells={}
for d in D:
    R = 9.5 if d['town'] else 15
    # organic blob as convex-ish polygon: clip by tangent half-planes with slight noise
    poly=[(-10,-10),(130,-10),(130,110),(-10,110)]
    for o in D:
        if o is d: continue
        a=o['x']-d['x']; b=o['y']-d['y']
        c=(o['x']**2+o['y']**2-d['x']**2-d['y']**2)/2
        poly=clip(poly,a,b,c)
    for k in range(28):
        ang=2*math.pi*k/28; r=R*(1+0.08*math.sin(3*ang+len(d['id'])))
        a,b=math.cos(ang),math.sin(ang)
        poly=clip(poly,a,b,a*d['x']+b*d['y']+r)
    cx=sum(p[0] for p in poly)/len(poly); cy=sum(p[1] for p in poly)/len(poly)
    d['poly']=[(round(p[0],2),round(p[1],2)) for p in poly]
    d['cx'],d['cy']=round(cx,2),round(cy,2)
json.dump(dict(districts=D,edges=edges),open('/tmp/claude-0/geo/geo.json','w'),ensure_ascii=False)
print(len(D),len(edges))

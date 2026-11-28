import json
g=json.load(open('geo.json')); t=json.load(open('terrain.json'))
def pts(p): return ' '.join(f'{x},{y}' for x,y in p)
def smooth(p):
    s=f'M{p[0][0]},{p[0][1]}'
    for i in range(1,len(p)-1):
        mx=(p[i][0]+p[i+1][0])/2; my=(p[i][1]+p[i+1][1])/2
        s+=f' Q{p[i][0]},{p[i][1]} {mx},{my}'
    return s+f' L{p[-1][0]},{p[-1][1]}'
o=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="1440" height="1200"><rect width="120" height="100" fill="#d8cfa6"/>']
for f in t['forests']: o.append(f'<polygon points="{pts(f)}" fill="#3f5a2e" stroke="#3f5a2e" stroke-width="3" stroke-linejoin="round"/>')
for d in g['districts']:
    # built-up: shrink polygon toward center
    r={'stare_miasto':8,'nowe_miasto':8,'srodmiescie':9,'lodka':8,'ogrodowa':7,'ksiezy_mlyn':6,'polesie':6,'widzew':6,'baluty':6,'gorna':6}.get(d['id'],5 if d['town'] else 2.6)
    o.append(f'<circle cx="{d["x"]}" cy="{d["y"]}" r="{r}" fill="#a8664a"/>')
for f in t['parks']: o.append(f'<polygon points="{pts(f)}" fill="#6f8f45" stroke="#6f8f45" stroke-width="1" stroke-linejoin="round"/>')
for r in t['rivers']: o.append(f'<path d="{smooth(r)}" fill="none" stroke="#4f7f9a" stroke-width="1.1" stroke-linecap="round"/>')
for r in t['roads']: o.append(f'<path d="{smooth(r)}" fill="none" stroke="#efe3c0" stroke-width="0.7"/>')
for r in t['rails']: o.append(f'<path d="{smooth(r)}" fill="none" stroke="#222" stroke-width="0.6"/>')
o.append('</svg>')
open('guide.svg','w').write('\n'.join(o))

"""Extract selected frames from the user-supplied SFIII sheets.
Run: python3 scripts/extract-ryu-dudley.py /path/to/Ryu.png /path/to/Dudley.png
Requires Pillow and NumPy. The source sheets remain outside the project.
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image

out = Path(__file__).resolve().parents[1] / 'apps/client/public/assets/sf3'
# (scanline, tile index) pairs. The sheets' one-pixel black dividers separate tiles.
sequences = {
 'ryu': {
  'idle':[(120,i) for i in [1,2,3,4,5,6,7,8,9,10,11,12]],
  'walk':[(120,i) for i in range(14,20)]+[(250,i) for i in range(0,7)],
  'back':[(250,i) for i in reversed(range(0,7))]+[(120,i) for i in reversed(range(14,20))],
  'jump':[(700,i) for i in [5,6,7,8]],
  'punch':[(1950,i) for i in [3,2,1,0,2,3]],
  'kick':[(2800,i) for i in [3,4,5,6,7,8,9]],
  'special':[(3500,i) for i in [0,1,2,3,4,5,6,7,8,9,10]],
  'super':[(3500,i) for i in [0,2,4,6,8,10,8,6]],
  'fall':[(1180,i) for i in [2,3]]+[(1300,i) for i in [0,1,2]],
  'landing':[(1300,i) for i in [3,4,5,6,7]],
  'down':[(1300,8)],
  'rise':[(1900,i) for i in [0,1,2,3,4,5,6,7,8,9,10,11]],
 },
 'dudley': {
  'idle':[(120,i) for i in [1,2,3,4,5,6,7,6,5,4,3,2]],
  'walk':[(250,i) for i in range(5,17)],
  'back':[(250,i) for i in reversed(range(5,17))],
  'jump':[(700,i) for i in [5,7,8,9]],
  'punch':[(2600,i) for i in [1,0,0,1,2]],
  # This sheet has no leg-kick clip, so use his stable guard pose under the
  # replaceable procedural kick-leg overlay. 1680 is a fall row, not a kick.
  'kick':[(120,i) for i in [1,2,3,4,5,6,5,4]],
  'special':[(2600,i) for i in [1,0,2,1,0,2,1,0,2,1]],
  'super':[(2950,i) for i in [0,1,2,3,4,5,6,7,8]],
  'fall':[(1680,i) for i in [5,6,7,8,9,10,11]],
  'landing':[(1850,i) for i in [8,9,10,11,12]],
  'down':[(2000,0)],
  'rise':[(2000,i) for i in [0,3,4,5,6,7]],
 }}

def extract(name, path):
 im=Image.open(path).convert('RGB'); a=np.array(im); frames={}; tiles=[]; actions={}
 for action, coords in sequences[name].items():
  actions[action]=[]
  for y, index in coords:
   key=f'{y}-{index}'
   if key not in frames:
    mask=np.all(a[y-5:y+1] == 0,axis=2).all(axis=0)
    groups=[]
    for xx in np.flatnonzero(mask):
     x=int(xx)
     if not groups or x>groups[-1][-1]+1: groups.append([x])
     else: groups[-1].append(x)
    edges=[g[0] for g in groups if len(g)==1]
    left,right=edges[index:index+2]
    assert 30 < right-left < 240, (name,key,left,right)
    strip=a[:,left+1:right]
    has_magenta=np.sum(np.all(strip==[255,0,255],axis=2),axis=1)>5
    top=y; bottom=y
    while top>0 and has_magenta[top-1]:top-=1
    while bottom+1<im.height and has_magenta[bottom+1]:bottom+=1
    rgba=np.array(im.crop((left+1,top,right,bottom+1)).convert('RGBA'))
    rgba[np.all(rgba[:,:,:3]==[255,0,255],axis=2),3]=0
    tile=Image.fromarray(rgba).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Trim transparent sheet padding before aligning the visible sprite to its foot line.
    bounds=tile.getbbox()
    assert bounds is not None, (name,key,'empty frame')
    tile=tile.crop(bounds)
    if tile.width > 200 or tile.height > 155:
     tile.thumbnail((200,155), Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(200,180));canvas.paste(tile,((200-tile.width)//2,155-tile.height),tile)
    assert canvas.getbbox()[3] == 155, (name,key,'frame is not grounded')
    frames[key]=len(tiles);tiles.append(canvas)
   actions[action].append({'key':key,'duration':3 if action in ('walk','back') else 5})
 atlas=Image.new('RGBA',(1600,((len(tiles)+7)//8)*180))
 for i,tile in enumerate(tiles):atlas.paste(tile,((i%8)*200,(i//8)*180))
 atlas.save(out/f'{name}-animations.png')
 (out/f'{name}-animations.json').write_text(json.dumps({'frames':frames,'actions':actions},indent=2)+'\n')
 print(name,len(tiles),'frames',atlas.size)

if len(sys.argv)!=3:raise SystemExit(__doc__)
extract('ryu',sys.argv[1]);extract('dudley',sys.argv[2])

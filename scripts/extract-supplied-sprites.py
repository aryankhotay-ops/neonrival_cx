"""Extract selected frames from the user-supplied SFIII sheets.
Run: python3 scripts/extract-supplied-sprites.py /path/to/Elena.png /path/to/Gill.png
Requires Pillow and NumPy. The source sheets remain outside the project.
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image

out = Path(__file__).resolve().parents[1] / 'apps/client/public/assets/sf3'
# (scanline, tile index) pairs. The sheets' one-pixel black dividers separate tiles.
sequences = {
 'elena': {
  'idle':[(110,i) for i in [0,1,2,3,4,3,2,1]],
  # One complete, evenly paced gait cycle; the former 24-frame clip crossed
  # unrelated rows and made her feet slide between poses.
  'walk':[(220,i) for i in range(11,19)],
  'back':[(220,i) for i in reversed(range(11,19))],
  'jump':[(735,i) for i in [10,11,12]],
  'punch':[(1720,i) for i in [0,1,2,3,4,3,2]],
  'kick':[(2100,i) for i in [4,5,6,7,8,6,5]],
  'special':[(2100,i) for i in [4,5,6,7,8,7,6,5]],
  'super':[(1980,i) for i in [0,1,2,3,4,5,6,2,3,4,5,6]],
  'fall':[(3500,i) for i in [3,4,5]], 'landing':[(3500,i) for i in [5,6,7]],
  'down':[(3500,7)], 'rise':[(3100,i) for i in [1,2,3,4,5,6]],
 },
 'gill': {
  'idle':[(1100,i) for i in [7,8,9,10,11,10,9,8]],
  'walk':[(750,i) for i in range(0,11)],
  'back':[(750,i) for i in reversed(range(0,11))],
  'jump':[(650,i) for i in [0,1,2,3]],
  'punch':[(1100,i) for i in [4,5,6,7]],
  'kick':[(1950,i) for i in [0,3,5,6,8]],
  'special':[(1950,i) for i in [0,3,5,6,8,6,5]],
  'super':[(4000,i) for i in [6,8,10]] + [(1100,i) for i in [7,8,9,10,11]],
  'fall':[(4000,i) for i in [0,1,2,3]], 'landing':[(4000,i) for i in [3,4,5]],
  'down':[(4000,6)], 'rise':[(4000,i) for i in [8,10]],
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
extract('elena',sys.argv[1]);extract('gill',sys.argv[2])

"""Append reviewed stance clips to existing atlases from the supplied PNG sheets.
Run with the directory containing the four user-supplied sheets as the argument.
Ken's additional clips are a recolored Ryu placeholder; Dudley's kicks use the
existing replaceable leg overlay because his boxing sheet contains no kicks.
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/'apps/client/public/assets/sf3'
source=Path(sys.argv[1])
def seq(y,indices):return [(y,i) for i in indices]
clips={
 'ryu':{'crouch':seq(350,[4]),'crouchPunch':seq(2700,[3,4,5,6,7,3]),'kick':seq(2350,[2,4,5,6,7,8,4,2]),'crouchKick':seq(2800,[3,4,5,6,7,8,9,3])},
 'elena':{'crouch':seq(550,[4]),'crouchPunch':seq(550,[4,5,6,7,6,5,4]),'kick':seq(1820,[1,2,3,4,5,6,7,8,9]),'crouchKick':seq(2100,[4,5,6,7,8,7,6,5,4])},
 'gill':{'crouch':seq(2150,[2]),'crouchPunch':seq(2150,[2,3,4,5,6,2]),'kick':seq(1950,[0,2,3,5,6,7,8,0]),'crouchKick':seq(2400,[4,5,6,7,8,9,6,4])},
 'dudley':{'crouch':seq(500,[4]),'crouchPunch':seq(3250,[9,10,11,12,11,10,9]),'crouchKick':seq(500,[4,5,6,5,4])},
}
def crop(im,a,y,index):
 mask=np.all(a[y-5:y+1]==0,axis=2).all(axis=0);groups=[]
 for xx in np.flatnonzero(mask):
  x=int(xx)
  if not groups or x>groups[-1][-1]+1:groups.append([x])
  else:groups[-1].append(x)
 edges=[g[0] for g in groups if len(g)==1];left,right=edges[index:index+2]
 assert 30<right-left<340,(y,index,left,right)
 strip=a[:,left+1:right];mag=np.sum(np.all(strip==[255,0,255],axis=2),axis=1)>5;top=bottom=y
 while top>0 and mag[top-1]:top-=1
 while bottom+1<im.height and mag[bottom+1]:bottom+=1
 rgba=np.array(im.crop((left+1,top,right,bottom+1)).convert('RGBA'));rgba[np.all(rgba[:,:,:3]==[255,0,255],axis=2),3]=0
 t=Image.fromarray(rgba).transpose(Image.Transpose.FLIP_LEFT_RIGHT);t=t.crop(t.getbbox())
 if t.width>200 or t.height>155:t.thumbnail((200,155),Image.Resampling.NEAREST)
 canvas=Image.new('RGBA',(200,180));canvas.alpha_composite(t,((200-t.width)//2,155-t.height));return canvas
for name,actions in clips.items():
 im=Image.open(next(source.glob('*Fighters - '+name.title()+'.png'))).convert('RGB');a=np.array(im)
 data=json.loads((root/f'{name}-animations.json').read_text());old=Image.open(root/f'{name}-animations.png').convert('RGBA');tiles=[]
 for n in range(len(data['frames'])):tiles.append(old.crop(((n%8)*200,(n//8)*180,(n%8+1)*200,(n//8+1)*180)))
 for action,coords in actions.items():
  data['actions'][action]=[]
  for y,i in coords:
   key=f'stance-{y}-{i}'
   if key not in data['frames']:data['frames'][key]=len(tiles);tiles.append(crop(im,a,y,i))
   data['actions'][action].append({'key':key,'duration':5})
 atlas=Image.new('RGBA',(1600,((len(tiles)+7)//8)*180))
 for n,t in enumerate(tiles):atlas.alpha_composite(t,((n%8)*200,(n//8)*180))
 atlas.save(root/f'{name}-animations.png');(root/f'{name}-animations.json').write_text(json.dumps(data,indent=2)+'\n')
# Match the four missing Ken stance clips to the same reviewed Ryu clips.
r=json.loads((root/'ryu-animations.json').read_text());k=json.loads((root/'ken-animations.json').read_text());ra=Image.open(root/'ryu-animations.png').convert('RGBA');ka=Image.open(root/'ken-animations.png').convert('RGBA');tiles=[ka.crop(((n%8)*200,(n//8)*180,(n%8+1)*200,(n//8+1)*180)) for n in range(len(k['frames']))]
for action in ['crouch','punch','crouchPunch','kick','crouchKick']:
 k['actions'][action]=[]
 for f in r['actions'][action]:
  key='stance-ryu-'+f['key']
  if key not in k['frames']:
   n=r['frames'][f['key']];t=ra.crop(((n%8)*200,(n//8)*180,(n%8+1)*200,(n//8+1)*180));p=np.array(t);rgb=p[:,:,:3].astype(int);gray=(rgb.max(axis=2)-rgb.min(axis=2)<35)&(rgb.min(axis=2)>80)&(p[:,:,3]>0)
   p[gray,0]=np.minimum(245,rgb[gray,0]);p[gray,1]=(rgb[gray,1]*.22).astype('uint8');p[gray,2]=(rgb[gray,2]*.18).astype('uint8');k['frames'][key]=len(tiles);tiles.append(Image.fromarray(p))
  k['actions'][action].append({'key':key,'duration':f['duration']})
atlas=Image.new('RGBA',(1600,((len(tiles)+7)//8)*180))
for n,t in enumerate(tiles):atlas.alpha_composite(t,((n%8)*200,(n//8)*180))
atlas.save(root/'ken-animations.png');(root/'ken-animations.json').write_text(json.dumps(k,indent=2)+'\n')

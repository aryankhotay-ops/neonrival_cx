"""Build reviewed clips from the user-supplied sheets and existing atlases.
Usage: python scripts/review-fighter-animations.py /path/to/sheets
Requires Pillow and NumPy. Coordinates refer to the original, unscaled PNGs.
Dudley has no kicks and Elena has no hand-strike normals in these sheets:
those four clips are explicit, whole-sprite adaptations of their source limbs.
No extra limb is rendered on top of an unchanged body at runtime.
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'apps/client/public/assets/sf3'
SOURCE=Path(sys.argv[1])
SIZE=(200,180)

def polygon_piece(tile,points):
 mask=Image.new('L',SIZE);ImageDraw.Draw(mask).polygon(points,fill=255)
 piece=tile.copy();piece.putalpha(Image.fromarray(np.minimum(np.array(tile.getchannel('A')),np.array(mask))))
 return piece

def move_piece(piece,a,b,c,d):
 """Nearest-neighbour affine bone transform, source a→b to destination c→d."""
 v=np.array(b)-a;w=np.array(d)-c
 scale=np.linalg.norm(w)/np.linalg.norm(v);angle=math.atan2(w[1],w[0])-math.atan2(v[1],v[0])
 co,si=math.cos(angle)*scale,math.sin(angle)*scale
 matrix=np.array([[co,-si],[si,co]]);inv=np.linalg.inv(matrix);offset=np.array(a)-inv@c
 return piece.transform(SIZE,Image.Transform.AFFINE,tuple(inv[0])+tuple([offset[0]])+tuple(inv[1])+tuple([offset[1]]),Image.Resampling.NEAREST)

def adapted(tile,parts,targets,limb_source=None,erase_parts=None):
 body=tile.copy();mask=Image.new('L',SIZE);draw=ImageDraw.Draw(mask)
 for points,_,_ in (erase_parts or parts):draw.polygon(points,fill=255)
 alpha=np.array(body.getchannel('A'));alpha[np.array(mask)>0]=0;body.putalpha(Image.fromarray(alpha))
 # Composite the detached pieces before the body, preserving the hip/shoulder seam.
 result=Image.new('RGBA',SIZE)
 for (points,a,b),(c,d) in zip(parts,targets):result.alpha_composite(move_piece(polygon_piece(limb_source or tile,points),a,b,c,d))
 result.alpha_composite(body)
 return result

def source_tile(name,y,index):
 im,a=sheets[name]
 mask=np.all(a[y-5:y+1]==0,axis=2).all(axis=0);groups=[]
 for xx in np.flatnonzero(mask):
  x=int(xx)
  if not groups or x>groups[-1][-1]+1:groups.append([x])
  else:groups[-1].append(x)
 edges=[g[0] for g in groups if len(g)==1];left,right=edges[index:index+2]
 assert 25<right-left<350,(name,y,index,left,right)
 mag=np.sum(np.all(a[:,left+1:right]==[255,0,255],axis=2),axis=1)>5;top=bottom=y
 while top>0 and mag[top-1]:top-=1
 while bottom+1<im.height and mag[bottom+1]:bottom+=1
 p=np.array(im.crop((left+1,top,right,bottom+1)).convert('RGBA'));p[np.all(p[:,:,:3]==[255,0,255],axis=2),3]=0
 tile=Image.fromarray(p).transpose(Image.Transpose.FLIP_LEFT_RIGHT);tile=tile.crop(tile.getbbox())
 # One scale per character, not a different scale for every pose.
 factor=scales[name];tile=tile.resize((round(tile.width*factor),round(tile.height*factor)),Image.Resampling.NEAREST)
 assert tile.width<=200 and tile.height<=170,(name,y,index,tile.size)
 canvas=Image.new('RGBA',SIZE);canvas.alpha_composite(tile,((200-tile.width)//2,155-tile.height))
 return canvas

def recolor_ken(tile):
 p=np.array(tile);rgb=p[:,:,:3].astype(int);gray=(rgb.max(axis=2)-rgb.min(axis=2)<35)&(rgb.min(axis=2)>80)&(p[:,:,3]>0)
 p[gray,0]=np.minimum(245,rgb[gray,0]);p[gray,1]=(rgb[gray,1]*.22).astype('uint8');p[gray,2]=(rgb[gray,2]*.18).astype('uint8')
 return Image.fromarray(p)

sheets={}
for name in ['elena','gill','ryu','dudley']:
 im=Image.open(next(SOURCE.glob('*Fighters - '+name.title()+'.png'))).convert('RGB');sheets[name]=(im,np.array(im))
# The source normal sprites fit at native resolution; Gill's tallest poses need a
# constant reduction. Keep each character at the same scale across its new clips.
scales={'elena':1,'gill':.9,'ryu':1,'dudley':1}

for name in ['elena','gill','dudley','ryu','ken']:
 data=json.loads((ASSETS/f'{name}-animations.json').read_text());atlas=Image.open(ASSETS/f'{name}-animations.png').convert('RGBA')
 tiles=[atlas.crop((n%8*200,n//8*180,n%8*200+200,n//8*180+180)) for n in range(len(data['frames']))]
 def existing(key):return tiles[data['frames'][key]]
 def add(key,tile):
  if key in data['frames']:tiles[data['frames'][key]]=tile
  else:data['frames'][key]=len(tiles);tiles.append(tile)
  return key
 def source(y,i,from_name=None):
  char=from_name or name;key=f'review-{char}-{y}-{i}';tile=source_tile(char,y,i)
  if name=='ken':tile=recolor_ken(tile)
  return add(key,tile)
 def clip(action,startup,active,recovery):
  phases={'startup':startup,'active':active,'recovery':recovery};data.setdefault('attackPhases',{})[action]=phases
  data['actions'][action]=[{'key':k,'duration':4} for part in phases.values() for k in part]

 if name=='dudley':
  standing=existing('120-1');crouching=existing('stance-500-4')
  standing_parts=[([(100,90),(115,87),(130,103),(130,115),(112,122),(101,108)],(107,96),(120,113)), ([(112,111),(130,108),(132,131),(128,139),(111,139),(108,124)],(120,113),(120,138)), ([(109,135),(130,135),(144,141),(144,148),(113,148),(108,143)],(120,138),(138,143))]
  crouch_parts=[([(108,116),(126,116),(140,125),(138,135),(120,139),(105,128)],(113,123),(131,130)), ([(121,127),(139,127),(139,140),(133,146),(118,143),(116,137)],(131,130),(129,141)), ([(110,134),(140,134),(152,144),(152,156),(110,156)],(129,141),(140,147))]
  for action,base,parts,pose in [('kick',standing,standing_parts,[(107,96),(130,91),(156,94),(174,96)]),('crouchKick',crouching,crouch_parts,[(113,123),(138,130),(162,139),(180,142)])]:
   keys=[]
   for i,t in enumerate([0,.35,.7,1]):
    targets=[]
    for j,(_,a,b) in enumerate(parts):targets.append((tuple(np.array(a)*(1-t)+np.array(pose[j])*t),tuple(np.array(b)*(1-t)+np.array(pose[j+1])*t)))
    tile=base.copy() if i==0 else adapted(base,standing_parts if action=='crouchKick' else parts,targets,standing if action=='crouchKick' else None,parts)
    assert tile.getbbox()[3]<=156,(action,i,tile.getbbox())
    keys.append(add(f'adapted-{action}-{i}',tile))
   clip(action,keys[:3],[keys[3]],list(reversed(keys[:3])))
  # Actual rapid-punch and corkscrew-extension poses, not a normal jab/body blow.
  clip('punch',['120-1','2600-1'],['2600-0'],['2600-1','120-1'])
  clip('crouchPunch',['stance-500-4','stance-3250-10','stance-3250-11'],['stance-3250-12'],['stance-3250-11','stance-3250-10','stance-500-4'])
  clip('special',['120-1',source(4650,0)],[source(4650,i) for i in [1,2,3,2,4]],[source(4650,5),'120-1'])
  clip('super',['120-1',source(4150,8),source(4150,9)],[source(5100,i) for i in [0,1,2,3,4]],[source(5100,5),source(5100,7),'120-1'])
  data['adaptations']={'kick':'Source-leg articulation; not an original SFIII kick.','crouchKick':'Source-leg articulation; not an original SFIII sweep.'}
 if name=='elena':
  # Replace the original forward arm as a complete raster limb, retaining the rear
  # arm. This is a game-specific palm normal, not Elena's original kick-only normal.
  for action,key,parts,pose in [
   ('punch','110-0', [([(128,85),(135,85),(144,91),(143,99),(135,98),(130,93)],(131,88),(140,95)), ([(138,90),(148,88),(158,90),(160,98),(150,101),(140,99)],(140,95),(154,95))],[(131,88),(147,88),(169,86)]),
   ('crouchPunch','stance-550-4', [([(103,103),(112,103),(122,113),(123,121),(114,124),(104,115)],(109,107),(119,118)), ([(117,114),(128,111),(139,108),(149,109),(149,117),(136,125),(118,124)],(119,118),(141,116))],[(109,107),(131,113),(159,109)])]:
   base=existing(key);keys=[]
   for i,t in enumerate([0,.45,1]):
    targets=[(tuple(np.array(a)*(1-t)+np.array(pose[j])*t),tuple(np.array(b)*(1-t)+np.array(pose[j+1])*t)) for j,(_,a,b) in enumerate(parts)]
    tile=base.copy() if i==0 else adapted(base,standing_parts if action=='crouchKick' else parts,targets,standing if action=='crouchKick' else None,parts)
    assert tile.getbbox()[3]<=156,(action,i,tile.getbbox())
    keys.append(add(f'adapted-{action}-{i}',tile))
   clip(action,keys[:2],[keys[2]],list(reversed(keys[:2])))
  clip('kick',[f'stance-1820-{i}' for i in [1,2,3]],['stance-1820-4','stance-1820-5','stance-1820-6'],[f'stance-1820-{i}' for i in [7,8,9]])
  clip('crouchKick',[f'stance-2100-{i}' for i in [4,5,6]],['stance-2100-7','stance-2100-8'],[f'stance-2100-{i}' for i in [6,5,4]])
  # Advancing horn kick and a clearly different acrobatic super combination.
  clip('special',['110-0',source(4550,0),source(4550,1),source(4550,2)],[source(4550,i) for i in [3,4,5]],[source(2350,i) for i in [6,7,8,9,10,11,12]]+['110-0'])
  clip('super',['110-0','1980-0','1980-2'],['1980-3','1980-4',source(4550,4),source(4550,5)],['1980-5','1980-6','110-0'])
  # Ping-pong this short transitional gait rather than snapping from its upright
  # final frame straight to the low first frame.
  for action in ['walk','back']:
   seq=data['actions'][action];data['actions'][action]=seq[:8]+list(reversed(seq[1:7]))
  data['adaptations']={'punch':'Source-arm palm articulation; original sheet uses kick normals.','crouchPunch':'Source-arm palm articulation; original sheet uses kick normals.'}
 if name=='gill':
  clip('punch',['1100-7','1100-4'],['1100-5','1100-6'],['1100-4','1100-7'])
  clip('crouchPunch',['stance-2150-2','stance-2150-3'],['stance-2150-4','stance-2150-5'],['stance-2150-6','stance-2150-2'])
  clip('kick',['stance-1950-0','stance-1950-2','stance-1950-3'],['stance-1950-5','stance-1950-6'],['stance-1950-7','stance-1950-8','stance-1950-0'])
  clip('crouchKick',['stance-2400-4','stance-2400-5','stance-2400-6'],['stance-2400-7','stance-2400-8'],['stance-2400-9','stance-2400-6','stance-2400-4'])
  clip('special',['1100-7',source(3000,0),source(3000,1)],[source(3000,i) for i in [3,4,5,6]],[source(3150,4),source(3150,5),'1100-7'])
  clip('super',[source(6000,3),source(6000,4),source(6000,6),source(6100,0)],[source(6100,i) for i in [2,3,4,5,6]],['1100-7','1100-8'])
 if name in ['ryu','ken']:
  # Keep their reviewed normal art, but line up the contact pose with hit frames.
  prefix='' if name=='ryu' else 'stance-ryu-'
  clip('punch',[prefix+'1950-3',prefix+'1950-2'],[prefix+'1950-1',prefix+'1950-0'],[prefix+'1950-2',prefix+'1950-3'])
  sp='' if name=='ryu' else 'stance-ryu-'
  clip('crouchPunch',[sp+'stance-2700-3'],[sp+'stance-2700-4',sp+'stance-2700-5'],[sp+'stance-2700-6',sp+'stance-2700-7',sp+'stance-2700-3'])
  clip('kick',[sp+'stance-2350-2',sp+'stance-2350-4',sp+'stance-2350-5'],[sp+'stance-2350-6',sp+'stance-2350-7'],[sp+'stance-2350-8',sp+'stance-2350-4',sp+'stance-2350-2'])
  clip('crouchKick',[sp+'stance-2800-3',sp+'stance-2800-4',sp+'stance-2800-5'],[sp+'stance-2800-6',sp+'stance-2800-7'],[sp+'stance-2800-8',sp+'stance-2800-9',sp+'stance-2800-3'])
  if name=='ken':
   clip('special',[source(3650,i,'ryu') for i in [0,1,2,3]],[source(3650,i,'ryu') for i in [5,6,7]],[source(3650,i,'ryu') for i in [8,9,10,11,12]])
   clip('super',[source(3650,i,'ryu') for i in [0,2,3]],[source(3650,i,'ryu') for i in [5,6,7,8,9]],[source(3650,i,'ryu') for i in [10,11,12]])
  else:
   clip('special',[f'3500-{i}' for i in [0,1,2]],[f'3500-{i}' for i in [3,4,5,6]],[f'3500-{i}' for i in [7,8,9,10]])
   clip('super',[f'3500-{i}' for i in [0,1,2]],[f'3500-{i}' for i in [3,4,5,6]],[f'3500-{i}' for i in [7,8,9,10]])
 # Align the pelvis across gait frames. Bounding-box centering alone follows
 # Gill's hair and Elena's extended hands, making the body jump sideways.
 if name in ['elena','gill','dudley']:
  fraction={'elena':.35,'gill':.55,'dudley':.45}[name]
  def pelvis_x(tile):
   bounds=tile.getbbox();y=round(bounds[1]+(bounds[3]-bounds[1])*fraction)
   yy,xx=np.where(np.array(tile.getchannel('A'))[y-2:y+3]>0)
   return float(np.median(xx))
  target=pelvis_x(existing(data['actions']['idle'][0]['key']));data['frameOffsets']={}
  for action in ['walk','back']:
   for f in data['actions'][action]:
    n=data['frames'][f['key']];data['frameOffsets'][n]={'x':round(max(-18,min(18,target-pelvis_x(tiles[n])))),'y':0}
 for action,phases in data['attackPhases'].items():
  for keys in phases.values():
   for key in keys:assert key in data['frames'],(name,action,key)
 atlas=Image.new('RGBA',(1600,math.ceil(len(tiles)/8)*180))
 for n,tile in enumerate(tiles):atlas.alpha_composite(tile,(n%8*200,n//8*180))
 atlas.save(ASSETS/f'{name}-animations.png');(ASSETS/f'{name}-animations.json').write_text(json.dumps(data,indent=2)+'\n')
 print(name,len(tiles),'frames')

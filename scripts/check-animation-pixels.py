"""Validate exported sprite cells; requires Pillow and NumPy."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/'apps/client/public/assets/sf3'
for name in ['elena','gill','ryu','ken','dudley']:
 data=json.loads((root/f'{name}-animations.json').read_text());im=Image.open(root/f'{name}-animations.png').convert('RGBA');p=np.array(im)
 assert not np.any(np.all(p[:,:,:3]==[255,0,255],axis=2)&(p[:,:,3]>0)),(name,'opaque background key')
 for action,seq in data['actions'].items():
  for frame in seq:
   n=data['frames'][frame['key']];tile=im.crop((n%8*200,n//8*180,n%8*200+200,n//8*180+180));bounds=tile.getbbox();assert bounds,(name,action,frame['key'])
   if frame['key'].startswith('adapted-'):assert bounds[3]<=156,(name,action,'foot below baseline')
 if name=='dudley':
  n=data['frames'][data['attackPhases']['kick']['active'][0]];p=np.array(im.crop((n%8*200,n//8*180,n%8*200+200,n//8*180+180)))
  assert not np.any(p[140:155,105:150,3]),'Standing kick still has the old planted front foot'
  n=data['frames'][data['attackPhases']['crouchKick']['active'][0]];p=np.array(im.crop((n%8*200,n//8*180,n%8*200+200,n//8*180+180)))
  assert not np.any(p[145:155,120:142,3]),'Sweep still has the old planted front foot'
print('PASS: all five atlases have nonempty clips and no opaque magenta; adapted limbs stay grounded; Dudley kick/sweep remove the original planted foot.')

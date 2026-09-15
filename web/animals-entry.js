'use strict';
const {person}=require('../src/ui/draw');
const {SPECIES}=require('../src/ui/animals');
const grid=document.getElementById('animals');
SPECIES.forEach((animal,index)=>{
  const card=document.createElement('article'),title=document.createElement('h2');
  title.textContent=animal.label;card.appendChild(title);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=280;
  canvas.setAttribute('aria-label',animal.label+'：普通、满足条件、条件冲突三个表情');
  const ctx=canvas.getContext('2d');ctx.scale(2,2);
  ['neutral','satisfied','conflict'].forEach((mood,i)=>{
    person(ctx,50+i*100,55,64,['#789D8B','#C48F6D','#8F9FB8'][index%3],index,mood);
    ctx.font='12px sans-serif';ctx.fillStyle='#697469';ctx.textAlign='center';
    ctx.fillText(['普通','满足','冲突'][i],50+i*100,119);
  });
  card.appendChild(canvas);grid.appendChild(card);
});

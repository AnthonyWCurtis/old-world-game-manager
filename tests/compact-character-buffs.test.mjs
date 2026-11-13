import test from 'node:test';
import assert from 'node:assert/strict';
import {compactBeneficialEffects} from '../docs/unit-view-modes.js';

const effect=(overrides={})=>({
 id:'reviewed-rule',name:'Reviewed Rule',quickLabel:'Reviewed buff',
 kind:'Special rule',sourceUrl:'https://tow.whfb.app/special-rules/reviewed-rule',
 status:'equipped',ownerName:'Character A',ownerIsCharacter:true,
 ownerId:'char-a',joinedFrom:'char-a',shared:true,beneficiaryId:'regiment-a',
 ...overrides
});

test('compact buff strip includes only projected joined benefits, not bearer-only kit',()=>{
 const result=compactBeneficialEffects([
  effect(),
  effect({id:'personal',name:'Personal armour',sourceUrl:'https://tow.whfb.app/magic-item/personal-armour',shared:false,joinedFrom:null}),
  effect({id:'bearer',name:'Personal bow',sourceUrl:'https://tow.whfb.app/magic-item/personal-bow',ownerIsCharacter:true,shared:true,joinedFrom:'char-a',status:'ready'})
 ]);
 assert.deepEqual(result.map(x=>x.label),['Reviewed buff']);
 assert.equal(result[0].category,'character');
});

test('same effect from different characters is shown once with both providers',()=>{
 const result=compactBeneficialEffects([
  effect(),effect({ownerName:'Character B',ownerId:'char-b',joinedFrom:'char-b'})
 ]);
 assert.equal(result.length,1);
 assert.deepEqual(result[0].providers,['Character A','Character B']);
});

test('only currently active targeted spells appear, with separate colour category',()=>{
 const result=compactBeneficialEffects([
  effect({name:'Glittering Robe',quickLabel:null,kind:'Spell',status:'active',sourceUrl:'https://tow.whfb.app/spell/glittering-robe',shared:true,joinedFrom:null,ownerName:'Mage'}),
  effect({name:'Drain Magic',kind:'Spell',status:'resolved',sourceUrl:'https://tow.whfb.app/spell/drain-magic'})
 ]);
 assert.equal(result.length,1);
 assert.equal(result[0].label,'Glittering Robe');
 assert.equal(result[0].category,'magic');
});

test('conditional benefit is marked as conditional, not a confirmed modifier',()=>{
 const result=compactBeneficialEffects([effect({status:'conditional'})]);
 assert.equal(result[0].category,'conditional');
});

test('no effects means no speculative labels',()=>{
 assert.deepEqual(compactBeneficialEffects([]),[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublishedMagicItemUrl} from '../docs/unit-view-modes.js';

test('published magic items receive gold accent eligibility, regardless of army',()=>{
 for(const url of [
  'https://tow.whfb.app/magic-item/charmed-shield',
  'https://tow.whfb.app/magic-item/elixir-of-power',
  'https://tow.whfb.app/magic-item/reaver-bow',
  'https://tow.whfb.app/magic-items/razor-standard'
 ])assert.equal(isPublishedMagicItemUrl(url),true,url);
});

test('mundane upgrades and unverified links do not receive magic-item styling',()=>{
 for(const url of [
  'https://tow.whfb.app/weapons-of-war/hand-weapon',
  'https://tow.whfb.app/weapons-of-war/heavy-armour',
  'https://tow.whfb.app/special-rules/close-order',
  'https://other.example/magic-item/reaver-bow',
  'https://tow.whfb.app/magic-item/reaver-bow?guess=true',
  'https://tow.whfb.app/magic-item/',
  '',
  null
 ])assert.equal(isPublishedMagicItemUrl(url),false,String(url));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactLinkCategory} from '../docs/unit-view-modes.js';

test('colour categories use source URLs and generic command roles, not army names',()=>{
 assert.equal(compactLinkCategory('https://tow.whfb.app/weapons-of-war/warbow','Warbows'),'equipment');
 assert.equal(compactLinkCategory('https://tow.whfb.app/special-rules/close-order','Close Order','rules'),'rule');
 assert.equal(compactLinkCategory('https://tow.whfb.app/magic-item/razor-standard','Razor Standard'),'magic');
 assert.equal(compactLinkCategory('https://tow.whfb.app/magic-item/the-loremasters-cloak','The Loremaster\'s Cloak'),'magic');
 assert.equal(compactLinkCategory('https://tow.whfb.app/command-groups/champions','Sea Master'),'command');
 assert.equal(compactLinkCategory(null,'Musician'),'command');
 assert.equal(compactLinkCategory(null,'Standard bearer'),'command');
 assert.equal(compactLinkCategory(null,'Sea Master (Champion)'),'command');
 assert.equal(compactLinkCategory('https://tow.whfb.app/weapons-of-war/hand-weapon','Hand weapons'),'equipment');
 assert.equal(compactLinkCategory(null,'Unresolved special rule','rules'),'rule');
 assert.equal(compactLinkCategory('https://example.com/command-groups/champions','Generic'),'equipment');
 assert.equal(compactLinkCategory('https://tow.whfb.app/command-groups/champions?wrong=1','Generic'),'equipment');
});

test('compact saves reuse the existing defence projection, without new save formula',()=>{
 const file=readFileSync(new URL('../docs/unit-view-modes.js',import.meta.url),'utf8');
 assert.match(file,/originalSaves\.cloneNode\(true\)/);
 assert.match(file,/\.game-defence-panel \.game-defence-values/);
 assert.match(file,/summary\.after\(strip\)/);
 assert.doesNotMatch(file,/header\.after\(strip\)/);
 assert.doesNotMatch(file,/✧ Equipment & Special Rules/);
});

test('compact references use inline colour-coded text without pill decoration',()=>{
 const css=readFileSync(new URL('../docs/unit-view-modes.css',import.meta.url),'utf8');
 assert.match(css,/\.owc-link-command\{\s*color:#f0a87e!important/);
 assert.match(css,/\.owc-link-magic\{\s*color:#edc47d!important/);
 assert.match(css,/\.owc-link-rule\{\s*color:#91d4c2!important/);
 assert.match(css,/\.owc-link-equipment\{\s*color:#a9c9e8!important/);
 assert.match(css,/\.owc-effect-magic\{\s*color:#a8e7f2!important/);
 assert.match(css,/\.owc-effect-character,.*\.owc-effect-conditional/s);
 assert.match(css,/border:0!important;border-radius:0!important/);
 assert.match(css,/\.army-unit-card-body > \.owc-save-strip/);
 assert.match(css,/:not\(\.owc-save-strip\)/);
});

test('saving-throw reorder ships a new offline shell and versioned entrypoints',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(html,/unit-view-modes\\.css\\?v=20261114-saves-before-characteristics/);
 assert.match(html,/app\\.js\\?v=1\\.0\\.0-alpha\\.5-saves-before-characteristics/);
 assert.match(worker,/game-manager-v1-shell-20261114-saves-before-characteristics/);
 assert.match(worker,/cache\.addAll\(APP_SHELL/);
});

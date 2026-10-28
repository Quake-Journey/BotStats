import test from 'node:test';
import assert from 'node:assert/strict';
import {profileMatchQuery,matchPagination} from '../public/pagination.js';
import {createNavigation} from '../public/navigation.js';
test('profile match pages retain exact identity, filters and sort independently of the parent list',()=>{
  const p=new URLSearchParams('profile=pp&kind=human&page=8&profilePage=3&map=q2duel5&period=week&sort_matches=score&dir_matches=asc');
  const q=profileMatchQuery(p);assert.equal(q.get('page'),'3');assert.equal(q.get('identity'),'pp');assert.equal(q.get('map'),'q2duel5');assert.equal(q.get('sort_matches'),'score');assert.equal(q.get('period'),'week');
  p.delete('profilePage');assert.equal(profileMatchQuery(p).get('page'),'1');
  p.set('kind','bot');p.set('profile','David-X');assert.equal(profileMatchQuery(p).get('kind'),'bot');assert.equal(profileMatchQuery(p).get('identity'),'David-X');
});
test('profile pages show all 131 matches across seven pages, with correct boundary controls',()=>{
  const first=matchPagination({total:131,pages:7,page:1},{profile:true});assert.match(first,/Матчи 1–20 \/ 131/);assert.match(first,/data-profile-page="0" disabled/);assert.match(first,/data-profile-page="2" >Далее/);
  const last=matchPagination({total:131,pages:7,page:7},{profile:true,lang:'en'});assert.match(last,/Matches 121–131 \/ 131/);assert.match(last,/data-profile-page="8" disabled/);
  assert.match(matchPagination({total:25,pages:2,page:2}),/data-page="1"/);
});
test('opening another profile resets its match page, same-profile links and preference changes retain it',()=>{
  const params=new URLSearchParams('profile=pp&kind=human&profilePage=7');const {url}=createNavigation({base:'/botstats',params,getPreferences:()=>({lang:'ru',theme:'dark'})});
  assert.ok(!url({profile:'q',kind:'human'}).includes('profilePage'));assert.ok(url({profile:'pp'}).includes('profilePage=7'));assert.ok(url().includes('profilePage=7'));
});

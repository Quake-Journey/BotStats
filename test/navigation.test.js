import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation} from '../public/navigation.js';
const inspect=s=>new URL(s,'https://example.test');
test('inherited state changes while explicit map/date overrides and removals survive',()=>{
 const params=new URLSearchParams({view:'dynamics',map:'q2duel5',period:'month',status:'completed',page:'2'});
 let theme='auto';const routes=createNavigation({base:'/botstats',params,getPreferences:()=>({theme,lang:'ru'})});
 const extra={view:'matches',period:'custom',from:'2026-10-01',to:'2026-10-02',map:'q2duel5',status:null,page:null};
 theme='light';params.set('map','q3t2');params.set('period','year');params.set('q','q & "x"');
 const actual=inspect(routes.url(extra));
 assert.deepEqual(Object.fromEntries(actual.searchParams),{view:'matches',map:'q2duel5',period:'custom',theme:'light',lang:'ru',q:'q & "x"',from:'2026-10-01',to:'2026-10-02'});
 assert.equal(inspect(routes.url()).searchParams.get('map'),'q3t2');
 params.delete('q');assert.equal(inspect(routes.url(extra)).searchParams.has('q'),false);
});
test('about anchors and deliberate home reset preserve only their intended state',()=>{
 const params=new URLSearchParams({map:'q3t2',profile:'pp',sort_matches:'score'});
 const routes=createNavigation({base:'/botstats',params,getPreferences:()=>({theme:'dark',lang:'en'})});
 const about=inspect(routes.url({view:'about',profile:null},{hash:'#difficulty'}));
 assert.equal(about.pathname,'/botstats/about');assert.equal(about.hash,'#difficulty');assert.equal(about.searchParams.has('view'),false);assert.equal(about.searchParams.has('profile'),false);assert.equal(about.searchParams.get('map'),'q3t2');
 const home=inspect(routes.url({}, {home:true}));assert.deepEqual(Object.fromEntries(home.searchParams),{theme:'dark',lang:'en'});
});
test('navigation attributes escape player-controlled text in URL and metadata',()=>{
 const routes=createNavigation({base:'/botstats',params:new URLSearchParams(),getPreferences:()=>({theme:'auto',lang:'ru'})});
 const html=routes.link({profile:'"><img src=x onerror=alert(1)>&\''});
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&quot;'));assert.ok(html.includes('&lt;'));assert.ok(html.includes('data-route="'));
});

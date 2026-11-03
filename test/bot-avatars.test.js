import test from 'node:test';
import assert from 'node:assert/strict';
import {botAvatarKey,botAvatar} from '../public/bot-avatars.js';

test('bot avatar identity is stable across skill suffixes and capitalization',()=>{
  for(const name of ['Purri-X','purri-x[200]','PURRI-X>50'])assert.equal(botAvatarKey(name),'purri');
  assert.equal(botAvatarKey('Human-X[100]'),'human');
  assert.equal(botAvatarKey('OptiMus-X'),'optimus');
  assert.equal(botAvatarKey('../../private'),'mixedbot');
});
test('untrusted bot names never become asset paths or HTML; small views use small portraits',()=>{
  const small=botAvatar('Purri-X'),large=botAvatar('Purri-X',{size:'profile',eager:true});
  assert.match(small,/purri-128\.webp/);assert.doesNotMatch(small,/384/);assert.match(small,/loading="lazy"/);
  assert.match(large,/purri-384\.webp/);assert.match(large,/loading="eager"/);
  assert.doesNotMatch(botAvatar('\"><script>bad</script>'),/<script>|bad/);
});

// Keep link destinations (explicit overrides) separate from inherited page state.
// Updating only history leaves already-rendered hrefs stale, including new tabs.
const escapeAttribute=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createNavigation({base,params,getPreferences}) {
  function url(extra={}, {hash='',home=false}={}) {
    const q=home?new URLSearchParams():new URLSearchParams(params);
    for(const [key,value] of Object.entries(getPreferences()))q.set(key,value);
    for(const [key,value] of Object.entries(extra)) {
      if(value===null||value==='')q.delete(key);else q.set(key,value);
    }
    // A match-page number belongs to one identity, never to the next profile.
    if(q.get('profile')!==params.get('profile')||q.get('kind')!==params.get('kind'))q.delete('profilePage');
    const about=q.get('view')==='about';
    if(about)q.delete('view');
    return base+(about?'/about':'/')+'?'+q+hash;
  }
  function link(extra={},options={}) {
    return `href="${escapeAttribute(url(extra,options))}" data-route="${escapeAttribute(JSON.stringify({extra,options}))}"`;
  }
  function bind(anchor,extra={},options={}) {
    anchor.dataset.route=JSON.stringify({extra,options});
    anchor.setAttribute('href',url(extra,options));
  }
  function sync(root) {
    for(const anchor of root.querySelectorAll('a[data-route]')) {
      const {extra,options}=JSON.parse(anchor.dataset.route),href=url(extra,options);
      if(anchor.getAttribute('href')!==href)anchor.setAttribute('href',href);
    }
  }
  return {url,link,bind,sync};
}

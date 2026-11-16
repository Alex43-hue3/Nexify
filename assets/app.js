(() => {
'use strict';
const CONFIG = window.NEXIFY_CONFIG || {};
const LOCAL_KEY = 'nexify_content_cache_v2';
const PROFILE_KEY = 'nexify_profiles_v2';
const ACTIVE_PROFILE_KEY = 'nexify_active_profile_v2';
const FAV_KEY = 'nexify_favorites_v2';
const HISTORY_KEY = 'nexify_history_v2';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => { try { const u = new URL(String(value || ''), location.href); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `nxf-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
const demo = [
['Comedy Central','Comedy','https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=500&q=85',7.8],
['Comedy Gold','Comedy','https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=500&q=85',7.9],
['Demo Action Movie','Action','https://images.unsplash.com/photo-1536449770108-2f8d4e3d4c7c?w=500&q=85',7.5],
['Demo Comedy Movie','Comedy','https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&q=85',8],
['Jungle Fury','Action','https://images.unsplash.com/photo-1511497584788-876760111969?w=500&q=85',8],
['Laugh Out Loud','Comedy','https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=85',8.1],
['Mirage Warrior','Action','https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=85',7.9],
['Astro Guardian','Action','https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=500&q=85',7.6],
['Neon Heist','Drama','https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=500&q=85',7.1],
['Cosmic Odyssey','Sci-Fi','https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500&q=85',7.5],
['Quantum Heist','Sci-Fi','https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=500&q=85',8.2],
['Last Outpost','Drama','https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=500&q=85',6.9],
['Time Breaker','Action','https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&q=85',8.3],
['Urban Assault','Action','https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=500&q=85',7.2],
["Dragon's Fire",'Fantasy','https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=85',7.4],
['Rogue Harbor','Drama','https://images.unsplash.com/photo-1478720568477-152d9b164e27?w=500&q=85',7.3]
].map((x,i)=>({id:`sample-${i}`,type:'movie',title:x[0],category:x[1],image:x[2],rating:x[3],source:'mp4',url:'',demo:true}));

let remoteItems = [];
// Migrate browser-only data created by the previous NEXIFY prototype.
if (!localStorage.getItem(LOCAL_KEY)) {
  try { const legacy=JSON.parse(localStorage.getItem('nexify_content_v1')||'[]'); if(Array.isArray(legacy)) localStorage.setItem(LOCAL_KEY,JSON.stringify(legacy)); } catch {}
}
if (!localStorage.getItem(PROFILE_KEY)) {
  try { const legacy=JSON.parse(localStorage.getItem('nexify_profiles_v1')||'null'); if(Array.isArray(legacy)&&legacy.length) localStorage.setItem(PROFILE_KEY,JSON.stringify(legacy)); } catch {}
}
if (!localStorage.getItem(ACTIVE_PROFILE_KEY) && localStorage.getItem('nexify_active_profile_v1')) localStorage.setItem(ACTIVE_PROFILE_KEY,localStorage.getItem('nexify_active_profile_v1'));
if (!localStorage.getItem(FAV_KEY) && localStorage.getItem('nexify_favorites')) localStorage.setItem(FAV_KEY,localStorage.getItem('nexify_favorites'));
let view = 'movie', category = 'All', filter = '', hls = null, currentVideo = null;
let profiles = loadJson(PROFILE_KEY, [{id:'profile-default',name:'Demo',type:'adult'}]);
let activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY) || profiles[0].id;
if (!profiles.some(p => p.id === activeProfileId)) activeProfileId = profiles[0].id;
let favorites = new Set(loadJson(FAV_KEY, []));
let history = loadJson(HISTORY_KEY, []);
let collapsed = false, lastHistoryWrite = 0;

function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function allItems() { return [...demo, ...remoteItems]; }
function activeProfile() { return profiles.find(p => p.id === activeProfileId) || profiles[0]; }
function profileKey(id) { return `${id}::`; }
function isFavorite(id) { return favorites.has(profileKey(activeProfileId)+id) || favorites.has(id); }
function setStatus(message, state='info') { const el=$('catalogStatus'); if (el) { el.textContent=message; el.dataset.state=state; } }
function githubRawUrl() {
  if (CONFIG.rawBase) return `${String(CONFIG.rawBase).replace(/\/$/,'')}/${CONFIG.catalogPath || 'data/catalog.json'}`;
  if (CONFIG.githubOwner && CONFIG.githubRepo && !/TU_USUARIO|TU_REPOSITORIO/.test(`${CONFIG.githubOwner}/${CONFIG.githubRepo}`))
    return `https://raw.githubusercontent.com/${encodeURIComponent(CONFIG.githubOwner)}/${encodeURIComponent(CONFIG.githubRepo)}/${encodeURIComponent(CONFIG.githubBranch || 'main')}/${(CONFIG.catalogPath || 'data/catalog.json').split('/').map(encodeURIComponent).join('/')}`;
  return '';
}
async function loadCatalog() {
  const raw = githubRawUrl();
  if (!raw) {
    remoteItems = loadJson(LOCAL_KEY, []);
    setStatus('Biblioteca local de respaldo · configura GitHub para sincronizar', 'warning');
    render(); return;
  }
  try {
    const response = await fetch(`${raw}?v=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('El catálogo JSON no contiene una lista válida.');
    remoteItems = data.map(normalizeItem).filter(Boolean);
    saveJson(LOCAL_KEY, remoteItems);
    setStatus(`Biblioteca sincronizada · ${remoteItems.length} elementos`, 'success');
  } catch (error) {
    remoteItems = loadJson(LOCAL_KEY, []);
    setStatus(`No se pudo actualizar GitHub. Mostrando caché local${remoteItems.length ? '' : ' vacía'}.`, 'warning');
    console.warn('NEXIFY catalog:', error);
  }
  render();
}
function normalizeItem(item) {
  if (!item || typeof item !== 'object' || !item.title) return null;
  const type = ['movie','series','channel'].includes(item.type) ? item.type : 'movie';
  return {...item, id:String(item.id || makeId()), type, title:String(item.title).trim(),
    category:String(item.category || 'General'), image:safeUrl(item.image), rating:Number(item.rating || 0)};
}
function itemsForView() {
  let items = filter === 'continue' ? allItems() : allItems().filter(x => x.type === view);
  if (filter === 'favorites') items = items.filter(x => isFavorite(x.id));
  if (filter === 'continue') {
    const seen = history.filter(x => x.profileId === activeProfileId);
    const ids = new Map(seen.map(x => [x.id, x.updatedAt]));
    items = items.filter(x => ids.has(x.id)).sort((a,b) => new Date(ids.get(b.id))-new Date(ids.get(a.id)));
  }
  if (category !== 'All') items = items.filter(x => String(x.category || 'General').toLowerCase() === category.toLowerCase());
  const q = $('searchInput').value.trim().toLowerCase();
  if (q) items = items.filter(x => `${x.title} ${x.category||''} ${x.description||''}`.toLowerCase().includes(q));
  const sort = $('sortSelect').value;
  if (sort === 'az') items.sort((a,b)=>a.title.localeCompare(b.title,'es'));
  if (sort === 'za') items.sort((a,b)=>b.title.localeCompare(a.title,'es'));
  if (sort === 'newest') items.sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  return items;
}
function renderCategories() {
  const list = allItems().filter(x=>x.type===view).map(x=>x.category||'General');
  const cats = [...new Set(list)].sort((a,b)=>a.localeCompare(b,'es'));
  $('categoryCount').textContent = cats.length;
  $('categoryList').innerHTML = ['All',...cats].map(c=>`<button type="button" data-category="${esc(c)}" class="${category===c?'selected':''}">${esc(c==='All'?'All':c)}</button>`).join('');
  $('categoryList').querySelectorAll('button').forEach(b=>{ b.hidden = !!$('categorySearch').value && !b.textContent.toLowerCase().includes($('categorySearch').value.toLowerCase()); });
}
function render() {
  const items = itemsForView();
  const labels = {movie:'Movies',series:'Series',channel:'Live TV'};
  $('catalogTitle').textContent = filter==='favorites'?'Favorite Movies':filter==='continue'?'Continue Watching':category==='All'?'All':category;
  $('catalogMeta').textContent = `${items.length} ${labels[view] || 'items'} · ${filter==='favorites'?'Favorites':filter==='continue'?'Recently watched':'NEXIFY library'}`;
  $('favoriteCount').textContent = favorites.size;
  const continueCount = history.filter(x=>x.profileId===activeProfileId).length;
  const continueButton = document.querySelector('[data-filter="continue"] small');
  if (continueButton) continueButton.textContent = continueCount;
  renderCategories();
  $('catalogGrid').innerHTML = items.length ? items.map(item => {
    const image = item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="poster-placeholder">${esc(item.title.slice(0,2).toUpperCase())}</div>`;
    const rating = Number(item.rating)>0 ? `<span class="rating">★ ${Number(item.rating).toFixed(1)}</span>` : '';
    return `<article class="catalog-card" data-id="${esc(item.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(item.title)}"><div class="cover">${image}${rating}<button type="button" class="favorite-btn ${isFavorite(item.id)?'is-favorite':''}" data-favorite="${esc(item.id)}" aria-label="${isFavorite(item.id)?'Quitar de favoritos':'Añadir a favoritos'}">${isFavorite(item.id)?'♥':'♡'}</button></div><div class="card-caption">${esc(item.title)}</div></article>`;
  }).join('') : '<div class="empty-catalog">No hay contenido en esta sección todavía.</div>';
}
function setView(next) {
  view=next; filter=''; category='All';
  document.querySelectorAll('.primary-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  render();
}
function saveHistory(item, seconds=0, duration=0) {
  history = history.filter(x=>!(x.id===item.id && x.profileId===activeProfileId));
  history.unshift({id:item.id,profileId:activeProfileId,seconds,duration,updatedAt:new Date().toISOString()});
  history=history.slice(0,100); saveJson(HISTORY_KEY,history);
}
function resolveUrl(item) {
  let url=String(item.url||'').trim();
  if (item.source==='drive') {
    const match=url.match(/\/file\/d\/([^/]+)/)||url.match(/[?&]id=([^&]+)/);
    if(match) url=`https://drive.google.com/file/d/${match[1]}/preview`;
  }
  if (item.source==='youtube') {
    try {
      const u=new URL(url); const id=u.hostname.includes('youtu.be')?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop();
      if(id) url=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    } catch {}
  }
  return safeUrl(url);
}
function createEpisodePicker(item, selectedSeason=0, selectedEpisode=0) {
  const seasons=Array.isArray(item.seasons)?item.seasons:[];
  if (!seasons.length) return '';
  return `<div class="episode-picker"><label>Temporada <select id="seasonSelect">${seasons.map((s,i)=>`<option value="${i}" ${i===selectedSeason?'selected':''}>${esc(s.title||`Temporada ${s.number||i+1}`)}</option>`).join('')}</select></label><label>Episodio <select id="episodeSelect"></select></label></div>`;
}
function fillEpisodes(item, seasonIndex=0, selectedEpisode=0) {
  const select=$('episodeSelect'); if(!select)return;
  const episodes=item.seasons?.[seasonIndex]?.episodes||[];
  select.innerHTML=episodes.map((ep,i)=>`<option value="${i}" ${i===selectedEpisode?'selected':''}>${esc(ep.title||`Episodio ${ep.number||i+1}`)}</option>`).join('');
  select.disabled=!episodes.length;
}
function play(item, episode=null, selectedSeason=0, selectedEpisode=0) {
  closePlayer(false);
  const title = episode ? `${item.title} · ${episode.title || `Episodio ${episode.number||1}`}` : item.title;
  $('playerTitle').textContent=title;
  $('playerStage').innerHTML='';
  const sourceItem=episode?{...item,...episode,source:episode.source||item.source}:item;
  const url=resolveUrl(sourceItem);
  if (!url) {
    $('playerStage').innerHTML=`<div class="player-placeholder">${item.demo?'Este título es una muestra visual. Agrega una fuente desde el panel administrativo.':'Este contenido todavía no tiene una fuente de reproducción válida.'}</div>`;
  } else if (['youtube','drive','facebook','iframe'].includes(sourceItem.source)) {
    const frame=document.createElement('iframe'); frame.src=url;
    frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin'; frame.title=title; $('playerStage').append(frame);
  } else {
    const video=document.createElement('video'); video.controls=true; video.autoplay=true; video.playsInline=true; video.preload='metadata';
    video.setAttribute('webkit-playsinline',''); $('playerStage').append(video); currentVideo=video;
    const startAt=history.find(x=>x.id===item.id&&x.profileId===activeProfileId)?.seconds||0;
    video.addEventListener('loadedmetadata',()=>{if(startAt>10&&startAt<video.duration-20)video.currentTime=startAt;});
    video.addEventListener('timeupdate',()=>{if(video.currentTime>0&&Date.now()-lastHistoryWrite>5000){lastHistoryWrite=Date.now();saveHistory(item,video.currentTime,video.duration||0);}});
    video.addEventListener('ended',()=>{history=history.filter(x=>!(x.id===item.id&&x.profileId===activeProfileId));saveJson(HISTORY_KEY,history);});
    video.addEventListener('error',()=>{const msg=document.createElement('p');msg.className='player-error';msg.textContent='No fue posible reproducir esta fuente. Comprueba que el enlace sea público y corresponda al formato seleccionado.';$('playerStage').append(msg);});
    if(sourceItem.source==='hls' && window.Hls && Hls.isSupported()) {
      hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:30,backBufferLength:30});
      hls.loadSource(url);hls.attachMedia(video);
      hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal){setStatus('Error en la fuente HLS. Revisa el enlace desde administración.','warning');hls.destroy();hls=null;}});
    } else if(sourceItem.source==='hls' && video.canPlayType('application/vnd.apple.mpegurl')) video.src=url;
    else video.src=url;
    video.play().catch(()=>{});
  }
  const picker=createEpisodePicker(item,selectedSeason,selectedEpisode);
  if(picker) {
    const wrap=document.createElement('div');wrap.className='episode-picker-wrap';wrap.innerHTML=picker;$('playerStage').after(wrap);
    $('seasonSelect').addEventListener('change',e=>fillEpisodes(item,Number(e.target.value)));
    fillEpisodes(item,selectedSeason,selectedEpisode);
    $('episodeSelect').addEventListener('change',e=>{const seasonIndex=Number($('seasonSelect').value),episodeIndex=Number(e.target.value),ep=item.seasons[seasonIndex].episodes[episodeIndex];if(ep)play(item,ep,seasonIndex,episodeIndex);});
  }
  $('playerModal').classList.remove('hidden');
}
function closePlayer(hide=true) {
  if(hls){hls.destroy();hls=null;}
  if(currentVideo){currentVideo.pause();currentVideo.removeAttribute('src');currentVideo.load();currentVideo=null;}
  
  const old=$('playerStage').nextElementSibling;
  if(old?.classList.contains('episode-picker-wrap'))old.remove();
  if(hide)$('playerModal').classList.add('hidden');
}
document.querySelectorAll('.primary-tab').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('catalogGrid').addEventListener('click',e=>{
  const fav=e.target.closest('[data-favorite]');
  if(fav){e.stopPropagation();const id=fav.dataset.favorite,key=profileKey(activeProfileId)+id;favorites.has(key)?favorites.delete(key):favorites.add(key);saveJson(FAV_KEY,[...favorites]);render();return;}
  const card=e.target.closest('[data-id]');if(card){const item=allItems().find(x=>x.id===card.dataset.id);if(item)play(item);}
});
$('catalogGrid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-id]')){e.preventDefault();const item=allItems().find(x=>x.id===e.target.dataset.id);if(item)play(item);}});
$('categoryList').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;filter='';render();}});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;category='All';if(filter==='favorites')view='movie';document.querySelectorAll('.primary-tab').forEach(t=>t.classList.toggle('active',filter===''&&t.dataset.view===view));render();}));
$('searchInput').addEventListener('input',render);$('sortSelect').addEventListener('change',render);
$('categorySearch').addEventListener('input',()=>renderCategories());
$('closePlayer').addEventListener('click',()=>closePlayer());
$('playerModal').addEventListener('click',e=>{if(e.target===$('playerModal'))closePlayer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePlayer();$('settingsModal').classList.add('hidden');$('profilePopover').classList.add('hidden');}});
$('collapseSide').addEventListener('click',()=>{collapsed=!collapsed;document.body.classList.toggle('sidebar-collapsed',collapsed);});

function initials(name){return String(name||'N').trim().slice(0,1).toUpperCase();}
function updateActiveProfile(){const profile=activeProfile();$('activeProfileName').textContent=profile.name;$('activeProfileLabel').textContent=profile.type==='kids'?'Perfil infantil':'Mi perfil';$('profileAvatar').textContent=initials(profile.name);}
function saveProfiles(){saveJson(PROFILE_KEY,profiles);localStorage.setItem(ACTIVE_PROFILE_KEY,activeProfileId);}
function renderProfileOptions(){$('profileOptions').innerHTML=profiles.map(p=>`<button class="profile-option ${p.id===activeProfileId?'active':''}" data-choose-profile="${esc(p.id)}"><span class="profile-avatar">${esc(initials(p.name))}</span><span>${esc(p.name)}<small>${p.type==='kids'?'Infantil':'Adulto'}${p.id===activeProfileId?' · Viendo ahora':''}</small></span></button>`).join('');}
const profileMenu=$('profileMenu'),profilePopover=$('profilePopover');
profileMenu.addEventListener('click',()=>{const opening=profilePopover.classList.contains('hidden');profilePopover.classList.toggle('hidden',!opening);profileMenu.setAttribute('aria-expanded',String(opening));if(opening)renderProfileOptions();});
$('profileOptions').addEventListener('click',e=>{const b=e.target.closest('[data-choose-profile]');if(!b)return;activeProfileId=b.dataset.chooseProfile;saveProfiles();updateActiveProfile();renderProfileOptions();profilePopover.classList.add('hidden');profileMenu.setAttribute('aria-expanded','false');render();});
document.addEventListener('click',e=>{if(!profilePopover.contains(e.target)&&!profileMenu.contains(e.target)){profilePopover.classList.add('hidden');profileMenu.setAttribute('aria-expanded','false');}});
function openSettings(){$('settingsModal').classList.remove('hidden');profilePopover.classList.add('hidden');renderManagedProfiles();}
$('settingsButton').addEventListener('click',openSettings);$('manageProfilesButton').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',()=>$('settingsModal').classList.add('hidden'));
$('settingsModal').addEventListener('click',e=>{if(e.target===$('settingsModal'))$('closeSettings').click();});
function renderManagedProfiles(){$('managedProfiles').innerHTML=profiles.map(p=>`<div class="managed-profile"><span class="profile-avatar">${esc(initials(p.name))}</span><div class="managed-profile-info"><strong>${esc(p.name)} ${p.id===activeProfileId?'· Activo':''}</strong><small>${p.type==='kids'?'Perfil infantil':'Perfil adulto'}</small></div><div class="profile-actions"><button data-edit-profile="${esc(p.id)}">Editar</button>${profiles.length>1?`<button class="delete" data-delete-profile="${esc(p.id)}">Eliminar</button>`:''}</div></div>`).join('');}
function showProfileEditor(profile=null){$('profileEditor').classList.remove('hidden');$('profileEditorTitle').textContent=profile?'Editar perfil':'Nuevo perfil';$('editingProfileId').value=profile?.id||'';$('profileNameInput').value=profile?.name||'';$('profileTypeInput').value=profile?.type||'adult';$('profileNameInput').focus();}
$('newProfileButton').addEventListener('click',()=>showProfileEditor());
$('cancelProfileEdit').addEventListener('click',()=>$('profileEditor').classList.add('hidden'));
$('profileEditor').addEventListener('submit',e=>{e.preventDefault();const id=$('editingProfileId').value,name=$('profileNameInput').value.trim(),type=$('profileTypeInput').value;if(!name)return;if(id){const profile=profiles.find(p=>p.id===id);if(profile){profile.name=name;profile.type=type;}}else{const profile={id:makeId(),name,type};profiles.push(profile);activeProfileId=profile.id;}saveProfiles();updateActiveProfile();renderProfileOptions();renderManagedProfiles();$('profileEditor').classList.add('hidden');render();});
$('managedProfiles').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-profile]'),del=e.target.closest('[data-delete-profile]');if(edit){const profile=profiles.find(p=>p.id===edit.dataset.editProfile);if(profile)showProfileEditor(profile);}if(del&&profiles.length>1){profiles=profiles.filter(p=>p.id!==del.dataset.deleteProfile);if(activeProfileId===del.dataset.deleteProfile)activeProfileId=profiles[0].id;saveProfiles();updateActiveProfile();renderManagedProfiles();renderProfileOptions();render();}});
updateActiveProfile();
function tick(){const d=new Date();$('clock').textContent=d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});$('today').textContent=d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}
tick();setInterval(tick,30000);render();loadCatalog();
})();

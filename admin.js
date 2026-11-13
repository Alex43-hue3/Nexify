(() => {
'use strict';
const CONFIG=window.NEXIFY_CONFIG||{};
const TOKEN_KEY='nexify_github_token_session';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeId=()=>crypto.randomUUID?crypto.randomUUID():`nxf-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
let token=sessionStorage.getItem(TOKEN_KEY)||'';
let catalog=[],fileSha=null,repoInfo=null;
const owner=String(CONFIG.githubOwner||'').trim(),repo=String(CONFIG.githubRepo||'').trim();
const branch=String(CONFIG.githubBranch||'main').trim(),path=String(CONFIG.catalogPath||'catalog.json').replace(/^\/+/,'');
const configured=owner&&repo&&!/TU_USUARIO|TU_REPOSITORIO/.test(`${owner}/${repo}`);
function apiUrl(suffix=''){return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${suffix}`;}
function headers(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};}
function status(message,kind='info'){$('saveStatus').textContent=message;$('saveStatus').dataset.state=kind;}
function showError(message){$('loginError').textContent=message;}
function b64Encode(text){const bytes=new TextEncoder().encode(text);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary);}
function b64Decode(value){const binary=atob(value.replace(/\n/g,''));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
async function request(url,options={}){const response=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});let data={};try{data=await response.json();}catch{}if(!response.ok){const message=data.message||`GitHub API: ${response.status}`;throw new Error(message);}return data;}
async function connect() {
  if(!configured){showError('Primero configura githubOwner y githubRepo en assets/config.js.');return;}
  token=$('githubToken').value.trim();
  if(!token){showError('Introduce un token de GitHub.');return;}
  $('connectBtn').disabled=true;$('connectBtn').textContent='Verificando acceso…';showError('');
  try{
    const user=await request('https://api.github.com/user');
    repoInfo=await request(apiUrl());
    const permissions=repoInfo.permissions||{};
    if(repoInfo.private && !permissions.push) throw new Error('El token no tiene permisos de escritura en este repositorio.');
    await loadFromGitHub();
    sessionStorage.setItem(TOKEN_KEY,token);
    $('loginCard').classList.add('hidden');$('dashboard').classList.remove('hidden');
    $('connectionInfo').textContent=`${user.login} · ${owner}/${repo} · rama ${branch}`;
    render();status('Conexión establecida. Los cambios se publicarán directamente en GitHub.','success');
  }catch(error){showError(`No se pudo conectar: ${error.message}`);token='';sessionStorage.removeItem(TOKEN_KEY);}
  finally{$('connectBtn').disabled=false;$('connectBtn').textContent='Conectar con GitHub →';}
}
async function loadFromGitHub(){
  try{
    const file=await request(`${apiUrl(`contents/${path.split('/').map(encodeURIComponent).join('/')}`)}?ref=${encodeURIComponent(branch)}`);
    if(file.type!=='file')throw new Error('La ruta del catálogo no apunta a un archivo.');
    fileSha=file.sha;
    const parsed=JSON.parse(b64Decode(file.content||''));
    if(!Array.isArray(parsed))throw new Error('El catálogo debe contener un arreglo JSON.');
    catalog=parsed.map(normalize).filter(Boolean);
  }catch(error){
    if(!String(error.message).includes('Not Found'))throw error;
    fileSha=null;catalog=[];
    status('El catálogo todavía no existe. Se creará al publicar el primer contenido.','warning');
  }
}
function normalize(item){
  if(!item||typeof item!=='object'||!item.title)return null;
  const type=['movie','series','channel'].includes(item.type)?item.type:'movie';
  return {...item,id:String(item.id||makeId()),type,title:String(item.title).trim(),category:String(item.category||'General'),seasons:Array.isArray(item.seasons)?item.seasons:[]};
}
async function publish(message='Actualizar catálogo NEXIFY'){
  if(!token)throw new Error('La sesión de GitHub ha caducado. Vuelve a conectar.');
  const url=apiUrl(`contents/${path.split('/').map(encodeURIComponent).join('/')}`);
  let sha=fileSha;
  if(!sha){
    try{const current=await request(`${url}?ref=${encodeURIComponent(branch)}`);sha=current.sha;fileSha=sha;}catch(e){if(!String(e.message).includes('Not Found'))throw e;}
  }
  const body={message,branch,content:b64Encode(JSON.stringify(catalog,null,2)+'\n')};
  if(sha)body.sha=sha;
  const saved=await request(url,{method:'PUT',body:JSON.stringify(body)});
  fileSha=saved.content?.sha||null;
  status(`Publicado correctamente · commit ${saved.commit?.sha?.slice(0,7)||'creado'}. GitHub Pages puede tardar unos minutos en reflejarlo.`,'success');
  render();
}
function render(){
  $('statMovies').textContent=catalog.filter(x=>x.type==='movie').length;
  $('statSeries').textContent=catalog.filter(x=>x.type==='series').length;
  $('statChannels').textContent=catalog.filter(x=>x.type==='channel').length;
  $('statTotal').textContent=catalog.length;
  const q=$('adminSearch').value.trim().toLowerCase();
  const items=catalog.filter(x=>`${x.title} ${x.category||''}`.toLowerCase().includes(q));
  $('adminList').innerHTML=items.length?items.map(item=>`<div class="admin-item"><img class="admin-thumb" src="${esc(item.image||'')}" alt="" onerror="this.style.visibility='hidden'"><div class="admin-item-info"><strong>${esc(item.title)}</strong><small>${esc(item.type)} · ${esc(item.category||'General')}${item.type==='series'?` · ${(item.seasons||[]).reduce((n,s)=>n+(s.episodes||[]).length,0)} episodios`:''}</small></div><button class="edit-btn" type="button" data-edit="${esc(item.id)}">Editar</button><button class="delete-btn" type="button" data-delete="${esc(item.id)}">Eliminar</button></div>`).join(''):'<div class="empty-state">No hay elementos que coincidan con la búsqueda.</div>';
}
function clearForm(){ $('contentForm').reset();$('editingId').value='';$('episodeNumber').value='1';$('formHeading').textContent='Agregar contenido';$('saveContentBtn').textContent='＋ Publicar en GitHub';$('cancelEditBtn').classList.add('hidden');toggleSeries();}
function toggleSeries(){$('seriesFields').classList.toggle('hidden',$('contentType').value!=='series');}
function editItem(item){
  $('editingId').value=item.id;$('contentType').value=item.type;$('contentCategory').value=item.category||'';$('contentTitle').value=item.title;$('contentDescription').value=item.description||'';$('contentImage').value=item.image||'';$('contentRating').value=item.rating||'';$('contentYear').value=item.year||'';$('contentSource').value=item.source||'mp4';$('contentUrl').value=item.url||'';$('contentFeatured').checked=!!item.featured;
  $('formHeading').textContent='Editar contenido';$('saveContentBtn').textContent='Guardar cambios en GitHub';$('cancelEditBtn').classList.remove('hidden');toggleSeries();
  if(item.type==='series'){$('seriesFields').classList.remove('hidden');$('seasonTitle').value=item.seasons?.[0]?.title||'Temporada 1';}
  $('contentTitle').focus();window.scrollTo({top:0,behavior:'smooth'});
}
$('connectBtn').addEventListener('click',connect);
$('githubToken').addEventListener('keydown',e=>{if(e.key==='Enter')connect();});
$('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem(TOKEN_KEY);token='';catalog=[];$('dashboard').classList.add('hidden');$('loginCard').classList.remove('hidden');$('githubToken').value='';});
$('contentType').addEventListener('change',toggleSeries);
$('cancelEditBtn').addEventListener('click',clearForm);
$('contentForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('editingId').value;
  const type=$('contentType').value;
  const title=$('contentTitle').value.trim();
  const url=$('contentUrl').value.trim();
  const episodeUrl=$('episodeUrl').value.trim();
  if(type!=='series'&&!url){status('Añade el enlace de reproducción.','warning');return;}
  if(type==='series'&&!id&&!episodeUrl&&!url){status('Añade al menos un enlace de episodio o una fuente de reproducción.','warning');return;}
  const previousCatalog=JSON.parse(JSON.stringify(catalog));
  let item=id?catalog.find(x=>x.id===id):null;
  if(!item){item={id:makeId(),createdAt:new Date().toISOString(),seasons:[]};catalog.unshift(item);}
  Object.assign(item,{type,title,category:$('contentCategory').value.trim()||'General',description:$('contentDescription').value.trim(),image:$('contentImage').value.trim(),rating:Number($('contentRating').value)||0,year:Number($('contentYear').value)||null,source:$('contentSource').value,url,featured:$('contentFeatured').checked,updatedAt:new Date().toISOString()});
  if(type==='series'&&(episodeUrl||url)){
    const seasonTitle=$('seasonTitle').value.trim()||'Temporada 1';
    let season=item.seasons.find(s=>(s.title||'').toLowerCase()===seasonTitle.toLowerCase());
    if(!season){season={number:item.seasons.length+1,title:seasonTitle,episodes:[]};item.seasons.push(season);}
    const episodeNumber=Number($('episodeNumber').value)||season.episodes.length+1;
    season.episodes.push({id:makeId(),number:episodeNumber,title:$('episodeTitle').value.trim()||`Episodio ${episodeNumber}`,url:episodeUrl||url,source:$('contentSource').value});
    season.episodes.sort((a,b)=>a.number-b.number);
  }
  $('saveContentBtn').disabled=true;
  try{await publish(id?'Editar contenido NEXIFY':'Agregar contenido NEXIFY');clearForm();}
  catch(error){catalog=previousCatalog;render();status(`No se pudo publicar: ${error.message}`,'error');}
  finally{$('saveContentBtn').disabled=false;}
});
$('adminList').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');
  if(edit){const item=catalog.find(x=>x.id===edit.dataset.edit);if(item)editItem(item);}
  if(del){const item=catalog.find(x=>x.id===del.dataset.delete);if(!item||!confirm(`¿Eliminar "${item.title}" del catálogo de GitHub?`))return;const previousCatalog=JSON.parse(JSON.stringify(catalog));catalog=catalog.filter(x=>x.id!==item.id);try{await publish('Eliminar contenido NEXIFY');}catch(error){catalog=previousCatalog;render();status(`No se pudo eliminar: ${error.message}`,'error');}}
});
$('adminSearch').addEventListener('input',render);
$('refreshBtn').addEventListener('click',async()=>{try{await loadFromGitHub();render();status('Catálogo actualizado desde GitHub.','success');}catch(error){status(`Error al actualizar: ${error.message}`,'error');}});
$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nexify-catalogo.json';a.click();URL.revokeObjectURL(a.href);});
$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data)||data.some(x=>!x||typeof x.title!=='string'))throw new Error('Formato no válido.');if(!confirm(`Esto reemplazará los ${catalog.length} elementos actuales por ${data.length} elementos. ¿Continuar?`))return;const previousCatalog=JSON.parse(JSON.stringify(catalog));catalog=data.map(normalize).filter(Boolean);try{await publish('Importar catálogo NEXIFY');}catch(error){catalog=previousCatalog;render();throw error;}}catch(error){status(`No se pudo importar: ${error.message}`,'error');}finally{e.target.value='';}});
if(!configured){showError('Configura assets/config.js con el usuario y repositorio de GitHub antes de conectar.');$('connectBtn').disabled=true;}
else if(token){$('githubToken').value=token;connect();}
toggleSeries();
})();

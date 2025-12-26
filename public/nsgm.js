let ws=null; 


 function waitForServerAndConnect() {      
  if(null!=ws){return true;}

let servok=false;
  fetch('http://localhost:3005/checkServer')
    .then(async res => {
      if(null!=ws){return servok= true;}
      if (res.ok) {
        
        ws = new WebSocket('ws://localhost:8080');

        ws.onopen = () => {
          console.log('Connected to server');
          ws.send(JSON.stringify({ c: 'steam' }));
        };
        
        ws.onmessage = (data) => {
          try {
            const d = JSON.parse(data.data);
            if (d.cb) {
             try{eval(d.cb)}catch(e){console.log(e)} 
            }
          } catch (e) {
            console.error("Invalid JSON from client:", data);
          }
        };
        
        ws.onclose = () => {
          console.log('Connection closed');
        };
        
        ws.onerror = (e) => {
          console.log(e);
        };
        servok=true;
              } else {
                servok=false;
                console.log('Server not available, retrying...');
      }
    })
    .catch(async() => {
      servok=false;
      console.log('Server not available, retrying...');
       });
       return servok;
}

async function getAvailableGames() {
  const apps =typeof this.collectionStore!=='undefined'?this.collectionStore.appTypeCollectionMap.get('type-games'):null;
  const sc =typeof SteamClient!=='undefined'? SteamClient:null;
  const ads =typeof appDetailsStore!=='undefined'? appDetailsStore:null;

  if(!sc&&!ads&&!apps&&ws.readyState !== WebSocket.OPEN)return setTimeout(getAvailableGames, 1000);
  const d = { installed: [], available: [] };

  const installedGames = await sc.Storage.GetString('installedGames').catch(() => undefined) || '[]';
  d.installed = JSON.parse(installedGames);

  const tasks = apps.allApps.map(async (a) => {
    if (a.BIsShortcut()) {
      const existingGame = d.installed.length>0?d.installed.find(e => e.gameid === a.m_gameid):null;
      if (existingGame && existingGame.id === a.appid) return;

      const appDetails = await ads.RequestAppDetails(a.appid).then(e => e);
      d.available.push({
        id: a.appid,
        name: a.display_name,
        gameid: a.m_gameid,
        dir: appDetails?.strShortcutExe,
        profileID: App.m_CurrentUser.strSteamID,
        installed: false
      });
    }
  });

  await Promise.all(tasks);

  d.getAvailableGames = d.installed.length || d.available.length;
  function sendWhenReady(data) {
    if (ws.readyState === WebSocket.OPEN) {
     try{ws.send(JSON.stringify(data));}catch(e){console.log(e)} 
    } else {
      setTimeout(() => sendWhenReady(data), 100);
    }
  }
 return sendWhenReady(d);

}

async function installGame(g) {
  console.log('installing game',g);
  let installedGame = await SteamClient.Storage.GetString('installedGames').catch(() => undefined) || undefined;
installedGame=undefined==installedGame?[]:JSON.parse(installedGame);
//installedGame = installedGame.length? JSON.parse(installedGame):[];
  let searchResult = await searchstore.FetchSearchSuggestions(g.name, undefined);
  if (searchResult.total === 0) {
    const dirName = g.dir.split("\\").slice(-2, -1)[0];
    searchResult = await searchstore.FetchSearchSuggestions(dirName, undefined);
  }
  if (searchResult.total !== 0) {
    console.log('search result:',g.dir);
    const response = await fetch(`http://localhost:3005/setup/?appid=${searchResult.items[0].m_unAppID}&dir=${g.dir}&appname=${searchResult.items[0].m_strName}&profileID=${g.profileID}`);
    let res = response.ok;
    let message = await response.text();

    if (res) {
      try {
        SteamClient.Storage.SetString(g.gameid, String(searchResult.items[0].m_unAppID));
        SteamClient.Storage.SetString(String(searchResult.items[0].m_unAppID), g.gameid);
        collectionStore.SetAppsAsHidden([g.id], true);
      await  SteamClient.RoamingStorage.DeleteKey(String(searchResult.items[0].m_unAppID)).catch(()=>undefined);
        SteamClient.RoamingStorage.SetString(String(searchResult.items[0].m_unAppID), JSON.stringify({ result: 0 ,gameid: g.gameid}));
        console.log(g.gameid);
        g.appid = searchResult.items[0].m_unAppID;
        g.name = searchResult.items[0].m_strName;
        g.installed = true;        
        installedGame.push(g);
        installedGame = JSON.stringify(installedGame);
        SteamClient.Storage.SetString('installedGames', installedGame);
      } catch (e) {
       await SteamClient.Storage.DeleteKey(String(g.appid)).catch(()=>undefined);
       await SteamClient.Storage.DeleteKey(g.gameid).catch(()=>undefined);
       await SteamClient.RoamingStorage.DeleteKey(String(searchResult.items[0].m_unAppID)).catch(()=>undefined);
        message = e.message;
        res = false;
       await SteamClient.RoamingStorage.DeleteKey(String(g.appid)).catch(()=>undefined);
      }
    }

    return ws.send(JSON.stringify({ installGame: true, result: res, message: message }));
  }else{console.log('no result: ',searchResult)}
}

async function uninstallGame(g) {
  try {
    let installedGame = await SteamClient.Storage.GetString('installedGames').catch(() => undefined) || '[]';
    installedGame = JSON.parse(installedGame);

    const target = installedGame.find(e => e.appid === g);
    if (!target) {
      return fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=notfound`);
    }

    installedGame = installedGame.filter(e => e.appid !== g);
    SteamClient.Storage.SetString('installedGames', JSON.stringify(installedGame));
    collectionStore.SetAppsAsHidden([target.id], false);
   await SteamClient.Storage.DeleteKey(target.gameid).catch(()=>undefined);
   await SteamClient.Storage.DeleteKey(String(g)).catch(()=>undefined);
   await SteamClient.RoamingStorage.DeleteKey(String(g)).catch(()=>undefined);
    fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=1`);
  } catch (e) {
    fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=${e.message}`);
  }
}
let proxiedData =null;


const amuI = setInterval(()=>{
  
 let amu = typeof appStore!=='undefined'?appStore.m_mapApps.updateValue_:null;
 let adt= typeof appDetailsStore !=='undefined'?appDetailsStore.m_mapAppData.dehanceValue_:null;
  const servok = waitForServerAndConnect();
 if(servok&&amu&&adt){
  clearInterval(amuI);
  console.log('Connected to server');
  //NotificationStore.TestAchievement(2114740);
  ///getAvailableGames();
  appStore.m_mapApps.updateValue_ =async function (...args) {
   // console.log('update value',args[1]);
      const j =  await SteamClient.Storage.GetString(String(args[0])).catch(()=>undefined)||null;
    if(j&&!j.result) {
     if( args[1].app_type!==1){return}
      console.log(j);

     /* args[1].GetPerClientData =  function GetPerClientData(e) {
        let t;
        switch (e) {
        case "local":
            t = this.local_per_client_data;
            break;
        case "mostavailable":
            t = this.most_available_per_client_data;
            break;
        default:
            t = this.selected_per_client_data
        }
    t.display_status = t.display_status === 31?11:t.display_status;
        return t
    };*/
    args[1].m_gameid = j;
    args[1].gameid = j;
    args[1].GetGameID=()=>j;
    args[1].BIsAppInBlockList = ()=>false;
    args[1].BIsOwned = ()=> true;
    args[1].per_client_data[0].display_status=args[1].per_client_data[0].display_status === 31?11:args[1].per_client_data[0].display_status;

    }
            return amu.apply(this, args)
  }
  
  appDetailsStore.m_mapAppData.dehanceValue_ = function (...args) {
    let check = false;
    check = args[0]?.details?.unAppID ? true : false;
    if (!check) return adt.apply(this, args);
    
    setTimeout(async () => {
      const appID = String(args[0].details.unAppID);
      let j;
      try {
        const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
        j = raw ? JSON.parse(raw) : { result: 0 };
            
        if (j.result === 1 && j.gameid) {
         
          const aDS = args[0].details.achievements;
          if(aDS.nTotal===j.data.rgAchievements.length&&aDS.nAchieved===j.data.rgAchievements.filter(e=>e.bAchieved).length){return}
          
          const unAchived = j.data.rgAchievements.filter(e => !e.bAchieved)||[];
          const achived = j.data.rgAchievements.filter(e => e.bAchieved)||[];
          const nAchieved = achived.length||0;
          const highlight = unAchived.filter(e => !e.bHidden)||[];
          const achivedHidden = achived.filter(e => e.bHidden)||[];
         aDS.nAchieved = nAchieved;
         aDS.vecUnachieved = unAchived;
         aDS.vecAchievedHidden = achivedHidden;
            aDS.nTotal = j.data.rgAchievements?.length||0;
               aDS.vecHighlight = highlight||[];
           aDS.version = aDS.nTotal>0?5:2;
    
        
    
          const a = appStore.GetAppOverviewByAppID(args[0].details.unAppID);
          ///a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31 ? 11 : a.per_client_data[0].display_status;
          a.m_gameid = j.gameid;
         a.gameid = j.gameid;
          a.GetGameID=()=>j.gameid;
          appDetailsStore.AppDetailsChanged(args[0].details);
            args[0].details.display_status = args[0].details.display_status === 31 ? 11 : args[0].details.display_status;
          args[0].details.bIsFreeApp = true;
        }
      } catch (e) {
  console.log(e);
      }
    },0);
   return adt.apply(this, args);
  };
  
const SAra = SteamClient.Apps.RegisterForAppDetails;

SteamClient.Apps.RegisterForAppDetails =  function (...args) {
  if(typeof args[0]==="string")args[0]=Number(args[0]);
  console.log(args);
    setTimeout(async ()=>{
  const appID = String(args[0]);
  let j;
  try {
   const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
   j = raw ? JSON.parse(raw) : { result: 0 };
 } catch (e) {
   j = { result: 0 };
 }

        
  if (j.result===0&&j.gameid) {
   
      let uu = await fetch(`http://localhost:3005/achievements/?appid=${appID}`);
   if(uu.ok){
      const d = await uu.json();
        if(!d.rgAchievements?.length>0)return;
        j.data= d;
        j.result= 200 / uu.status;
        j.updated = true;
      SteamClient.RoamingStorage.SetString(appID, JSON.stringify(j));
   }
   const a=appStore.GetAppOverviewByAppID(args[0]);
   a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31?11:a.per_client_data[0].display_status;
      }
       

///SteamClient.Apps.RegisterForAppOverviewChanges((e)=>appStore.UpdateAppOverview(e));
        

  },0);

  return SAra.apply(this, args);
};

const SAsc = SteamClient.Apps.SetCachedAppDetails;
SteamClient.Apps.SetCachedAppDetails = async function (...args) {
      const appID = String(args[0]);
      let j;
      try {
       const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
       j = raw ? JSON.parse(raw) : { result: 0 };
     } catch (e) {
       j = { result: 0 };
     }
    if(j.gameid&&j.result===1){
      
       let d= args[1]||'';
if(d?.length&&d?.length>20){
    d= JSON.parse(d);
   (Array.isArray(d) && d[0]?.[1] && d[0][1].version !== 5)
{
        
   const unAchived = j.data.rgAchievements.filter(e => !e.bAchieved)||[];
   const achived = j.data.rgAchievements.filter(e => e.bAchieved)||[];
   const nAchieved = achived.length;
   const highlight = unAchived.filter(e => !e.bHidden)||[];
   const achivedHidden = achived.filter(e => e.bHidden)||[];
  d[0][1].data.nAchieved = nAchieved;
  d[0][1].data.vecUnachieved = unAchived;
  d[0][1].data.vecAchievedHidden = achivedHidden;
     d[0][1].data.nTotal = j.data.rgAchievements?.length||0;
        d[0][1].data.vecHighlight = highlight||[];
    d[0][1].version = d[0][1].data.nTotal>0?5:2;
    }
   args[1] = JSON.stringify(d);
}
const a=appStore.GetAppOverviewByAppID(args[0])||null;

a?a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31?11:a.per_client_data[0].display_status:null;


         
    }
    
   
    return SAsc.apply(this,args);
}



const SAa = SteamClient.Apps.GetMyAchievementsForApp;

SteamClient.Apps.GetMyAchievementsForApp = async function (...args) {  
  console.log('GetMyAchievementsForApp',args)
   const appID = String(args[0]);
   let j
   try {
    const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
    j = raw ? JSON.parse(raw) : { result: 0 };
  } catch (e) {
    j = { result: 0 };
  }
    if(j.gameid&&j.result===1){
      return new Promise(r=>r(j));
    }
  return SAa.apply(this, args);
};

const TerminateApp= SteamClient.Apps.TerminateApp;
SteamClient.Apps.TerminateApp = async function (...args) {
    const e = await SteamClient.Storage.GetString(args[0]).catch(()=>undefined)||null;
    if(e&&!e.result){args[0]=e;
      console.log(args);
     setTimeout(()=>{ ws.send(JSON.stringify({ c: 'unwatch'}));},5000);
      history.back();};
        return TerminateApp.apply(this, args);
    }

    const runG = SteamClient.Apps.RunGame;
    SteamClient.Apps.RunGame =  function (...args) {
      //console.log(args);
      setTimeout(async()=>{
        const e = await SteamClient.Storage.GetString(args[0]).catch(()=>undefined)||null;
        if(e&&!e.result){
         ws.send(JSON.stringify({ c: 'watch', appid: e}));
         const int = setInterval(async () => {
          let vg = await SteamClient.Overlay.GetOverlayBrowserInfo();
      
          // If vg is not an array or is empty, skip
          if (!Array.isArray(vg) || vg.length === 0 || typeof vg[0]?.unPID === 'undefined') {
              return;
          }      
          try {
              let uid = 'overlay_uid' + vg[0]?.unPID;
              const tryOW = g_PopupManager.m_mapPopups.data_.get(uid) || g_PopupManager.m_mapPopups.data_.get('desktop' + uid);
              if (!tryOW) return;
              const overlayWindow = tryOW.value_?.window;
      
              if (overlayWindow?.document) {
               try{ overlayWindow.eval(`
                  if (document?.readyState === 'complete') {
                      ${uis}
                  } else {
                      document?.addEventListener('DOMContentLoaded', () => {
                          ${uis}
                      });
                  }
              `);}catch(e){console.log(e)}
                if(overlayWindow?.showAchievement){
              clearInterval(int);
                   }
                  ///overlayWindow.eval(uis);
              } else {
                  console.warn('Overlay window not found');
              }
          } catch (err) {
              console.error('Error processing overlay info:', err);
          }
      }, 3000);
      

        };},0);
            return runG.apply(this, args);
        }
 }
},1000);



       async function updateAch(a){
          const raw = await SteamClient.RoamingStorage.GetString(a.appid).catch(() => undefined);
          j = raw ? JSON.parse(raw) : { result: 0 }; 
          if(j.gameid&&j.result===1){
            a.changed.forEach(async e=>{
              console.log(e);
           const g = j.data.rgAchievements.find(w=>w.strID===e[0]);
           g.bAchieved = e[1].earned;
           g.rtUnlocked = e[1].earned_time;
           SteamClient.RoamingStorage.SetString(a.appid, JSON.stringify(j));
       let vg='overlay_uid'+(await SteamClient.Overlay.GetOverlayBrowserInfo())[0].unPID;
       vg=g_PopupManager.m_mapPopups.data_.get(vg) || g_PopupManager.m_mapPopups.data_.get('desktop'+vg);
       vg=vg.value_?.window;
       SteamClient.Browser.HideCursorUntilMouseEvent();
           vg.document.body.children[0].style.display = 'none'
           await delay(2000);
           SteamClient.Overlay.SetOverlayState(a.appid,2);
           await delay(1000);
           vg.showAchievement(
            g.strImage,
            g.strName,
            g.strDescription
          );
          Ach?.LoadMyAchievements(Number(a.appid));

        await delay(3000);
          SteamClient.Overlay.SetOverlayState(a.appid,0);
          
         setTimeout(()=>{ vg.document.body.children[0].style.display = 'block';},3000);
         
            });
          }
        }

 const uis = `
 style = document.createElement('style');
style.textContent = \`
  #notification-container {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9999;
  }

  .achievement-notification {
    display: flex;
    align-items: center;
    background: linear-gradient(to right, #1b2838, #171a21);
    color: white;
    border: 2px solid #66c0f4;
    padding: 12px 16px;
    border-radius: 8px;
    width: 320px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    font-family: "Segoe UI", sans-serif;
    animation: slideIn 0.5s ease-out, fadeOut 0.5s ease-in 4.5s forwards;
  }

  .achievement-icon {
    width: 48px;
    height: 48px;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .achievement-text {
    display: flex;
    flex-direction: column;
  }

  .achievement-title {
    font-weight: bold;
    font-size: 16px;
    color: #66c0f4;
  }

  .achievement-description {
    font-size: 14px;
    color: #c7d5e0;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: translateY(40px);
    }
  }
\`
document.head.appendChild(style);
 videoAudio = document.createElement("video");
videoAudio.preload = "auto";
videoAudio.volume = 0.5;
 source = document.createElement("source");
source.src = "http://localhost:3005/steamAch.wav";
source.type = "audio/wav";
videoAudio.appendChild(source);
videoAudio= document.body.appendChild(videoAudio);
function showAchievement(iconUrl, title, description) {
   container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    document.body.appendChild(container);
  }

   notification = document.createElement("div");
  notification.className = "achievement-notification";

   icon = document.createElement("img");
  icon.className = "achievement-icon";
  icon.src = iconUrl;

   textDiv = document.createElement("div");
  textDiv.className = "achievement-text";

   titleDiv = document.createElement("div");
  titleDiv.className = "achievement-title";
  titleDiv.textContent = title;

   descDiv = document.createElement("div");
  descDiv.className = "achievement-description";
  descDiv.textContent = description;

  textDiv.appendChild(titleDiv);
  textDiv.appendChild(descDiv);
  notification.appendChild(icon);
  notification.appendChild(textDiv);
  container.appendChild(notification);
  videoAudio.click();
  videoAudio.play();

  setTimeout(() => {
    notification.remove();
  }, 5000);
}`;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};
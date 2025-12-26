const express = require.main.require('express');
const app = express();
const path = require.main.require('path');
const fs = require.main.require('fs');
const http = require.main.require('http');
const cheerio = require.main.require('cheerio');
const os = require.main.require('os');
const puppeteer = require.main.require('puppeteer');
const cors = require.main.require('cors');
const { exec,execFile } = require.main.require('child_process');
const WebSocket = require.main.require('ws');

const logPath = path.join(os.homedir(), 'Desktop','log.txt');

function log(msg) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
}

const watcher = require(path.join(__dirname, 'watcher.node'));


const { existsSync, mkdir, mkdirSync, writeFile, readFile } = fs;
const { json } = express;





const userHomeDir = os.homedir();



let steamPath;
let chromePath;

async function getSystemChromePath() {
  chromePath = await new Promise((resolve, reject) => {
    const regKey = 'HKCR\\ChromeHTML\\shell\\open\\command';
    exec(`reg query "${regKey}" /ve`, (error, stdout) => {
      if (error || !stdout) return reject(log('Failed to locate Chrome in registry'));
const match = stdout.match(/"([^"]+?chrome\.exe)"/i);
      if (match && match[1]) return resolve(match[1]);
      reject( log('chrome.exe path not found in registry'));
    });
  });
}

async function getSteamPath() {
  d = await new Promise((resolve, reject) => {
    const regKey = 'HKCR\\steam\\Shell\\Open\\Command';
    exec(`reg query "${regKey}" /ve`, (error, stdout) => {
      if (error || !stdout) return reject( log('Failed to locate Steam in registry'));
      const match = stdout.match(/"([^"]+?steam\.exe)"/i);

      if (match && match[1]) return resolve(match[1]);
      reject( log('steam.exe path not found in registry'));
    });
  });
  return d;
}

async function getPaths() {
  await getSystemChromePath();
  steamPath = await getSteamPath();
steamPath = path.dirname(steamPath);
  log('Chrome Path:', chromePath);
  log('Steam Path:', steamPath);
}

getPaths();


function findFileRecursive(dir, targetFileName) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && targetFileName.includes(entry.name)) {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const result = findFileRecursive(fullPath, targetFileName);
      if (result) return result;
    }
  }

  return null;
}


app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(json());

let clients = {};
app.get('/steamAch.wav', (req, res) => {
  const filePath = path.join(steamPath, 'steamui','sounds','deck_ui_achievement_toast.wav');
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': stat.size,
  });

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

app.get('/achievements', async (req, res) => {
  const { appid } = req.query;

  if (!appid || !/^\d+$/.test(appid)) {
    return res.status(400).send('Valid numeric appid is required');
  }

  try {
    const appPath = path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid, `${appid}.json`);
    if (!fs.existsSync(appPath)) {
      return res.status(404).send('App not found');
    }

    const appData = fs.readFileSync(appPath, 'utf8');
    const appDetails = JSON.parse(appData);
    const steamApiPath = appDetails.steamApiPath;

    const rgAchievementsPath = path.join(steamApiPath, 'steam_settings', 'rgAchievements.json');
    if (!fs.existsSync(rgAchievementsPath)) {
      return res.status(404).send('Achievements data not found');
    }

    const rgAchievementsRaw = fs.readFileSync(rgAchievementsPath, 'utf8');
    const rgAchievements = JSON.parse(rgAchievementsRaw);

    res.json(rgAchievements);
  } catch (err) {
    log(err.stack || err);
    res.status(500).send('Error reading achievements data');
  }
});


app.get('/NSGM', (req, res) => {
  res.sendFile(path.join(path.dirname(process.execPath),'app', 'public','index.html'));
});

app.get('/checkServer',(req,res)=>{
if(clients.steam && clients.steam.readyState === WebSocket.OPEN){
  clients.steam.close();
  clients.steam = null;
}  
  res.send('true');
});

app.get('/startup', (req, res) => {
  res.sendFile(path.join(path.dirname(process.execPath),'app', 'public','startup.html'));
});
app.get('/fixGameDetails', async (req, res) => {
  const { appid} = req.query;
  if (!appid) {
    return res.status(400).send('appid query parameter is required');
  }
  const appPath = path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid, `${appid}.json`);
    if (!fs.existsSync(appPath)) {
      return res.status(404).send('App not found');
    }
    const appData = fs.readFileSync(appPath, 'utf8');
    const Details = JSON.parse(appData);
    const steam_settings = path.join(Details.steamApiPath,'steam_settings');
    if(!fs.existsSync(steam_settings)){

      fs.mkdirSync(steam_settings, { recursive: true });
      fs.writeFileSync(path.join(steam_settings, 'steam_appid.txt'), appid);

      fs.writeFileSync(path.join(steam_settings, 'disable_overlay.txt'), '');

    }
   try{ const appDetails = await fetchAppDetails(appid);
     const {
       rgAchievements=undefined,
       stats=undefined,
       achievements=undefined,
       configsApp=undefined,
       depot=undefined
     } = appDetails;

     stats!==undefined && stats!==null && fs.writeFileSync(path.join(steam_settings, 'stats.txt'), stats);
     achievements!==undefined && achievements!==null && fs.writeFileSync(path.join(steam_settings, 'achievements.json'), JSON.stringify(achievements));
     configsApp!==undefined && configsApp!==null && fs.writeFileSync(path.join(steam_settings, 'configs.app.ini'), configsApp);
      depot!==undefined && depot!==null && fs.writeFileSync(path.join(steam_settings, 'depots.txt'), depot);
     rgAchievements!==undefined && rgAchievements!==null && fs.writeFileSync(path.join(steam_settings, 'rgAchievements.json'), JSON.stringify(rgAchievements));    
     
     
     
     res.send('Game details fixed successfully!');}catch(e){
      log('Failed to fix game details:', e);
      res.status(500).send('Failed to fix game details');}
});
app.get('/setup', async (req, res) => {
  const { appid, dir, appname, profileID } = req.query;
  
  if (!appid || !dir || !appname || !profileID) {
    return res.status(400).send('appid, dir, appname, and profileID query parameters are required');
  }
 
  try {
    const gamePath = dir.replace(/^"|"$/g, '');
    const gameDir = path.dirname(gamePath);
    const steamApiPath = findFileRecursive(gameDir, ['steam_api.dll', 'steam_api64.dll']);
    if (!steamApiPath) {
      return res.status(400).send('This program only works with valid Steam games containing steam_api.dll or steam_api64.dll');
    }
    fs.writeFileSync(path.join(gameDir,'steam_appid.txt'), appid);

    if(!fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid))){
      fs.mkdirSync(path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid), { recursive: true });
    }
    const appPathDetails = {gameDire: gameDir,steamApiPath: path.dirname(steamApiPath)};
    fs.writeFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid, appid + '.json'), JSON.stringify(appPathDetails));
    const steamP = path.join(steamPath, 'steamapps');
    const appManifestFile = path.join(steamP, `appmanifest_${appid}.acf`);
    const sizeOnDisk = 1000000000;
    const manifestContent = `
  "AppState"
  {
      "appid"           "${appid}"
      "Universe"        "1"
      "LauncherPath"    "E:\\Program Files (x86)\\Steam\\steam.exe"
      "name"            "${appname}"
      "StateFlags"      "4"
      "installdir"      "${gameDir.replace(/\\/g, '\\\\')}"
      "LastUpdated"     "0"
      "LastPlayed"      "0"
      "SizeOnDisk"      "${sizeOnDisk}"
      "StagingSize"     "0"
      "buildid"         "0"
      "LastOwner"       "${profileID}"
      "DownloadType"    "1"
      "UpdateResult"    "0"
      "BytesToDownload" "0"
      "BytesDownloaded" "0"
      "BytesToStage"    "0"
      "BytesStaged"     "0"
      "TargetBuildID"   "0"
      "AutoUpdateBehavior"   "2"
      "AllowOtherDownloadsWhileRunning" "0"
      "ScheduledAutoUpdate" "0"
      "FullValidateAfterNextUpdate" "1"
      "InstalledDepots"
      {
      }
      "SharedDepots"
      {
      }
      "UserConfig"
      {
          "language"    "french"
      }
      "MountedConfig"
      {
          "language"    "french"
      }
  }
  `;
  fs.writeFileSync(appManifestFile, manifestContent);
  if (!fs.existsSync(appManifestFile)) {
    return res.status(500).send('Failed to create appmanifest file');
  }

   const steamApiFileName = path.basename(steamApiPath);
   const steamApiDir = path.dirname(steamApiPath);
   fs.renameSync(steamApiPath, steamApiPath+'.bak');
   const steamApiDirName = path.join(__dirname,'public','steam');
   fs.copyFileSync(path.join(steamApiDirName, steamApiFileName), steamApiPath);
   const steamclientPath = findFileRecursive(steamApiDir, ['steamclient.dll', 'steamclient64.dll']);
if(steamclientPath){
  fs.renameSync(steamclientPath, steamclientPath+'.bak');
}
    fs.copyFileSync(path.join(steamApiDirName, 'steamclient.dll'), path.join(steamApiDir, 'steamclient.dll'));
    fs.copyFileSync(path.join(steamApiDirName, 'steamclient64.dll'), path.join(steamApiDir, 'steamclient64.dll'));
    if(!fs.existsSync(path.join(steamApiDir , 'steam_settings'))){
      fs.mkdirSync(path.join(steamApiDir , 'steam_settings'), { recursive: true });
    }
     
     fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'steam_appid.txt'), appid);
     const appDetails = await fetchAppDetails(appid);
     const {
       rgAchievements=undefined,
       stats=undefined,
       achievements=undefined,
       configsApp=undefined,
       depot=undefined
     } = appDetails;
     
       stats!==undefined && stats!==null && fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'stats.txt'), stats);
       achievements!==undefined && achievements!==null && fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'achievements.json'), JSON.stringify(achievements));
       configsApp!==undefined && configsApp!==null && fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'configs.app.ini'), configsApp);
        depot!==undefined && depot!==null && fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'depots.txt'), depot);
       rgAchievements!==undefined && rgAchievements!==null && fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'rgAchievements.json'), JSON.stringify(rgAchievements));
       //fs.writeFileSync(path.join(steamApiDir , 'steam_settings', 'disable_overlay.txt'), '');
   return res.send(`${appname} is installed successfully!`);
  } catch (err) {
    log(err);
    res.status(500).send('see logs for more details:', err.message);    
    }
});
let lres=new Map();


app.get('/uninstall', async (req, res) => {

  const { appid,uninstalled =undefined} = req.query;
  if(undefined !==uninstalled){
    if(uninstalled === 'notfound') return lres.get(appid)?.send('Game not found!');
    if(uninstalled === '1') return lres.get(appid)?.send(`uninstalled successfully!`);
    return lres.get(appid)?.send(uninstalled);
  }
  if (!appid) {
    return res.status(400).send('appid and dir query parameters are required');
  }

  try {

    const appPath = path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', appid, `${appid}.json`);
    if (!fs.existsSync(appPath)) {
      return res.status(404).send('App not found');
    }

    const appData = fs.readFileSync(appPath, 'utf8');
    const appDetails = JSON.parse(appData);
    const steamApiPath = appDetails.steamApiPath;
    fs.rmSync(path.join(steamApiPath, 'steam_settings'), { recursive: true, force: true });
    ['steam_api.dll','steamclient.dll','steamclient64.dll','steam_api64.dll'].forEach((file) => {
      const filePath = path.join(steamApiPath, file);
     
      if(fs.existsSync(filePath+'.bak')){
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        fs.renameSync(filePath+'.bak', filePath);
      }
    });  
    const steamAppsDir = path.join(steamPath, 'steamapps');
    const appManifestFile = path.join(steamAppsDir, `appmanifest_${appid}.acf`);

    // Delete appmanifest file
    if (fs.existsSync(appManifestFile)) {
      fs.unlinkSync(appManifestFile);
    }
    if (lres.has(appid)) lres.delete(appid);
    lres.set(appid, res);
    
    clients?.steam?.send(JSON.stringify({ cb:`uninstallGame(${appid});`}));

  } catch (err) {


    log('Unsetup failed:', err.message);
    return res.status(500).send('Unsetup failed, see logs for more details');
  }
});

//app.listen(3000, () => console.log('Server running on http://localhost:3000'));


const server = http.createServer(app);
server.listen(3005, '0.0.0.0', () => {
  console.log('✅ Server started on http://localhost:3000');
});

server.on('error', (err) => {
  console.error('❌ Server failed to start on port 3000:', err);
});










async function retry(fn, retries = 3, delayMs = 3000) {
  let attempt = 1;
  let lastError;

  while (retries > 0) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log(`Attempt ${attempt} failed:`, err.message);
      retries--;
      attempt++;
      if (retries === 0) {
        log('All retries failed:', err);    return null;  }
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}


async function fetchAppDetails(appid, retryCount = 3) {
  const collectedData = {};
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    let UA ='';
    const UAF = path.join(os.homedir(), 'AppData', 'Roaming', 'steam+', 'ua.txt');
if (fs.existsSync(UAF)) {
    UA = fs.readFileSync(UAF, 'utf8').trim();
}
   const userAgent = UA || 'Mozilla/5.0 (Windows NT 10.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);
    await page.setJavaScriptEnabled(true);
    let $ = null;
    let catchedOnes = [];
   const selectors = ['.achievements_list', '#stats', '.depot', 'tr.app'];
    await retry(async () => {
      await page.goto(`https://steamdb.info/app/${appid}/stats/`, { waitUntil: 'domcontentloaded' });
    
      const found = await page.waitForFunction((selectors) => {
        return selectors.filter(s => document.querySelector(s)).join(',');
      }, {
        timeout: 5000,
        polling: 100
      }, selectors);
      if (!found) {
        throw new Error('No elements found');
      }
      catchedOnes = (await found.jsonValue()).split(',');
    
      const html = await page.content();
      $ = cheerio.load(html);
    }, retryCount);
    
    if (catchedOnes.includes('.achievements_list')||catchedOnes.includes('#stats')||catchedOnes.includes('.depot')||catchedOnes.includes('tr.app')){ 
      const html = await page.content();
      $ = cheerio.load(html);
    }
    if($){
      let depots = '';
      
      try {
        $('.depot').each((index, el) => {
          const depotId = $(el).attr('data-depotid');
          if (depotId) {
            depots += depotId + '\n';
          }
        });
      } catch (e) {
        log('Failed to parse depot IDs:', e.message);
      }
      
      collectedData.depot = depots || '';
      
      
      let dlcResult = '';
      try {
        $('tr.app').each((_, el) => {
          const dlcId = $(el).attr('data-appid');
          const dlcName = $(el).children().eq(1).text().trim();
          if (dlcId && dlcName) {
            dlcResult += `${dlcId}=${dlcName}\n`;
          }
        });
      } catch (e) {
        log('Failed to parse DLC IDs:', e.message);
      }
      
      collectedData.configsApp = `[app::dlcs]\nunlock_all=0\n${dlcResult}`;
      
      const bag = { rgAchievements: [] };
      const aj = [];
    try{
      $('#stats .achievement').each((_, el) => {
        
        const $el = $(el);
        const percent = parseFloat($el.find('.achievement_unlock').text().replace('%', '')) || 0;
        const desc = $el.find('.achievement_desc').text();
        const hidden = desc.includes('Hidden achievement');
        const name = $el.find('.achievement_name').text().trim();
        const id = $el.find('.achievement_api').text().trim();
        const imageName = $el.find('.achievement_image').attr('data-name') || 'default.png';
         log(name);
        aj.push({
          hidden,
          displayName: { english: name },
          description: { english: desc },
          name: id
        });
    
        bag.rgAchievements.push({
          bAchieved: false,
          bHidden: hidden,
          flAchieved: percent,
          flCurrentProgress: 0,
          flMaxProgress: 1,
          flMinProgress: 0,
          rtUnlocked: 0,
          strDescription: desc,
          strID: id,
          strImage: `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${imageName}`,
          strName: name
        });
      });}catch(e){
        log('Failed to parse achievements:', e);
      }
     
const $stats = $('#stats');
const firstTable = $stats.find('table').first();
const firstTrWithTd = firstTable.find('tr').filter((_, el) => $(el).find('td').length > 0).first();
const trParent = firstTrWithTd.parent(); 
const allRows = trParent.children('tr');
let stats = '';
try{
 stats = allRows
  .map((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^[^\s\b]+/);
    return match ? `${match[0]}=int=0` : '';
  })
  .get()
  .filter(Boolean)
  .join('\n');
}catch(e){
  log('Failed to parse stats:', e);
}
    
      collectedData.stats = stats||'';
      
    
      collectedData.rgAchievements = bag;
      collectedData.achievements = aj;
}
    return collectedData;
  } catch (err) {
   log('fetchAchievements failed:', err.message);
    return {rgAchievements: null, stats: null, achievements: null, configsApp: null, depot: null};
  } finally {
    await browser.close();
  }
}

const watchObj = {
  appid: null,
watchLocked : false};

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  
  ws.on('message', function incoming(message) {
    let m;
    try {
      m = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', message);
      return;
    }
  
    if (!m.c) {
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(m));
        }
      });
      return;
    }
  
    ///console.log(m.c);
  
    if (m.c === 'steam') {
      clients.steam = ws;
  
      ws.on('close', (code, reason) => {
        // stopServer();
      });
      return;
    }
  
    if (m.c === 'nsgm') {
      clients.nsgm = ws;
      return;
    }
  
    if (m.c === 'kill') {
      stopServer();
      return;
    }
  
    if (m.c === 'watch') {
      const { appid } = m;
      log(`Watching for changes in ${appid}`);
      if (!appid) {
        log('appid is required for watching');
        return;
      }
      if (watchObj.appid === appid) {
        log(`Already watching for changes in ${appid}`);
        return;
      }
      watchObj.appid = appid;
      watchObj.watchLocked = true;
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const filePath = path.join(appData, 'GSE Saves', appid);
      let of = {};
      if (fs.existsSync(path.join(filePath,'achievements.json'))) {
        try{
          of = JSON.parse(fs.readFileSync(path.join(filePath, 'achievements.json'), 'utf8'));
          log(`Loaded existing achievements for ${appid}`);}catch(e){
          log(`Failed to load existing achievements for ${appid}:`, e.message);
          of = {};
          }
      }

      watcher.watchFile(filePath, 'achievements.json', (event) => {
        if(event.event==='created'){
          try{
          of = JSON.parse(event.content);
          log(`New achievements file created for ${appid}`);}catch(e){
          log(`Failed to parse new achievements file for ${appid}:`, e.message);}
        }else if(event.event==='modified'){
          log(`Achievements file modified for ${appid}`);
          try{
          const cf = JSON.parse(event.content);
          const changed = JSON.stringify({appid: appid, changed: Object.entries(cf).filter(
              key => key[1].earned !== of[key[0]].earned
            )});
          of = cf;
          clients?.steam?.send(JSON.stringify({ cb: `updateAch(${changed})` }));}catch(e){
          log(`Failed to parse modified achievements file for ${appid}:`, e.message);
          }
        }
      });
  
      return;
    }
    
    if (m.c === 'unwatch') {
      log('Unwatching for changes');

    try{  watcher.stopWatching();
watchObj.appid = null;watchObj.watchLocked = false;
    }catch(e){
      log('Failed to stop watching:', e);}
      return;
    }
  
  });
  

  ws.on('close', () => {
    log('Client disconnected');
  });
});  

wss.on('error', (error) => {
  log('WebSocket error:', error);
});



function stopServer() {
 
  try {
    process.kill(process.pid);
    log(`Server with PID ${process.pid} stopped.`);
  } catch (err) {
   log('Failed to stop server:', err.message);
  }
}


/*
const psScriptPath = path.join(__dirname, 'toast.ps1');

execFile('powershell.exe', ['-NoProfile', '-File', psScriptPath], (error, stdout, stderr) => {
  if (error) {
    console.error('Toast failed:', stderr || error.message);
  } else {
    console.log('Toast shown.');
  }
});*/
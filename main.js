const { app } = require('electron');
const { execSync,exec ,execFile} = require('child_process');


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
if( process.argv.includes('steam+://server')) {

sleep(10000);

}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}
function isAdmin() {
  try {
    const out = execSync(
      'net session',
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

if (!isAdmin()) {
  exec(
    `powershell -Command "Start-Process -FilePath '${process.execPath}' -Verb runAs"`,
    () => {}
  );

  app.quit();
  process.exit(0);
}


const {  BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const protocol = 'steam+';
const exePath = process.execPath;
const os = require('os');
const logPath = path.join(app.getPath('desktop'), 'log.txt');

function log(msg) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
}

function registerProtocol() {
  try {
    execSync(`reg add "HKCU\\Software\\Classes\\${protocol}" /ve /d "URL:${protocol} Protocol" /f`);
    execSync(`reg add "HKCU\\Software\\Classes\\${protocol}" /v "URL Protocol" /d "" /f`);
    execSync(`reg add "HKCU\\Software\\Classes\\${protocol}\\shell\\open\\command" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`);
    console.log(`[✔] Protocol '${protocol}://' registered`);
  } catch (err) {
    console.error(`[✘] Failed to register protocol: ${err.message}`);
  }
}

function isRegistered() {
  try {
    const output = execSync(`reg query HKCU\\Software\\Classes\\${protocol}`, { stdio: 'pipe' }).toString();
    return output.includes(protocol);
  } catch {
    return false;
  }
}

if (!isRegistered()) {
  registerProtocol();
  const firstRun = path.join(path.dirname(process.execPath), 'firstRun.lock');

  fs.writeFileSync(firstRun, '');

}


function startServerDetached() {
    const nodePath = process.execPath;
    const pidFile = path.join(app.getPath('userData'), 'server.pid');
    const serverPath = path.join(path.dirname(process.execPath),'app', 'server.js');

  
    if (fs.existsSync(pidFile)) return;
  
    const child = spawn(nodePath, ['server.js'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  
    child.unref();
    fs.writeFileSync(pidFile, String(child.pid));
    child.stdout.on('data', (data) => {
       log(`stdout: ${data}`);
      });
      
      child.stderr.on('data', (data) => {
        log(`stderr: ${data}`);
      });
      
      child.on('close', (code) => {
      log(`Child process exited with code ${code}`);
      });
      
      // Listen for any errors in spawning the child process
      child.on('error', (err) => {
        log('Failed to start the child process:', err);
      });
      app.quit();
  }

  let mwin = null;
 function openManager(){
  if(mwin && !mwin.isDestroyed()) {
        mwin.focus();
    } else {
    mwin = new BrowserWindow({
        width: 900,
        height: 700,
        resizable: true,
    skipTaskbar: true,
        fullscreen: false,
        frame: true,
        webPreferences: {
           nodeIntegration: true,
    contextIsolation: false,
        }
    });

    mwin.loadURL('http://localhost:3005/NSGM');
    mwin.on('closed', () => {
        mwin = null;
    });
    mwin.on('minimize', () => mwin.close());
  }
  }

let forServer=false;

for (const arg of process.argv) {
    
    if (arg.includes('steam+://server')) {
      forServer = true;
      log(`Launched with protocol URL: ${arg}`);
      require(path.join(path.dirname(process.execPath), 'app','server.js'));
      ///startServerDetached();
        break;
    }else if(arg.includes('server.js')){
        log(`Launched with protocol URL: ${JSON.stringify(arg)}`);
forServer = true;
 
    }else if(arg.includes('steam+://manager')){
openManager(); 
    }


  }



async function getSteamPath() {
  d = await new Promise((resolve, reject) => {
    const regKey = 'HKCR\\steam\\Shell\\Open\\Command';
    exec(`reg query "${regKey}" /ve`, (error, stdout) => {
      if (error || !stdout) return reject(new Error('Failed to locate Steam in registry'));
      const match = stdout.match(/"([^"]+?steam\.exe)"/i);
      if (match && match[1]) return resolve(match[1]);
      reject(new Error('steam.exe path not found in registry'));
    });
  });
  return d;
}
function isAppRunningByPath(appPath, callback) {
    const safePath = appPath.replace(/\\/g, '\\\\');
    exec(`wmic process where "ExecutablePath='${safePath}'" get ProcessId`, (err, stdout) => {
      if (err) return callback(false);
      const match = stdout.match(/\d+/);
      callback(!!match);
    });
  }

let mainWindow;
let parentpath= null;
let targetApp;
async function getparentpath() {
    parentpath = await getSteamPath();
if(parentpath?.length){
parentpath = path.dirname(parentpath);
 targetApp = path.join(parentpath, 'steam.exe');
}
}

getparentpath();
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        fullscreen: false,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true
        }
    });

    // Load your HTML file (adjust the path as needed)
    mainWindow.loadFile(path.join(path.dirname(process.execPath), 'app', 'public', 'startup.html'));
    
    // Open the DevTools (optional)
     //mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    ipcMain.on('minimize', () => mainWindow.minimize());
    ipcMain.on('close', () => mainWindow.close());
   
ipcMain.handle('setupManager', async () => {
    try {
      // Get Steam path
      
     if(parentpath?.includes('exe')){
      parentpath = path.dirname(parentpath);
      ///targetApp = path.join(parentpath, 'steam.exe');
     }
     let steamPath = path.join(parentpath, 'steamui', 'index.html');
  
      // Asynchronously read the file
      let fileContent = await new Promise((resolve, reject) => {
        fs.readFile(steamPath, 'utf8', (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
      let modifiedContent = fileContent.replace('library.js', 'librory.js');

    // Write the modified content back to the file asynchronously
    await new Promise((resolve, reject) => {
      fs.writeFile(steamPath, modifiedContent, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    steamPath = path.join(parentpath, 'steamui');
    const jsFilePath = path.join(path.dirname(process.execPath),'app', 'public','nsgm.js');

    const content = fs.readFileSync(jsFilePath, 'utf8');

    modifiedContent = fs.readFileSync(path.join(steamPath,'library.js'), 'utf8');
    modifiedContent = modifiedContent+'\n'+content;
    fs.writeFileSync(path.join(steamPath,'librory.js'),modifiedContent,'utf-8');
    modifiedContent = fs.readFileSync(path.join(steamPath,'chunk~2dcc5aaf7.js'), 'utf8');
    if(!modifiedContent.includes('//# sourceMappingURL')) return false;
    modifiedContent = modifiedContent.replace('//# sourceMappingURL', '//# sou');
    modifiedContent = modifiedContent.replace('const b=new f;', 'const b=new f;window.Ach=b;');
    fs.writeFileSync(path.join(steamPath,'chunk~2dcc5aaf7.js'),modifiedContent,'utf-8');
    return false;
    } catch (err) {
      log('Error reading Steam file:', err);
      return `Error: ${err.message}`;
    }
  });

  ipcMain.handle('runSteam',async () => {
log(targetApp);
   
const child = spawn(targetApp, ['-dev', '-console'], {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
  app.quit();
return false;
  });
ipcMain.handle('closeSteam', () => {

    isAppRunningByPath(targetApp, (isRunning) => {
        if(isRunning) {
            exec(`wmic process where "ExecutablePath='${targetPath.replace(/\\/g, '\\\\')}'" get ProcessId`, (err, stdout) => {
                if (err) return log('closing steam',err);
              
                const pids = [...stdout.matchAll(/\d+/g)].map(m => m[0]);
                pids.forEach(pid => {
                  exec(`taskkill /PID ${pid} /F`);
                });
              });
        }
    });
})
}

let tray=null;


app.on('ready', ()=>{if(!forServer){createWindow()}else{
  
        tray = new Tray(path.join(path.dirname(process.execPath),'app','public', 'icon.ico')); 
    
        const contextMenu = Menu.buildFromTemplate([
          { label: 'Open Manager', click: () => openManager() },
          { type: 'separator' },
          { label: 'Quit', click: () => app.quit() }
        ]);
      
        tray.setToolTip('Steam+');
        tray.setContextMenu(contextMenu);
        tray.on('click', () => {
         openManager();
        });
        const firstRun = path.join(path.dirname(process.execPath), 'firstRun.lock');
        if(fs.existsSync(firstRun)){
          fs.unlinkSync(firstRun);
          openManager();
        }

}});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin'&&!forServer) {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null&&!forServer) {
        //createWindow();
    }
});



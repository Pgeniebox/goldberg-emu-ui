# Non-steam-games-manager
https://www.youtube.com/watch?v=59eJTwkKah4
How to use:
launch the setup to install steam+.
after install you should run the installed application to setup your existing steam application.
steamui is folder in steam location in your pc, our application will modify three files to make this work:

steam/steamui/index.html in this file we will change the loaded script library to librory, whene we change the letter we will prevent steam to check its content.
steam/steamui/library this file will be ignored because the index.html have librory and not library.
steam/steamui/chunk~2dcc5aaf7.js we will change this file just to give access to achievement controle.

you can run the service from any console or browser by starting this url :"steam+://server" or from the application.
without steam plus server the tray icon will not appear.

info:
my application use puppiter to load games metadata like achievments and more so if you dont see the achievements in your game you should fix details in our steam manager > game > settings > fix game details >> , note: keep retry until you see the achievements in your game.

- 👋 Hi, I’m @Pgeniebox

SteamOS Non-Steam Game Manager

Bring the full Steam experience to your non-Steam games on SteamOS.
This project transforms how non-Steam games appear and behave inside Steam — integrating achievements, rich metadata, events, and full native Steam UI presentation — as if they were real Steam games.

Features

Native Steam Integration: Non-Steam games are seamlessly injected into Steam with:

Full grid/capsule art and metadata

Steam-style achievements & rich presence

Events and update notifications

Controller layout support


Metadata Sync: Automatically fetches cover art, icons, description, genres, and more from online sources.

Event System: Adds custom update notes, patch logs, and notifications in the Steam library.

Launch Customization: Configure pre-launch scripts, launch parameters, and custom overlays.

Cross-platform Ready: Built for SteamOS, works in Game Mode with perfect controller support.


Motivation

SteamOS provides a beautiful, console-like experience — but non-Steam games are second-class citizens.
I built this program to close the gap. After deep reverse-engineering and system integration, this tool gives non-Steam games parity with official Steam titles.


Contributing

I built this from scratch with care and precision. Contributions, bug reports, and feature suggestions are welcome — but please respect the vision: non-Steam should feel native.

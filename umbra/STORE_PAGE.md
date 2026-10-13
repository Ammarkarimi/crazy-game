# Store Page Kit: UMBRA

## Title
UMBRA: Duel of Shadows

## Short description (under 300 chars)
Silhouette sword fighting with real weight. Pick any rival, from dojo apprentice to the Last Sword Saint, then master combos, parries and magic and forge legendary gear to climb from Novice to Legend. No levels, no energy timers, no ads.

## Long description

**Every rival is waiting. Choose your fight.**

UMBRA is a 2D fighting game of shadows and steel. Your fighter is a living silhouette with real weapons: a katana that leaves a trail of light, a war hammer that shatters guards, twin kama that never stop moving. There is no level map to grind. Pick any rival you like; the stronger they are, the more they pay.

**FIGHT WITH YOUR HANDS, NOT A MENU**
Attack, kick and heavy strikes change with every direction: lunges, rising launchers, low slashes, sweeps and side kicks. Chain 3-hit combos, cancel into launchers, juggle rivals in the air, roll through attacks, and throw shuriken, kunai, chakram and bombs.

**BLOCKING THAT MATTERS**
Hold back to guard. Lows must be blocked crouching, jump attacks standing, and heavy blows break any guard. Time it perfectly as the Ronin and parry, leaving your rival wide open.

**MAGIC**
Fill your spirit meter in battle and unleash Dragon Fire, Ice Spikes, Heaven's Wrath lightning, Earth Shatter, Shadow Step or Soul Drain.

**THE FORGE**
Buy and upgrade 43 pieces of gear across weapons, armor, helmets, ranged weapons and magic, from a wooden bokken to the Dragon Fang. Rare gear carries perks: Burning, Frost, Venom, Lifesteal, Thunder and more.

**SIX FIGHTERS**
Kage the shadow ninja, Ronin the wandering blade, Shen the iron monk, Goro the oni warlord, Nagi the viper assassin and Ayame the spirit weaver. Each fights differently.

**14 RIVALS, 7 TIERS**
Novice, Easy, Normal, Hard, Expert, Master and Legend. Each rival has a personality: aggressive brawlers, patient defenders, long-range zoners and tricksters.

**PLAY ANYWHERE, TOGETHER**
2-player local Versus on one keyboard or with gamepads, full touch controls, and a Training dojo.

### Features
- Fluid skeletal animation with flowing cloth and weapon trails
- 6 fighters, 5 weapon classes, 43 items with 5 upgrade levels each
- 14 AI rivals across 7 difficulty tiers; no levels, choose any rival any time
- Combos, juggles, parries, guard breaks, counter hits, status effects
- 7 magic types and 5 ranged weapons
- 6 hand-painted procedural arenas with weather
- Original procedural soundtrack: taiko, koto, shamisen and flute
- Local 2-player Versus and Training mode
- Keyboard, gamepad and touch controls
- No ads, no microtransactions, no energy timers, no data collection

## Age rating guidance
Stylised fantasy combat between silhouettes, with no blood (hits splash black "ink"), no gore and no online interaction. Expect **PEGI 7 / ESRB Everyone 10+** (fantasy violence). Get the official rating through the IARC questionnaire on each store.

## Tags / genres
Fighting, Action, 2D Fighter, Martial Arts, Swordplay, Silhouette, Samurai, Ninja, Singleplayer, Local Versus, Controller Support, Touch-Friendly, Offline, Steam Deck

## Pricing suggestion
- itch.io / Steam: **$4.99–$7.99**; the free web demo (`npm run build:demo`) drives sales
- Mobile (as an installable web app or wrapped): $2.99 premium, no ads

## System requirements (desktop)
- **OS:** Windows 10+, macOS 11+, Ubuntu 20.04+
- **Processor:** dual core, 2 GHz
- **Memory:** 2 GB RAM
- **Graphics:** any GPU with hardware-accelerated canvas
- **Storage:** 300 MB

## Assets (in `/marketing`)
| File | Use |
|---|---|
| `cover-630x500.png` | itch.io cover image |
| `capsule-460x215.png` | Steam header capsule |
| `capsule-616x353.png` | Steam main capsule |
| `hero-1920x620.png` | Store banner / website hero |
| `screenshot-*.png` | 1920x1080 screenshots (6 fights, rival select, forge) |
| `../build/icon.png` | 1024x1024 app icon |

Run `npm run marketing` to regenerate them after visual changes.

## Launch checklist
- [x] Privacy policy page (`privacy.html`)
- [x] Installable offline web build (`npm run build:site`, Vercel-ready)
- [x] Automatic Windows / macOS / Linux builds (GitHub Actions → GitHub Release)
- [ ] Trademark search for the name "UMBRA" in games (consider a subtitle-first name if needed)
- [ ] Complete the IARC age-rating questionnaire
- [ ] Put the free demo on itch.io, CrazyGames and Newgrounds; link to the paid version
- [ ] Code-sign the Windows and macOS builds
- [ ] Record a 30-second trailer: a combo into a launcher juggle, a parry, Heaven's Wrath, a LEGEND rival
- [ ] Post clips to r/IndieGaming, r/FightingGames, TikTok and YouTube Shorts

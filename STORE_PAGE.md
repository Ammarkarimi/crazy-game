# Store Page Kit: HYPERCHAOS

## Title
HYPERCHAOS

## Tagline (short description, under 300 chars)
A neon arena roguelite where the rules break every wave. Survive 20 waves of escalating madness, stack absurd upgrades into game-breaking builds, and unleash OVERDRIVE to turn the screen into pure light.

## Long description

**The arena is alive. The rules are optional. The chaos is mandatory.**

HYPERCHAOS is a fast, neon-drenched twin-stick roguelite built for one-more-run sessions. Every level-up hands you a choice. Every wave might rewrite the laws of physics. Every run ends in a glorious explosion, one way or another.

**BUILD SOMETHING RIDICULOUS**
33 upgrades across four rarities. Orbiting blades, wingman drones, tesla chains, hydra shells that split on impact, bullets that ricochet between enemies, a literal Thunder God. Stack them into combos that should not be legal.

**EXPECT THE UNEXPECTED**
From wave 2, CHAOS EVENTS can flip everything: a black hole devours the arena, meteors rain from the sky, the screen mirrors itself, the lights go out, every enemy grabs a gun, or the whole game shifts into HYPERSPEED.

**UNLEASH OVERDRIVE**
Kills charge your chaos meter. Fill it and detonate OVERDRIVE: invincibility, 2.5x fire rate, slowed time and a shockwave that clears the screen.

**FACE THE BOSSES**
The Hive Queen. The Obliterator. Mirrormind. And at wave 20, the Chaos Engine itself. Each has multi-phase bullet-hell patterns that demand real skill.

**KEEP GROWING**
Earn shards to unlock five distinct ships and permanent upgrades. Chase 24 achievements, top the Daily Chaos challenge, then see how deep Endless mode goes.

### Features
- 20-wave campaign, Endless mode and a seeded Daily Chaos challenge
- 4 multi-phase bosses
- 12 rule-bending Chaos Events
- 33 upgrades, 5 ships, 9 permanent upgrades
- 24 achievements
- Reactive warp-grid visuals, hit-stop, screen shake and neon glow everywhere
- Adaptive synthwave soundtrack that intensifies with the action
- Full keyboard + mouse, gamepad (Steam Deck friendly) and touch support
- Accessibility options: auto-fire, screen-shake and flash reduction, particle scaling
- Runs on almost anything

## Tags / genres
Roguelite, Twin Stick Shooter, Bullet Hell, Arcade, Action, Shoot 'Em Up, Bullet Heaven, Survivor-like, Neon, Synthwave, Retro, Score Attack, Singleplayer, Controller Support, Steam Deck

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
| `screenshot-*.png` | 1920x1080 gameplay screenshots |
| `../build/icon.png` | 1024x1024 app icon |

Run `npm run marketing` to regenerate them after visual changes.

## Launch checklist
- [ ] Set `STUDIO_NAME` (src/util.js) and the `appId` / `copyright` in package.json
- [ ] Trademark search for the game name
- [ ] Build the web zip (`npm run build:web`) and upload a free demo to itch.io to collect followers
- [ ] Build desktop versions on each OS (`npm run build:win` / `build:mac` / `build:linux`)
- [ ] Code-sign the Windows and macOS builds (avoids SmartScreen and Gatekeeper warnings)
- [ ] Record a 30-60 second trailer: boss fight, an Overdrive moment, a Chaos Event announcement
- [ ] Post GIFs to r/roguelites, r/indiegaming, r/WebGames, Twitter/X and TikTok
- [ ] Steam: pay the Steam Direct fee, set up the store page and gather wishlists for at least 2 weeks before release

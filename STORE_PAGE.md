# Store Page Kit: HYPERCHAOS

## Title
HYPERCHAOS: Super Silly Space Adventure

## Short description (under 300 chars)
Fly a happy little rocket, blow sparkle bubbles and cheer up the grumpy space monsters! A bright, silly, non-violent space adventure for kids aged 4+, with gentle difficulty, sticker collecting, rainbow power-ups and an extra-hard mode for grown-ups.

## Long description

**The Grumpies are SO grumpy. Only you can cheer them up!**

Hop into your rocket and zoom around a twinkly space playground. Your rocket blows sparkle bubbles all by itself, so little hands only need to steer. Every Grumpy you bubble turns into a happy smiling face and floats away in a burst of confetti!

**SIMPLE TO PLAY**
Move with the arrow keys, a gamepad stick or just drag a finger on the screen. Shooting and aiming happen automatically, so even pre-readers can play right away.

**PICK A SUPER POWER**
Grab the twinkly stars to level up, then choose a new power from big, colourful cards: Double Shot, Robot Buddy, Spinning Star, Bouncy Shots, Confetti Pop and 28 more. Mix them into the silliest combos!

**RAINBOW MODE!**
Fill the rainbow bar and press the rainbow button. Your rocket goes rainbow, can't be hurt, and fires bubbles super fast!

**SURPRISES EVERY WAVE**
Disco Party, Giant Mode, Teeny Tiny, Treasure Time, Piñata Party, Zoomies, Falling Stars and more keep every game different.

**MEET THE BIG GRUMPIES**
Queen Buzz, Robo Grump, Copycat Crystal and King Grumpus are the grumpiest of all. Can you make them smile?

**COLLECT EVERYTHING**
24 stickers to collect in your Sticker Book, 5 cute rockets to unlock (Zippy, Zoom, Turtle, Sparkle and Wiggles) and 9 forever-powers in the Shop.

**MADE FOR FAMILIES**
- 3 difficulty levels: **Easy** (3 lives, gentle Grumpies, made for ages 4+), **Normal** (a fun challenge) and **Hard** (a real arcade test for grown-ups)
- No ads, no in-app purchases, no chat, no accounts, no data collection
- Works fully offline
- Cheerful voice cheers ("Awesome!", "Level up!"), which can be switched off
- Break reminder for parents (15, 30 or 60 minutes)
- "Grown-ups only" maths gate before erasing progress
- Big buttons, emoji icons for pre-readers, and options to reduce screen shake and flashes

### Features
- Non-violent: enemies are "cheered up", never destroyed
- 20-wave adventure, Forever Mode and a Daily Surprise challenge
- 4 Big Grumpy bosses with silly patterns
- 12 surprise events
- 33 super powers, 5 rockets and 9 shop upgrades
- 24 collectible stickers
- Happy chiptune soundtrack that bounces along with the action
- Keyboard, gamepad and touch controls
- Easy, Normal and Hard difficulty

## Age rating guidance
Cartoon, non-violent content with no user interaction or data collection. Suitable for **PEGI 3 / ESRB Everyone**. Get the official rating through the IARC questionnaire on each store.

## Tags / genres
Kids, Family Friendly, Cute, Casual, Colorful, Space, Arcade, Shoot 'Em Up, Bullet Heaven, Roguelite, Singleplayer, Controller Support, Touch-Friendly, Offline, Steam Deck

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
- [ ] Complete the IARC age-rating questionnaire (expect PEGI 3 / Everyone)
- [x] Privacy policy page (`privacy.html`, live on the website); kids' categories on most stores require one
- [x] Website with installable, offline app (Vercel)
- [x] Automatic Windows / macOS / Linux builds (GitHub Actions → GitHub Release)
- [ ] Build the free web demo (`npm run build:demo`) and put it on itch.io and kids' web portals
- [ ] Code-sign the Windows and macOS builds
- [ ] Record a 30-second trailer: Grumpies turning happy, Rainbow Mode, a Big Grumpy, the Sticker Book
- [ ] Share with parenting communities, homeschool groups and family YouTubers/streamers

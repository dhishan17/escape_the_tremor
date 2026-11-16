# Escaping the Tremor: editing and publishing guide

A Parkinson's disease virtual escape room for LIFE SCI 2CC3 (Group 4). Plain HTML, CSS and JavaScript. It needs no server, no account and no install to run: open `index.html` in a browser.

## What each file does

| File | What it holds | Who edits it |
|---|---|---|
| `content.js` | Every question, answer, hint, passcode, Lab Notebook text, learning goal, source, crossword, team credits, timer length and hint cost | Anyone on the team |
| `diagrams.js` | The two schematic brain drawings (midbrain hotspot, coronal basal ganglia) | Anyone comfortable with SVG |
| `styles.css` | Colours, fonts, layout | Anyone |
| `sheet.js` | Reads the optional Google Sheet and checks it room by room | Nobody |
| `game.js` | The engine: timer, hint bank, puzzle types, win and time-out screens | Only if you change how the game works |
| `index.html` | Loads the files above in order | Rarely |
| `make-single-file.py` | Builds one all-in-one HTML file for pasting into Google Sites | Optional |

## Edit without code: the Google Sheet (recommended for the group)

The file `escaping-the-tremor-content-sheet.xlsx` holds every question, hint, passcode, notebook text, the opening-page text, the timer and the five colours, laid out as spreadsheet rows. Once it is connected, the game reads it each time it loads, so your group edits a Sheet instead of code.

1. Upload the `.xlsx` to Google Drive (New, then File upload). Open it with Google Sheets, then choose File, then **Save as Google Sheets** so it becomes a real Google Sheet.
2. Click **Share**. Under General access choose **Anyone with the link: Viewer**. Add each groupmate by email as **Editor**.
3. From the Sheet's address bar, copy the long code between `/d/` and `/edit`.
4. Your game link is `https://dhishan17.github.io/escape_the_tremor/?sheet=THE_LONG_CODE`. Use this link everywhere (Google Sites embed, Avenue, Teams).
5. Open it and scroll to the bottom of the opening page. It should say "Content loaded from the group's Google Sheet." If it says "Showing the built-in content", the Sheet is not shared correctly or a tab was renamed.

Rules: do not rename the tabs, change row 1, change the Room numbers, or change the grey Role words. If a room's rows are invalid, that room keeps its built-in puzzle and the footer says which one and why. The game never writes to your Sheet.

What the Sheet cannot change: the puzzle type of each room, and the two brain diagrams. Those are in the code.

## Common edits in code (all in `content.js`)

- **Change the clock or hint cost:** edit `timeMinutes` and `hintCostMinutes` at the top. The rules text updates itself.
- **Credit the team:** edit `credits` and `group`.
- **Reword a question or hint:** find the room in `STAGES` (search for its `title`) and edit the text between the quotes.
- **Change a passcode:** edit that room's `code`. It must be exactly 4 digits.
- **Change an answer:**
  - `multi` and `quiz` rooms: the correct option has `ok: true`.
  - `sort` rooms: each item has `b:` set to its bucket id.
  - `match` rooms: each row has `ans:` set to the correct option text.
  - `sequence` room: the list is already in the correct order. The game shuffles it.
- **Change the crossword:** edit `CW`. Crossing letters must match, so rebuild the layout if you swap a word.

Keep quotes balanced and keep the commas between items. If the game shows a blank page after an edit, a quote or comma is missing near your change.

## Publish it (free, about 5 minutes, no coding)

1. (Already done if the game is live.) One teammate makes a free GitHub account, then clicks New repository, names it `escaping-the-tremor`, and sets it to Public.
2. Click Add file, then Upload files. Drag in `index.html`, `styles.css`, `game.js`, `content.js`, `diagrams.js`, `sheet.js` and `README.md`. To update later, upload files with the same names again and they replace the old ones. Click Commit changes.
3. Go to Settings, then Pages. Under Build and deployment choose Deploy from a branch, branch `main`, folder `/ (root)`, then Save.
4. After about a minute the game is live at `https://YOUR-USERNAME.github.io/escaping-the-tremor/`. Keep the trailing slash. This is the link to submit.
5. Add teammates under Settings, then Collaborators. They can edit in the browser: open the repo and press the `.` key, or click the pencil icon on any file. Every change is saved with the editor's name and time, so the repo's commit history shows who built what.

## Put it on Google Sites

- **Recommended (embed by URL):** after step 4 above, open your Google Site, then Insert, Embed, URL tab, paste the GitHub Pages link, click Insert. For a full-page game, add a page of type Full page embed. Then publish the site.
- **Alternative (paste the code):** run `python3 make-single-file.py`, open the new `escaping-the-tremor-single-file.html`, copy everything, then in Sites choose Insert, Embed, Embed code tab and paste. Test it before relying on it: some Sites setups restrict scripts in pasted code. If the timer or buttons do not work, use the URL method.
- Google Sites editors can collaborate on the page itself (share the site with your teammates), but the game code is edited in `content.js` on GitHub.

## Before you submit

1. Open the final link in a private or logged-out window.
2. Play all 10 rooms in Practice mode, then one timed run.
3. Check it on a phone.
4. Paste the same link into the Avenue folder and the Teams "Game assignment links" folder.

# AI Search Engine for Google Docs

AI Search Engine is a Chrome extension that adds a local AI search sidebar to Google Docs. It lets you upload your own note file, search that note library while you type, and insert a selected answer back into the active document.

## 1. What it does

### Goal

The extension is designed for fast in-document recall:

- search your own interview notes, study notes, or writing snippets
- see the most relevant matches while typing in Google Docs
- insert the selected answer back into the doc without leaving the editor

### How it works

At a high level:

1. You upload a plain text note file into the extension.
2. The extension splits the file into question/answer pairs and builds local embeddings.
3. While you type in Google Docs, the extension keeps a local shadow query buffer.
4. That query is embedded and matched against your indexed notes.
5. The top 4 results are shown in the sidebar.
6. Clicking a result pastes the answer back into the current Google Docs editor.

Notes:

- search is semantic, not exact keyword matching only
- the extension also does a second pass on the answer text and highlights the most relevant answer clause in the result preview
- indexing and search happen inside the extension runtime, not through a server-side app backend

## 2. Installation

### Install from release

1. Download the latest `dist.zip` from the GitHub Releases page.
2. Unzip it so you have a local `dist/` folder.
3. Open Chrome and go to:

```txt
chrome://extensions
```

4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the unzipped `dist/` folder.

After that, open a Google Doc and the extension will attach to the editor frame.

### Build from source (optional)

You only need this if you want to modify the extension locally.

```bash
npm install
npm run build
```

### Rebuild the release zip

```bash
rm -rf dist dist.zip && npm run build && zip -r dist.zip dist
```

## 3. Upload document format

The extension currently expects a plain `.txt` file with this outline format:

- top-level `*` line = question
- indented `*` lines under it = answer bullet points
- deeper indentation is preserved as nested bullets

### Example

```txt
* How does Node.js handle async task?
   * JavaScript runs on one main thread per Node runtime.
   * libuv manages the event loop and async work without blocking JS.
   * Async work completes later and callbacks run on the main thread.

* What is worker thread?
   * Worker thread is a tool for multithreading.
   * Similar idea to Web Worker in the browser.
   * Used for CPU-heavy work off the main thread.
```

### Parsing rules

- question indentation is removed
- answer lines are converted into bullet-style answer text
- blank lines are ignored
- the file should contain at least one top-level `* question`

Good content types:

- interview Q&A
- study notes
- coding concept summaries
- reusable answer templates

## 4. UI and shortcuts

### Sidebar

The sidebar includes:

- **Config** panel
  - upload note file
  - throttle slider
  - indexed document list
- **Preview line**
  - shows the current query buffer
- **Search result list**
  - shows the top 4 matches
  - highlights the most relevant answer clause

### Current shortcuts and behavior

- `Right Alt`
  - toggle the sidebar open and closed

- `Enter`
  - keeps the current search context
  - appends a newline to the local query buffer instead of resetting

- `Esc`
  - clears the current search context

- `Cmd/Ctrl + A`, then `Delete` or `Backspace`
  - clears the local query buffer

- `Cmd/Ctrl + Delete` or `Cmd/Ctrl + Backspace`
  - deletes the current line from the local query buffer

- `Arrow Left / Arrow Right`
  - moves the local cursor inside the shadow buffer

### Write-back

- click a result in the sidebar
- the extension extracts the answer portion
- the answer is pasted back into the active Google Docs editor

Current limitation:

- write-back is plain text
- rich formatting such as bold is not preserved

## 5. How to improve search quality

Search quality depends heavily on both:

- how you write the source note file
- how you compose the live query while typing

### How to write a better note file

Prefer:

- one clear question per entry
- short, focused bullet points
- concrete terms instead of vague summaries
- consistent terminology
- multiple common phrasings when useful

Better:

```txt
* What is backpressure?
   * Stream flow control when producer is faster than consumer.
   * Prevents memory buildup and overload.
   * Common signal: write() returns false, then wait for drain.
```

Worse:

```txt
* backpressure
   * something about stream handling
```

Tips:

- include important keywords in the question
- keep answers dense and specific
- avoid giant paragraphs when bullets would be clearer
- if a topic has multiple common names, mention them explicitly

### How to write a better query

Prefer:

- short concept phrases
- the actual technical terms you want
- 1 to 3 related lines for the same topic

Good:

```txt
node.js event loop
worker thread
cpu heavy work
```

Less good:

```txt
that thing in backend when js does many tasks
```

Tips:

- use the important nouns first
- keep related lines together
- press `Esc` when switching to a new topic
- if results feel stale, clear and start a fresh query

## Development notes

### Run tests

```bash
npm test
```

### Main runtime pieces

- `src/content.js`
  - Google Docs content integration and keyboard/query handling
- `src/offscreen.js`
  - embedding, indexing, and semantic search
- `src/documentParser.mjs`
  - parses the text note format into question/answer rows
- `src/normalization.mjs`
  - query/document normalization helpers

## Limitations

- works only on Google Docs pages
- write-back is plain text only
- search quality depends on note quality
- English keyboard input path is the main optimized flow
- IME behavior is not the main optimized target right now

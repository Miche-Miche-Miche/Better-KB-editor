// ==UserScript==
// @name         Better KB editor
// @namespace    local.servicenow.better-kb-form
// @version      0.11.0
// @description  Sticky shortcuts and editor toolbar, collapsible attachment list and details, full-length editor.
// @author       Miche (based on Destination LPS KB form by Lucas Vieites)
// @homepageURL  https://github.com/Miche-Miche-Miche/Better-KB-editor
// @match        https://*.service-now.com/kb_knowledge.do*
// @match        https://*.service-now.com/kb_knowledge_block.do*
// @icon         https://images.icon-icons.com/2699/PNG/512/servicenow_logo_icon_168835.png
// @updateURL    https://raw.githubusercontent.com/Miche-Miche-Miche/Better-KB-editor/main/Better_KB_editor.user.js
// @downloadURL  https://raw.githubusercontent.com/Miche-Miche-Miche/Better-KB-editor/main/Better_KB_editor.user.js
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==
/*
Better KB editor: a tidier knowledge article form (kb_knowledge.do) for editors.
- Header at the top of the form, as wide as the form fields: "KB number -
Title" (plain-looking text with a link to the published article) on the
left, the Workflow state in its own space at the right edge.
- ServiceNow's grey form bar, which stays at the top while you scroll, holds
Show/Hide details, lined up with the form fields, followed by the icon
buttons (Copy link, last published version, this version, private window,
Workspace).
- Show/Hide details opens or closes the details (Number, Knowledge base ...
Roles); the browser remembers the last choice. If a required field in the
details is empty, they open. Short description sits right below the header.
- Attachments are listed one per line in a card at the right of the form
fields (below the header line when the window is too narrow), with
ServiceNow's own Manage Attachments, rename and download links. The files
stay hidden until you click Show next to "Manage Attachments (n):"; the
browser remembers whether the list was last open or closed.
- The article editor grows to show the whole article, and follows it as you
type. Its bottom-right handle can still drag it taller. While you scroll a
long article, the editor's toolbar stays just below the grey bar.
- Tab title "KBnumber - Title", the Check out label and the editor style sheet
work as in the original script.
Never saves anything on its own; use ServiceNow's normal Save/Update.
Formerly "Better KB form". Based on "Destination LPS KB form" v0.5 by Lucas
Vieites: https://gist.github.com/lucasvieites/49b318e354244cd3cef92ff5c40c713c
Copy link and the article link come from Better KB shortcuts:
https://github.com/Miche-Miche-Miche/Better-KB-shortcuts
Disable "Destination LPS KB form" in Tampermonkey while this one is enabled,
otherwise its shortcut icons appear as well.
Maintainers: keep this note and the changelog up to date.
*/
/** ChangeLog (newest first):
v0.11.0: Attachment list opens and closes with Show/Hide; closed by default; choice remembered
v0.10.1: Attachment card: one file per row, name then rename/download; all files shown
v0.10.0: Show/Hide details in the grey bar; attachment list card; sticky editor toolbar
v0.9.3: Shorter description and changelog
v0.9.2: Status in its own space; plain title link
v0.9.1: One-line header; bar icons aligned with fields
v0.9.0: Renamed Better KB editor; line icons in ServiceNow's bar
v0.8.0: Top header; editor fits the article
v0.7.0: Sidebar; Copy link and title link
v0.6.0: First release: collapsible details, visible shortcuts, taller editor
Destination LPS KB form v0.1-v0.5 (Lucas Vieites): KB links, tab title,
Knowledge Blocks, Workspace link, editor style sheet
*/
(function () {
  'use strict';
  // ---- Configuration --------------------------------------------------------
  const CONFIG = {
    // Where the open/closed choice is kept (this browser and ServiceNow
    // instance only). The key keeps its "better-kb-form" name so the choice
    // made before the rename is still remembered.
    STORAGE_KEY: 'better-kb-form:details-collapsed',
    // Open the details on load, and after a ServiceNow error message, when a
    // required field inside them is empty, so it can still be filled in.
    // This does not change the remembered choice.
    EXPAND_WHEN_REQUIRED_EMPTY: true,
    // Move the Short description row up, right below the header. Only that
    // row moves; the article editor never moves (moving it would reload the
    // editor). Set to false to keep ServiceNow's order.
    SHORT_DESCRIPTION_FIRST: true,
    // Start the header where the form's fields start (left edge of Short
    // description), with Show/Hide details in the label column. Set to false
    // to place the header straight after the button.
    ALIGN_WITH_FIELDS: true,
    // Show the Workflow state at the right of the header (a read-only copy of
    // the field in the details). Set to false to hide it.
    SHOW_STATUS: true,
    // Width (em) of the space kept for the Workflow state at the right end of
    // the header line. 12em fits the longest standard state, "Pending
    // retirement"; a longer custom state wraps inside the space instead of
    // touching the title.
    STATUS_SLOT_EM: 12,
    // Add the icon buttons to ServiceNow's grey form bar (next to
    // "Knowledge KB..."), which stays at the top while scrolling. Nothing is
    // added if the bar cannot be identified. Set to false to turn it off.
    DOCK_IN_FORM_BAR: true,
    // Start the grey-bar icons at the same horizontal position as the form
    // fields (and the header link). If the fields start further left than the
    // icons' natural place (narrow windows), the icons stay next to the title.
    ALIGN_DOCK_WITH_FIELDS: true,
    // Put Show/Hide details in the grey form bar, before the icon buttons, so
    // it is reachable while scrolling. It stays in the header if the bar
    // cannot be identified. Set to false to keep it in the header.
    TOGGLE_IN_FORM_BAR: true,
    // Show ServiceNow's attachment line (Manage Attachments, files, rename,
    // download) as a list with one file per line, in a card at the right of
    // the form fields. ServiceNow's own elements are moved, not copied, so
    // its links keep working. Set to false to leave them where they are.
    ATTACHMENT_LIST: true,
    // Card width limits at the right of the fields (pixels), and the space
    // kept on each side of it. With less room than the minimum, the card
    // goes below the header line instead.
    ATTACHMENT_SIDE_MIN_PX: 200,
    ATTACHMENT_SIDE_MAX_PX: 320,
    ATTACHMENT_SIDE_GAP_PX: 24,
    // Hide the files in the attachment card behind a Show/Hide button;
    // "Manage Attachments (n):" stays visible. Closed until the button is
    // first used; after that, the last choice is kept (this browser and
    // ServiceNow instance only). Set to false to always list every file.
    COLLAPSIBLE_ATTACHMENTS: true,
    FILES_STORAGE_KEY: 'better-kb-editor:attachments-collapsed',
    // Keep the article editor's toolbar visible while scrolling a long
    // article: once the top of the editor passes under the grey bar, the
    // toolbar stays just below the bar. Set to false to turn it off.
    STICKY_EDITOR_TOOLBAR: true,
    // Stacking order of the kept-visible toolbar. It only ever covers the
    // article text, so it only needs to sit above the editor's text area.
    TOOLBAR_Z_INDEX: 2,
    // How long "Copied" stays visible after copying (milliseconds).
    COPIED_FEEDBACK_MS: 2000,
    // Grow the article editor to show the whole article, and follow it while
    // typing. ServiceNow's - / + height buttons have no lasting effect while
    // this is on. Set to false for ServiceNow's own editor height.
    AUTO_FIT_EDITOR: true,
    // Extra space under the last line of the article (pixels).
    AUTO_FIT_EXTRA_PX: 24,
    // Safety stop: if something else (ServiceNow or TinyMCE) keeps changing
    // the editor height back, stop fitting after this many such resets within
    // AUTO_FIT_WINDOW_MS. Growth while typing never counts.
    AUTO_FIT_MAX_RESETS: 12,
    AUTO_FIT_WINDOW_MS: 5000,
    // Height limits (pixels) for the editor, whether fitted or dragged with
    // its resize handle. The maximum is only a safety ceiling.
    EDITOR_MIN_HEIGHT_PX: 200,
    EDITOR_MAX_HEIGHT_PX: 20000,
    // From the original script: a style sheet record on the instance that is
    // added inside the article editor (kb_knowledge only). Set to '' to stop.
    EDITOR_STYLESHEET: 'eb29f348db64f010d9816d3405961927.cssdbx',
    // From the original script: the Check out UI action button (its sys_id
    // is instance-specific) and the label it is given.
    CHECKOUT_BUTTON_ID: '169ee7fcdb122200a042f278f0b8f58e',
    CHECKOUT_LABEL: 'Check out',
    // Portals used by the shortcuts, unchanged from the original: published
    // and this-version links use /lps; the private-window link uses /kb.
    PUBLISHED_PORTAL: 'lps',
    PRIVATE_VIEW_PORTAL: 'kb',
    // ServiceNow builds the form and the editor after the page has loaded.
    // Changes are batched for this pause (ms), and the form is re-checked at
    // this interval (ms) until everything is in place or the time limit (ms)
    // passes; after that, only page changes trigger a check.
    CHECK_DEBOUNCE_MS: 150,
    SETUP_POLL_MS: 500,
    SETUP_TIMEOUT_MS: 30000,
    // Upper limit on tab-title rewrites per page (see setTabTitle), and extra
    // checks (ms after start) that catch a title set late by the outer page.
    MAX_TITLE_WRITES: 5,
    TITLE_RECHECK_MS: [1000, 3000],
    // Set to true to log troubleshooting steps (no titles or record data).
    DEBUG: false
  };
  const LOG_PREFIX = '## Better KB editor => ';
  // Namespace for injected IDs and classes; kept from Better KB form so
  // nothing else changes with the rename.
  const PREFIX = 'bkbf';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RECORD_TABLES = ['kb_knowledge', 'kb_knowledge_block'];
  const RESIZE_HANDLE = '.tox-statusbar__resize-handle';
  const EDITOR_CONTAINER = '.tox-tinymce';
  const ERROR_MESSAGE = '.notification-error, .outputmsg_error';
  // ServiceNow's form UI action buttons in the grey bar carry these classes
  // (the copies at the bottom of the form have no "header" class).
  const FORM_BAR_BUTTON = 'button.form_action_button.header';
  // ServiceNow's attachment line at the top of the form and the separator
  // under it (exact IDs from the classic form).
  const ATTACHMENT_HEADER_ID = 'header_attachment';
  const ATTACHMENT_LINE_ID = 'header_attachment_line';
  // TinyMCE's toolbar area, and the class TinyMCE adds when its own sticky
  // toolbar option is on (then the toolbar is left to TinyMCE).
  const EDITOR_HEADER = '.tox-editor-header';
  const NATIVE_STICKY_CLASS = 'tox-tinymce--toolbar-sticky-on';
  // Line icons on a 24 x 24 grid, drawn with currentColor so they follow the
  // surrounding text colour. Built as SVG elements, never as markup strings.
  const ICONS = {
    copy: [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }], ['path', { d: 'M5 15V5a2 2 0 0 1 2-2h8' }]],
    published: [['path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    version: [['path', { d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' }], ['path', { d: 'M14 3v5h5' }]],
    private: [['circle', { cx: 6.5, cy: 15, r: 3.5 }], ['circle', { cx: 17.5, cy: 15, r: 3.5 }], ['path', { d: 'M10 15h4M3 14l2.5-7H8M21 14l-2.5-7H16' }]],
    workspace: [['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ['path', { d: 'M9 4v16M9 10h12' }]],
    copied: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
    copyFailed: [['path', { d: 'M12 3 2 20h20L12 3z' }], ['path', { d: 'M12 10v4M12 17h.01' }]]
  };
  const state = {
    record: null,
    bar: null,
    dock: null,
    tools: null,
    toggle: null,
    files: null,
    filesToggle: null,
    filesCollapsed: null,
    warning: null,
    status: null,
    parts: [],
    collapsed: false,
    titleWrites: 0,
    duplicateWarned: false,
    stylesheetDone: false
  };
  function debug(message) {
    if (CONFIG.DEBUG) console.log(LOG_PREFIX + message);
  }
  // ---- Pure helpers ----------------------------------------------------------
  // A ServiceNow sys_id is 32 hexadecimal characters; anything else gives ''
  // so no broken version link is created.
  function validSysId(value) {
    return /^[0-9a-f]{32}$/i.test(String(value || '')) ? String(value) : '';
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  // Same-instance portal address, e.g. /lps?id=kb_article_view&sysparm_article=KB1.
  function portalUrl(portal, params) {
    const url = new URL('/' + portal, location.origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.href;
  }
  // Unchanged from the original: Workspace on the 4th tab (Versions). The tab
  // index is a Workspace-specific assumption; check it if the tabs change.
  function workspaceUrl(sysId) {
    return location.origin + '/now/sow/kb_view/kb_knowledge/' + sysId +
    '/sub/record/kb_knowledge/' + sysId + '/params/selected-tab-index/4';
  }
  // From Better KB shortcuts: the latest published article, by number, as
  // used by its Copy link and article link (id=kb_article, not
  // kb_article_view as in the original form script's links).
  function articleUrl(number) {
    return portalUrl(CONFIG.PUBLISHED_PORTAL, { id: 'kb_article', sysparm_article: number });
  }
  // Text of the header link: "KB number - Title", with the title exactly as
  // typed (dashes and ampersands included); the number alone when untitled.
  function titleText(record) {
    return record.title ? record.number + ' - ' + record.title : record.number;
  }
  // The icon actions in the grey bar, in order.
  function buildShortcuts(record) {
    const items = [{
      kind: 'copy',
      icon: 'copy',
      label: 'Copy link',
      href: articleUrl(record.number)
      }, {
        kind: 'link',
        icon: 'published',
        label: 'View last published version in DLPS',
        href: portalUrl(CONFIG.PUBLISHED_PORTAL, { id: 'kb_article_view', sysparm_article: record.number })
    }];
    // A new, unsaved record has no version to open yet.
    if (record.sysId) {
      items.push({
        kind: 'link',
        icon: 'version',
        label: 'View this version in DLPS',
        href: portalUrl(CONFIG.PUBLISHED_PORTAL, { id: 'kb_article_view', sys_kb_id: record.sysId })
      });
    }
    items.push({
      kind: 'private',
      icon: 'private',
      label: 'View in private browser',
      href: portalUrl(CONFIG.PRIVATE_VIEW_PORTAL, { id: 'kb_article_view', sysparm_article: record.number })
    });
    if (record.sysId) {
      items.push({
        kind: 'workspace',
        icon: 'workspace',
        label: 'View in Workspace',
        href: workspaceUrl(record.sysId)
      });
    }
    return items;
  }
  // Colour group for the Workflow lozenge, from its visible text.
  function statusTone(text) {
    const value = String(text || '').toLowerCase();
    if (/retire|outdated/.test(value)) return 'retired';
    if (/publish/.test(value)) return 'published';
    if (/review|approv|schedul/.test(value)) return 'review';
    if (/draft/.test(value)) return 'draft';
    return 'neutral';
  }
  // ---- Reading the form ------------------------------------------------------
  function getSysId() {
    const fromUrl = new URLSearchParams(location.search).get('sys_id') || '';
    if (fromUrl === '-1') return ''; // New record: not saved yet.
    const unique = document.getElementById('sys_uniqueValue');
    return validSysId(unique && unique.value) || validSysId(fromUrl);
  }
  // Number fields are read-only for most users (sys_readonly.prefix, as in
  // the original); the plain ID covers users who may edit the number.
  function findRecord() {
    for (const table of RECORD_TABLES) {
      const numberField = document.getElementById('sys_readonly.' + table + '.number') ||
      document.getElementById(table + '.number');
      if (!numberField) continue;
      const number = String(numberField.value || '').trim();
      if (!number) return null; // Not filled in yet: check again later.
      const titleField = document.getElementById(table + '.short_description');
      const title = titleField ? String(titleField.value || '').trim() : '';
      return {
        table,
        number,
        numberField,
        title, // Follows Short description edits (title link).
        tabTitle: title, // As loaded, like the original script's tab title.
        sysId: getSysId()
      };
    }
    return null;
  }
  // The text a field shows, read-only. ServiceNow renders reference fields as
  // sys_display.<table>.<field>, read-only choices as sys_readonly.<...>, and
  // keeps the stored value in <table>.<field> (for choices, an internal value
  // such as "pending_retirement", shown here as "Pending retirement").
  // Record identifiers are never shown.
  function fieldDisplay(table, field) {
    const base = table + '.' + field;
    for (const id of ['sys_display.' + base, 'sys_readonly.' + base, base]) {
      const element = document.getElementById(id);
      if (!element) continue;
      let text = '';
      let internal = false;
      if (element.tagName === 'SELECT') {
        const option = element.options && element.options[element.selectedIndex];
        text = option ? option.text : '';
      } else if ('value' in element) {
        text = element.value;
        internal = id === base && element.type === 'hidden';
      } else {
        text = element.textContent;
      }
      text = String(text || '').trim();
      if (!text || validSysId(text)) continue;
      if (internal && /^[a-z_]+$/.test(text)) {
        text = text.replace(/_/g, ' ');
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }
      return text;
    }
    return '';
  }
  // The details section: from the Number field's row down to (not including)
  // Short description, or the article body if Short description is missing
  // or has already been moved above. Found by exact field IDs, not by layout
  // classes. Returns null (nothing is hidden) when the layout is unexpected.
  // shortRow is the Short description row, when it can move safely: it must
  // be a separate row with no frame inside (the editor must never move).
  function findDetailParts(record) {
    const start = document.getElementById('element.' + record.table + '.number');
    if (!start) return null;
    const boundary = ['short_description', 'text']
    .map((field) => document.getElementById('element.' + record.table + '.' + field))
    .find((element) => element && !element.contains(start) && !start.contains(element) &&
      (start.compareDocumentPosition(element) & 4)); // 4 = follows start.
    if (!boundary) return null;
    let first = start;
    while (first.parentElement && !first.parentElement.contains(boundary)) first = first.parentElement;
    const parent = first.parentElement;
    const form = record.numberField.form || record.numberField.closest('form');
    if (!parent || !form || !form.contains(parent)) return null;
    if (isTablePart(parent)) return null; // No room for a header.
    const parts = [];
    let node = first;
    for (; node && !node.contains(boundary); node = node.nextElementSibling) {
      if (node.id !== PREFIX + '-bar') parts.push(node);
    }
    if (!parts.length) return null;
    const editor = document.getElementById('element.' + record.table + '.text');
    const shortRow = boundary.id === 'element.' + record.table + '.short_description' &&
    node && node.parentElement === parent && !node.querySelector('iframe') &&
    !(editor && node.contains(editor)) ? node : null;
    return { parts, parent, shortRow };
  }
  function isTablePart(element) {
    return /^(TABLE|TBODY|THEAD|TFOOT|TR)$/.test(element.tagName);
  }
  // A required field whose value is empty, inside the given elements. The
  // "status." marker carries ServiceNow's mandatory="true"; the value is read
  // from the field itself rather than from styling classes.
  function hasEmptyRequired(parts) {
    for (const part of parts) {
      for (const marker of part.querySelectorAll('[id^="status."][mandatory="true"]')) {
        const field = document.getElementById(marker.id.slice('status.'.length));
        if (field && 'value' in field && !String(field.value || '').trim()) return true;
      }
    }
    return false;
  }
  function isRendered(element) {
    return !!element && element.getClientRects().length > 0;
  }
  // ---- Styles -----------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(PREFIX + '-style')) return;
    const style = document.createElement('style');
    style.id = PREFIX + '-style';
    style.textContent = `
    /* Colours in one place. The accent matches ServiceNow's form buttons.
    */
    .${PREFIX}-bar, .${PREFIX}-dock {
    --${PREFIX}-ink: #1d2733; --${PREFIX}-muted: #5c6470; --${PREFIX}-accent: #3b4bd8;
    --${PREFIX}-line: #cdd2db; --${PREFIX}-soft: #eef0f3; --${PREFIX}-surface: #ffffff;
    --${PREFIX}-tip-bg: #1d2733; --${PREFIX}-tip-text: #ffffff;
    }
    /* !important: ServiceNow sets inline display values on form rows.
    */
    .${PREFIX}-hidden { display: none !important; }
    .${PREFIX}-sr {
    position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    .${PREFIX}-svg { width: 1.15em; height: 1.15em; flex: 0 0 auto; fill: none; stroke: currentColor;
    stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    /* Record header: Show/Hide details, then the header column. alignHeader()
    sets the first column to the form's label width when it can.
    */
    .${PREFIX}-bar {
    display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: .75rem;
    align-items: start; box-sizing: border-box; width: 100%;
    margin: 0 0 .9rem; padding: .25rem 0; color: var(--${PREFIX}-ink);
    }
    .${PREFIX}-toggle { display: inline-flex; align-items: center; gap: .5em; justify-self: start; }
    .${PREFIX}-chevron {
    display: inline-block; width: .45em; height: .45em; margin-top: -.2em;
    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: rotate(45deg); transition: transform .15s ease;
    }
    .${PREFIX}-toggle[aria-expanded="false"] .${PREFIX}-chevron { transform: rotate(-45deg); margin-top: 0; }
    /* One line divided in two: the title text takes the remaining width,
    the Workflow state has its own fixed space at the right end, so the
    two can never overlap.
    */
    .${PREFIX}-head { min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
    .${PREFIX}-line {
    display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 1rem;
    align-items: center; min-height: 2.1em;
    }
    .${PREFIX}-line.${PREFIX}-with-status { grid-template-columns: minmax(0, 1fr) ${CONFIG.STATUS_SLOT_EM}em; }
    .${PREFIX}-title-text { min-width: 0; line-height: 1.4; overflow-wrap: anywhere; }
    /* An inline link: only the words are clickable, as in Better KB
    shortcuts. Normal weight, ServiceNow's link colour, underlined on
    hover or keyboard focus. Font size is copied from Short description.
    */
    .${PREFIX}-title, .${PREFIX}-title:focus {
    display: inline; font-weight: 400; font-size: inherit; text-decoration: none;
    }
    .${PREFIX}-title:hover, .${PREFIX}-title:focus-visible { text-decoration: underline; }
    .${PREFIX}-status { min-width: 0; justify-self: end; text-align: right; }
    .${PREFIX}-lozenge {
    display: inline-block; max-width: 100%; padding: .15em .55em; border-radius: 4px;
    font-size: .8em; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    white-space: normal; background: var(--${PREFIX}-soft); color: var(--${PREFIX}-ink);
    }
    .${PREFIX}-lozenge[hidden] { display: none !important; }
    .${PREFIX}-tone-draft { background: #fbf0d0; color: #5a4300; }
    .${PREFIX}-tone-review { background: #e3ebff; color: #1f3a8a; }
    .${PREFIX}-tone-published { background: #e1f5ea; color: #0f5132; }
    .${PREFIX}-tone-retired { background: #eceef1; color: #4a5260; }
    /* Icon buttons in the grey bar.
    */
    .${PREFIX}-ib, .${PREFIX}-ib:hover, .${PREFIX}-ib:focus {
    position: relative; display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 7px; color: var(--${PREFIX}-muted);
    text-decoration: none; cursor: pointer;
    }
    .${PREFIX}-ib:hover, .${PREFIX}-ib:focus-visible { background: var(--${PREFIX}-soft); color: var(--${PREFIX}-accent); }
    .${PREFIX}-ib .${PREFIX}-svg { width: 18px; height: 18px; }
    /* Compact dock in ServiceNow's grey form bar. alignDock() replaces the
    left margin to line it up with the form fields.
    */
    .${PREFIX}-dock {
    display: inline-flex; align-items: center; gap: 2px; padding: 2px; margin: 0 .75rem;
    vertical-align: middle; border-radius: 8px; border: 1px solid var(--${PREFIX}-line);
    background: var(--${PREFIX}-surface); color: var(--${PREFIX}-ink);
    }
    .${PREFIX}-dock .${PREFIX}-ib { width: 26px; height: 26px; }
    .${PREFIX}-dock .${PREFIX}-ib .${PREFIX}-svg { width: 16px; height: 16px; }
    .${PREFIX}-bar a:focus-visible, .${PREFIX}-dock a:focus-visible, .${PREFIX}-toggle:focus-visible {
    outline: 2px solid currentColor; outline-offset: 2px;
    }
    /* Show/Hide details and the icon buttons together in the grey bar.
    alignDock() replaces the left margin to line them up with the fields.
    */
    .${PREFIX}-tools {
      display: inline-flex; align-items: center; gap: .5rem; margin: 0 .75rem;
      vertical-align: middle;
    }
    .${PREFIX}-tools .${PREFIX}-dock { margin: 0; }
    .${PREFIX}-tools .${PREFIX}-toggle { white-space: nowrap; }
    /* The header's first column; holds Show/Hide details only when it is
    not in the grey bar. Its own width, so alignHeader() can measure it.
    */
    .${PREFIX}-lead { justify-self: start; min-width: 0; }
    .${PREFIX}-bar.${PREFIX}-toggle-in-bar { column-gap: 0; }
    /* Attachment card. ServiceNow's own attachment elements are moved in and
    turned from one line into a list. !important overrides the inline sizes
    and one-line rules ServiceNow sets on them.
    */
    .${PREFIX}-files { box-sizing: border-box; min-width: 0; }
    .${PREFIX}-bar.${PREFIX}-files-side { position: relative; }
    .${PREFIX}-files-side > .${PREFIX}-files { position: absolute; top: 0; z-index: 1; }
    .${PREFIX}-files-flow > .${PREFIX}-files { grid-column: 2; margin-top: .6rem; }
    #${PREFIX}-files #${ATTACHMENT_HEADER_ID} {
      display: block; height: auto !important; max-width: none !important; margin: 0 !important;
      padding: .6rem .75rem !important; overflow: visible !important; box-sizing: border-box;
      border: 1px solid var(--${PREFIX}-line); border-radius: 8px;
      background: var(--${PREFIX}-surface); color: var(--${PREFIX}-ink);
    }
    #${PREFIX}-files #header_attachment_size_checker,
    #${PREFIX}-files #header_attachment_list {
      display: block; width: auto !important; height: auto !important; max-width: none !important;
      max-height: none !important; margin: 0 !important; padding: 0 !important;
      overflow: visible !important; white-space: normal !important; list-style: none;
    }
    #${PREFIX}-files #header_attachment_list > li {
      float: none !important; width: auto !important; max-width: none !important;
      height: auto !important; max-height: none !important; overflow: visible !important;
      margin: 0 !important; padding: .4rem 0 !important; border-top: 1px solid var(--${PREFIX}-line);
      white-space: normal !important; line-height: 1.4;
    }
    #${PREFIX}-files #header_attachment_list > li:first-child { border-top: 0; padding-top: 0 !important; }
    #${PREFIX}-files #header_attachment_list > li.manage_list {
      display: block !important; font-weight: 600; padding-bottom: .5rem !important;
    }
    /* One file per row: icon and name on the first line, rename and download
    on the second. ServiceNow lays a file's parts out side by side with fixed
    sizes, which squeezed them into overlapping columns; !important overrides
    that. markFiles() tags the parts. ServiceNow also hides the files that do
    not fit on its single line (showing "+2"); the list has room for all.
    */
    #${PREFIX}-files #header_attachment_list > li.attachment_list_items,
    #${PREFIX}-files #header_attachment_list > li.attachment_list_items.hidden {
      display: flex !important; visibility: visible !important; opacity: 1 !important;
      position: static !important; flex-wrap: wrap !important;
      align-items: baseline !important; gap: .1rem .4rem !important;
    }
    /* A wrapper around all of a file's parts takes no space of its own, so
    its parts line up as above. */
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-wrap { display: contents !important; }
    /* Only the tagged parts are resized; untagged parts (for example text
    meant for screen readers only) keep ServiceNow's styling. */
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-icon,
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-name,
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-action {
      flex: 0 0 auto !important; float: none !important; position: static !important;
      width: auto !important; max-width: 100% !important; height: auto !important;
      max-height: none !important; margin: 0 !important; overflow: visible !important;
      text-overflow: clip !important; visibility: visible !important;
    }
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-icon { flex: 0 0 1.25rem !important; }
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-name {
      flex: 1 1 calc(100% - 1.65rem) !important; min-width: 0 !important;
      white-space: normal !important; overflow-wrap: anywhere;
    }
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-name * {
      max-width: none !important; white-space: normal !important; text-overflow: clip !important;
      visibility: visible !important;
    }
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-action { white-space: nowrap !important; font-size: .92em; }
    #${PREFIX}-files #header_attachment_list > li .${PREFIX}-file-action-first { margin-left: 1.65rem !important; }
    #${PREFIX}-files #${ATTACHMENT_HEADER_ID} .plus_more { display: none !important; }
    #${PREFIX}-files #attachment_upload_progress:empty { display: none !important; }
    /* Show/Hide button for the files, at the top right of the card, beside
    "Manage Attachments (n):", which keeps room for it on its right (see
    ensureFilesToggle()). Closed: only ServiceNow's file rows are hidden;
    these rules sit after (and outrank) the rules above that show them.
    */
    .${PREFIX}-files { position: relative; }
    .${PREFIX}-files-toggle {
      position: absolute; top: .5rem; right: .6rem; z-index: 1;
      display: inline-flex; align-items: center; gap: .4em; margin: 0; padding: .1rem .5rem;
      border: 1px solid var(--${PREFIX}-line); border-radius: 6px;
      background: var(--${PREFIX}-surface); color: var(--${PREFIX}-accent);
      font: inherit; font-size: .85em; font-weight: 400; line-height: 1.3; cursor: pointer;
    }
    .${PREFIX}-files-toggle:hover { background: var(--${PREFIX}-soft); }
    .${PREFIX}-files-toggle:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .${PREFIX}-files-toggle[hidden] { display: none !important; }
    .${PREFIX}-files-toggle[aria-expanded="false"] .${PREFIX}-chevron { transform: rotate(-45deg); margin-top: 0; }
    #${PREFIX}-files.${PREFIX}-files-has-toggle #header_attachment_list > li.manage_list { padding-right: 4.25rem !important; }
    #${PREFIX}-files.${PREFIX}-files-collapsed #header_attachment_list > li.attachment_list_items,
    #${PREFIX}-files.${PREFIX}-files-collapsed #header_attachment_list > li.attachment_list_items.hidden {
      display: none !important;
    }
    #${PREFIX}-files.${PREFIX}-files-collapsed #header_attachment_list > li.manage_list { padding-bottom: 0 !important; }
    /* The separator ServiceNow draws under the attachment line, now empty. */
    .${PREFIX}-files-moved #${ATTACHMENT_LINE_ID} { display: none !important; }
    /* Editor toolbar kept visible while scrolling (see updateToolbar()). */
    .${PREFIX}-tb-pinned {
      position: fixed !important; top: var(--${PREFIX}-tb-top) !important;
      left: var(--${PREFIX}-tb-left) !important; width: var(--${PREFIX}-tb-width) !important;
      box-sizing: border-box !important; z-index: ${CONFIG.TOOLBAR_Z_INDEX} !important;
      background-color: var(--${PREFIX}-tb-background, #ffffff) !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, .18) !important;
    }
    .${PREFIX}-tb-spacer { padding-top: var(--${PREFIX}-tb-space) !important; }
    .${PREFIX}-warning { display: block; color: #b00020; }
    .${PREFIX}-warning[hidden] { display: none !important; }
    @media (prefers-reduced-motion: reduce) {
    .${PREFIX}-chevron { transition: none; }
    }
    `;
    (document.head || document.documentElement).appendChild(style);
  }
  // ---- Building blocks ------------------------------------------------------------
  function makeIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', PREFIX + '-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const [tag, attributes] of ICONS[name]) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, String(value));
      svg.appendChild(shape);
    }
    return svg;
  }
  function setIcon(control, name) {
    const current = control.querySelector('.' + PREFIX + '-svg');
    const icon = makeIcon(name);
    if (current) current.replaceWith(icon);
    else control.prepend(icon);
  }
  function readCollapsed() {
    try {
      return window.localStorage.getItem(CONFIG.STORAGE_KEY) === '1';
    } catch (_) {
      return false; // Storage blocked: start open.
    }
  }
  function saveCollapsed(collapsed) {
    try {
      window.localStorage.setItem(CONFIG.STORAGE_KEY, collapsed ? '1' : '0');
    } catch (_) {
      debug('Could not remember the open/closed choice (storage unavailable).');
    }
  }
  // Only '0' (opened with the button) shows the files; no saved choice yet,
  // or blocked storage, keeps them closed.
  function readFilesCollapsed() {
    try {
      return window.localStorage.getItem(CONFIG.FILES_STORAGE_KEY) !== '0';
    } catch (_) {
      return true;
    }
  }
  function saveFilesCollapsed(collapsed) {
    try {
      window.localStorage.setItem(CONFIG.FILES_STORAGE_KEY, collapsed ? '1' : '0');
    } catch (_) {
      debug('Could not remember the attachment list choice (storage unavailable).');
    }
  }
  function openPrivate(url) {
    if (typeof GM_openInTab !== 'function') {
      console.warn(LOG_PREFIX + 'Private window unavailable: GM_openInTab is not granted.');
      return;
    }
    // Tampermonkey opens a private window only if the browser allows the
    // extension in private/incognito windows.
    GM_openInTab(url, { incognito: true });
  }
  // From Better KB shortcuts: GM_setClipboard needs no page focus or
  // clipboard permission; the standard Clipboard API is a fallback.
  function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return Promise.resolve();
      }
    } catch (error) {
      return Promise.reject(error);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('No clipboard API available'));
  }
  // Screen-reader announcement for copy results (the visual feedback is the
  // icon and tooltip/label change).
  function announce(text) {
    if (!state.status) return;
    state.status.textContent = '';
    window.setTimeout(() => { if (state.status) state.status.textContent = text; }, 30);
  }
  // Copy behaviour for the Copy link icon. The href stays a real address
  // (right-click > Copy link address also works); a normal click copies it
  // instead of navigating. The icon turns into a tick and the tooltip reads
  // "Copied" for a moment.
  function addCopyBehaviour(control, idleIcon, idleTip) {
    let timer = 0;
    function show(ok) {
      window.clearTimeout(timer);
      setIcon(control, ok ? 'copied' : 'copyFailed');
      control.title = ok ? 'Copied' : 'Copy failed';
      announce(ok ? 'Article link copied' : 'Copy failed');
      timer = window.setTimeout(() => {
        setIcon(control, idleIcon);
        control.title = idleTip;
        }, CONFIG.COPIED_FEEDBACK_MS);
    }
    control.addEventListener('click', (event) => {
      event.preventDefault();
      copyText(control.getAttribute('href')).then(() => show(true), (error) => {
        console.warn(LOG_PREFIX + 'Copy link failed: ' + (error && error.name ? error.name : 'unknown error'));
        show(false);
      });
    });
  }
  // One icon button: a real link with an accessible name and the browser's
  // own tooltip (ServiceNow's bar may clip anything drawn outside it).
  function buildIconButton(entry) {
    const item = document.createElement('a');
    item.className = PREFIX + '-ib ' + PREFIX + '-' + entry.kind;
    item.href = entry.href;
    item.setAttribute('aria-label', entry.label);
    item.title = entry.label;
    item.appendChild(makeIcon(entry.icon));
    if (entry.kind === 'copy') {
      addCopyBehaviour(item, entry.icon, entry.label);
      return item;
    }
    item.target = '_blank';
    item.rel = 'noopener';
    if (entry.kind === 'private') {
      // Every click (including middle and Ctrl/Cmd-click) opens the private
      // window instead of a normal tab.
      const open = (event) => {
        if (event.type === 'auxclick' && event.button !== 1) return;
        event.preventDefault();
        openPrivate(entry.href);
      };
      item.addEventListener('click', open);
      item.addEventListener('auxclick', open);
    } else if (entry.kind === 'workspace') {
      // As in the original, a plain click opens Workspace through
      // Tampermonkey; middle/Ctrl/Cmd-click keep the browser's own handling.
      item.addEventListener('click', (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (typeof GM_openInTab !== 'function') return; // Normal link fallback.
        event.preventDefault();
        GM_openInTab(entry.href);
      });
    }
    return item;
  }
  function buildActions(record) {
    const group = document.createElement('div');
    for (const entry of buildShortcuts(record)) group.appendChild(buildIconButton(entry));
    return group;
  }
  // Header contents, one line: "KB number - Title" linked to the latest
  // published article on the left, the Workflow state on the right.
  function buildHead(record) {
    const head = document.createElement('div');
    head.className = PREFIX + '-head';
    const line = document.createElement('div');
    line.className = PREFIX + '-line' + (CONFIG.SHOW_STATUS ? ' ' + PREFIX + '-with-status' : '');
    const text = document.createElement('div');
    text.className = PREFIX + '-title-text';
    const link = document.createElement('a');
    link.className = PREFIX + '-title';
    link.href = articleUrl(record.number);
    link.target = '_new'; // Kept from Better KB shortcuts: reuses one tab.
    link.rel = 'noopener';
    link.title = 'Open the latest published version of this article';
    link.textContent = titleText(record);
    text.appendChild(link);
    line.appendChild(text);
    if (CONFIG.SHOW_STATUS) {
      const slot = document.createElement('div');
      slot.className = PREFIX + '-status';
      const lozenge = document.createElement('span');
      lozenge.className = PREFIX + '-lozenge';
      lozenge.hidden = true;
      slot.appendChild(lozenge);
      line.appendChild(slot); // The space stays reserved even when empty.
    }
    head.appendChild(line);
    return head;
  }
  // Keeps the title link in step with Short description edits.
  function updateTitleLink() {
    if (!state.record || !state.bar) return;
    const link = state.bar.querySelector('.' + PREFIX + '-title');
    if (!link) return;
    const field = document.getElementById(state.record.table + '.short_description');
    if (field) state.record.title = String(field.value || '').trim();
    const value = titleText(state.record);
    if (link.textContent !== value) link.textContent = value;
  }
  // Read-only copy of Workflow; hidden when the value is missing.
  function updateStatus() {
    if (!CONFIG.SHOW_STATUS || !state.record || !state.bar) return;
    const lozenge = state.bar.querySelector('.' + PREFIX + '-lozenge');
    if (lozenge) {
      const text = fieldDisplay(state.record.table, 'workflow_state');
      const className = PREFIX + '-lozenge ' + PREFIX + '-tone-' + statusTone(text);
      if (lozenge.textContent !== text) lozenge.textContent = text;
      if (lozenge.className !== className) lozenge.className = className;
      if (lozenge.hidden === !!text) lozenge.hidden = !text;
      if (text) lozenge.setAttribute('aria-label', 'Workflow: ' + text);
    }
  }
  function updateWarning() {
    if (!state.warning) return;
    const show = state.collapsed && hasEmptyRequired(state.parts);
    if (state.warning.hidden === show) state.warning.hidden = !show;
  }
  function applyCollapsed(collapsed, remember) {
    state.collapsed = collapsed;
    for (const part of state.parts) part.classList.toggle(PREFIX + '-hidden', collapsed);
    if (state.toggle) {
      state.toggle.setAttribute('aria-expanded', String(!collapsed));
      state.toggle.querySelector('.' + PREFIX + '-toggle-text').textContent =
      collapsed ? 'Show details' : 'Hide details';
    }
    if (remember) saveCollapsed(collapsed);
    updateWarning();
    scheduleFit(); // The editor's width can change with the layout.
  }
  function buildToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button'; // Never submits the ServiceNow form.
    toggle.className = 'btn btn-default ' + PREFIX + '-toggle';
    const chevron = document.createElement('span');
    chevron.className = PREFIX + '-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = PREFIX + '-toggle-text';
    toggle.append(chevron, text);
    toggle.addEventListener('click', () => applyCollapsed(!state.collapsed, true));
    return toggle;
  }
  // withToggle is false when the details cannot be identified safely: the
  // header then only adds its contents and hides nothing.
  function buildBar(record, withToggle) {
    const bar = document.createElement('div');
    bar.id = PREFIX + '-bar';
    bar.className = PREFIX + '-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', record.table === 'kb_knowledge_block' ? 'Knowledge Block header' : 'Article header');
    // First column: kept even when empty, so the header stays in the second.
    // placeToggle() puts Show/Hide details here or in the grey bar.
    const lead = document.createElement('div');
    lead.className = PREFIX + '-lead';
    bar.appendChild(lead);
    if (withToggle) {
      if (!state.toggle) state.toggle = buildToggle();
      lead.appendChild(state.toggle);
    } else {
      if (state.toggle) state.toggle.remove(); // Nothing left to open or close.
      state.toggle = null;
    }
    const head = buildHead(record);
    if (withToggle) {
      const warning = document.createElement('span');
      warning.className = PREFIX + '-warning';
      warning.setAttribute('role', 'status');
      warning.textContent = 'A required field in the details is empty';
      warning.hidden = true;
      head.appendChild(warning);
      state.warning = warning;
    } else {
      state.warning = null;
    }
    const status = document.createElement('span');
    status.className = PREFIX + '-sr';
    status.setAttribute('role', 'status');
    head.appendChild(status);
    state.status = status;
    bar.appendChild(head);
    return bar;
  }
  // The field whose position the header and grey-bar icons follow: Short
  // description, else Number.
  function referenceField() {
    if (!state.record) return null;
    return document.getElementById(state.record.table + '.short_description') || state.record.numberField;
  }
  // The left edge of the form's fields, or null when it is not on screen.
  function fieldsLeft() {
    const field = referenceField();
    return isRendered(field) ? field.getBoundingClientRect().left : null;
  }
  // Use the reference field's font size and family for the title text, so
  // it matches Short description. Only written when it changes.
  function matchFieldFont() {
    const field = referenceField();
    const text = state.bar && state.bar.querySelector('.' + PREFIX + '-title-text');
    if (!text || !isRendered(field)) return;
    const computed = window.getComputedStyle(field);
    for (const [property, value] of [['font-size', computed.fontSize], ['font-family', computed.fontFamily]]) {
      if (value && text.style.getPropertyValue(property) !== value) text.style.setProperty(property, value);
    }
  }
  // Make the header line span exactly the form fields: it starts where
  // Short description starts and ends where it ends, so the Workflow state
  // sits inside the fields' right edge. Show/Hide details then sits in the
  // label column. Measured, because ServiceNow's column widths vary with
  // window size and form layout. When labels sit above fields (narrow
  // windows), the header simply follows the button.
  function alignHeader() {
    const bar = state.bar;
    if (!CONFIG.ALIGN_WITH_FIELDS || !bar || !bar.isConnected || !isRendered(bar) || !state.record) return;
    const field = referenceField();
    const first = bar.firstElementChild;
    let columns = '';
    if (isRendered(field) && first) {
      const fieldRect = field.getBoundingClientRect();
      const offset = Math.round(fieldRect.left - bar.getBoundingClientRect().left);
      const width = Math.floor(fieldRect.width);
      const needed = Math.ceil(first.getBoundingClientRect().width) + 8;
      if (offset >= needed) columns = offset + 'px ' + (width > 0 ? width + 'px' : 'minmax(0, 1fr)');
    }
    if (bar.style.gridTemplateColumns !== columns) {
      bar.style.gridTemplateColumns = columns;
      bar.style.columnGap = columns ? '0' : '';
    }
  }
  function ensureBar(record) {
    if (state.bar && state.bar.isConnected) {
      updateWarning();
      return;
    }
    const found = findDetailParts(record);
    if (found) {
      const { parts, parent, shortRow } = found;
      state.parts = parts;
      if (CONFIG.SHORT_DESCRIPTION_FIRST && shortRow) moveBefore(shortRow, parts[0]);
      state.bar = buildBar(record, true);
      // Header first, then Short description when it sits directly above the
      // details (just moved, or moved before a ServiceNow redraw).
      const above = parts[0].previousElementSibling;
      const anchor = above && above.querySelector &&
      above.querySelector('[id="element.' + record.table + '.short_description"]') ? above : parts[0];
      parent.insertBefore(state.bar, anchor);
      placeToggle();
      const keepOpen = CONFIG.EXPAND_WHEN_REQUIRED_EMPTY && hasEmptyRequired(parts);
      applyCollapsed(readCollapsed() && !keepOpen, false);
      watchTitleField(record);
      return;
    }
    // Fallback: header above the Number field, without the open/close button.
    state.parts = [];
    const start = document.getElementById('element.' + record.table + '.number');
    if (!start || !start.parentElement || isTablePart(start.parentElement)) {
      debug('No safe place for the header; leaving the form unchanged.');
      state.bar = null;
      return;
    }
    debug('Details section not identified; header added without Show/Hide details.');
    state.bar = buildBar(record, false);
    start.parentElement.insertBefore(state.bar, start);
    watchTitleField(record);
  }
  // ---- Dock in ServiceNow's form bar ---------------------------------------------
  // The grey bar holding "Knowledge KB..." and the Save/Update buttons. Found
  // from ServiceNow's own header UI action buttons, then their enclosing
  // navigation bar; it must not be part of the form fields. Its title (the
  // "Knowledge KB..." heading) is where the dock goes.
  function findFormBar(record) {
    const button = document.querySelector(FORM_BAR_BUTTON);
    const bar = button && button.closest('nav, .navbar');
    if (!bar || bar.contains(record.numberField)) return null;
    const title = bar.querySelector('.navbar-title, h1');
    if (!title || title.contains(button)) return null;
    return { bar, title };
  }
  // One group after the bar's title: Show/Hide details (see placeToggle()),
  // then the icon buttons.
  function ensureDock(record) {
    if (!CONFIG.DOCK_IN_FORM_BAR && !CONFIG.TOGGLE_IN_FORM_BAR) return;
    if (state.tools && state.tools.isConnected) return;
    const found = findFormBar(record);
    if (!found) {
      debug('Form bar not identified; no dock added.');
      return;
    }
    const tools = document.createElement('div');
    tools.id = PREFIX + '-tools';
    tools.className = PREFIX + '-tools';
    if (CONFIG.DOCK_IN_FORM_BAR) {
      const dock = buildActions(record);
      dock.id = PREFIX + '-dock';
      dock.className = PREFIX + '-dock';
      dock.setAttribute('role', 'group');
      dock.setAttribute('aria-label', 'Article shortcuts');
      tools.appendChild(dock);
      state.dock = dock;
    }
    found.title.insertAdjacentElement('afterend', tools);
    state.tools = tools;
    placeToggle();
  }
  // Show/Hide details goes first in the grey bar when that is available,
  // otherwise in the header's first column. The same button moves, so its
  // state and click handling are kept, and so does keyboard focus.
  function placeToggle() {
    const toggle = state.toggle;
    if (!toggle) return;
    const inTools = !!(CONFIG.TOGGLE_IN_FORM_BAR && state.tools && state.tools.isConnected);
    const lead = state.bar && state.bar.isConnected ? state.bar.querySelector('.' + PREFIX + '-lead') : null;
    const target = inTools ? state.tools : lead;
    if (!target) return;
    if (target.firstElementChild !== toggle) {
      const hadFocus = document.activeElement === toggle;
      target.insertBefore(toggle, target.firstChild);
      if (hadFocus && document.activeElement !== toggle) toggle.focus();
    }
    if (state.bar && state.bar.classList.contains(PREFIX + '-toggle-in-bar') !== inTools) {
      state.bar.classList.toggle(PREFIX + '-toggle-in-bar', inTools);
    }
  }
  // Start the grey-bar group (Show/Hide details, then the icons) where the
  // form fields start. The group follows the bar's title, so the point it
  // starts from is its left edge minus its current left margin (whether from
  // the style sheet or set here); the new margin is the distance from there
  // to the fields. Both elements are in the same frame, so their positions
  // are comparable.
  function alignDock() {
    const dock = state.tools;
    if (!CONFIG.ALIGN_DOCK_WITH_FIELDS || !dock || !dock.isConnected || !isRendered(dock)) return;
    const left = fieldsLeft();
    if (left === null) return;
    const currentMargin = parseFloat(window.getComputedStyle(dock).marginLeft) || 0;
    const base = dock.getBoundingClientRect().left - currentMargin;
    const gap = Math.round(left - base);
    // Fields further left than the title's end (narrow windows): keep the
    // style sheet's spacing instead of overlapping the title.
    const margin = gap >= 8 ? gap + 'px' : '';
    if (dock.style.marginLeft !== margin) dock.style.marginLeft = margin;
  }
  // Moves the Short description row (no frame inside, checked by the caller)
  // and keeps the cursor in its field if it was there.
  function moveBefore(node, reference) {
    const active = document.activeElement;
    const hadFocus = active && node.contains(active);
    reference.parentElement.insertBefore(node, reference);
    if (hadFocus && document.activeElement !== active && typeof active.focus === 'function') active.focus();
  }
  let titleFieldWatched = null;
  function watchTitleField(record) {
    const field = document.getElementById(record.table + '.short_description');
    if (!field || titleFieldWatched === field) return;
    titleFieldWatched = field;
    field.addEventListener('input', updateTitleLink);
    field.addEventListener('change', updateTitleLink);
  }
  // Called with the observer's records: open the details (without changing the
  // remembered choice) when a ServiceNow error appears inside them, or anywhere
  // while a required field inside them is empty.
  function expandOnError(records) {
    if (!state.collapsed || !state.parts.length || !CONFIG.EXPAND_WHEN_REQUIRED_EMPTY) return;
    let errorShown = false;
    let errorInside = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (!node.matches(ERROR_MESSAGE) && !node.querySelector(ERROR_MESSAGE)) continue;
        errorShown = true;
        if (state.parts.some((part) => part.contains(node))) errorInside = true;
      }
    }
    if (errorInside || (errorShown && hasEmptyRequired(state.parts))) applyCollapsed(false, false);
  }
  // ---- Attachment list -----------------------------------------------------------
  // ServiceNow's attachment line (Manage Attachments, then the links for each
  // file) is moved, not copied, into a card in the header, so its own links,
  // rename and download keep working; the style sheet lists one file per
  // line. ServiceNow finds these elements by ID, which moving keeps. Nothing
  // happens on forms without the attachment line, and a line added later
  // (first upload) is picked up by the page observer.
  function ensureFiles() {
    if (!CONFIG.ATTACHMENT_LIST || !state.bar || !state.bar.isConnected) return;
    const native = document.getElementById(ATTACHMENT_HEADER_ID);
    if (!native || native.contains(state.bar) || (state.tools && state.tools.contains(native))) return;
    let files = state.files;
    if (!files || !state.bar.contains(files)) {
      files = document.createElement('div');
      files.id = PREFIX + '-files';
      files.className = PREFIX + '-files';
      files.setAttribute('role', 'group');
      files.setAttribute('aria-label', 'Attachments');
      state.bar.appendChild(files);
      state.files = files;
    }
    if (native.parentElement !== files) {
      files.appendChild(native);
      document.documentElement.classList.add(PREFIX + '-files-moved');
      debug('Attachment line moved into the list card.');
    }
  }
  // Tags the parts of each file (icon, name, rename/download links) so the
  // style sheet can put the icon and name on the first line and the links on
  // the second. Only these classes are added; ServiceNow's elements, text and
  // links stay as they are. Re-applied after ServiceNow redraws the list.
  const FILE_ROLES = ['icon', 'name', 'action', 'action-first', 'wrap'];
  function setFileRoles(part, roles) {
    for (const role of FILE_ROLES) {
      const name = PREFIX + '-file-' + role;
      const want = roles.includes(role);
      if (part.classList.contains(name) !== want) part.classList.toggle(name, want);
    }
  }
  // Text meant for screen readers only (such as "Attached by ... On ...") is
  // drawn about 1px wide and must stay hidden. Not-yet-drawn parts (0px)
  // count as visible.
  function isScreenReaderOnly(part) {
    if (/(^|\s)(sr-only|screen-reader-text|visually-hidden)(\s|$)/.test(part.className || '')) return true;
    const rect = part.getBoundingClientRect();
    return rect.width > 0 && rect.width <= 2;
  }
  function markFiles() {
    const list = state.files && state.files.querySelector('#header_attachment_list');
    if (!list) return;
    for (const item of list.children) {
      if (!item.classList.contains('attachment_list_items')) continue;
      // Look inside single wrappers (an element holding all of the parts).
      let holder = item;
      while (holder.children.length === 1 && holder.firstElementChild.children.length > 1) {
        holder = holder.firstElementChild;
        setFileRoles(holder, ['wrap']);
      }
      let named = false;
      let firstAction = true;
      for (const part of holder.children) {
        const text = String(part.textContent || '').replace(/\s+/g, ' ').trim();
        const roles = [];
        if (/^(\[[^\]]*\]\s*)+$/.test(text) || /^(rename|download)$/i.test(text)) {
          roles.push('action');
          if (firstAction) roles.push('action-first');
          firstAction = false;
        } else if (!text && (part.matches('img, svg') || part.querySelector('img, svg'))) {
          roles.push('icon');
        } else if (!named && text && !isScreenReaderOnly(part)) {
          roles.push('name');
          named = true;
        }
        setFileRoles(part, roles);
      }
    }
  }
  // Show/Hide for the files in the card. The button belongs to the script
  // and sits in the script's card, before ServiceNow's attachment line, so
  // it comes first when tabbing. Closing only adds a class to the card, so
  // ServiceNow's elements and links are untouched and the files stay hidden
  // when ServiceNow redraws the list (after an upload, for example).
  function setClass(element, name, on) {
    if (element.classList.contains(name) !== on) element.classList.toggle(name, on);
  }
  function applyFilesCollapsed(collapsed, remember) {
    state.filesCollapsed = collapsed;
    if (state.files) setClass(state.files, PREFIX + '-files-collapsed', collapsed);
    const toggle = state.filesToggle;
    if (toggle) {
      const label = collapsed ? 'Show attachments' : 'Hide attachments';
      if (toggle.getAttribute('aria-expanded') !== String(!collapsed)) toggle.setAttribute('aria-expanded', String(!collapsed));
      if (toggle.getAttribute('aria-label') !== label) toggle.setAttribute('aria-label', label);
      if (toggle.title !== label) toggle.title = label;
      // Text is only written when it changes: each write is a page change
      // that the page observer would otherwise answer with another check.
      const text = toggle.querySelector('.' + PREFIX + '-files-toggle-text');
      const word = collapsed ? 'Show' : 'Hide';
      if (text && text.textContent !== word) text.textContent = word;
    }
    if (remember) saveFilesCollapsed(collapsed);
  }
  function buildFilesToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button'; // Never submits the ServiceNow form.
    toggle.className = PREFIX + '-files-toggle';
    toggle.setAttribute('aria-controls', 'header_attachment_list');
    const chevron = document.createElement('span');
    chevron.className = PREFIX + '-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = PREFIX + '-files-toggle-text';
    toggle.append(chevron, text);
    toggle.addEventListener('click', () => {
      applyFilesCollapsed(!state.filesCollapsed, true);
      // In narrow windows the card is part of the page flow, so the editor
      // moves; re-place the kept-visible toolbar.
      scheduleToolbar();
    });
    return toggle;
  }
  // Called after ensureFiles() and markFiles(). The button is hidden when
  // the card lists no files (ServiceNow keeps the line for an empty list).
  function ensureFilesToggle() {
    const files = state.files;
    if (!CONFIG.COLLAPSIBLE_ATTACHMENTS || !files || !files.isConnected) return;
    if (state.filesCollapsed === null) state.filesCollapsed = readFilesCollapsed();
    if (!state.filesToggle) state.filesToggle = buildFilesToggle();
    const toggle = state.filesToggle;
    // Moving an element that is already in place still counts as a page
    // change, so it is only moved when needed.
    if (files.firstElementChild !== toggle) files.prepend(toggle);
    const list = files.querySelector('#header_attachment_list');
    let count = 0;
    if (list) {
      for (const item of list.children) if (item.classList.contains('attachment_list_items')) count++;
    }
    if (toggle.hidden !== (count === 0)) toggle.hidden = count === 0;
    setClass(files, PREFIX + '-files-has-toggle', count > 0);
    applyFilesCollapsed(state.filesCollapsed, false);
  }
  // At the right of the form fields when there is room for the card (wide
  // windows leave an empty column there), otherwise below the header line.
  // Measured, like alignHeader(), because the column widths depend on the
  // window size and form layout. The card is positioned inside the header,
  // so it scrolls with the form.
  function placeFiles() {
    const bar = state.bar;
    const files = state.files;
    if (!bar || !files || !bar.contains(files) || !isRendered(bar)) return;
    const field = referenceField();
    let side = null;
    if (isRendered(field)) {
      const fieldRect = field.getBoundingClientRect();
      const gap = CONFIG.ATTACHMENT_SIDE_GAP_PX;
      const room = Math.floor(document.documentElement.clientWidth - fieldRect.right - 2 * gap);
      if (room >= CONFIG.ATTACHMENT_SIDE_MIN_PX) {
        side = {
          left: Math.round(fieldRect.right + gap - bar.getBoundingClientRect().left),
          width: Math.min(room, CONFIG.ATTACHMENT_SIDE_MAX_PX)
        };
      }
    }
    if (bar.classList.contains(PREFIX + '-files-side') !== !!side) bar.classList.toggle(PREFIX + '-files-side', !!side);
    if (bar.classList.contains(PREFIX + '-files-flow') !== !side) bar.classList.toggle(PREFIX + '-files-flow', !side);
    const left = side ? side.left + 'px' : '';
    const width = side ? side.width + 'px' : '';
    if (files.style.left !== left) files.style.left = left;
    if (files.style.width !== width) files.style.width = width;
  }
  // ---- Original script features ----------------------------------------------
  // The form usually sits in ServiceNow's navigation frame; the tab title
  // belongs to the top window (same instance, so access is allowed). The
  // outer page can set its own title after the form loads, so the title is
  // re-applied when it differs, up to CONFIG.MAX_TITLE_WRITES times, so the
  // script never fights the page indefinitely.
  function setTabTitle(record) {
    if (state.titleWrites >= CONFIG.MAX_TITLE_WRITES) return;
    const title = record.tabTitle ? record.number + ' - ' + record.tabTitle : record.number;
    let target = document;
    try {
      target = window.top.document;
    } catch (_) {
      target = document; // Cross-origin top window: set this frame's title.
    }
    if (target.title === title) return;
    target.title = title;
    state.titleWrites += 1;
  }
  function fixCheckoutLabel() {
    if (!CONFIG.CHECKOUT_BUTTON_ID) return;
    const button = document.getElementById(CONFIG.CHECKOUT_BUTTON_ID);
    if (button && button.textContent.trim() !== CONFIG.CHECKOUT_LABEL) button.textContent = CONFIG.CHECKOUT_LABEL;
  }
  function warnIfOriginalEnabled(record) {
    if (state.duplicateWarned) return;
    // The original script gives its first icon this ID.
    if (document.getElementById(record.number + '_pub')) {
      state.duplicateWarned = true;
      console.warn(LOG_PREFIX + '"Destination LPS KB form" also seems enabled: disable it to avoid duplicate icons.');
    }
  }
  function editorFrame(record) {
    return document.getElementById(record.table + '.text_ifr');
  }
  // The editor's document, once TinyMCE has built it (same origin).
  function editorDocument() {
    const frame = state.record && editorFrame(state.record);
    let doc = null;
    try {
      doc = frame && frame.contentDocument;
    } catch (_) {
      doc = null;
    }
    if (!doc || !doc.head || !doc.body) return null;
    if (!doc.body.classList.contains('mce-content-body') && doc.body.id !== 'tinymce') return null;
    return doc;
  }
  // Adds the original script's style sheet inside the editor once TinyMCE has
  // built the editor's document. Retried because TinyMCE starts after load.
  function ensureEditorStylesheet(record) {
    if (state.stylesheetDone) return;
    if (!CONFIG.EDITOR_STYLESHEET || record.table !== 'kb_knowledge') {
      state.stylesheetDone = true;
      return;
    }
    const doc = editorDocument();
    if (!doc) return;
    if (!doc.getElementById(PREFIX + '-editor-css')) {
      const link = doc.createElement('link');
      link.id = PREFIX + '-editor-css';
      link.rel = 'stylesheet';
      link.type = 'text/css';
      // Same address the original's relative link resolved to.
      link.href = new URL(CONFIG.EDITOR_STYLESHEET, document.baseURI).href;
      doc.head.appendChild(link);
    }
    state.stylesheetDone = true;
  }
  // ---- Editor height -----------------------------------------------------------------
  function editorContainer() {
    if (!state.record) return null;
    const frame = editorFrame(state.record);
    return frame ? frame.closest(EDITOR_CONTAINER) : null;
  }
  // floor: height dragged with the handle (the fitted height never goes
  // below it). last: the height this script last set. resets: times when
  // something else had changed it (safety stop).
  const fit = { floor: 0, last: 0, resets: [], stopped: false, dragging: false, doc: null, container: null, timer: 0 };
  function setEditorHeight(container, height) {
    container.style.setProperty('max-height', 'none');
    container.style.setProperty('height', height + 'px');
    fit.last = height;
  }
  // Height of the article inside the editor: the bottom of its last block
  // plus the body's bottom spacing. Measured from the content, not the
  // editor's scroll height, because that is never smaller than the editor
  // itself and would stop the editor shrinking when text is deleted.
  function contentHeight(doc) {
    const body = doc.body;
    const view = doc.defaultView;
    const scrollTop = (view && view.pageYOffset) || 0;
    const styleOf = (element) => (view && view.getComputedStyle ? view.getComputedStyle(element) : null);
    let bottom = 0;
    for (const child of body.children) {
      const rect = child.getBoundingClientRect();
      if (!rect.width && !rect.height) continue; // Hidden.
      const style = styleOf(child);
      bottom = Math.max(bottom, rect.bottom + scrollTop + (style ? parseFloat(style.marginBottom) || 0 : 0));
    }
    const bodyStyle = styleOf(body);
    const spacing = bodyStyle ? (parseFloat(bodyStyle.paddingBottom) || 0) + (parseFloat(bodyStyle.marginBottom) || 0) : 0;
    return Math.ceil(bottom + spacing);
  }
  // Sets the editor to toolbar + article + status bar. Skipped in TinyMCE's
  // full-screen mode and while the editor is hidden.
  function fitEditor() {
    if (!CONFIG.AUTO_FIT_EDITOR || fit.stopped || fit.dragging) return;
    const container = editorContainer();
    const frame = state.record && editorFrame(state.record);
    const doc = editorDocument();
    if (!container || !frame || !doc || !isRendered(container)) return;
    if (container.classList.contains('tox-fullscreen')) return;
    watchEditor(container, doc);
    const current = container.getBoundingClientRect().height;
    const chrome = current - frame.getBoundingClientRect().height; // Toolbars and status bar.
    if (!(chrome >= 0)) return;
    const target = clamp(Math.ceil(chrome + contentHeight(doc) + CONFIG.AUTO_FIT_EXTRA_PX),
      Math.max(CONFIG.EDITOR_MIN_HEIGHT_PX, fit.floor), CONFIG.EDITOR_MAX_HEIGHT_PX);
    if (Math.abs(current - target) <= 2) return;
    if (fit.last && Math.abs(current - fit.last) > 2) {
      const now = Date.now();
      fit.resets = fit.resets.filter((time) => now - time < CONFIG.AUTO_FIT_WINDOW_MS);
      fit.resets.push(now);
      if (fit.resets.length > CONFIG.AUTO_FIT_MAX_RESETS) {
        fit.stopped = true;
        console.warn(LOG_PREFIX + 'Editor height keeps being changed elsewhere; automatic fitting stopped for this page.');
        return;
      }
    }
    setEditorHeight(container, target);
  }
  function scheduleFit() {
    if (!CONFIG.AUTO_FIT_EDITOR || fit.stopped) return;
    window.clearTimeout(fit.timer);
    fit.timer = window.setTimeout(fitEditor, 100);
  }
  // Re-fit when the article changes (typing, pasting, images loading) and
  // when the editor's size or width changes (window resize, ServiceNow or
  // TinyMCE resetting the height). Wired once per editor document.
  function watchEditor(container, doc) {
    if (fit.doc !== doc) {
      fit.doc = doc;
      const Observer = (doc.defaultView && doc.defaultView.MutationObserver) || MutationObserver;
      new Observer(scheduleFit).observe(doc.body, { childList: true, subtree: true, characterData: true });
      doc.addEventListener('load', scheduleFit, true); // Images inside the article.
    }
    if (fit.container !== container) {
      fit.container = container;
      if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFit).observe(container);
    }
  }
  // The resize handle of the article editor only (not other HTML fields).
  function articleResizeHandle(target) {
    const handle = target && target.nodeType === 1 ? target.closest(RESIZE_HANDLE) : null;
    const container = handle ? editorContainer() : null;
    return container && container.contains(handle) ? { handle, container } : null;
  }
  function prepareResizeHandle() {
    const container = editorContainer();
    const handle = container && container.querySelector(RESIZE_HANDLE);
    // Lets touch and pen drags resize instead of scrolling the page.
    if (handle && handle.style.touchAction !== 'none') handle.style.touchAction = 'none';
  }
  // TinyMCE's own drag stops at the editor's configured maximum height. This
  // takes over a mouse/touch drag on the article editor's handle and sets the
  // editor height directly, within CONFIG limits. Dragging taller keeps the
  // extra room; dragging shorter than the article snaps back to fit it.
  // Keyboard resizing on the handle is left to TinyMCE.
  function startResize(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    const found = articleResizeHandle(event.target);
    if (!found) return;
    const { handle, container } = found;
    event.preventDefault();
    event.stopImmediatePropagation();
    const frame = editorFrame(state.record);
    const startY = event.clientY;
    const startHeight = container.getBoundingClientRect().height;
    const previousPointerEvents = frame ? frame.style.pointerEvents : '';
    // The editor is an iframe: without this, it swallows the pointer while
    // the drag passes over it.
    if (frame) frame.style.pointerEvents = 'none';
    fit.dragging = true; // No fitting while the handle is being dragged.
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (_) {
      // Capture unavailable: window-level listeners below still follow the drag.
    }
    let height = startHeight;
    function move(moveEvent) {
      if (moveEvent.pointerId !== event.pointerId) return;
      moveEvent.preventDefault();
      height = clamp(Math.round(startHeight + moveEvent.clientY - startY),
        CONFIG.EDITOR_MIN_HEIGHT_PX, CONFIG.EDITOR_MAX_HEIGHT_PX);
      setEditorHeight(container, height);
    }
    function end(endEvent) {
      if (endEvent.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      if (frame) frame.style.pointerEvents = previousPointerEvents;
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Already released.
      }
      fit.dragging = false;
      fit.floor = height;
      scheduleFit();
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  }
  // Stops TinyMCE starting its own (capped) drag from the same press.
  function blockNativeResize(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;
    if (articleResizeHandle(event.target)) event.stopImmediatePropagation();
  }
  // ---- Editor toolbar kept visible --------------------------------------------------
  // The editor is as tall as the article, so its toolbar would scroll away.
  // Once the top of the editor passes under the grey bar, the toolbar is
  // fixed just below the bar, over its usual place; a spacer keeps its room
  // so the article does not jump. Fixed rather than CSS "sticky": TinyMCE's
  // editor box clips its contents (overflow: hidden), which stops a sticky
  // toolbar from moving. Only the toolbar moves; the article, the stored
  // value and the editor height are untouched.
  const toolbar = { current: null, observer: null, watched: new WeakSet(), frame: 0 };
  function toolbarParts() {
    const container = editorContainer();
    const header = container && container.querySelector(EDITOR_HEADER);
    const holder = header && header.parentElement;
    return holder && container.contains(holder) ? { container, header, holder } : null;
  }
  // Bottom edge of the grey bar on screen, or 0 (top of the window) when the
  // bar is missing, hidden or has scrolled away.
  function toolbarLine() {
    const found = state.record && findFormBar(state.record);
    if (!found) return 0;
    const rect = found.bar.getBoundingClientRect();
    return rect.height ? Math.max(0, rect.bottom) : 0;
  }
  // Pinned only while the editor's top has passed the line and at least one
  // toolbar height of article is still below it, so the toolbar never covers
  // the grey bar or the fields after the editor. null: leave it in place.
  function toolbarTop(line, top, bottom, height) {
    if (!(height > 0) || top >= line) return null;
    if (bottom - height < line) return null;
    return line;
  }
  function setToolbarVar(element, name, value) {
    const property = '--' + PREFIX + '-tb-' + name;
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  }
  function clearToolbarVars(element, names) {
    for (const name of names) element.style.removeProperty('--' + PREFIX + '-tb-' + name);
  }
  // First non-transparent background among the toolbar and its editor, so
  // article text never shows through gaps between buttons.
  function toolbarBackground(parts) {
    for (const element of [parts.header, parts.header.firstElementChild, parts.holder, parts.container]) {
      if (!element) continue;
      const colour = window.getComputedStyle(element).backgroundColor;
      if (colour && colour !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(colour)) return colour;
    }
    return '#ffffff';
  }
  function pinToolbar(parts, top, box, height) {
    const header = parts.header;
    if (!header.classList.contains(PREFIX + '-tb-pinned')) {
      setToolbarVar(header, 'background', toolbarBackground(parts));
      debug('Editor toolbar kept visible.');
    }
    setToolbarVar(header, 'top', Math.round(top) + 'px');
    setToolbarVar(header, 'left', Math.round(box.left) + 'px');
    setToolbarVar(header, 'width', Math.round(box.width) + 'px');
    setToolbarVar(parts.holder, 'space', Math.round(height) + 'px');
    header.classList.add(PREFIX + '-tb-pinned');
    parts.holder.classList.add(PREFIX + '-tb-spacer');
  }
  function unpinToolbar(parts) {
    if (!parts.header.classList.contains(PREFIX + '-tb-pinned') &&
      !parts.holder.classList.contains(PREFIX + '-tb-spacer')) return;
    parts.header.classList.remove(PREFIX + '-tb-pinned');
    parts.holder.classList.remove(PREFIX + '-tb-spacer');
    clearToolbarVars(parts.header, ['top', 'left', 'width', 'background']);
    clearToolbarVars(parts.holder, ['space']);
    debug('Editor toolbar back in place.');
  }
  // Left alone in full-screen mode (already visible there), when TinyMCE's
  // own sticky toolbar or other styling already keeps it in view, and while
  // the editor is hidden.
  function canPinToolbar(parts, box) {
    if (!box.width || !box.height) return false;
    if (parts.container.classList.contains('tox-fullscreen')) return false;
    if (parts.container.classList.contains(NATIVE_STICKY_CLASS)) return false;
    if (!parts.header.classList.contains(PREFIX + '-tb-pinned')) {
      const position = window.getComputedStyle(parts.header).position;
      if (position === 'fixed' || position === 'sticky') return false;
    }
    return true;
  }
  // Size changes catch the editor being fitted to the article, the toolbar
  // wrapping onto more rows and full-screen mode.
  function watchToolbar(parts) {
    if (typeof ResizeObserver !== 'function') return;
    if (!toolbar.observer) toolbar.observer = new ResizeObserver(scheduleToolbar);
    for (const element of [parts.container, parts.header]) {
      if (toolbar.watched.has(element)) continue;
      toolbar.watched.add(element);
      toolbar.observer.observe(element);
    }
  }
  function updateToolbar() {
    const parts = CONFIG.STICKY_EDITOR_TOOLBAR && state.record ? toolbarParts() : null;
    // The editor was rebuilt or removed: release the old toolbar first.
    if (toolbar.current && (!parts || parts.header !== toolbar.current.header)) {
      unpinToolbar(toolbar.current);
      toolbar.current = null;
    }
    if (!parts) return;
    toolbar.current = parts;
    watchToolbar(parts);
    const box = parts.holder.getBoundingClientRect();
    if (!canPinToolbar(parts, box)) {
      unpinToolbar(parts);
      return;
    }
    const height = parts.header.getBoundingClientRect().height;
    const top = toolbarTop(toolbarLine(), box.top, box.bottom, height);
    if (top === null) unpinToolbar(parts);
    else pinToolbar(parts, top, box, height);
  }
  // At most one toolbar update per screen refresh, however many scroll
  // events arrive.
  function scheduleToolbar() {
    if (!CONFIG.STICKY_EDITOR_TOOLBAR || toolbar.frame) return;
    toolbar.frame = window.requestAnimationFrame(() => {
      toolbar.frame = 0;
      updateToolbar();
    });
  }
  // ---- Lifecycle ---------------------------------------------------------------------
  function setupComplete() {
    return !!(state.record && state.bar && state.bar.isConnected && state.stylesheetDone &&
      (!CONFIG.AUTO_FIT_EDITOR || fit.doc) &&
      (!CONFIG.DOCK_IN_FORM_BAR || (state.dock && state.dock.isConnected)));
  }
  function check() {
    const record = state.record || findRecord();
    if (!record) return;
    if (!state.record) {
      state.record = record;
      debug('Knowledge form found (' + record.table + ').');
    }
    ensureStyle();
    setTabTitle(record);
    warnIfOriginalEnabled(record);
    ensureBar(record);
    ensureDock(record);
    placeToggle();
    ensureFiles();
    markFiles();
    ensureFilesToggle();
    updateTitleLink();
    updateStatus();
    alignHeader();
    matchFieldFont();
    alignDock();
    placeFiles();
    ensureEditorStylesheet(record);
    prepareResizeHandle();
    fitEditor();
    fixCheckoutLabel();
    updateToolbar();
  }
  let pending = false;
  function scheduleCheck() {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      check();
      }, CONFIG.CHECK_DEBOUNCE_MS);
  }
  // Window capture runs before TinyMCE's own listeners on the page.
  window.addEventListener('pointerdown', startResize, true);
  window.addEventListener('mousedown', blockNativeResize, true);
  window.addEventListener('touchstart', blockNativeResize, { capture: true, passive: true });
  window.addEventListener('resize', scheduleCheck); // Re-align header, re-fit editor.
  window.addEventListener('resize', scheduleToolbar);
  // Capture also receives scrolling inside ServiceNow's form containers, not
  // only scrolling of the whole page.
  document.addEventListener('scroll', scheduleToolbar, { capture: true, passive: true });
  check();
  for (const delay of CONFIG.TITLE_RECHECK_MS) window.setTimeout(check, delay);
  // Bounded retry while ServiceNow and TinyMCE finish building the form.
  const startedAt = Date.now();
  const poll = window.setInterval(() => {
    check();
    if (setupComplete() || Date.now() - startedAt > CONFIG.SETUP_TIMEOUT_MS) {
      window.clearInterval(poll);
      if (!setupComplete()) debug('Setup incomplete after the time limit; page changes still trigger checks.');
    }
    }, CONFIG.SETUP_POLL_MS);
  // Element additions/removals only (no attributes or text), so typing and
  // our own class changes do not trigger work.
  new MutationObserver((records) => {
    expandOnError(records);
    scheduleCheck();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

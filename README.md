# Better KB editor

A [Tampermonkey](https://www.tampermonkey.net/) userscript that gives the ServiceNow knowledge article form a tidier header, sticky shortcuts and a full-length editor.

- **Header:** Show/Hide details, "KB number - title" linked to the published article, and the Workflow state on the right.
- **Shortcuts** in ServiceNow's grey bar, always in view: Copy link, last published version, this version, private window, Workspace.
- **Details** (Number to Roles) open or close with one click; the choice is remembered.
- **Open/Close accordions**, next to Show/Hide details, opens or closes every accordion in the article at once; one label at a time, saying what the click does, and the choice is remembered.
- **Publish** is replaced by **Close all accordions and publish** while an accordion is left open, so a published article never opens with sections already unfolded. With none open, Publish works as usual.
- **Editor** grows to fit the whole article.
- The browser tab shows "KB number - title".

The script never saves anything in ServiceNow. Opening or closing accordions changes the article in the editor only, so it is kept the next time you save or publish, like any other edit.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the [raw script file](https://raw.githubusercontent.com/Miche-Miche-Miche/Better-KB-editor/main/Better_KB_editor.user.js) and select **Install**.
3. If you also use the original **Destination LPS KB form** script, disable it.

Updates install automatically from the same file.

## Credits

Based on [Destination LPS KB form](https://gist.github.com/lucasvieites/49b318e354244cd3cef92ff5c40c713c) (v0.5) by Lucas Vieites. Copy link and the title link come from [Better KB shortcuts](https://github.com/Miche-Miche-Miche/Better-KB-shortcuts)

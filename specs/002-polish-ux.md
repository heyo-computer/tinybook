# Ergonomic UX
Create a more cohesive UX 

## Tasks
- [ ] add dark and light mode theming - the sidebars and the content area should both respect this and be consistent
- [ ] add settings for the title - replace "tinybook" with the title if set
- [ ] combine the "New Document" and "import" buttons into a single button with a "+" icon that displays a modal that allows the user to create a specific doc type or import
- [ ] allow the different panes to be resized
- [ ] add mistral provider to the settings
- [ ] in markdown editor, add a transcribe button that uses mistral voxtral to write a doc from speech
- [ ] in markdown editor, add a "polish" button that asks the agent to clean up the document and potentially compact it

<!--
Spec format reference (full docs in the printer README):
  * Lines starting with `- [ ]`, `- [x]`, `* [ ]`, `+ [ ]` (etc.) at
    column 0 are tasks. The text after the checkbox is the title.
  * Lines indented by 2 spaces or one tab below a task become its
    description body.
  * Any unindented non-task line ends the current task's description.
  * Re-runs of `printer run <this-file>` are idempotent — items are
    matched to existing tasks by a stable anchor derived from this
    file's path + the task title.
-->

# New Project

Support CSV and kanban views plus imports and exports

## Tasks
- [ ] add csv editor component
- [ ] add kanban component that derives data from csv
- [ ] add ability to add csv and kanban documents in sidebar
- [ ] add ability to reorder items in the sidebar
- [ ] add ability to create documents by importing existing file
- [ ] add ability to download files 
- [ ] styling: add paper shaders to provide texture to the app everywhere except the editor components: https://shaders.paper.design/halftone-dots#colorBack=f2f1e8&colorFront=2b2b2b&originalColors=false&type=gooey&grid=hex&inverted=false&size=0.5&radius=1.25&contrast=0.4&grainMixer=0.2&grainOverlay=0.2&grainSize=0.5&scale=1&fit=cover


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

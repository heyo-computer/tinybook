# Agent Ergonomics
Improve the agent experience.

## Tasks
- [ ] move the new document button to be inline with the logout and settings buttons and ensure its just the icon
- [ ] add "@" mentions for existing files to the agent
- [ ] ensure there is a web search tool for the agent; add to settings and use tavily for searches
- [ ] add a button group at the top of the agent panel
- [ ] add context compaction, clear context, and current context to the button group 
- [ ] add a readonly preview feature which lets anyone read the contents of the book but no agent access and no changes can be made. Ensure that the API endpoints are appropriately guarded

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

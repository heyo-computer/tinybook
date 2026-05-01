# Feedback for Heyo VM Developers

Based on this session deploying a PIN-auth app with `heyvm`, here's feedback on the CLI, API, and skills.

## CLI Issues

### 1. `heyvm deploy` reliability problems

- Consistently failed with `Invalid mount path: Host path does not exist` errors, leaving behind "Unknown" status sandboxes
- The error message doesn't clearly indicate whether this is a backend issue, timing issue, or configuration problem
- These failed sandboxes clutter `heyvm list` output and the only way to clean them seems to be individual `heyvm delete` calls

### 2. `heyvm update` sandbox resolution inconsistency

- `heyvm exec sb-3986321b` works fine
- `heyvm update sb-3986321b` fails with "Sandbox not found" 
- This inconsistency is confusing - if I can exec into a sandbox, why can't I update it?

### 3. `heyvm create` doesn't support public images by ID

- `heyvm create --image bun` fails with "Image 'bun' not found"
- `heyvm create --image im-7fd286f7` (the public bun image) fails with "Image not found"
- Only `ubuntu:24.04`, `debian`, and `alpine` work directly
- This forces users to use `heyvm deploy` for public images, but that has the mounting issues

### 4. Sandbox lifecycle management

- No way to bulk delete failed/Unknown sandboxes
- `heyvm delete` only accepts one ID at a time (no `--all-unknown` or `--filter` options)
- No `heyvm list-inactive` or `heyvm cleanup` command

## API Issues

### 1. 502 Bad Gateway errors

- `sandbox-deploy` endpoint returned 502 during sandbox creation
- No clear retry mechanism or guidance in the CLI

### 2. Mount-replace API opacity

- The `sandbox-mount-replace` endpoint exists but isn't exposed in the CLI
- When it fails, there's no clear feedback

### 3. Missing image validation in deploy

- Deploy requests with invalid image IDs should validate before creating deployment records

## Skills Documentation Issues

### 1. `heyvm images list` documentation mismatch

- Skill docs mention `--libvirt`, `--firecracker`, `--local` flags
- Actual help shows `--libvirt`, `--firecracker`, `--local` but the skill example says `--libvirt` for filtering
- The `--local` flag shows Docker images, but that's not clear from the help text

### 2. Missing `setup-hook` examples

- The skill shows `setup-hook` for installing tools, but when combined with `heyvm deploy`, the sandbox still fails
- Need examples that work: "install bun and run my app" workflow

### 3. KVM vs libvirt confusion

- `kvm-bun` appears in `heyvm list` output as an image
- But `heyvm create --image kvm-bun` fails
- Documentation should clarify local vs public images

## Suggestions

1. **CLI**: Add `--force` or `--cleanup` flag to `heyvm deploy` to delete previous failed deployments with the same name
2. **CLI**: Allow multiple sandbox IDs in `heyvm delete` (`heyvm delete sb-1 sb-2 sb-3`)
3. **CLI**: Add `heyvm update` support for local sandboxes, not just deployed ones
4. **API**: Validate image availability before creating deployment records
5. **Skills**: Add troubleshooting section for "Unknown" status sandboxes
6. **General**: Better error messages that suggest next steps ("Try: heyvm delete sb-xxx to clean up")
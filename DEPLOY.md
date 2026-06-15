# Deploy Guide — Clutch & Clean Detailing

## One-time: push to GitHub
Repo: https://github.com/krugerco/clutch-and-clean

1. Create an **empty** repo on GitHub named `clutch-and-clean`
   (no README, no .gitignore — this project already has them).
2. From inside this folder, in Git Bash:
   ```bash
   git remote add origin https://github.com/krugerco/clutch-and-clean.git
   git push -u origin main
   ```
   If asked for a password, use a **Personal Access Token** (GitHub no longer
   accepts account passwords for git). Generate one at:
   GitHub → Settings → Developer settings → Personal access tokens.
   Or run `gh auth login` to authenticate through the browser.

## One-time: connect Cloudflare Pages
Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git →
select the `clutch-and-clean` repo. Build settings:
- Framework preset: **None**
- Build command: *(leave blank)*
- Build output directory: `/`

Save and Deploy. After this, every `git push` to `main` auto-deploys.

## Everyday updates
```bash
git add -A
git commit -m "describe the change"
git push
```
Cloudflare rebuilds automatically within ~30 seconds.

## IMPORTANT: activate the inquiry form
The "Send an Inquiry" form posts to Formspree (endpoint `maqzazkw`), which
emails leads to Clutchandcleandetailers@gmail.com.

Formspree confirms the address on the FIRST submission. Once the site is live:
1. Submit the form once yourself.
2. Check Clutchandcleandetailers@gmail.com for a Formspree confirmation email.
3. Click the confirmation link.

Until that link is clicked, inquiries will NOT be delivered. After it's
confirmed, every lead arrives with the subject "New detail inquiry — [name]".

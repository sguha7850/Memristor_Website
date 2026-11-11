# Publishing on GitHub Pages

The website is static: HTML, JavaScript, JSON, Markdown and Python files. GitHub Pages can therefore serve it directly, with no build step.

## One-time setup

1. **Create a repository.** Create an empty repository on GitHub, for example `memristor-model`.
   - **Public repository:** Pages is free.
   - **Private repository:** Pages needs a paid plan.
2. **Upload the project.** Choose one of these ways.

   **Option A: GitHub Desktop (easiest on Windows).**
   1. *File → Add local repository* → `D:\Memristor_Website`. If prompted, choose *create a repository*.
   2. Commit all files.
   3. *Publish repository*. Untick "Keep this code private" if you want free Pages.

   **Option B: command line** (Git for Windows):
   ```
   cd D:\Memristor_Website
   git init
   git add .
   git commit -m "Memristor model website"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<repo>.git
   git push -u origin main
   ```
3. **Turn on Pages.** On GitHub, go to **Settings → Pages**.
   1. Set **Source** to *Deploy from a branch*.
   2. Set the **Branch** to `main`, with folder `/ (root)`.
   3. Click **Save**.
4. **Open the site.** After about a minute it is live at `https://<your-user>.github.io/<repo>/`.

## Updating

Edit files, then commit and push (in GitHub Desktop: *Commit* then *Push origin*). Pages redeploys automatically within about a minute.

## Notes

- **Everything in the repository is public**, including the original code in `original_code/`. The stochastic code is shown on the site as documentation, so this is intended. Do not commit anything you do not want published.
- **`.nojekyll`** tells GitHub to serve the files as-is. Keep it.
- **Stale page after a push:** browsers cache aggressively. If an update does not appear, press **Ctrl+F5** to force a reload.
- **Optional test run:** to check everything before pushing, run `python -m pytest validation -v` (see RUNNING_ON_WINDOWS.md).

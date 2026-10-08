---
name: subagents-implement
description: "Implement several issues in parallel, one ticket-implementer subagent per issue, each in its own worktree and PR, then review each PR and drive its CI to green."
disable-model-invocation: true
---

`/implement`, fanned out: the user passes issue numbers, and every issue is
built by its own **implementer** (the `ticket-implementer` subagent) in its
own worktree, ending in its own PR. You are the **parent**: you dispatch,
review, send fixes back, and report. You never edit an implementer's branch
yourself; every change goes back through the implementer that owns the PR.

Everything in `.agents/skills/implement/SKILL.md` still applies, per
issue: each implementer follows it (`/tdd` at pre-agreed seams, typecheck
and single test files regularly, full suite once at the end), and its
`/code-review` step is the parent's review in step 3.

Communicate through **context pointers** (issue numbers, PR URLs, file
paths, commit SHAs) rather than pasting content the implementer can read.

## Steps

1. **Read the issues.** For each number, `gh issue view <n> --comments`.
   Note which issues touch the same files (contracts, shared modules) and
   any blocking relationship between them. An issue blocked by another
   one in the list waits until the blocker's PR is merged; tell the user
   which ones you held back and why. Done when every issue is either
   dispatchable or held back with a reason.

2. **Dispatch in parallel.** In a single message, launch one
   `ticket-implementer` per dispatchable issue, in the background, each
   with worktree isolation (Claude Code: the Agent tool with
   `subagent_type: "ticket-implementer"`, `isolation: "worktree"`,
   `run_in_background: true`; OpenCode: the `task` tool with the
   `ticket-implementer` agent). Each prompt carries only:
   - the issue number;
   - "follow `.agents/skills/implement/SKILL.md` as well as your own
     instructions, skipping its `/code-review` step (the parent reviews)";
   - the sibling issues running in parallel and the shared files you saw
     overlap on, so it keeps those changes minimal and additive;
   - any test change the user explicitly authorized for that issue;
   - "stop after opening the PR and report its URL; the parent will
     message you with review findings and then ask you to watch CI".

   Keep each implementer's ID: every later round goes to the same agent
   (Claude Code: SendMessage to its ID; OpenCode: resume with its
   `task_id`), so it keeps its worktree and context. Done when every
   dispatched implementer has reported a PR URL, or a blocker.

3. **Review each PR** as soon as its implementer reports, without
   waiting for the others. Fetch the branch (`git fetch origin <branch>`)
   and run the `code-review` skill on it with `origin/main` as the fixed
   point and the issue as the spec. Read the `gh pr view <n>` body too:
   it must close the issue and list changed tests and open concerns.
   Done when the review has run and every finding is classified as
   **blocking** (a bug, a spec gap, a broken repo rule from `CLAUDE.md`)
   or **optional**.

4. **Send the findings back.** Message the PR's implementer with the
   blocking findings (file, line, what is wrong, what correct looks
   like) and the optional ones worth taking. It fixes them in its
   worktree, re-runs the gates, pushes to the same PR and reports the new
   head SHA. Re-review only what changed (`git diff <old-sha>..<new-sha>`)
   and repeat until the review is clean. A finding that needs the
   maintainer's decision goes to the user, not to the implementer.
   Done when a review of the latest head has no blocking finding.

5. **Have the implementer drive CI to green.** Message it to watch CI on
   its PR in a loop until every check is green:
   - wait for the run on the current head: `gh pr checks <n> --watch`;
   - on a red check, read the failure (`gh run view <run-id> --log-failed`),
     root-cause it, fix the code, re-run the matching gate locally, push,
     and watch again;
   - a failing test means the code is wrong: fix the code, never the
     test, the gates or the quality configs;
   - a check that is also red on `main`, or a failure outside the PR's
     code, is reported to the parent with the evidence instead of fixed;
   - report the PR URL and "all checks green on <sha>" when done.

   If a CI fix changed more than a few lines, review that diff as in
   step 3 before accepting it. Done when the implementer reports every
   check green on the PR's latest head, or a blocker it can't fix from
   its PR.

6. **Report.** Once every PR is done, give the user one list: per issue,
   the PR URL, its state (green and reviewed, or the blocker and what it
   needs), and anything held back in step 1. Every PR in the list has
   had a clean review and green CI, or says exactly why not.

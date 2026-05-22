---
name: resilient-run
description: 'Start or resume a resilient run — a checkpoint-and-resume protocol that survives context compaction. Usage: /resilient-run <goal> OR /resilient-run resume [path]'
---

# Resilient Run — Checkpoint & Resume Protocol

You are activating the **Resilient Run** protocol. This protocol ensures long-running agent sessions survive context compaction by maintaining a centralized progress file that acts as persistent memory.

The progress file is the **single source of truth**. After context compaction, YOU WILL LOSE conversation memory — but the progress file survives. You MUST write to it frequently so any future session (or yourself after compaction) can pick up exactly where you left off.

## Step 1: Determine Mode

$ARGUMENTS

Parse the arguments above:

- If arguments start with `resume` → go to **Resume Mode** (Step 2B)
- If arguments are empty or blank → go to **Discovery Mode** (Step 2C)
- Otherwise → treat the entire argument as the **goal description** and go to **Init Mode** (Step 2A)

---

## Step 2A: Init Mode — Create a New Resilient Run

You're starting a fresh run. The user provided a goal.

### 2A.1: Confirm the Goal

Read the goal from the arguments. If it's clear and actionable, proceed. If it's vague, use AskUserQuestion to clarify what "done" looks like.

### 2A.2: Generate a Slug

Create a short kebab-case slug from the goal (3-5 words max). Examples:
- "Test the custom domains E2E" → `custom-domains-e2e`
- "Fix all auth bugs on staging" → `fix-auth-bugs-staging`
- "Deploy the worker to production" → `deploy-worker-prod`

### 2A.3: Create the Progress File

Create the directory and file at `docs/resilient-run/<slug>/PROGRESS.md` using this template:

```markdown
# <Goal Summary> — Resilient Run

## Goal
<The full goal description — what "done" looks like, stated clearly and actionably>

## Status: IN PROGRESS

## Plan
1. (To be filled as you analyze the work ahead)

## Environment
- Date started: <today's date>
- Branch: <current git branch>
- Key paths: (fill as relevant)

## Current Phase: 1 — Discovery & Planning

## Completed
(nothing yet)

## Bugs Found & Fixed
| # | Phase | Component | Symptom | Root Cause | Fix |
|---|-------|-----------|---------|-----------|-----|

## Files Modified
(none yet)

## Key Decisions
(none yet)

## Blockers
(none)
```

Fill in the goal, date, and current git branch. Then proceed to **Step 3: Activate Protocol**.

---

## Step 2B: Resume Mode — Continue an Existing Run

The user wants to resume. Parse what follows `resume`:

### If a file path was provided:
Read the progress file at that path. Proceed to **Step 2B.2**.

### If no path was provided:
Scan `docs/resilient-run/` for existing runs:
```
ls -d docs/resilient-run/*/
```
For each directory found, read the first 10 lines of `PROGRESS.md` to extract the goal and status.

Present the runs to the user via AskUserQuestion:
- Show each run with its goal and current status
- Let them pick which to resume

### 2B.2: Understand Current State

Read the ENTIRE progress file. Analyze:
1. **Goal** — what are we trying to achieve?
2. **Status** — is it IN PROGRESS, BLOCKED, or something else?
3. **Current Phase** — where did we leave off?
4. **Completed** — what's already done? Do NOT redo this work.
5. **Bugs Found** — what issues have we already discovered and fixed?
6. **Files Modified** — what files have we already changed?
7. **Blockers** — is anything blocking progress?

Report to the user: "Resuming resilient run: **<goal>**. Currently at Phase <N> — <phase name>. <brief summary of what's done and what's next>."

Proceed to **Step 3: Activate Protocol**.

---

## Step 2C: Discovery Mode — No Arguments

If the user ran `/resilient-run` with no arguments:

Check if any runs exist:
```
ls -d docs/resilient-run/*/
```

- If runs exist → show them and ask: "Resume an existing run, or start a new one?"
- If no runs exist → ask: "What's the goal for your new resilient run?"

Route to the appropriate mode based on the user's answer.

---

## Step 3: Activate the Resilient Run Protocol

**THIS IS THE MOST CRITICAL SECTION. These behavioral rules govern your actions for the ENTIRE remainder of this session.**

### 🔴 MANDATORY CHECKPOINT RULES

You MUST update the progress file (`docs/resilient-run/<slug>/PROGRESS.md`) after EACH of these events:

1. **Bug/issue discovered** — Add a numbered row to the "Bugs Found & Fixed" table immediately. Include the symptom and component. Root cause and fix can be added when resolved.

2. **Bug/issue fixed** — Update the existing row with root cause and fix description.

3. **File modified** — Add the file path and a brief description to "Files Modified".

4. **Phase completed** — Move the phase description to "Completed" with a result summary. Update "Current Phase" to the next phase.

5. **Key decision made** — Add to "Key Decisions" with rationale.

6. **Blocker encountered** — Add to "Blockers". If resolved, move to "Key Decisions" or "Completed".

7. **Plan refined** — Update the "Plan" section as you learn more about what needs to be done.

8. **Every 3-5 significant actions** — Even if none of the above triggers fired, do a general checkpoint to update status and current state.

### 🔴 CHECKPOINT FORMAT

When checkpointing, use the Edit tool to surgically update specific sections. Do NOT rewrite the entire file — append to existing sections. This preserves history.

### 🔴 AFTER CONTEXT COMPACTION

If you feel uncertain about what you've already done, or if the conversation seems to have lost context:

1. **STOP what you're doing**
2. **Re-read the entire progress file**
3. **Resume from where the file says you are**
4. Do NOT redo work that the progress file shows as completed

### 🔴 GOAL PERSISTENCE

The goal is in the progress file, not in your conversation memory. If you ever lose track of what you're doing:
- Read the progress file
- The `## Goal` section tells you what "done" looks like
- The `## Current Phase` section tells you where you are
- The `## Completed` section tells you what's already done

### 🔴 STATUS UPDATES

Update the `## Status` line when:
- Work is progressing normally: `## Status: IN PROGRESS`
- A blocker is hit: `## Status: BLOCKED — <reason>`
- All work is complete: `## Status: COMPLETE`
- Run is paused for user input: `## Status: PAUSED — Awaiting <what>`

### 🔴 COMPLETION

When the goal is fully achieved:
1. Update status to `## Status: COMPLETE`
2. Write a `## Summary` section at the bottom with:
   - Total bugs found and fixed
   - Total files modified
   - Key outcomes
   - Duration (if trackable)
3. Tell the user the resilient run is complete

---

## Now: Begin Working

You have activated the resilient run protocol. The progress file is your flight recorder.

**If this is a new run (Init Mode):**
Start by analyzing the goal, filling in the Plan section, and then begin Phase 1. Checkpoint as you go.

**If this is a resume (Resume Mode):**
You already analyzed the current state in Step 2B.2. Pick up exactly where the progress file says you left off. Do NOT redo completed work.

Begin now. The goal is in the progress file. Go.

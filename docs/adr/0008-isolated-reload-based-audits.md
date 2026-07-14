# 0008 — Isolate reload-based audits from the active pane

Date: 2026-07-13
Status: accepted

## Context

A Page SEO audit must describe the active pane without changing the page state the user chose to inspect. Reload-based assessments such as Lighthouse are valuable supporting evidence, but running them against the visible pane would disturb navigation, form state, scroll position, emulation, and runtime evidence.

## Decision

The default Page SEO audit observes the active pane without reloading or mutating it. Assessments that require a reload or invasive instrumentation run only through an explicit user action in an isolated hidden audit target, and their results remain separately attributed to that load, tool version, and configuration. Authenticated session access requires explicit confirmation, and hidden-target traffic never enters the active pane's Diagnostics evidence.

## Consequences

Reload-based assessments may differ from the interactive page and must say so. The app accepts the additional lifecycle and resource cost of an isolated target in exchange for preserving the user's observed state and keeping evidence ownership coherent.

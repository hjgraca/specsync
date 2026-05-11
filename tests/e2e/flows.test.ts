import { test, expect } from "@playwright/test";

const BASE = "http://localhost:4000";

test.describe("Q&A golden path", () => {
  test("creates session, answers questions, and completes", async ({ page }) => {
    // Create a Q&A session via the API
    const res = await fetch(`${BASE}/qa/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E Test Q&A",
        questions: [
          {
            id: "q1",
            title: "Preferred database",
            type: "single-select",
            options: [
              { key: "pg", label: "PostgreSQL" },
              { key: "mysql", label: "MySQL" },
            ],
          },
          {
            id: "q2",
            title: "Additional requirements",
            type: "free-text",
          },
        ],
      }),
    });

    const session = await res.json();
    expect(session.id).toBeDefined();
    expect(session.token).toBeDefined();

    // Navigate to the session page
    await page.goto(`/qa/${session.id}?token=${session.token}`);

    // Verify title renders
    await expect(page.locator("h1")).toContainText("E2E Test Q&A");

    // Verify questions render
    await expect(page.getByText("Preferred database")).toBeVisible();
    await expect(page.getByText("Additional requirements")).toBeVisible();

    // Answer question 1: select a radio option and submit
    await page.getByLabel("PostgreSQL").check();
    await page.getByRole("button", { name: "Submit Answer" }).first().click();

    // Verify answered state shows green checkmark
    await expect(page.getByText("✓").first()).toBeVisible();

    // Answer question 2: fill free-text and submit
    await page.getByPlaceholder("Type your answer...").fill("Must support transactions");
    await page.getByRole("button", { name: "Submit Answer" }).click();

    // Verify completion state
    await expect(page.getByText("All questions answered")).toBeVisible();
  });
});

test.describe("Review golden path", () => {
  test("creates document, renders content, and approves", async ({ page }) => {
    // Create a document via the API
    const res = await fetch(`${BASE}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E Review Doc",
        markdown: "# Architecture\n\nThis document describes the system architecture.",
      }),
    });

    const doc = await res.json();
    expect(doc.slug).toBeDefined();
    expect(doc.accessToken).toBeDefined();
    expect(doc.docUrl).toBeDefined();

    // Navigate to the document review page
    await page.goto(`/review/${doc.slug}?token=${doc.accessToken}`);

    // Verify the document title shows
    await expect(page.locator("h1")).toContainText("E2E Review Doc");

    // Verify markdown content renders (check for heading text)
    await expect(page.getByText("Architecture")).toBeVisible();
    await expect(page.getByText("system architecture")).toBeVisible();

    // Verify comment sidebar exists
    await expect(page.getByText("No comments yet")).toBeVisible();

    // Click Approve button
    await page.getByRole("button", { name: "Approve" }).click();

    // Verify approval state: the approval bar disappears (status is no longer active)
    await expect(page.getByRole("button", { name: "Approve" })).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Presence", () => {
  test("shows codename in presence bar", async ({ page }) => {
    // Create a Q&A session
    const res = await fetch(`${BASE}/qa/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Presence Test",
        questions: [
          {
            id: "q1",
            title: "Pick one",
            type: "single-select",
            options: [{ key: "a", label: "Option A" }],
          },
        ],
      }),
    });

    const session = await res.json();

    // Navigate to the session
    await page.goto(`/qa/${session.id}?token=${session.token}`);

    // Wait for the presence bar to appear and verify codename pattern (word-word (you))
    await expect(
      page.getByText(/\w+-\w+ \(you\)/)
    ).toBeVisible({ timeout: 10_000 });
  });
});

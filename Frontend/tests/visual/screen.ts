import type { Page } from "@playwright/test";

export async function showWholeScreen(page: Page) {
  const height = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      ...Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => getComputedStyle(el).overflowY === "auto")
        .map((el) => el.scrollHeight),
    ),
  );
  await page.setViewportSize({ width: page.viewportSize()!.width, height });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (getComputedStyle(el).overflowY === "auto") el.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

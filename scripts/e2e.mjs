/*
 * End-to-end check of the main workflow in a real browser:
 * new inquiry (two kids) → log contact → book trial → attended → enroll,
 * plus a drag on the pipeline board. Run against `npx vite preview --port 4173`.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://localhost:4173";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (s) => console.log("✓", s);
const expectText = async (t) => { await page.getByText(t).first().waitFor({ timeout: 4000 }); };

await page.goto(BASE + "/leads");
await page.getByRole("button", { name: "New inquiry" }).click();
await page.getByLabel("Parent first name").fill("Testy");
await page.getByLabel("Last name", { exact: true }).fill("Mcfakerson");
await page.getByLabel("Phone", { exact: true }).fill("610-555-0199");
await page.getByLabel("First name", { exact: true }).fill("Alpha");
await page.getByLabel("Age", { exact: true }).fill("8");
await page.getByRole("button", { name: "Add another child" }).click();
await page.getByLabel("First name", { exact: true }).nth(1).fill("Beta");
await page.getByLabel("Age", { exact: true }).nth(1).fill("5");
await page.getByRole("button", { name: "Add inquiry" }).click();
await expectText("2 inquiries added");
await expectText("Alpha Mcfakerson");
step("added a two-child inquiry; the first child's panel opened");

await page.getByRole("dialog").getByRole("button", { name: "Log contact" }).first().click();
await page.getByLabel("What happened", { exact: true }).selectOption("reached");
await page.getByLabel("Notes", { exact: true }).fill("Spoke with Testy; wants a trial for both.");
await page.getByRole("button", { name: "Log contact" }).last().click();
await expectText("Contact logged");
await page.getByRole("tab", { name: /Contact history/ }).click();
await expectText("Spoke with Testy");
step("logged a contact for both siblings; stage moved to Contacted");

await page.getByRole("tab", { name: "Overview" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Book trial" }).click();
await page.getByRole("button", { name: "Book trial" }).last().click();
await expectText("Trial booked");
await page.getByRole("tab", { name: /Trials/ }).click();
await page.getByRole("button", { name: "Attended" }).first().click();
await expectText("Trial marked attended");
step("booked a trial and marked it attended");

await page.getByRole("tab", { name: "Overview" }).click();
await page.getByRole("button", { name: "Enroll" }).first().click();
await page.getByLabel("Membership", { exact: true }).selectOption("12 Month Program");
await page.getByLabel("Payment", { exact: true }).selectOption("PIF");
await expectText("$2,164.50"); // $195 × 12 = $2,340, minus 7.5% = $2,164.50
await page.getByRole("button", { name: "Enroll" }).last().click();
await expectText("Alpha enrolled");
step("enrolled with a paid-in-full 12 month price computed from the price list");

await page.getByRole("tab", { name: "Family" }).click();
await expectText("Beta Mcfakerson");
step("family tab shows the sibling still in the pipeline");

await page.setViewportSize({ width: 1900, height: 1000 });
await page.goto(BASE + "/pipeline");
const card = page.locator(".card", { hasText: "Beta Mcfakerson" });
await card.dragTo(page.locator("section.col[aria-label^=\"Decision pending\"]"));
await expectText("Beta moved to Decision pending");
step("dragged a card to Decision pending on the pipeline board");

await page.getByLabel("Move Beta Mcfakerson to another stage").selectOption("nurture");
await page.getByRole("button", { name: "Move to Nurture" }).click();
await expectText("Moved to Nurture");
step("moved a card with its Move menu; Nurture asked for a reconnect date");
await page.setViewportSize({ width: 1360, height: 900 });

await page.goto(BASE + "/families");
await page.getByLabel("Search families").fill("Mcfakerson");
await page.locator("tbody tr").first().click();
await expectText("12 Month Program, paid in full");
step("family page shows the new membership");

await page.reload();
await expectText("12 Month Program, paid in full");
step("changes survive a reload");

await browser.close();
if (errors.length) { console.error(errors); process.exit(1); }
console.log("End-to-end workflow passed");

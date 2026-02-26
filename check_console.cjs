const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', error => console.log(`[Browser Page Error] ${error.message}`));

    try {
        console.log("Navigating to http://localhost:4173...");
        await page.goto('http://localhost:4173/');
        await page.waitForTimeout(2000);

        console.log("Filling login form...");
        await page.fill('input[type="email"]', 'playwright_test1@example.com');
        await page.fill('input[type="password"]', 'testpassword123');

        console.log("Submitting login...");
        await page.click('button[type="submit"]');

        console.log("Waiting for navigation to dashboard...");
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'screenshot_dashboard.png' });
        console.log("Saved screenshot_dashboard.png");
    } catch (e) {
        console.error("Failed to load page", e);
    } finally {
        await browser.close();
    }
})();

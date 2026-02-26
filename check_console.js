const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`[Browser Console Error] ${msg.text()}`);
        } else {
            console.log(`[Browser Console] ${msg.text()}`);
        }
    });

    page.on('pageerror', error => {
        console.log(`[Browser Page Error] ${error.message}`);
    });

    try {
        console.log("Navigating to http://localhost:4173...");
        await page.goto('http://localhost:4173/');
        await page.waitForTimeout(3000);
    } catch (e) {
        console.error("Failed to load page", e);
    } finally {
        await browser.close();
    }
})();

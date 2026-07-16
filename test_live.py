from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Collect console errors
    errors = []
    page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))
    page.on("console", lambda msg: errors.append(f"CONSOLE [{msg.type}]: {msg.text}") if msg.type == "error" else None)
    
    page.goto("https://seo-nine-phi.vercel.app/")
    page.wait_for_load_state("networkidle")
    
    print("=== PAGE LOADED ===")
    print(f"Title: {page.title()}")
    
    # Take screenshot of initial state
    page.screenshot(path="/tmp/before_click.png", full_page=True)
    print("Screenshot saved: /tmp/before_click.png")
    
    # Find and click the analyze button
    buttons = page.get_by_role("button").all()
    print(f"\n=== BUTTONS ({len(buttons)}) ===")
    for b in buttons:
        text = b.text_content()
        print(f"  Button: '{text}' visible={b.is_visible()}")
    
    # Try to find the main form submit button
    analyze_btn = page.get_by_role("button", name="Launch SEO Niche Analysis")
    if analyze_btn.count() > 0:
        print("\n=== CLICKING ANALYZE ===")
        analyze_btn.click()
        
        # Wait for analysis to complete
        page.wait_for_timeout(8000)
        page.screenshot(path="/tmp/after_click.png", full_page=True)
        print("Screenshot saved: /tmp/after_click.png")
        
        # Check page content
        content = page.content()
        print(f"\nPage content length: {len(content)}")
        
        # Check for key elements
        print(f"Has 'DashboardOverview': {'DashboardOverview' in content}")
        print(f"Has 'Competitive Intelligence': {'Competitive Intelligence' in content}")
    else:
        print("\n=== ANALYZE BUTTON NOT FOUND ===")
        # Try alternate selectors
        btn = page.locator("button:has-text('Analyze')")
        print(f"Alternate 'Analyze' buttons: {btn.count()}")
        if btn.count() > 0:
            print(f"First match text: '{btn.first.text_content()}'")
    
    print(f"\n=== ERRORS ({len(errors)}) ===")
    for e in errors:
        print(f"  {e}")
    
    browser.close()

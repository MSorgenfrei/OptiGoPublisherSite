(() => {
    // Get the current page URL to store per-page access
    const pageKey = `paywallPassed_${window.location.pathname}`;

    // Only run the paywall if the user hasn't completed it for this page
    if (sessionStorage.getItem(pageKey)) return;

    // Create modal HTML
    const modalHTML = `
        <div id="paywall-overlay" 
        style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
        display: flex; justify-content: center; align-items: center; z-index: 9999;
        background: rgba(0, 0, 0, 0.7); ">
            <div id="paywall-modal" 
            style="background: white; padding: 20px; width: 90%; max-width: 400px; text-align: center; border-radius: 10px;">
                <div id="paywall-step-1">
                    <p>Enjoying this content? Continue reading!</p>
                    <button id="paywall-continue" style="padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer;">Continue</button>
                </div>
                <div id="paywall-step-2" style="display: none;">
                    <p>Enter your name to continue:</p>
                    <input type="text" id="paywall-name" style="width: 100%; padding: 8px;" />
                    <button id="paywall-name-btn" style="margin-top: 10px; padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer;">Next</button>
                </div>
                <div id="paywall-step-3" style="display: none;">
                    <p>Enter your email:</p>
                    <input type="email" id="paywall-email" style="width: 100%; padding: 8px;" />
                    <button id="paywall-submit" style="margin-top: 10px; padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer;">Finish</button>
                </div>
            </div>
        </div>
    `;

    // Inject modal into the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.filter = "none";
    
    // Element references
    const overlay = document.getElementById("paywall-overlay");
    const step1 = document.getElementById("paywall-step-1");
    const step2 = document.getElementById("paywall-step-2");
    const step3 = document.getElementById("paywall-step-3");
    
    document.getElementById("paywall-continue").addEventListener("click", () => {
        step1.style.display = "none";
        step2.style.display = "block";
    });

    document.getElementById("paywall-name-btn").addEventListener("click", () => {
        step2.style.display = "none";
        step3.style.display = "block";
    });

    document.getElementById("paywall-submit").addEventListener("click", () => {
        sessionStorage.setItem('paywallPassed', 'true');
        overlay.remove();
        document.body.style.filter = "none";
    });

    // Scroll detection (trigger at 25% scroll)
    window.addEventListener("scroll", () => {
        if ((window.scrollY / document.documentElement.scrollHeight) > 0.25) {
            overlay.style.display = "flex";
            document.body.style.filter = "blur(5px)";
        }
    }, { once: true });
})();

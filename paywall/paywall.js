(() => {
    // Get the current page URL to store per-page access
    const pageKey = `paywallPassed_${window.location.pathname}`;

    // Only run the paywall if the user hasn't completed it for this page
    if (sessionStorage.getItem(pageKey)) return;

    // Create modal HTML
    const modalHTML = `
        <div id="paywall-overlay">
            <div id="paywall-modal">
                <div id="paywall-step-1">
                    <h1 class="paywall-header">Pay As You Go.</h1>
                    <h2 class="paywall-subheader">No subscriptions. No surprises.</p>
                    <button id="paywall-continue">REVEAL ARTICLE $0.49</button>
                    <p class="paywall-body">Powered by OptiGo</p>
                </div>
                <div id="paywall-step-2" class="hidden">
                    <h1>Pay As You Go.</h1>
                    <p>No subscriptions. No surprises.</p>
                    <p>Enter your name to continue:</p>
                    <input type="text" id="paywall-name" />
                    <button id="paywall-name-btn">Next</button>
                </div>
                <div id="paywall-step-3" class="hidden">
                    <p>Enter your email:</p>
                    <input type="email" id="paywall-email" />
                    <button id="paywall-submit">Finish</button>
                </div>
            </div>
        </div>
    `;

    // Inject modal into the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.filter = "none";
    
    // Element references
    const overlay = document.getElementById("paywall-overlay");
    const modal = document.getElementById("paywall-modal");
    const step1 = document.getElementById("paywall-step-1");
    const step2 = document.getElementById("paywall-step-2");
    const step3 = document.getElementById("paywall-step-3");
    
    document.getElementById("paywall-continue").addEventListener("click", () => {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
    });

    document.getElementById("paywall-name-btn").addEventListener("click", () => {
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
    });

    document.getElementById("paywall-submit").addEventListener("click", () => {
        sessionStorage.setItem(pageKey, 'true');
        overlay.remove();
        document.body.style.filter = "none";
    });

    // Function to show the paywall when scrolling below 25% of the page
    function checkScroll() {
        const scrollPosition = window.scrollY;
        const pageHeight = document.documentElement.scrollHeight;

        // If user scrolls below 25% of the total page height, show paywall
        if (scrollPosition > (pageHeight * 0.25)) {
            overlay.style.display = "flex";
            modal.style.display = "block";
            document.getElementById("paywall-overlay").style.backdropFilter = "blur(5px)";
            window.removeEventListener("scroll", checkScroll); // Remove event listener once triggered
        }
    }

    // Attach scroll event listener
    window.addEventListener("scroll", checkScroll);
})();


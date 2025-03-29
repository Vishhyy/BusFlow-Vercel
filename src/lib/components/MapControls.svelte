<script>
    import { isBusListPopupOpen } from '$lib/stores.js';

    // URLs
    const umoAppUrl = "https://play.google.com/store/apps/details?id=com.cubic.ctp.app"; // Example Android URL
    const umoWebsiteUrl = "https://umomobility.com"; // Fallback/info website
    const donationUrl = "https://www.paypal.com/donate/?business=83A9DBK7SWS4E&no_recurring=0&item_name=Thank+you+for+your+support+%21+¤cy_code=CAD";
    const umoIconUrl = "https://play-lh.googleusercontent.com/tiVl9bt_gtLWAOBdk0Y3Wh9FYYCzXIdyBhtheH_aw_IKYpF9mfMgQ2wXgQTKdL5OxA"; // Check if this URL is stable

    function openUmo() {
        // Try opening app link, fallback to website (simple version)
        window.open(umoAppUrl, '_blank');
        // More sophisticated app linking might be needed for iOS/Android specifics
    }

    function openDonation() {
        window.open(donationUrl, '_blank');
    }

    function toggleBusList() {
        $isBusListPopupOpen = !$isBusListPopupOpen;
        console.log(`🚌 Bus list popup toggled: ${$isBusListPopupOpen}`);
    }
</script>

<div class="map-controls-container">
    <!-- Umo App Button -->
    <button class="control-button umo-button" on:click={openUmo} title="Open Umo App">
        <img src={umoIconUrl} alt="Umo" class="control-icon" />
    </button>

    <!-- Donation Button -->
    <button class="control-button donation-button" on:click={openDonation} title="Donate">
        💲 <!-- Or a heart icon, etc. -->
    </button>

     <!-- Bus List Button -->
    <button class="control-button bus-list-button" on:click={toggleBusList} title="Show Bus Routes">
        🚌
    </button>
</div>

<style>
    .map-controls-container {
        position: absolute;
        bottom: 20px;
        left: 15px;
        z-index: 1001; /* Above map elements */
        display: flex;
        gap: 12px; /* Spacing between buttons */
    }

    .control-button {
        width: 55px; /* Slightly smaller */
        height: 55px;
        border-radius: 50%;
        border: none;
        background-color: white;
        box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 24px; /* For emoji icons */
        transition: background-color 0.2s ease, transform 0.1s ease;
        overflow: hidden; /* Ensure image stays within bounds */
    }
    .control-button:hover {
        background-color: #f0f0f0;
    }
    .control-button:active {
        transform: scale(0.95);
    }

    .dark-mode-toggle {
         background-color: #444;
         color: white;
    }
    :global(body.dark-mode) .dark-mode-toggle { /* Style differently in dark mode if needed */
        background-color: #eee;
        color: #333;
    }

    .umo-button {
        padding: 5px; /* Give image some space */
    }
    .control-icon {
        width: 85%;
        height: 85%;
        object-fit: contain;
        border-radius: 50%; /* Make icon image round */
    }

    .donation-button {
        background-color: #FFD700; /* Gold */
        color: #333; /* Darker emoji for contrast */
        font-size: 28px;
    }
    .donation-button:hover {
         background-color: #ffec80;
    }

    .bus-list-button {
        background-color: #3498db; /* Blue */
        color: white;
         font-size: 28px;
    }
     .bus-list-button:hover {
         background-color: #5dade2;
     }
</style>
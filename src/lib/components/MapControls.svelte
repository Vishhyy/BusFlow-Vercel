<script>
    import { isBusListPopupOpen } from '$lib/stores.js';
    import { onDestroy } from 'svelte';

    // --- URLs & Constants ---
    const UMO_PLAY_STORE_URL_ANDROID = "https://play.google.com/store/apps/details?id=com.cubic.ctp.app&pcampaignid=web_share";
    const UMO_APP_STORE_URL_IOS = "https://apps.apple.com/app/umo-mobility/id1540611257";
    const UMO_WEBSITE_URL_FALLBACK = "https://umomobility.com/";
    const donationUrl = "https://www.paypal.com/donate/?business=83A9DBK7SWS4E&no_recurring=0&item_name=Thank+you+for+your+support+%21+currency_code=CAD";
    const umoIconUrl = "/icons/umo_icon.webp"; // Using local icon
    const instagramUrl = "https://www.instagram.com/your_instagram_profile"; // ** REPLACE **

    // Music Service Configuration
    const musicServices = [
        { name: "Spotify", url: "https://open.spotify.com/your_profile", icon: "🎧" },     // ** REPLACE **
        { name: "Apple Music", url: "https://music.apple.com/your_profile", icon: "" },  // ** REPLACE **
        { name: "YouTube Music", url: "https://music.youtube.com/your_channel", icon: "▶️" } // ** REPLACE **
    ];
    let showMusicPopup = false;
    let musicButtonElement; // Bound to the music button

    // --- Event Handlers ---
    function openUmo() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) { window.open(UMO_APP_STORE_URL_IOS, '_blank'); }
        else if (/android/i.test(userAgent)) { window.open(UMO_PLAY_STORE_URL_ANDROID, '_blank'); }
        else { window.open(UMO_WEBSITE_URL_FALLBACK, '_blank'); }
    }
    function openDonation() { window.open(donationUrl, '_blank'); }
    function openInstagram() { window.open(instagramUrl, '_blank'); }

    function toggleBusList() {
        $isBusListPopupOpen = !$isBusListPopupOpen;
        console.log('MapControls: $isBusListPopupOpen toggled to:', $isBusListPopupOpen);
    }

    function toggleMusicPopup() { // Event parameter is implicitly passed by on:click
        showMusicPopup = !showMusicPopup;
        console.log('MapControls: showMusicPopup toggled to:', showMusicPopup);
    }

    function openMusicService(url) {
        window.open(url, '_blank');
        showMusicPopup = false;
    }

    // Click Outside to Close Music Popup ONLY
    function handleClickOutside(event) {
        if (!showMusicPopup) return; // Only act if music popup is actually shown

        const clickedMusicButton = musicButtonElement && musicButtonElement.contains(event.target);
        // Query for the popup element only when needed, as it might not be in the DOM
        const musicPopupElementQuery = document.querySelector('.music-service-popup');
        const clickedInsideMusicPopup = musicPopupElementQuery && musicPopupElementQuery.contains(event.target);

        if (!clickedMusicButton && !clickedInsideMusicPopup) {
            console.log("MapControls: Clicked outside music button/popup, closing music popup.");
            showMusicPopup = false;
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('click', handleClickOutside, true);
    }
    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('click', handleClickOutside, true);
        }
    });
</script>

<div class="map-controls-container">
    <div class="control-button-stack">
        <button class="control-button stacked-item instagram-button" on:click={openInstagram} title="Follow on Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather-icon"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        </button>
        <div class="music-button-container">
            <button bind:this={musicButtonElement} class="control-button stacked-item music-button" on:click|stopPropagation={toggleMusicPopup} title="Choose Music Service">🎵</button>
            {#if showMusicPopup}
                <div class="music-service-popup"> <!-- No bind:this needed here for this handleClickOutside version -->
                    <p class="popup-title">Choose a service:</p>
                    {#each musicServices as service (service.name)}
                        <button class="music-service-option" on:click={() => openMusicService(service.url)}>
                            <span class="service-icon">{service.icon}</span> {service.name}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <button class="control-button umo-button" on:click={openUmo} title="Open Umo App">
            <img src={umoIconUrl} alt="Umo" class="control-icon" />
        </button>
    </div>
    <button class="control-button donation-button" on:click={openDonation} title="Donate">💲</button>
    <button class="control-button bus-list-button" on:click={toggleBusList} title="Show Bus Routes">🚌</button>
</div>

<style>
    .map-controls-container { position: absolute; bottom: 20px; left: 15px; z-index: 1001; display: flex; align-items: flex-end; gap: 12px; }
    .control-button-stack { display: flex; flex-direction: column-reverse; gap: 8px; align-items: center; }
    .control-button { width: 50px; height: 50px; border-radius: 50%; border: none; background-color: white; box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.25); cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 26px; transition: background-color 0.2s ease, transform 0.1s ease; overflow: hidden; padding: 0; }
    .control-button:hover { background-color: #f0f0f0; }
    .control-button:active { transform: scale(0.95); }
    .stacked-item { width: 40px; height: 40px; font-size: 22px; }
    .stacked-item .feather-icon { width: 55%; height: 55%; stroke: white; }
    .umo-button {}
    .control-icon { width: 90%; height: 90%; object-fit: contain; border-radius: 50%; }
    .instagram-button { background-color: #E1306C; }
    .music-button { background-color: #1DB954; color: white; }
    .donation-button { background-color: #FFC107; color: #424242; }
    .bus-list-button { background-color: #2196F3; color: white; }
    .music-button-container { position: relative; display: flex; justify-content: center; z-index: 10; }
    .music-service-popup { position: absolute; left: 50%; transform: translateX(-50%); background-color: white; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 10px; z-index: 1010; width: max-content; min-width: 150px; }
    .music-service-popup.position-above-button { bottom: calc(100% + 5px); } /* these classes are for dynamic JS positioning */
    .music-service-popup.position-below-button { top: calc(100% + 5px); }
    :global(body.dark-mode) .music-service-popup { background-color: #333; border-color: #555; color: #eee; }
    .popup-title { margin-top: 0; margin-bottom: 8px; font-size: 0.9em; font-weight: bold; color: #555; }
    :global(body.dark-mode) .popup-title { color: #bbb; }
    .music-service-option { display: flex; align-items: center; width: 100%; padding: 8px 10px; margin-bottom: 5px; border: none; background-color: #f0f0f0; color: #333; text-align: left; cursor: pointer; border-radius: 4px; font-size: 0.9em; }
    .music-service-option:last-child { margin-bottom: 0; }
    .music-service-option:hover { background-color: #e0e0e0; }
    :global(body.dark-mode) .music-service-option { background-color: #444; color: #eee; }
    :global(body.dark-mode) .music-service-option:hover { background-color: #555; }
    .service-icon { margin-right: 8px; font-size: 1.1em; }
</style>
<script>
    import { isBusListPopupOpen } from '$lib/stores.js';
    import { onDestroy, tick } from 'svelte';

    // --- URLs & Constants ---
    const UMO_PLAY_STORE_URL_ANDROID = "https://play.google.com/store/apps/details?id=com.cubic.ctp.app&pcampaignid=web_share";
    const UMO_APP_STORE_URL_IOS = "https://apps.apple.com/app/umo-mobility/id1540611257";
    const UMO_WEBSITE_URL_FALLBACK = "https://umomobility.com/";
    const donationUrl = "https://www.paypal.com/donate/?business=83A9DBK7SWS4E&no_recurring=0&item_name=Thank+you+for+your+support+%21+currency_code=CAD";
    const umoIconUrl = "/icons/umo_icon.webp";
    const instagramUrl = "https://www.instagram.com"; // ** REPLACE **

    const musicServices = [
        { name: "Spotify", url: "https://open.spotify.com", icon: "🎧" },     // ** REPLACE **
        { name: "Apple Music", url: "https://music.apple.com", icon: "" },  // ** REPLACE **
        { name: "YouTube Music", url: "https://music.youtube.com", icon: "▶️" } // ** REPLACE **
    ];
    let showMusicPopup = false;
    let musicButtonElement;
    let musicPopupElement;

    // --- Event Handlers ---
    function openUmo() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) { window.open(UMO_APP_STORE_URL_IOS, '_blank'); }
        else if (/android/i.test(userAgent)) { window.open(UMO_PLAY_STORE_URL_ANDROID, '_blank'); }
        else { window.open(UMO_WEBSITE_URL_FALLBACK, '_blank'); }
    }
    function openDonation() { window.open(donationUrl, '_blank'); }
    function toggleBusList() { $isBusListPopupOpen = !$isBusListPopupOpen; }
    function openInstagram() { window.open(instagramUrl, '_blank'); }

    async function toggleMusicPopup() {
        showMusicPopup = !showMusicPopup;
        if (showMusicPopup) {
            await tick();
            if (musicButtonElement && musicPopupElement) {
                const buttonRect = musicButtonElement.getBoundingClientRect();
                const popupHeight = musicPopupElement.offsetHeight;
                const spaceAbove = buttonRect.top;
                const spaceBelow = window.innerHeight - buttonRect.bottom;
                if (spaceAbove < (popupHeight + 10) && spaceBelow > spaceAbove) {
                    musicPopupElement.classList.add('position-below');
                    musicPopupElement.classList.remove('position-above');
                } else {
                    musicPopupElement.classList.add('position-above');
                    musicPopupElement.classList.remove('position-below');
                }
            }
        }
    }
    function openMusicService(url) { window.open(url, '_blank'); showMusicPopup = false; }
    function handleClickOutside(event) {
        if (showMusicPopup && musicButtonElement && !musicButtonElement.contains(event.target) &&
            musicPopupElement && !musicPopupElement.contains(event.target)) {
            showMusicPopup = false;
        }
    }
    if (typeof window !== 'undefined') { window.addEventListener('click', handleClickOutside, true); }
    onDestroy(() => { if (typeof window !== 'undefined') { window.removeEventListener('click', handleClickOutside, true); } });
</script>

<div class="map-controls-container">
    <div class="control-button-stack">
        <button class="control-button instagram-button" on:click={openInstagram} title="Follow on Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather-icon"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        </button>
        <div class="music-button-container">
            <button bind:this={musicButtonElement} class="control-button music-button" on:click|stopPropagation={toggleMusicPopup} title="Choose Music Service">🎵</button>
            {#if showMusicPopup}
                <div bind:this={musicPopupElement} class="music-service-popup">
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
    .map-controls-container {
        position: absolute;
        bottom: 20px;
        left: 15px;
        z-index: 1001;
        display: flex;
        align-items: flex-end;
        gap: 12px;
    }

    .control-button-stack {
        display: flex;
        flex-direction: column-reverse;
        gap: 8px;
        align-items: center;
    }

    .control-button {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: none;
        background-color: white;
        box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 26px;
        transition: background-color 0.2s ease, transform 0.1s ease;
        overflow: hidden;
        padding: 0;
    }
    .control-button:hover { background-color: #f0f0f0; }
    .control-button:active { transform: scale(0.95); }

    .control-button .feather-icon {
        width: 60%;
        height: 60%;
        stroke: white;
    }
    .umo-button { /* No padding needed if control-icon handles size well */ }
    .control-icon {
        width: 90%;
        height: 90%;
        object-fit: contain;
        border-radius: 50%;
    }

    .instagram-button { background-color: #E1306C; }
    .music-button { background-color: #1DB954; color: white; }
    .donation-button { background-color: #FFC107; color: #424242; }
    .bus-list-button { background-color: #2196F3; color: white; }

    .music-button-container {
        position: relative; /* Essential for absolute positioning of the popup */
        display: flex;
        justify-content: center;
        /* z-index: 10; /* Keep if needed to ensure it's above other elements in the stack if they also get z-index */
    }

    .music-service-popup {
        position: absolute;
    left: calc(100% + 8px); /* Position to the right of the parent, 8px gap */
    /* Vertical alignment will be controlled by .position-above-button or .position-below-button */
    /* but we can set a default centering attempt here using transform */
    top: 50%; /* Attempt to start from the vertical middle of .music-button-container */
    transform: translateY(-50%); /* Pull it up by half its own height to truly center it */

        background-color: white;
        border: 1px solid #ccc;
        border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        padding: 10px;
        z-index: 1010; /* Ensure it's on top */
        width: max-content;
        min-width: 150px;
    }

    /* These classes will now primarily control vertical alignment */
    .music-service-popup.position-above-button { /* Renamed for clarity */
        bottom: 0; /* Align bottom of popup with (roughly) bottom of music button */
        /* Adjust if music button isn't perfectly centered in its container: */
        /* bottom: -5px; /* Example: if music button is 40px, container might be slightly different */
        top: auto;
    }
    .music-service-popup.position-below-button { /* Renamed for clarity */
        top: 0; /* Align top of popup with (roughly) top of music button */
        bottom: auto;
    }
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
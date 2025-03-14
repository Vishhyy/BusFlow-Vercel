<script>
    export let routes = [];
    export let isOpen = false;
    export let closeSidebar;

    function handleRouteClick(route) {
        console.log("Selected route:", route);
        closeSidebar();
    }
</script>

<style>
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        width: 250px;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px;
        overflow-y: auto;
        transition: transform 0.3s ease-in-out;
        z-index: 1000;
    }

    .sidebar.hidden {
        transform: translateX(-100%);
    }

    .sidebar.open {
        transform: translateX(0);
    }

    .sidebar h2 {
        font-size: 20px;
        margin-bottom: 10px;
    }

    .route-list {
        list-style: none;
        padding: 0;
    }

    .route-item {
        background: #333;
        padding: 12px;
        margin: 6px 0;
        cursor: pointer;
        border-radius: 5px;
        text-align: center;
        transition: background 0.3s ease-in-out;
        font-size: 16px;
    }

    .route-item:hover {
        background: #555;
    }

    .close-btn {
        background: red;
        color: white;
        border: none;
        padding: 10px;
        cursor: pointer;
        display: block;
        width: 100%;
        text-align: center;
        margin-top: 15px;
        font-weight: bold;
        border-radius: 5px;
    }

    .close-btn:hover {
        background: darkred;
    }
</style>

<!-- Sidebar Container -->
<div class="sidebar {isOpen ? 'open' : 'hidden'}">
    <h2>Routes</h2>
    <ul class="route-list">
        {#each routes as route}
            <li class="route-item" role="button" on:click={() => handleRouteClick(route)}>
                {route}
            </li>
        {/each}
    </ul>
    <button class="close-btn" on:click={closeSidebar}>Close</button>
</div>

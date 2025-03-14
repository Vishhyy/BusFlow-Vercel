
<script lang="ts">
  import { onMount } from "svelte";

  let map;

  onMount(() => {
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 50.4501, lng: -104.6178 },
      zoom: 13,
    });
  });
</script>

<div id="map" style="width: 100%; height: 400px;"></div>


import { json } from '@sveltejs/kit';

export async function GET() {
    const busData = [
        { id: 1, route: "A1", lat: 50.45, lng: -104.61 },
        { id: 2, route: "B2", lat: 50.46, lng: -104.62 }
    ];

    return json(busData);
}

//loadDataset function

export async function loadDataset(datasetName) {
    try {
        let response = await fetch(`/get-data/${datasetName}`);
        let text = await response.text();  // Read raw text for debugging
        console.log(`📜 Raw response for ${datasetName}:`, text);

        let json = JSON.parse(text); // Parse as JSON

        if (!json.data) throw new Error("Missing 'data' field in response"); // Validate structure
        
        return json.data;  // Extract 'data' field
    } catch (error) {
        console.error(`❌ Failed to load ${datasetName}:`, error);
        return [];
    }
}
